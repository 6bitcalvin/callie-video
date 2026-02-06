import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, SignalingMessage } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

// Use multiple STUN servers and add TURN server for better connectivity
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN server for NAT traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
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
  const originalVideoTrack = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Initialize camera and microphone
  const initializeMedia = useCallback(async (video: boolean = true, audio: boolean = true): Promise<MediaStream | null> => {
    try {
      setError(null);
      console.log('📹 Initializing media - video:', video, 'audio:', audio);
      
      // Detect if mobile device
      const isMobile = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      const videoConstraints = video ? {
        width: isMobile ? { ideal: 720 } : { ideal: 1280 },
        height: isMobile ? { ideal: 1280 } : { ideal: 720 },
        facingMode: 'user',
      } : false;
      
      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: audio ? { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true 
        } : false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Got media stream:', stream.id, 'tracks:', stream.getTracks().map(t => t.kind).join(', '));
      
      // Save original video track for screen share toggle
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        originalVideoTrack.current = videoTrack;
      }
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('❌ Failed to get media devices:', err);
      setError('Could not access camera/microphone. Please check permissions.');
      return null;
    }
  }, []);

  // Handle peer disconnect
  const handlePeerDisconnect = useCallback((odpeerId: string) => {
    console.log('👋 Peer disconnected:', odpeerId);
    const pc = peerConnections.current.get(odpeerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(odpeerId);
    }
    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(odpeerId);
      return newMap;
    });
    setConnectedPeers(prev => {
      const newSet = new Set(prev);
      newSet.delete(odpeerId);
      return newSet;
    });
    pendingCandidates.current.delete(odpeerId);
    hasCreatedOfferFor.current.delete(odpeerId);
  }, []);

  // End the call
  const endCall = useCallback(() => {
    console.log('📴 Ending call');
    
    // Notify all peers
    peerConnections.current.forEach((pc, odpeerId) => {
      if (callChannelRef.current && currentRoomId) {
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'call-end',
            from: myUserId,
            to: odpeerId,
            roomId: currentRoomId,
          } as SignalingMessage,
        });
      }
      pc.close();
    });
    
    // Clear all refs and state
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    hasCreatedOfferFor.current.clear();
    allParticipantsRef.current = [];
    originalVideoTrack.current = null;

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

  // Add pending ICE candidates
  const addPendingCandidates = useCallback(async (odpeerId: string, pc: RTCPeerConnection) => {
    const candidates = pendingCandidates.current.get(odpeerId);
    if (candidates && candidates.length > 0) {
      console.log('🧊 Adding', candidates.length, 'pending ICE candidates for:', odpeerId);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding pending ICE candidate:', err);
        }
      }
      pendingCandidates.current.delete(odpeerId);
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((odpeerId: string, stream: MediaStream, roomId: string): RTCPeerConnection => {
    const existingPc = peerConnections.current.get(odpeerId);
    if (existingPc && existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
      console.log('♻️ Reusing existing peer connection for:', odpeerId);
      return existingPc;
    }

    console.log('🔗 Creating NEW peer connection for:', odpeerId);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add all tracks from local stream
    stream.getTracks().forEach((track) => {
      console.log('➕ Adding track to peer', odpeerId, ':', track.kind, track.enabled ? '(enabled)' : '(disabled)');
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && callChannelRef.current) {
        console.log('🧊 Sending ICE candidate to:', odpeerId);
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'ice-candidate',
            from: myUserId,
            to: odpeerId,
            roomId: roomId,
            payload: event.candidate.toJSON(),
          } as SignalingMessage,
        });
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('📥 Received remote track from:', odpeerId, 'kind:', event.track.kind);
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.set(odpeerId, remoteStream);
          return newMap;
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state with', odpeerId, ':', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectedPeers(prev => new Set([...prev, odpeerId]));
        setCallState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        handlePeerDisconnect(odpeerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state with', odpeerId, ':', pc.iceConnectionState);
    };

    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', pc.iceGatheringState);
    };

    peerConnections.current.set(odpeerId, pc);
    return pc;
  }, [myUserId, handlePeerDisconnect]);

  // Create and send offer
  const createAndSendOffer = useCallback(async (odpeerId: string, pc: RTCPeerConnection, roomId: string) => {
    if (hasCreatedOfferFor.current.has(odpeerId)) {
      console.log('⏭️ Already created offer for:', odpeerId);
      return;
    }
    hasCreatedOfferFor.current.add(odpeerId);

    try {
      console.log('📤 Creating offer for:', odpeerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      console.log('📤 Sending offer to:', odpeerId);

      // Wait a moment for the channel to be ready
      await new Promise(r => setTimeout(r, 100));

      callChannelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          type: 'offer',
          from: myUserId,
          to: odpeerId,
          roomId,
          payload: offer,
        } as SignalingMessage,
      });
    } catch (err) {
      console.error('❌ Error creating offer:', err);
      hasCreatedOfferFor.current.delete(odpeerId);
    }
  }, [myUserId]);

  // Setup call signaling channel
  const setupCallChannel = useCallback((roomId: string): Promise<ReturnType<typeof supabase.channel>> => {
    return new Promise((resolve) => {
      console.log('📡 Setting up call channel for room:', roomId);
      
      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
      }

      const channel = supabase.channel('call:' + roomId, {
        config: { broadcast: { self: false } }
      });

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const signal = payload as SignalingMessage;
        
        if (signal.to !== myUserId) return;

        console.log('📨 Received signal:', signal.type, 'from:', signal.from);

        const currentStream = localStreamRef.current;

        switch (signal.type) {
          case 'call-accept': {
            console.log('✅ Call accepted by:', signal.from);
            setCallState('connecting');
            
            if (!currentStream) {
              console.error('❌ No local stream available');
              return;
            }
            
            const pc = createPeerConnection(signal.from, currentStream, roomId);
            await createAndSendOffer(signal.from, pc, roomId);
            break;
          }

          case 'participant-joined': {
            const newParticipantId = signal.from;
            console.log('👋 New participant joined:', newParticipantId);
            
            if (!currentStream) {
              console.error('❌ No local stream available');
              return;
            }

            // Only the user with lower ID creates the offer (to prevent glare)
            if (myUserId < newParticipantId) {
              console.log('📤 I will create offer to new participant:', newParticipantId);
              const pc = createPeerConnection(newParticipantId, currentStream, roomId);
              await createAndSendOffer(newParticipantId, pc, roomId);
            } else {
              console.log('⏳ Waiting for offer from new participant:', newParticipantId);
            }
            break;
          }
          
          case 'offer': {
            console.log('📥 Received offer from:', signal.from);
            
            if (!currentStream) {
              console.error('❌ No local stream for answering');
              return;
            }
            
            let pc = peerConnections.current.get(signal.from);
            if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
              pc = createPeerConnection(signal.from, currentStream, roomId);
            }
            
            try {
              // Handle glare (both sides created offers)
              if (pc.signalingState === 'have-local-offer') {
                if (myUserId > signal.from) {
                  console.log('🔄 Glare detected, rolling back my offer');
                  await pc.setLocalDescription({ type: 'rollback' });
                  hasCreatedOfferFor.current.delete(signal.from);
                } else {
                  console.log('⏭️ Glare detected, ignoring incoming offer (I have priority)');
                  return;
                }
              }

              if (pc.signalingState !== 'stable') {
                console.log('⏭️ Ignoring offer, signaling state is:', pc.signalingState);
                return;
              }

              await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
              await addPendingCandidates(signal.from, pc);
              
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              console.log('📤 Sending answer to:', signal.from);

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
              console.error('❌ Error handling offer:', err);
            }
            break;
          }
          
          case 'answer': {
            console.log('📥 Received answer from:', signal.from);
            const pc = peerConnections.current.get(signal.from);
            if (pc && signal.payload) {
              try {
                if (pc.signalingState === 'have-local-offer') {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
                  await addPendingCandidates(signal.from, pc);
                  console.log('✅ Answer applied successfully for:', signal.from);
                } else {
                  console.log('⏭️ Ignoring answer, signaling state is:', pc.signalingState);
                }
              } catch (err) {
                console.error('❌ Error setting remote description:', err);
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
                  console.error('❌ Error adding ICE candidate:', err);
                }
              } else {
                // Queue the candidate for later
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
            console.log('📴 Call ended/rejected by:', signal.from);
            handlePeerDisconnect(signal.from);
            if (peerConnections.current.size === 0) {
              endCall();
            }
            break;
          }
        }
      });

      channel.subscribe((status) => {
        console.log('📡 Call channel status:', status);
        if (status === 'SUBSCRIBED') {
          callChannelRef.current = channel;
          resolve(channel);
        }
      });
    });
  }, [myUserId, createPeerConnection, handlePeerDisconnect, addPendingCandidates, endCall, createAndSendOffer]);

  // Initiate a call to one or more users
  const initiateCall = useCallback(async (targetUserIds: string[], video: boolean = true) => {
    if (callStateRef.current !== 'idle') {
      console.warn('⚠️ Already in a call');
      return;
    }

    console.log('📞 Initiating call to:', targetUserIds, 'video:', video);
    
    const roomId = uuidv4();
    const allParticipants = [myUserId, ...targetUserIds];
    
    setCurrentRoomId(roomId);
    setCurrentCallTargets(targetUserIds);
    allParticipantsRef.current = allParticipants;
    setIsVideoCall(video);
    setCallState('ringing');

    // Get camera and microphone
    const stream = await initializeMedia(video, true);
    if (!stream) {
      console.error('❌ Failed to get media stream');
      setCallState('idle');
      return;
    }

    // Set up the signaling channel first
    await setupCallChannel(roomId);

    // Send call invites to all targets
    for (const targetId of targetUserIds) {
      console.log('📤 Sending call invite to:', targetId);
      
      const inviteChannel = supabase.channel('user-calls:' + targetId, {
        config: { broadcast: { self: false } }
      });

      inviteChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Send multiple times for reliability
          for (let i = 0; i < 5; i++) {
            console.log(`📤 Sending invite attempt ${i + 1} to:`, targetId);
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
                fromUser: myUserInfo || {
                  displayName: 'Unknown',
                  avatarColor: '#8B5CF6',
                  colorTheme: 'from-purple-500 to-pink-500',
                },
              } as SignalingMessage,
            });
            await new Promise(r => setTimeout(r, 500));
          }
          
          // Keep channel open for a bit
          setTimeout(() => {
            supabase.removeChannel(inviteChannel);
          }, 10000);
        }
      });
    }

    // Timeout after 60 seconds
    setTimeout(() => {
      if (callStateRef.current === 'ringing') {
        console.log('⏰ Call timeout - no answer');
        endCall();
      }
    }, 60000);
  }, [myUserId, myUserInfo, initializeMedia, setupCallChannel, endCall]);

  // Accept an incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) {
      console.error('❌ No incoming call to accept');
      return;
    }

    console.log('✅ Accepting call from:', incomingCall.from);
    console.log('👥 All participants:', incomingCall.participants);
    
    const { from, roomId, isVideo, participants } = incomingCall;
    
    const otherParticipants = participants.filter(p => p !== myUserId);
    allParticipantsRef.current = participants;
    
    setCurrentRoomId(roomId);
    setCurrentCallTargets(otherParticipants);
    setIsVideoCall(isVideo);
    setCallState('connecting');
    setIncomingCall(null);

    // Get camera and microphone
    const stream = await initializeMedia(isVideo, true);
    if (!stream) {
      console.error('❌ Failed to get media stream');
      setCallState('idle');
      return;
    }

    // Set up signaling channel and wait for it
    const channel = await setupCallChannel(roomId);

    // Wait a moment for channel to be fully ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send accept to the caller
    console.log('📤 Sending call-accept to caller:', from);
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

    // Notify other participants (for group calls)
    for (const odparticipantId of otherParticipants) {
      if (odparticipantId !== from) {
        console.log('📤 Notifying participant that I joined:', odparticipantId);
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'participant-joined',
            from: myUserId,
            to: odparticipantId,
            roomId,
          } as SignalingMessage,
        });
      }
    }
  }, [incomingCall, myUserId, initializeMedia, setupCallChannel]);

  // Reject an incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;

    console.log('❌ Rejecting call from:', incomingCall.from);
    
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

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
        console.log('🎤 Audio track enabled:', track.enabled);
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  // Toggle camera on/off
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
        console.log('📹 Video track enabled:', track.enabled);
      });
      setIsCameraOff((prev) => !prev);
    }
  }, []);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing, go back to camera
      console.log('🖥️ Stopping screen share');
      
      try {
        // Get camera stream again
        const isMobile = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: isMobile ? { ideal: 720 } : { ideal: 1280 },
            height: isMobile ? { ideal: 1280 } : { ideal: 720 },
            facingMode: 'user',
          },
          audio: false, // Keep existing audio
        });
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          // Replace track in all peer connections
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          });
          
          // Update local stream
          if (localStreamRef.current) {
            const oldVideoTracks = localStreamRef.current.getVideoTracks();
            oldVideoTracks.forEach(t => {
              localStreamRef.current?.removeTrack(t);
              t.stop();
            });
            localStreamRef.current.addTrack(videoTrack);
            setLocalStream(localStreamRef.current);
          }
        }
        
        setIsScreenSharing(false);
      } catch (err) {
        console.error('❌ Failed to switch back to camera:', err);
      }
    } else {
      // Start screen sharing
      console.log('🖥️ Starting screen share');
      
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true,
          audio: false,
        });
        
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track in all peer connections
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        // Handle when user stops screen share via browser UI
        screenTrack.onended = async () => {
          console.log('🖥️ Screen share ended by user');
          setIsScreenSharing(false);
          
          // Get camera back
          try {
            const isMobile = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const camStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: isMobile ? { ideal: 720 } : { ideal: 1280 },
                height: isMobile ? { ideal: 1280 } : { ideal: 720 },
                facingMode: 'user',
              },
              audio: false,
            });
            
            const camTrack = camStream.getVideoTracks()[0];
            if (camTrack) {
              peerConnections.current.forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                if (sender) {
                  sender.replaceTrack(camTrack);
                }
              });
              
              if (localStreamRef.current) {
                const oldVideoTracks = localStreamRef.current.getVideoTracks();
                oldVideoTracks.forEach(t => {
                  localStreamRef.current?.removeTrack(t);
                  t.stop();
                });
                localStreamRef.current.addTrack(camTrack);
                setLocalStream(localStreamRef.current);
              }
            }
          } catch (err) {
            console.error('❌ Failed to get camera back:', err);
          }
        };

        // Update local stream display
        if (localStreamRef.current) {
          const oldVideoTracks = localStreamRef.current.getVideoTracks();
          oldVideoTracks.forEach(t => {
            localStreamRef.current?.removeTrack(t);
            // Don't stop the camera track, just remove it
          });
          localStreamRef.current.addTrack(screenTrack);
          setLocalStream(localStreamRef.current);
        }
        
        setIsScreenSharing(true);
      } catch (err) {
        console.error('❌ Failed to share screen:', err);
        // User cancelled or error occurred
      }
    }
  }, [isScreenSharing]);

  // Set up incoming call listener
  useEffect(() => {
    if (!myUserId) {
      console.log('⏳ No user ID, skipping call listener setup');
      return;
    }

    console.log('=== 📞 Setting up incoming call listener for user:', myUserId, '===');
    
    const processedRoomIds = new Set<string>();
    
    const channel = supabase.channel('user-calls:' + myUserId, {
      config: { 
        broadcast: { self: false },
      }
    });

    channel.on('broadcast', { event: 'call-invite' }, ({ payload }) => {
      console.log('=== 📥 RECEIVED CALL INVITE ===');
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      const signal = payload as SignalingMessage;
      
      if (signal.type !== 'call-invite' || signal.to !== myUserId) {
        console.log('⏭️ Ignoring - not for me');
        return;
      }
      
      // Prevent duplicate processing
      if (processedRoomIds.has(signal.roomId)) {
        console.log('⏭️ Already processed this call');
        return;
      }
      processedRoomIds.add(signal.roomId);
      
      setTimeout(() => {
        processedRoomIds.delete(signal.roomId);
      }, 30000);
      
      console.log('=== 📞 INCOMING CALL from:', signal.from, '===');
      
      if (callStateRef.current !== 'idle') {
        console.log('📵 Already in call, sending busy signal');
        
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
      console.log('=== 📡 User calls channel status:', status, '===');
      if (status === 'SUBSCRIBED') {
        console.log('✅ Listening for calls on: user-calls:' + myUserId);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Failed to subscribe to calls channel');
      }
    });

    return () => {
      console.log('🧹 Cleaning up call listener');
      supabase.removeChannel(channel);
    };
  }, [myUserId]);

  // Cleanup on unmount
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
