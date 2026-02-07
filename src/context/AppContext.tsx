import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase, testRealtimeConnection } from '@/lib/supabase';
import { colorThemes, ColorTheme, Friend, Message, Reaction, User, UserProfile } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useWebRTC } from '@/hooks/useWebRTC';
import { stringToColor } from '@/components/ColorAvatar';

type IncomingCallInfo = {
  from: string;
  roomId: string;
  isVideo: boolean;
  participants: string[];
  fromUser: { displayName: string; avatarColor: string; colorTheme: string };
};

type AppContextType = {
  isConnected: boolean;
  connectionError: string | null;
  user: User | null;
  friends: Friend[];
  addFriend: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  removeFriend: (friendId: string) => Promise<void>;
  onlineUsers: Set<string>;
  activeChat: Friend | null;
  setActiveChat: (friend: Friend | null) => void;
  messages: Message[];
  sendMessage: (content: string, type: Message['type'], fileUrl?: string) => Promise<void>;
  isTyping: boolean;
  setIsTyping: (value: boolean) => void;
  friendTyping: boolean;
  callState: 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isVideoCall: boolean;
  incomingCall: IncomingCallInfo | null;
  initiateCall: (targetUserIds: string[], video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  currentCallTargets: string[];
  reactions: Reaction[];
  addReaction: (emoji: string) => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (value: boolean) => void;
  playSound: (sound: 'pop' | 'ring' | 'hangup' | 'message') => void;
  copyUserIdToClipboard: () => void;
};

const AppContext = createContext<AppContextType | null>(null);

const FRIENDS_STORAGE_KEY = 'callie_friends';

interface AppProviderProps {
  children: ReactNode;
  userProfile: UserProfile;
}

export function AppProvider({ children, userProfile }: AppProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const user: User = {
    id: userProfile.id,
    username: userProfile.username,
    displayName: userProfile.displayName,
    avatarColor: userProfile.avatarColor,
    colorTheme: userProfile.colorTheme,
    status: 'online',
  };

  const [friends, setFriends] = useState<Friend[]>(() => {
    try {
      const stored = localStorage.getItem(`${FRIENDS_STORAGE_KEY}_${userProfile.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((f: Friend) => ({
          ...f,
          lastSeen: new Date(f.lastSeen),
        }));
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [activeChat, setActiveChat] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // WebRTC hook
  const webRTC = useWebRTC(user.id, {
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    colorTheme: user.colorTheme.gradient,
  });

  // Test connection on mount
  useEffect(() => {
    const init = async () => {
      try {
        const result = await testRealtimeConnection();
        setIsConnected(result.connected);
        setConnectionError(result.connected ? null : (result.error || 'Failed to connect'));
      } catch (error) {
        setConnectionError(`Connection failed: ${error}`);
        setIsConnected(false);
      }
    };
    init();
  }, []);

  // Persist friends
  useEffect(() => {
    localStorage.setItem(`${FRIENDS_STORAGE_KEY}_${userProfile.id}`, JSON.stringify(friends));
  }, [friends, userProfile.id]);

  // Sound effects
  const playSound = useCallback((sound: 'pop' | 'ring' | 'hangup' | 'message') => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (sound) {
        case 'pop':
          osc.frequency.value = 800;
          gain.gain.value = 0.1;
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
          break;
        case 'message':
          osc.frequency.value = 600;
          gain.gain.value = 0.1;
          osc.start();
          setTimeout(() => { osc.frequency.value = 800; }, 100);
          osc.stop(ctx.currentTime + 0.2);
          break;
        case 'ring':
          osc.frequency.value = 440;
          gain.gain.value = 0.15;
          osc.start();
          const interval = setInterval(() => {
            osc.frequency.value = osc.frequency.value === 440 ? 520 : 440;
          }, 500);
          setTimeout(() => { clearInterval(interval); osc.stop(); }, 2000);
          break;
        case 'hangup':
          osc.frequency.value = 400;
          gain.gain.value = 0.1;
          osc.start();
          osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.3);
          osc.stop(ctx.currentTime + 0.3);
          break;
      }
    } catch {
      // ignore
    }
  }, []);

  const copyUserIdToClipboard = useCallback(() => {
    navigator.clipboard.writeText(user.id);
    playSound('pop');
  }, [user.id, playSound]);

  // Add friend
  const addFriend = useCallback(async (friendId: string): Promise<{ success: boolean; error?: string }> => {
    if (!friendId || friendId.trim() === '') {
      return { success: false, error: 'Please enter a valid user ID' };
    }
    const trimmed = friendId.trim();
    if (trimmed === user.id) {
      return { success: false, error: "You can't add yourself as a friend" };
    }
    if (friends.some(f => f.id === trimmed)) {
      return { success: false, error: 'This user is already your friend' };
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) {
      return { success: false, error: 'Invalid user ID format. Please paste the complete ID.' };
    }

    const randomTheme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
    const newFriend: Friend = {
      id: trimmed,
      username: `user_${trimmed.slice(0, 8)}`,
      displayName: `User ${trimmed.slice(0, 8)}`,
      avatarColor: stringToColor(trimmed),
      colorTheme: randomTheme,
      status: onlineUsers.has(trimmed) ? 'online' : 'offline',
      lastSeen: new Date(),
      unreadCount: 0,
    };
    setFriends(prev => [...prev, newFriend]);
    playSound('pop');
    return { success: true };
  }, [user.id, friends, onlineUsers, playSound]);

  // Remove friend
  const removeFriend = useCallback(async (friendId: string) => {
    setFriends(prev => prev.filter(f => f.id !== friendId));
    if (activeChat?.id === friendId) setActiveChat(null);
  }, [activeChat]);

  // Send message
  const sendMessage = useCallback(async (content: string, type: Message['type'], fileUrl?: string) => {
    if (!activeChat) return;
    const msg: Message = {
      id: uuidv4(),
      senderId: user.id,
      receiverId: activeChat.id,
      content,
      type,
      fileUrl,
      createdAt: new Date(),
      read: false,
    };
    setMessages(prev => [...prev, msg]);
    playSound('pop');
    if (chatChannelRef.current) {
      try {
        await chatChannelRef.current.send({
          type: 'broadcast',
          event: 'message',
          payload: { ...msg, createdAt: msg.createdAt.toISOString() },
        });
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    }
  }, [user.id, activeChat, playSound]);

  // Reactions
  const addReaction = useCallback((emoji: string) => {
    const r: Reaction = { id: uuidv4(), emoji, userId: user.id, timestamp: Date.now() };
    setReactions(prev => [...prev, r]);
    playSound('pop');
    setTimeout(() => { setReactions(prev => prev.filter(x => x.id !== r.id)); }, 3000);
  }, [user.id, playSound]);

  // Typing indicator
  useEffect(() => {
    if (!isTyping || !chatChannelRef.current) return;
    chatChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { senderUserId: user.id },
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
  }, [isTyping, user.id]);

  // Presence channel
  useEffect(() => {
    if (!isConnected) return;

    type PresencePayload = {
      senderUserId?: string;
      username?: string;
      displayName?: string;
      avatarColor?: string;
      colorTheme?: ColorTheme;
    };

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: user.id } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const online = new Set<string>();
      const profiles: Record<string, PresencePayload> = {};

      Object.entries(state).forEach(([key, presences]) => {
        if (Array.isArray(presences) && presences.length > 0) {
          online.add(key);
          profiles[key] = presences[0] as PresencePayload;
        }
      });

      setOnlineUsers(online);
      setFriends(prev => prev.map(friend => {
        const profile = profiles[friend.id];
        const isOn = online.has(friend.id);
        if (profile && (profile.username || profile.displayName)) {
          return {
            ...friend,
            username: profile.username || friend.username,
            displayName: profile.displayName || friend.displayName,
            avatarColor: profile.avatarColor || friend.avatarColor,
            colorTheme: profile.colorTheme || friend.colorTheme,
            status: isOn ? 'online' as const : 'offline' as const,
            lastSeen: isOn ? new Date() : friend.lastSeen,
          };
        }
        return {
          ...friend,
          status: isOn ? 'online' as const : 'offline' as const,
          lastSeen: isOn ? new Date() : friend.lastSeen,
        };
      }));
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      setOnlineUsers(prev => new Set(prev).add(key));
      if (Array.isArray(newPresences) && newPresences.length > 0) {
        const profile = newPresences[0] as PresencePayload;
        setFriends(prev => prev.map(friend => {
          if (friend.id === key) {
            return {
              ...friend,
              username: profile.username || friend.username,
              displayName: profile.displayName || friend.displayName,
              avatarColor: profile.avatarColor || friend.avatarColor,
              colorTheme: (profile.colorTheme as ColorTheme) || friend.colorTheme,
              status: 'online' as const,
              lastSeen: new Date(),
            };
          }
          return friend;
        }));
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      setOnlineUsers(prev => { const n = new Set(prev); n.delete(key); return n; });
      setFriends(prev => prev.map(f =>
        f.id === key ? { ...f, status: 'offline' as const, lastSeen: new Date() } : f
      ));
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          senderUserId: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
          colorTheme: user.colorTheme,
          online_at: new Date().toISOString(),
        });
      } else if (status === 'CHANNEL_ERROR') {
        setConnectionError('Failed to connect to presence channel');
      } else if (status === 'TIMED_OUT') {
        setConnectionError('Connection timed out');
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [user.id, user.username, user.displayName, user.avatarColor, user.colorTheme, isConnected]);

  // Chat channel
  useEffect(() => {
    if (!activeChat) {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
      return;
    }

    const roomId = [user.id, activeChat.id].sort().join(':');
    const channel = supabase.channel(`chat:${roomId}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'message' }, ({ payload }) => {
      const message = { ...payload, createdAt: new Date(payload.createdAt) } as Message;
      if (message.senderId !== user.id) {
        setMessages(prev => [...prev, message]);
        playSound('message');
      }
    });

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.senderUserId !== user.id) {
        setFriendTyping(true);
        setTimeout(() => setFriendTyping(false), 3000);
      }
    });

    channel.subscribe();
    chatChannelRef.current = channel;
    setMessages([]);
    setFriendTyping(false);

    return () => { supabase.removeChannel(channel); };
  }, [user.id, activeChat, playSound]);

  return (
    <AppContext.Provider
      value={{
        isConnected,
        connectionError,
        user,
        friends,
        addFriend,
        removeFriend,
        onlineUsers,
        activeChat,
        setActiveChat,
        messages,
        sendMessage,
        isTyping,
        setIsTyping,
        friendTyping,
        callState: webRTC.callState,
        localStream: webRTC.localStream,
        remoteStreams: webRTC.remoteStreams,
        isMuted: webRTC.isMuted,
        isCameraOff: webRTC.isCameraOff,
        isScreenSharing: webRTC.isScreenSharing,
        isVideoCall: webRTC.isVideoCall,
        incomingCall: webRTC.incomingCall,
        initiateCall: webRTC.initiateCall,
        acceptCall: webRTC.acceptCall,
        rejectCall: webRTC.rejectCall,
        endCall: webRTC.endCall,
        toggleMute: webRTC.toggleMute,
        toggleCamera: webRTC.toggleCamera,
        toggleScreenShare: webRTC.toggleScreenShare,
        currentCallTargets: webRTC.currentCallTargets,
        reactions,
        addReaction,
        showEmojiPicker,
        setShowEmojiPicker,
        playSound,
        copyUserIdToClipboard,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
