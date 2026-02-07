import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
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
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
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

type SignalPayload = {
  type: string;
  from: string;
  to: string;
  roomId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  isVideo?: boolean;
  participants?: string[];
  fromUser?: UserInfo;
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

  // Refs for stable access in callbacks
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const callStateRef = useRef<CallState>('idle');
  const localStreamRef = useRef<MediaStream | null>(null);
  const allParticipantsRef = useRef<string[]>([]);
  const offerCreatedFor = useRef<Set<string>>(new Set());
  const roomIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef(myUserId);
  const myUserInfoRef = useRef(myUserInfo);

  // Keep refs in sync
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { myUserIdRef.current = myUserId; }, [myUserId]);
  useEffect(() => { myUserInfoRef.current = myUserInfo; }, [myUserInfo]);

  // ─── GET MEDIA ───────────────────────────────────────────────
  const getMedia = useCallback(async (video: boolean): Promise<MediaStream | null> => {
    try {
      setError(null);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: isMobile ? { ideal: 720 } : { ideal: 1280 },
          height: isMobile ? { ideal: 1280 } : { ideal: 720 },
          facingMode: 'user',
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log('[MEDIA] Got stream:', stream.getTracks().map(t => t.kind));
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('[MEDIA] Failed:', err);
      setError('Camera/microphone access denied. Check permissions.');
      return null;
    }
  }, []);

  // ─── CLEANUP ─────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    console.log('[CLEANUP] Cleaning up all connections');
    peerConnections.current.forEach((pc, peerId) => {
      console.log('[CLEANUP] Closing peer:', peerId);
      pc.close();
    });
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    offerCreatedFor.current.clear();
    allParticipantsRef.current = [];

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
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
    roomIdRef.current = null;
    setCurrentCallTargets([]);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setError(null);
  }, []);

  // ─── CREATE PEER CONNECTION ──────────────────────────────────
  const makePeer = useCallback((peerId: string, stream: MediaStream, roomId: string): RTCPeerConnection => {
    // Close existing if broken
    const existing = peerConnections.current.get(peerId);
    if (existing) {
      if (existing.connectionState === 'connected' || existing.connectionState === 'connecting') {
        console.log('[PEER] Reusing existing connection for:', peerId);
        return existing;
      }
      existing.close();
      peerConnections.current.delete(peerId);
    }

    console.log('[PEER] Creating new connection for:', peerId);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // ICE candidates
    pc.onicecandidate = (ev) => {
      if (ev.candidate && callChannelRef.current) {
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'ice-candidate',
            from: myUserIdRef.current,
            to: peerId,
            roomId,
            candidate: ev.candidate.toJSON(),
          },
        });
      }
    };

    // Remote tracks
    pc.ontrack = (ev) => {
      console.log('[PEER] Got remote track from:', peerId, ev.track.kind);
      const remoteStream = ev.streams[0];
      if (remoteStream) {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(peerId, remoteStream);
          return next;
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log('[PEER] Connection state', peerId, ':', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log('[PEER] Connection lost to:', peerId);
        peerConnections.current.delete(peerId);
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
        // If no more peers, end call
        if (peerConnections.current.size === 0 && callStateRef.current !== 'idle') {
          cleanup();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[ICE] State', peerId, ':', pc.iceConnectionState);
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [cleanup]);

  // ─── SEND OFFER ──────────────────────────────────────────────
  const sendOffer = useCallback(async (peerId: string, pc: RTCPeerConnection, roomId: string) => {
    if (offerCreatedFor.current.has(peerId)) {
      console.log('[OFFER] Already sent to:', peerId);
      return;
    }
    offerCreatedFor.current.add(peerId);

    try {
      console.log('[OFFER] Creating for:', peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      // Small delay for channel readiness
      await new Promise(r => setTimeout(r, 200));

      if (callChannelRef.current) {
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'offer',
            from: myUserIdRef.current,
            to: peerId,
            roomId,
            sdp: offer,
          },
        });
        console.log('[OFFER] Sent to:', peerId);
      }
    } catch (err) {
      console.error('[OFFER] Error:', err);
      offerCreatedFor.current.delete(peerId);
    }
  }, []);

  // ─── FLUSH PENDING ICE CANDIDATES ───────────────────────────
  const flushCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingCandidates.current.get(peerId);
    if (queued && queued.length > 0) {
      console.log('[ICE] Flushing', queued.length, 'candidates for:', peerId);
      for (const c of queued) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('[ICE] flush error:', e); }
      }
      pendingCandidates.current.delete(peerId);
    }
  }, []);

  // ─── HANDLE INCOMING SIGNAL ──────────────────────────────────
  const handleSignal = useCallback(async (signal: SignalPayload) => {
    if (signal.to !== myUserIdRef.current) return;

    const currentStream = localStreamRef.current;
    const roomId = roomIdRef.current || signal.roomId;

    switch (signal.type) {
      case 'call-accept': {
        console.log('[SIGNAL] Call accepted by:', signal.from);
        setCallState('connecting');
        if (!currentStream) { console.error('[SIGNAL] No local stream!'); return; }
        const pc = makePeer(signal.from, currentStream, roomId);
        await sendOffer(signal.from, pc, roomId);
        break;
      }

      case 'participant-joined': {
        console.log('[SIGNAL] Participant joined:', signal.from);
        if (!currentStream) { console.error('[SIGNAL] No local stream!'); return; }

        // Lower ID creates the offer to avoid glare
        if (myUserIdRef.current < signal.from) {
          console.log('[SIGNAL] I will offer to:', signal.from);
          const pc = makePeer(signal.from, currentStream, roomId);
          await sendOffer(signal.from, pc, roomId);
        } else {
          console.log('[SIGNAL] Waiting for offer from:', signal.from);
          // Just prepare the peer connection
          makePeer(signal.from, currentStream, roomId);
        }
        break;
      }

      case 'offer': {
        console.log('[SIGNAL] Got offer from:', signal.from);
        if (!currentStream) { console.error('[SIGNAL] No local stream!'); return; }

        let pc = peerConnections.current.get(signal.from);
        if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
          pc = makePeer(signal.from, currentStream, roomId);
        }

        try {
          // Handle glare: if we both sent offers, lower ID wins
          if (pc.signalingState === 'have-local-offer') {
            if (myUserIdRef.current > signal.from) {
              console.log('[SIGNAL] Glare: rolling back my offer');
              await pc.setLocalDescription({ type: 'rollback' });
              offerCreatedFor.current.delete(signal.from);
            } else {
              console.log('[SIGNAL] Glare: ignoring their offer (I have priority)');
              return;
            }
          }

          if (pc.signalingState !== 'stable') {
            console.log('[SIGNAL] Skipping offer, state:', pc.signalingState);
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
          await flushCandidates(signal.from, pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (callChannelRef.current) {
            callChannelRef.current.send({
              type: 'broadcast',
              event: 'signal',
              payload: {
                type: 'answer',
                from: myUserIdRef.current,
                to: signal.from,
                roomId,
                sdp: answer,
              },
            });
            console.log('[SIGNAL] Sent answer to:', signal.from);
          }
        } catch (err) {
          console.error('[SIGNAL] Offer handling error:', err);
        }
        break;
      }

      case 'answer': {
        console.log('[SIGNAL] Got answer from:', signal.from);
        const pc = peerConnections.current.get(signal.from);
        if (pc && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
            await flushCandidates(signal.from, pc);
            console.log('[SIGNAL] Answer applied for:', signal.from);
          } catch (err) {
            console.error('[SIGNAL] Answer error:', err);
          }
        } else {
          console.log('[SIGNAL] Ignoring answer, state:', pc?.signalingState);
        }
        break;
      }

      case 'ice-candidate': {
        const pc = peerConnections.current.get(signal.from);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate!));
          } catch (err) {
            console.warn('[ICE] Add error:', err);
          }
        } else {
          // Queue for later
          if (!pendingCandidates.current.has(signal.from)) {
            pendingCandidates.current.set(signal.from, []);
          }
          pendingCandidates.current.get(signal.from)!.push(signal.candidate!);
        }
        break;
      }

      case 'call-end':
      case 'call-reject':
      case 'call-busy': {
        console.log('[SIGNAL] Call ended/rejected by:', signal.from);
        const pc = peerConnections.current.get(signal.from);
        if (pc) { pc.close(); peerConnections.current.delete(signal.from); }
        setRemoteStreams(prev => { const n = new Map(prev); n.delete(signal.from); return n; });
        if (peerConnections.current.size === 0) {
          cleanup();
        }
        break;
      }
    }
  }, [makePeer, sendOffer, flushCandidates, cleanup]);

  // ─── SETUP CALL CHANNEL ──────────────────────────────────────
  const setupCallChannel = useCallback((roomId: string): Promise<ReturnType<typeof supabase.channel>> => {
    return new Promise((resolve, reject) => {
      console.log('[CHANNEL] Setting up call channel:', roomId);

      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }

      const channel = supabase.channel('call-room-' + roomId, {
        config: { broadcast: { self: false } }
      });

      channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignal(payload as SignalPayload);
      });

      const timeout = setTimeout(() => {
        reject(new Error('Channel subscription timeout'));
      }, 15000);

      channel.subscribe((status) => {
        console.log('[CHANNEL] Status:', status);
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          callChannelRef.current = channel;
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(new Error('Channel error: ' + status));
        }
      });
    });
  }, [handleSignal]);

  // ─── INITIATE CALL ───────────────────────────────────────────
  const initiateCall = useCallback(async (targetIds: string[], video: boolean) => {
    if (callStateRef.current !== 'idle') {
      console.warn('[CALL] Already in a call');
      return;
    }

    console.log('[CALL] Initiating call to:', targetIds);
    const roomId = uuidv4();
    const allPeers = [myUserId, ...targetIds];

    setCurrentRoomId(roomId);
    roomIdRef.current = roomId;
    setCurrentCallTargets(targetIds);
    allParticipantsRef.current = allPeers;
    setIsVideoCall(video);
    setCallState('ringing');

    // Get media
    const stream = await getMedia(video);
    if (!stream) { cleanup(); return; }

    // Setup signaling channel
    try {
      await setupCallChannel(roomId);
    } catch (err) {
      console.error('[CALL] Channel setup failed:', err);
      setError('Failed to setup call channel');
      cleanup();
      return;
    }

    // Send invites to each target via their personal channel
    // IMPORTANT: Channel name MUST match what the receiver is listening on!
    for (const targetId of targetIds) {
      const inviteCh = supabase.channel('incoming-' + targetId, {
        config: { broadcast: { self: false } }
      });

      inviteCh.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Send invite multiple times for reliability
          for (let attempt = 0; attempt < 5; attempt++) {
            console.log(`[INVITE] Sending to ${targetId}, attempt ${attempt + 1}`);
            await inviteCh.send({
              type: 'broadcast',
              event: 'incoming-call',
              payload: {
                type: 'call-invite',
                from: myUserId,
                to: targetId,
                roomId,
                isVideo: video,
                participants: allPeers,
                fromUser: myUserInfo || {
                  displayName: 'Unknown',
                  avatarColor: '#8B5CF6',
                  colorTheme: 'from-purple-500 to-pink-500',
                },
              },
            });
            await new Promise(r => setTimeout(r, 600));
          }
          // Keep channel alive briefly then cleanup
          setTimeout(() => supabase.removeChannel(inviteCh), 15000);
        }
      });
    }

    // Timeout after 60s
    setTimeout(() => {
      if (callStateRef.current === 'ringing') {
        console.log('[CALL] No answer, timing out');
        cleanup();
      }
    }, 60000);
  }, [myUserId, myUserInfo, getMedia, setupCallChannel, cleanup]);

  // ─── ACCEPT CALL ─────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall) { console.error('[CALL] No incoming call'); return; }

    const { from: callerId, roomId, isVideo, participants } = incomingCall;
    console.log('[CALL] Accepting call from:', callerId, 'room:', roomId);

    const otherPeers = participants.filter(p => p !== myUserId);
    allParticipantsRef.current = participants;

    setCurrentRoomId(roomId);
    roomIdRef.current = roomId;
    setCurrentCallTargets(otherPeers);
    setIsVideoCall(isVideo);
    setCallState('connecting');
    setIncomingCall(null);

    // Get media
    const stream = await getMedia(isVideo);
    if (!stream) { cleanup(); return; }

    // Setup signaling channel
    let channel: ReturnType<typeof supabase.channel>;
    try {
      channel = await setupCallChannel(roomId);
    } catch (err) {
      console.error('[CALL] Channel setup failed:', err);
      setError('Failed to join call');
      cleanup();
      return;
    }

    // Wait for channel to be fully ready
    await new Promise(r => setTimeout(r, 500));

    // Tell the caller we accepted
    console.log('[CALL] Sending accept to:', callerId);
    channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type: 'call-accept',
        from: myUserId,
        to: callerId,
        roomId,
      },
    });

    // Notify other participants in group calls
    for (const peerId of otherPeers) {
      if (peerId !== callerId) {
        console.log('[CALL] Notifying participant:', peerId);
        await new Promise(r => setTimeout(r, 200));
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'participant-joined',
            from: myUserId,
            to: peerId,
            roomId,
          },
        });
      }
    }
  }, [incomingCall, myUserId, getMedia, setupCallChannel, cleanup]);

  // ─── REJECT CALL ─────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    console.log('[CALL] Rejecting call from:', incomingCall.from);

    // Send reject via a temporary channel
    // Use the same call room channel so the caller receives the reject signal
    const rejectCh = supabase.channel('call-room-' + incomingCall.roomId, {
      config: { broadcast: { self: false } }
    });

    rejectCh.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await rejectCh.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'call-reject',
            from: myUserId,
            to: incomingCall.from,
            roomId: incomingCall.roomId,
          },
        });
        setTimeout(() => supabase.removeChannel(rejectCh), 2000);
      }
    });

    setIncomingCall(null);
  }, [incomingCall, myUserId]);

  // ─── END CALL ────────────────────────────────────────────────
  const endCall = useCallback(() => {
    console.log('[CALL] Ending call');

    // Notify all peers
    peerConnections.current.forEach((_pc, peerId) => {
      if (callChannelRef.current && roomIdRef.current) {
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'call-end',
            from: myUserId,
            to: peerId,
            roomId: roomIdRef.current,
          },
        });
      }
    });

    cleanup();
  }, [myUserId, cleanup]);

  // ─── TOGGLE MUTE ─────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, []);

  // ─── TOGGLE CAMERA ───────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setIsCameraOff(prev => !prev);
    }
  }, []);

  // ─── TOGGLE SCREEN SHARE ─────────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Switch back to camera
      try {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: isMobile ? { ideal: 720 } : { ideal: 1280 },
            height: isMobile ? { ideal: 1280 } : { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });
        const camTrack = camStream.getVideoTracks()[0];
        if (camTrack && localStreamRef.current) {
          // Replace in peer connections
          peerConnections.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(camTrack);
          });
          // Replace in local stream
          const oldTracks = localStreamRef.current.getVideoTracks();
          oldTracks.forEach(t => { localStreamRef.current?.removeTrack(t); t.stop(); });
          localStreamRef.current.addTrack(camTrack);
          setLocalStream(localStreamRef.current);
        }
        setIsScreenSharing(false);
      } catch (err) {
        console.error('[SCREEN] Failed to switch back:', err);
      }
    } else {
      // Start screen share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          // Auto-switch back to camera
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          }).then(camStream => {
            const camTrack = camStream.getVideoTracks()[0];
            if (camTrack) {
              peerConnections.current.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(camTrack);
              });
              if (localStreamRef.current) {
                const oldTracks = localStreamRef.current.getVideoTracks();
                oldTracks.forEach(t => { localStreamRef.current?.removeTrack(t); t.stop(); });
                localStreamRef.current.addTrack(camTrack);
                setLocalStream(localStreamRef.current);
              }
            }
          }).catch(console.error);
        };

        if (localStreamRef.current) {
          const oldTracks = localStreamRef.current.getVideoTracks();
          oldTracks.forEach(t => localStreamRef.current?.removeTrack(t));
          localStreamRef.current.addTrack(screenTrack);
          setLocalStream(localStreamRef.current);
        }

        setIsScreenSharing(true);
      } catch (err) {
        console.error('[SCREEN] Screen share cancelled or failed:', err);
      }
    }
  }, [isScreenSharing]);

  // ─── INCOMING CALL LISTENER ──────────────────────────────────
  useEffect(() => {
    if (!myUserId) return;

    console.log('[LISTEN] Setting up incoming call listener for:', myUserId);
    const processedCalls = new Set<string>();

    // Listen on a FIXED channel name so senders can find us
    const listenChannel = supabase.channel('incoming-' + myUserId, {
      config: { broadcast: { self: false } }
    });

    listenChannel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
      const data = payload as SignalPayload;
      console.log('[LISTEN] Received broadcast:', data.type, 'from:', data.from);

      if (data.type !== 'call-invite') return;
      if (data.to !== myUserId) return;

      // Deduplicate
      if (processedCalls.has(data.roomId)) return;
      processedCalls.add(data.roomId);
      setTimeout(() => processedCalls.delete(data.roomId), 30000);

      if (callStateRef.current !== 'idle') {
        console.log('[LISTEN] Already in call, sending busy');
        return;
      }

      console.log('[LISTEN] *** INCOMING CALL from:', data.from, '***');
      setIncomingCall({
        from: data.from,
        roomId: data.roomId,
        isVideo: data.isVideo ?? true,
        participants: data.participants || [data.from, myUserId],
        fromUser: data.fromUser || {
          displayName: 'Unknown',
          avatarColor: '#8B5CF6',
          colorTheme: 'from-purple-500 to-pink-500',
        },
      });
    });

    listenChannel.subscribe((status) => {
      console.log('[LISTEN] Channel status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[LISTEN] Ready to receive calls on: incoming-' + myUserId);
      }
    });

    return () => {
      console.log('[LISTEN] Removing listener');
      supabase.removeChannel(listenChannel);
    };
  }, [myUserId]);

  // ─── UNMOUNT CLEANUP ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      peerConnections.current.forEach(pc => pc.close());
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
