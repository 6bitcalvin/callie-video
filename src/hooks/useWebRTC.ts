import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, SignalingMessage } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

type IncomingCallData = {
  from: string;
  roomId: string;
  isVideo: boolean;
  fromUser: {
    displayName: string;
    avatarColor: string;
    colorTheme: string;
  };
};

export function useWebRTC(userId: string, userInfo?: { displayName: string; avatarColor: string; colorTheme: string }) {
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

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const callStateRef = useRef<CallState>('idle');
  const localStreamRef = useRef<MediaStream | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Initialize media devices
  const initializeMedia = useCallback(async (video: boolean = true, audio: boolean = true) => {
    try {
      setError(null);
      console.log('Initializing media - video:', video, 'audio:', audio);
      
      const constraints: MediaStreamConstraints = {
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got media stream:', stream.id);
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Failed to get media devices:', err);
      setError('Could not access camera/microphone. Please check permissions.');
      return null;
    }
  }, []);

  // Create peer connection for a specific peer
  const createPeerConnection = useCallback((peerId: string, stream: MediaStream, roomId: string): RTCPeerConnection => {
    console.log('Creating peer connection for:', peerId);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach((track) => {
      console.log('Adding track:', track.kind);
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && callChannelRef.current) {
        console.log('Sending ICE candidate to:', peerId);
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'ice-candidate',
            from: userId,
            to: peerId,
            roomId: roomId,
            payload: event.candidate.toJSON(),
          } as SignalingMessage,
        });
      }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('Received remote track from:', peerId, 'kind:', event.track.kind);
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(peerId, remoteStream);
        return newMap;
      });
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        handlePeerDisconnect(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${peerId}:`, pc.iceConnectionState);
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [userId]);

  // Handle peer disconnect
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
    pendingCandidates.current.delete(peerId);
  }, []);

  // Add pending ICE candidates
  const addPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const candidates = pendingCandidates.current.get(peerId);
    if (candidates) {
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

  // End call
  const endCall = useCallback(() => {
    console.log('Ending call');
    
    // Send end signal to all peers
    peerConnections.current.forEach((pc, peerId) => {
      if (callChannelRef.current && currentRoomId) {
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'call-end',
            from: userId,
            to: peerId,
            roomId: currentRoomId,
          } as SignalingMessage,
        });
      }
      pc.close();
    });
    peerConnections.current.clear();
    pendingCandidates.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Cleanup channel
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
  }, [userId, currentRoomId]);

  // Setup call channel for signaling
  const setupCallChannel = useCallback((roomId: string, _stream: MediaStream) => {
    console.log('Setting up call channel for room:', roomId);
    
    const channel = supabase.channel(`call:${roomId}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      const signal = payload as SignalingMessage;
      if (signal.to !== userId) return;

      console.log('Received signal:', signal.type, 'from:', signal.from);

      switch (signal.type) {
        case 'call-accept': {
          console.log('Call accepted by:', signal.from);
          setCallState('connecting');
          
          const currentStream = localStreamRef.current;
          if (!currentStream) {
            console.error('No local stream available');
            return;
          }
          
          const pc = createPeerConnection(signal.from, currentStream, roomId);
          
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log('Sending offer to:', signal.from);

            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: {
                type: 'offer',
                from: userId,
                to: signal.from,
                roomId,
                payload: offer,
              } as SignalingMessage,
            });
          } catch (err) {
            console.error('Error creating offer:', err);
          }
          break;
        }
        
        case 'offer': {
          console.log('Received offer from:', signal.from);
          
          const currentStream = localStreamRef.current;
          if (!currentStream) {
            console.error('No local stream for answering');
            return;
          }
          
          const pc = peerConnections.current.get(signal.from) || createPeerConnection(signal.from, currentStream, roomId);
          
          try {
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
                from: userId,
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
              await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
              await addPendingCandidates(signal.from, pc);
            } catch (err) {
              console.error('Error setting remote description:', err);
            }
          }
          break;
        }
        
        case 'ice-candidate': {
          const pc = peerConnections.current.get(signal.from);
          if (pc && signal.payload) {
            if (pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
              } catch (err) {
                console.error('Error adding ICE candidate:', err);
              }
            } else {
              // Queue the candidate
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
          // Check if all peers disconnected
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
  }, [userId, createPeerConnection, handlePeerDisconnect, addPendingCandidates, endCall]);

  // Initiate a call
  const initiateCall = useCallback(async (targetUserIds: string[], video: boolean = true) => {
    if (callStateRef.current !== 'idle') {
      console.warn('Already in a call');
      return;
    }

    console.log('Initiating call to:', targetUserIds, 'video:', video);
    
    const roomId = uuidv4();
    setCurrentRoomId(roomId);
    setCurrentCallTargets(targetUserIds);
    setIsVideoCall(video);
    setCallState('ringing');

    const stream = await initializeMedia(video, true);
    if (!stream) {
      console.error('Failed to get media stream');
      setCallState('idle');
      return;
    }

    // Setup call channel
    setupCallChannel(roomId, stream);

    // Send call invites to all targets via their personal channels
    for (const targetId of targetUserIds) {
      console.log('Sending call invite to:', targetId);
      
      // Use a dedicated channel for the call invite
      const inviteChannel = supabase.channel(`user-calls:${targetId}`, {
        config: { broadcast: { self: false } }
      });

      inviteChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Invite channel subscribed, sending invite to:', targetId);
          
          await inviteChannel.send({
            type: 'broadcast',
            event: 'call-invite',
            payload: {
              type: 'call-invite',
              from: userId,
              to: targetId,
              roomId,
              isVideo: video,
              fromUser: userInfo,
            } as SignalingMessage,
          });
          
          // Keep channel open for a bit then cleanup
          setTimeout(() => {
            supabase.removeChannel(inviteChannel);
          }, 5000);
        }
      });
    }

    // Timeout for call (30 seconds)
    setTimeout(() => {
      if (callStateRef.current === 'ringing') {
        console.log('Call timeout - no answer');
        endCall();
      }
    }, 30000);
  }, [userId, userInfo, initializeMedia, setupCallChannel, endCall]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) {
      console.error('No incoming call to accept');
      return;
    }

    console.log('Accepting call from:', incomingCall.from);
    
    const { from, roomId, isVideo } = incomingCall;
    setCurrentRoomId(roomId);
    setCurrentCallTargets([from]);
    setIsVideoCall(isVideo);
    setCallState('connecting');
    setIncomingCall(null);

    const stream = await initializeMedia(isVideo, true);
    if (!stream) {
      console.error('Failed to get media stream');
      setCallState('idle');
      return;
    }

    // Setup call channel
    const channel = setupCallChannel(roomId, stream);

    // Wait for channel to be ready, then send accept
    setTimeout(() => {
      console.log('Sending call-accept to:', from);
      channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          type: 'call-accept',
          from: userId,
          to: from,
          roomId,
        } as SignalingMessage,
      });
    }, 500);
  }, [incomingCall, userId, initializeMedia, setupCallChannel]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;

    console.log('Rejecting call from:', incomingCall.from);
    
    const rejectChannel = supabase.channel(`call:${incomingCall.roomId}`, {
      config: { broadcast: { self: false } }
    });

    rejectChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await rejectChannel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'call-reject',
            from: userId,
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
  }, [incomingCall, userId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff((prev) => !prev);
    }
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Switch back to camera
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

        // Keep audio from original stream
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

  // Listen for incoming calls on user's personal channel
  useEffect(() => {
    if (!userId) return;

    console.log('Setting up incoming call listener for user:', userId);
    
    const channel = supabase.channel(`user-calls:${userId}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'call-invite' }, ({ payload }) => {
      const signal = payload as SignalingMessage;
      console.log('📞 INCOMING CALL:', signal);
      
      if (signal.type === 'call-invite' && signal.to === userId) {
        // If already in a call, send busy
        if (callStateRef.current !== 'idle') {
          console.log('Already in call, sending busy signal');
          
          const busyChannel = supabase.channel(`call:${signal.roomId}`, {
            config: { broadcast: { self: false } }
          });
          
          busyChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await busyChannel.send({
                type: 'broadcast',
                event: 'signal',
                payload: {
                  type: 'call-busy',
                  from: userId,
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

        console.log('📞 Setting incoming call state');
        setIncomingCall({
          from: signal.from,
          roomId: signal.roomId,
          isVideo: signal.isVideo ?? true,
          fromUser: signal.fromUser || {
            displayName: 'Unknown Caller',
            avatarColor: '#8B5CF6',
            colorTheme: 'from-purple-500 to-pink-500',
          },
        });
      }
    });

    channel.subscribe((status) => {
      console.log('User calls channel status:', status);
    });

    return () => {
      console.log('Cleaning up incoming call listener');
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Close all peer connections
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      // Remove call channel
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
