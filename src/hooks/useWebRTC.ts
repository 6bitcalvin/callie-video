import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, SignalingMessage } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

type UserInfo = {
  displayName: string;
  avatarColor: string;
  colorTheme: string;
};

type IncomingCallData = {
  from: string;
  roomId: string;
  isVideo: boolean;
  participants: string[];
  fromUser: UserInfo;
};

export function useWebRTC(myUserId: string, myUserInfo?: UserInfo) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentCallTargets, setCurrentCallTargets] = useState<string[]>([]);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const callStateRef = useRef<CallState>('idle');
  const localStreamRef = useRef<MediaStream | null>(null);
  const allParticipantsRef = useRef<string[]>([]);
  const hasCreatedOfferFor = useRef<Set<string>>(new Set());

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const initializeMedia = useCallback(async (video: boolean = true, audio: boolean = true) => {
    try {
      setError(null);
      console.log('Initializing media - video:', video, 'audio:', audio);
      
      // Detect if mobile device
      const isMobile = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Set video constraints based on device type
      // Mobile: Portrait orientation (taller than wide)
      // Desktop: Landscape orientation (wider than tall)
      const videoConstraints = video ? {
        width: isMobile ? { ideal: 720 } : { ideal: 1280 },
        height: isMobile ? { ideal: 1280 } : { ideal: 720 },
        facingMode: 'user',
        aspectRatio: isMobile ? { ideal: 9/16 } : { ideal: 16/9 }
      } : false;
      
      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got media stream:', stream.id, 'isMobile:', isMobile);
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Failed to get media devices:', err);
      setError('Could not access camera/microphone. Please check permissions.');
      return null;
    }
  }, []);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream, roomId: string): RTCPeerConnection => {
    const existingPc = peerConnections.current.get(peerId);
    if (existingPc && existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
      console.log('Reusing existing peer connection for:', peerId);
      return existingPc;
    }

    console.log('Creating NEW peer connection for:', peerId);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    stream.getTracks().forEach((track) => {
      console.log('Adding track to peer', peerId, ':', track.kind);
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && callChannelRef.current) {
        console.log('Sending ICE candidate to:', peerId);
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'ice-candidate',
            from: myUserId,
            to: peerId,
            roomId: roomId,
            payload: event.candidate.toJSON(),
          } as SignalingMessage,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track from:', peerId, 'kind:', event.track.kind);
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(peerId, remoteStream);
        return newMap;
      });
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state with ' + peerId + ':', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectedPeers(prev => new Set([...prev, peerId]));
        setCallState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        handlePeerDisconnect(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state with ' + peerId + ':', pc.iceConnectionState);
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [myUserId]);

  const handlePeerDisconnect = useCallback((peerId: string) => {
    console.log('Peer disconnected:', peerId);
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(peerId);
    }
    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(peerId);
      return newMap;
    });
    setConnectedPeers(prev => {
      const newSet = new Set(prev);
      newSet.delete(peerId);
      return newSet;
    });
    pendingCandidates.current.delete(peerId);
    hasCreatedOfferFor.current.delete(peerId);
  }, []);

  const addPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const candidates = pendingCandidates.current.get(peerId);
    if (candidates && candidates.length > 0) {
      console.log('Adding', candidates.length, 'pending ICE candidates for:', peerId);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding pending ICE candidate:', err);
        }
      }
      pendingCandidates.current.delete(peerId);
    }
  }, []);

  const endCall = useCallback(() => {
    console.log('Ending call');
    
    peerConnections.current.forEach((pc, peerId) => {
      if (callChannelRef.current && currentRoomId) {
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'call-end',
            from: myUserId,
            to: peerId,
            roomId: currentRoomId,
          } as SignalingMessage,
        });
      }
      pc.close();
    });
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    hasCreatedOfferFor.current.clear();
    allParticipantsRef.current = [];

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }

    setLocalStream(null);
    localStreamRef.current = null;
    setRemoteStreams(new Map());
    setCallState('idle');
    setCurrentRoomId(null);
    setCurrentCallTargets([]);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setError(null);
    setConnectedPeers(new Set());
  }, [myUserId, currentRoomId]);

  const createAndSendOffer = useCallback(async (peerId: string, pc: RTCPeerConnection, roomId: string) => {
    if (hasCreatedOfferFor.current.has(peerId)) {
      console.log('Already created offer for:', peerId);
      return;
    }
    hasCreatedOfferFor.current.add(peerId);

    try {
      console.log('Creating offer for:', peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('Sending offer to:', peerId);

      callChannelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          type: 'offer',
          from: myUserId,
          to: peerId,
          roomId,
          payload: offer,
        } as SignalingMessage,
      });
    } catch (err) {
      console.error('Error creating offer:', err);
      hasCreatedOfferFor.current.delete(peerId);
    }
  }, [myUserId]);

  const setupCallChannel = useCallback((roomId: string) => {
    console.log('Setting up call channel for room:', roomId);
    
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
    }

    const channel = supabase.channel('call:' + roomId, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      const signal = payload as SignalingMessage;
      
      if (signal.to !== myUserId) return;

      console.log('Received signal:', signal.type, 'from:', signal.from);

      const currentStream = localStreamRef.current;

      switch (signal.type) {
        case 'call-accept': {
          console.log('Call accepted by:', signal.from);
          setCallState('connecting');
          
          if (!currentStream) {
            console.error('No local stream available');
            return;
          }
          
          const pc = createPeerConnection(signal.from, currentStream, roomId);
          await createAndSendOffer(signal.from, pc, roomId);
          break;
        }

        case 'participant-joined': {
          const newParticipantId = signal.from;
          console.log('New participant joined:', newParticipantId);
          
          if (!currentStream) {
            console.error('No local stream available');
            return;
          }

          if (myUserId < newParticipantId) {
            console.log('I will create offer to new participant:', newParticipantId);
            const pc = createPeerConnection(newParticipantId, currentStream, roomId);
            await createAndSendOffer(newParticipantId, pc, roomId);
          } else {
            console.log('Waiting for offer from new participant:', newParticipantId);
          }
          break;
        }
        
        case 'offer': {
          console.log('Received offer from:', signal.from);
          
          if (!currentStream) {
            console.error('No local stream for answering');
            return;
          }
          
          let pc = peerConnections.current.get(signal.from);
          if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
            pc = createPeerConnection(signal.from, currentStream, roomId);
          }
          
          try {
            if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
              console.log('Ignoring offer, signaling state is:', pc.signalingState);
              return;
            }

            if (pc.signalingState === 'have-local-offer') {
              if (myUserId > signal.from) {
                console.log('Glare detected, rolling back my offer');
                await pc.setLocalDescription({ type: 'rollback' });
              } else {
                console.log('Glare detected, ignoring incoming offer');
                return;
              }
            }

            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
            await addPendingCandidates(signal.from, pc);
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log('Sending answer to:', signal.from);

            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: {
                type: 'answer',
                from: myUserId,
                to: signal.from,
                roomId,
                payload: answer,
              } as SignalingMessage,
            });
          } catch (err) {
            console.error('Error handling offer:', err);
          }
          break;
        }
        
        case 'answer': {
          console.log('Received answer from:', signal.from);
          const pc = peerConnections.current.get(signal.from);
          if (pc && signal.payload) {
            try {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
                await addPendingCandidates(signal.from, pc);
              } else {
                console.log('Ignoring answer, signaling state is:', pc.signalingState);
              }
            } catch (err) {
              console.error('Error setting remote description:', err);
            }
          }
          break;
        }
        
        case 'ice-candidate': {
          const pc = peerConnections.current.get(signal.from);
          if (pc && signal.payload) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
              } catch (err) {
                console.error('Error adding ICE candidate:', err);
              }
            } else {
              if (!pendingCandidates.current.has(signal.from)) {
                pendingCandidates.current.set(signal.from, []);
              }
              pendingCandidates.current.get(signal.from)!.push(signal.payload as RTCIceCandidateInit);
            }
          }
          break;
        }
        
        case 'call-reject':
        case 'call-busy':
        case 'call-end': {
          console.log('Call ended/rejected by:', signal.from);
          handlePeerDisconnect(signal.from);
          if (peerConnections.current.size === 0) {
            endCall();
          }
          break;
        }
      }
    });

    channel.subscribe((status) => {
      console.log('Call channel status:', status);
    });

    callChannelRef.current = channel;
    return channel;
  }, [myUserId, createPeerConnection, handlePeerDisconnect, addPendingCandidates, endCall, createAndSendOffer]);

  const initiateCall = useCallback(async (targetUserIds: string[], video: boolean = true) => {
    if (callStateRef.current !== 'idle') {
      console.warn('Already in a call');
      return;
    }

    console.log('Initiating call to:', targetUserIds, 'video:', video);
    
    const roomId = uuidv4();
    const allParticipants = [myUserId, ...targetUserIds];
    
    setCurrentRoomId(roomId);
    setCurrentCallTargets(targetUserIds);
    allParticipantsRef.current = allParticipants;
    setIsVideoCall(video);
    setCallState('ringing');

    const stream = await initializeMedia(video, true);
    if (!stream) {
      console.error('Failed to get media stream');
      setCallState('idle');
      return;
    }

    setupCallChannel(roomId);

    // Send call invites to all targets using THEIR user-calls channel
    for (const targetId of targetUserIds) {
      console.log('Sending call invite to:', targetId, 'on channel: user-calls:' + targetId);
      
      // IMPORTANT: Use the SAME channel name that the recipient is listening on
      const inviteChannel = supabase.channel('user-calls:' + targetId, {
        config: { broadcast: { self: false } }
      });

      inviteChannel.subscribe(async (status) => {
        console.log('Invite channel for', targetId, 'status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Sending call-invite to:', targetId);
          
          // Send multiple times to ensure delivery
          for (let i = 0; i < 3; i++) {
            await inviteChannel.send({
              type: 'broadcast',
              event: 'call-invite',
              payload: {
                type: 'call-invite',
                from: myUserId,
                to: targetId,
                roomId,
                isVideo: video,
                participants: allParticipants,
                fromUser: myUserInfo,
              } as SignalingMessage,
            });
            await new Promise(r => setTimeout(r, 300));
          }
          
          // Keep channel open longer to ensure message delivery
          setTimeout(() => {
            supabase.removeChannel(inviteChannel);
          }, 5000);
        }
      });
    }

    setTimeout(() => {
      if (callStateRef.current === 'ringing') {
        console.log('Call timeout - no answer');
        endCall();
      }
    }, 45000);
  }, [myUserId, myUserInfo, initializeMedia, setupCallChannel, endCall]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) {
      console.error('No incoming call to accept');
      return;
    }

    console.log('Accepting call from:', incomingCall.from);
    console.log('All participants in call:', incomingCall.participants);
    
    const { from, roomId, isVideo, participants } = incomingCall;
    
    const otherParticipants = participants.filter(p => p !== myUserId);
    allParticipantsRef.current = participants;
    
    setCurrentRoomId(roomId);
    setCurrentCallTargets(otherParticipants);
    setIsVideoCall(isVideo);
    setCallState('connecting');
    setIncomingCall(null);

    const stream = await initializeMedia(isVideo, true);
    if (!stream) {
      console.error('Failed to get media stream');
      setCallState('idle');
      return;
    }

    const channel = setupCallChannel(roomId);

    await new Promise(resolve => setTimeout(resolve, 800));

    console.log('Sending call-accept to caller:', from);
    channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type: 'call-accept',
        from: myUserId,
        to: from,
        roomId,
      } as SignalingMessage,
    });

    for (const participantId of otherParticipants) {
      if (participantId !== from) {
        console.log('Notifying participant that I joined:', participantId);
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'participant-joined',
            from: myUserId,
            to: participantId,
            roomId,
          } as SignalingMessage,
        });
      }
    }
  }, [incomingCall, myUserId, initializeMedia, setupCallChannel]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;

    console.log('Rejecting call from:', incomingCall.from);
    
    const rejectChannel = supabase.channel('call:' + incomingCall.roomId, {
      config: { broadcast: { self: false } }
    });

    rejectChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await rejectChannel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'call-reject',
            from: myUserId,
            to: incomingCall.from,
            roomId: incomingCall.roomId,
          } as SignalingMessage,
        });

        setTimeout(() => {
          supabase.removeChannel(rejectChannel);
        }, 1000);
      }
    });

    setIncomingCall(null);
  }, [incomingCall, myUserId]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff((prev) => !prev);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      const stream = await initializeMedia(isVideoCall, true);
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            screenStream.addTrack(audioTrack);
          }
        }

        setLocalStream(screenStream);
        localStreamRef.current = screenStream;
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Failed to share screen:', err);
      }
    }
  }, [isScreenSharing, isVideoCall, initializeMedia]);

  // Set up incoming call listener - this runs once when myUserId is set
  useEffect(() => {
    if (!myUserId) {
      console.log('No user ID, skipping call listener setup');
      return;
    }

    console.log('=== Setting up incoming call listener for user:', myUserId, '===');
    console.log('Listening on channel: user-calls:' + myUserId);
    
    // Track if we've already processed a call invite (prevent duplicates)
    const processedRoomIds = new Set<string>();
    
    const channel = supabase.channel('user-calls:' + myUserId, {
      config: { 
        broadcast: { self: false },
        presence: { key: myUserId }
      }
    });

    channel.on('broadcast', { event: 'call-invite' }, ({ payload }) => {
      console.log('=== RECEIVED BROADCAST ON CALL CHANNEL ===');
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      const signal = payload as SignalingMessage;
      
      // Check if this invite is for us
      if (signal.type !== 'call-invite') {
        console.log('Not a call-invite, ignoring');
        return;
      }
      
      if (signal.to !== myUserId) {
        console.log('Call invite not for me, ignoring. to:', signal.to, 'me:', myUserId);
        return;
      }
      
      // Prevent duplicate processing
      if (processedRoomIds.has(signal.roomId)) {
        console.log('Already processed this call invite, ignoring duplicate');
        return;
      }
      processedRoomIds.add(signal.roomId);
      
      // Clear old room IDs after 30 seconds
      setTimeout(() => {
        processedRoomIds.delete(signal.roomId);
      }, 30000);
      
      console.log('=== INCOMING CALL from:', signal.from, '===');
      
      if (callStateRef.current !== 'idle') {
        console.log('Already in call, sending busy signal');
        
        const busyChannel = supabase.channel('call:' + signal.roomId, {
          config: { broadcast: { self: false } }
        });
        
        busyChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await busyChannel.send({
              type: 'broadcast',
              event: 'signal',
              payload: {
                type: 'call-busy',
                from: myUserId,
                to: signal.from,
                roomId: signal.roomId,
              } as SignalingMessage,
            });
            
            setTimeout(() => {
              supabase.removeChannel(busyChannel);
            }, 1000);
          }
        });
        return;
      }

      console.log('Setting incoming call state with data:', {
        from: signal.from,
        roomId: signal.roomId,
        isVideo: signal.isVideo,
        participants: signal.participants,
        fromUser: signal.fromUser,
      });
      
      setIncomingCall({
        from: signal.from,
        roomId: signal.roomId,
        isVideo: signal.isVideo ?? true,
        participants: signal.participants || [signal.from, myUserId],
        fromUser: signal.fromUser || {
          displayName: 'Unknown Caller',
          avatarColor: '#8B5CF6',
          colorTheme: 'from-purple-500 to-pink-500',
        },
      });
    });

    channel.subscribe((status) => {
      console.log('=== User calls channel status:', status, '===');
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully listening for incoming calls on: user-calls:' + myUserId);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Failed to subscribe to calls channel');
      }
    });

    return () => {
      console.log('Cleaning up incoming call listener');
      supabase.removeChannel(channel);
    };
  }, [myUserId]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
      }
    };
  }, []);

  return {
    callState,
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isVideoCall,
    incomingCall,
    currentRoomId,
    currentCallTargets,
    connectedPeers,
    error,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  };
}
