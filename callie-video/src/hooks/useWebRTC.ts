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

type IncomingCallData = {
  from: string;
  roomId: string;
  isVideo: boolean;
  fromUser: {
    displayName: string;
    avatarUrl: string;
    colorTheme: string;
  };
};

export function useWebRTC(userId: string, userInfo?: { displayName: string; avatarUrl: string; colorTheme: string }) {
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
  const userChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const callStateRef = useRef<CallState>('idle');

  // Keep ref in sync with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Initialize media devices
  const initializeMedia = useCallback(async (video: boolean = true, audio: boolean = true) => {
    try {
      setError(null);
      const constraints: MediaStreamConstraints = {
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Failed to get media devices:', err);
      setError('Could not access camera/microphone. Please check permissions.');
      return null;
    }
  }, []);

  // Create peer connection for a specific peer
  const createPeerConnection = useCallback((peerId: string, stream: MediaStream, roomId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && callChannelRef.current) {
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
      console.log('Received remote track from:', peerId);
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
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Cleanup channels
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams(new Map());
    setCallState('idle');
    setCurrentRoomId(null);
    setCurrentCallTargets([]);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setError(null);
  }, [localStream, userId, currentRoomId]);

  // Initiate a call
  const initiateCall = useCallback(async (targetUserIds: string[], video: boolean = true) => {
    if (callStateRef.current !== 'idle') {
      console.warn('Already in a call');
      return;
    }

    const roomId = uuidv4();
    setCurrentRoomId(roomId);
    setCurrentCallTargets(targetUserIds);
    setIsVideoCall(video);
    setCallState('ringing');

    const stream = await initializeMedia(video, true);
    if (!stream) {
      setCallState('idle');
      return;
    }

    // Create call channel
    const channel = supabase.channel(`call:${roomId}`, {
      config: { broadcast: { self: false } }
    });
    callChannelRef.current = channel;

    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      const signal = payload as SignalingMessage;
      if (signal.to !== userId) return;

      console.log('Received signal:', signal.type, 'from:', signal.from);

      switch (signal.type) {
        case 'call-accept': {
          setCallState('connecting');
          const pc = createPeerConnection(signal.from, stream, roomId);
          
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

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
        case 'answer': {
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
          handlePeerDisconnect(signal.from);
          // Check if all peers disconnected
          if (peerConnections.current.size === 0) {
            endCall();
          }
          break;
        }
      }
    });

    await channel.subscribe();

    // Send call invites to all targets
    for (const targetId of targetUserIds) {
      const targetChannel = supabase.channel(`user:${targetId}:${Date.now()}`, {
        config: { broadcast: { self: false } }
      });
      
      targetChannel.on('broadcast', { event: 'incoming-call' }, () => {});
      
      await targetChannel.subscribe();
      
      await targetChannel.send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: {
          type: 'call-invite',
          from: userId,
          to: targetId,
          roomId,
          isVideo: video,
          fromUser: userInfo,
        } as SignalingMessage,
      });

      // Cleanup target channel after sending
      setTimeout(() => {
        supabase.removeChannel(targetChannel);
      }, 2000);
    }

    // Timeout for call (30 seconds)
    setTimeout(() => {
      if (callStateRef.current === 'ringing') {
        endCall();
      }
    }, 30000);
  }, [userId, userInfo, initializeMedia, createPeerConnection, handlePeerDisconnect, addPendingCandidates, endCall]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    const { from, roomId, isVideo } = incomingCall;
    setCurrentRoomId(roomId);
    setCurrentCallTargets([from]);
    setIsVideoCall(isVideo);
    setCallState('connecting');
    setIncomingCall(null);

    const stream = await initializeMedia(isVideo, true);
    if (!stream) {
      setCallState('idle');
      return;
    }

    const channel = supabase.channel(`call:${roomId}`, {
      config: { broadcast: { self: false } }
    });
    callChannelRef.current = channel;

    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      const signal = payload as SignalingMessage;
      if (signal.to !== userId) return;

      console.log('Received signal (callee):', signal.type, 'from:', signal.from);

      switch (signal.type) {
        case 'offer': {
          const pc = createPeerConnection(signal.from, stream, roomId);
          
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
            await addPendingCandidates(signal.from, pc);
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

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
              if (!pendingCandidates.current.has(signal.from)) {
                pendingCandidates.current.set(signal.from, []);
              }
              pendingCandidates.current.get(signal.from)!.push(signal.payload as RTCIceCandidateInit);
            }
          }
          break;
        }
        case 'call-end': {
          handlePeerDisconnect(signal.from);
          if (peerConnections.current.size === 0) {
            endCall();
          }
          break;
        }
      }
    });

    await channel.subscribe();

    // Send accept signal
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
  }, [incomingCall, userId, initializeMedia, createPeerConnection, handlePeerDisconnect, addPendingCandidates, endCall]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;

    const rejectChannel = supabase.channel(`call:${incomingCall.roomId}`, {
      config: { broadcast: { self: false } }
    });
    
    rejectChannel.on('broadcast', { event: 'signal' }, () => {});
    
    await rejectChannel.subscribe();
    
    rejectChannel.send({
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

    setIncomingCall(null);
  }, [incomingCall, userId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, [localStream]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff((prev) => !prev);
    }
  }, [localStream]);

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
        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            screenStream.addTrack(audioTrack);
          }
        }

        setLocalStream(screenStream);
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Failed to share screen:', err);
      }
    }
  }, [isScreenSharing, isVideoCall, initializeMedia, localStream]);

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`user:${userId}`, {
      config: { broadcast: { self: false } }
    });
    userChannelRef.current = channel;

    channel.on('broadcast', { event: 'incoming-call' }, async ({ payload }) => {
      const signal = payload as SignalingMessage;
      console.log('Incoming call from:', signal.from);
      
      if (signal.type === 'call-invite' && signal.to === userId) {
        // If already in a call, send busy
        if (callStateRef.current !== 'idle') {
          const busyChannel = supabase.channel(`call:${signal.roomId}:busy`, {
            config: { broadcast: { self: false } }
          });
          
          busyChannel.on('broadcast', { event: 'signal' }, () => {});
          
          await busyChannel.subscribe();
          
          busyChannel.send({
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
          return;
        }

        setIncomingCall({
          from: signal.from,
          roomId: signal.roomId,
          isVideo: signal.isVideo ?? true,
          fromUser: signal.fromUser || {
            displayName: 'Unknown',
            avatarUrl: '',
            colorTheme: 'from-purple-500 to-pink-500',
          },
        });
      }
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      // Close all peer connections
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      // Remove channels
      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
      }
      if (userChannelRef.current) {
        supabase.removeChannel(userChannelRef.current);
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
