import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase, testRealtimeConnection } from '@/lib/supabase';
import { colorThemes, ColorTheme, Friend, Message, Reaction, User, UserProfile } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useWebRTC } from '@/hooks/useWebRTC';
import { stringToColor } from '@/components/ColorAvatar';

type AppContextType = {
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  
  // User state
  user: User | null;
  
  // Friends
  friends: Friend[];
  addFriend: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  removeFriend: (friendId: string) => Promise<void>;
  onlineUsers: Set<string>;
  
  // Chat
  activeChat: Friend | null;
  setActiveChat: (friend: Friend | null) => void;
  messages: Message[];
  sendMessage: (content: string, type: Message['type'], fileUrl?: string) => Promise<void>;
  isTyping: boolean;
  setIsTyping: (value: boolean) => void;
  friendTyping: boolean;
  
  // Call (from useWebRTC)
  callState: 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isVideoCall: boolean;
  incomingCall: { from: string; roomId: string; isVideo: boolean; participants: string[]; fromUser: { displayName: string; avatarColor: string; colorTheme: string } } | null;
  initiateCall: (targetUserIds: string[], video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  currentCallTargets: string[];
  
  // Reactions
  reactions: Reaction[];
  addReaction: (emoji: string) => void;
  
  // UI state
  showEmojiPicker: boolean;
  setShowEmojiPicker: (value: boolean) => void;
  
  // Utilities
  playSound: (sound: 'pop' | 'ring' | 'hangup' | 'message') => void;
  copyUserIdToClipboard: () => void;
};

const AppContext = createContext<AppContextType | null>(null);

// Storage key for friends
const FRIENDS_STORAGE_KEY = 'callie_friends';

interface AppProviderProps {
  children: ReactNode;
  userProfile: UserProfile;
}

export function AppProvider({ children, userProfile }: AppProviderProps) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // User based on profile
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
      // Ignore parse errors
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

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // WebRTC hook
  const webRTC = useWebRTC(
    user.id,
    {
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      colorTheme: user.colorTheme.gradient,
    }
  );

  // Test connection on mount
  useEffect(() => {
    const initializeConnection = async () => {
      console.log('Testing Supabase realtime connection...');
      
      try {
        const result = await testRealtimeConnection();
        console.log('Connection test result:', result);
        
        setIsConnected(result.connected);
        if (!result.connected) {
          setConnectionError(result.error || 'Failed to connect to server');
        } else {
          setConnectionError(null);
        }
      } catch (error) {
        console.error('Connection test error:', error);
        setConnectionError(`Connection failed: ${error}`);
        setIsConnected(false);
      }
    };
    
    initializeConnection();
  }, []);

  // Persist friends to localStorage
  useEffect(() => {
    localStorage.setItem(`${FRIENDS_STORAGE_KEY}_${userProfile.id}`, JSON.stringify(friends));
  }, [friends, userProfile.id]);

  // Sound effects
  const playSound = useCallback((sound: 'pop' | 'ring' | 'hangup' | 'message') => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      switch (sound) {
        case 'pop':
          oscillator.frequency.value = 800;
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
        case 'message':
          oscillator.frequency.value = 600;
          gainNode.gain.value = 0.1;
          oscillator.start();
          setTimeout(() => {
            oscillator.frequency.value = 800;
          }, 100);
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
        case 'ring':
          oscillator.frequency.value = 440;
          gainNode.gain.value = 0.15;
          oscillator.start();
          const ringInterval = setInterval(() => {
            oscillator.frequency.value = oscillator.frequency.value === 440 ? 520 : 440;
          }, 500);
          setTimeout(() => {
            clearInterval(ringInterval);
            oscillator.stop();
          }, 2000);
          break;
        case 'hangup':
          oscillator.frequency.value = 400;
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.frequency.linearRampToValueAtTime(200, audioContext.currentTime + 0.3);
          oscillator.stop(audioContext.currentTime + 0.3);
          break;
      }
    } catch {
      // Audio not supported
    }
  }, []);

  // Copy user ID to clipboard
  const copyUserIdToClipboard = useCallback(() => {
    navigator.clipboard.writeText(user.id);
    playSound('pop');
  }, [user.id, playSound]);

  // Add friend by ID
  const addFriend = useCallback(async (friendId: string): Promise<{ success: boolean; error?: string }> => {
    if (!friendId || friendId.trim() === '') {
      return { success: false, error: 'Please enter a valid user ID' };
    }

    const trimmedId = friendId.trim();

    if (trimmedId === user.id) {
      return { success: false, error: "You can't add yourself as a friend" };
    }

    // Check if already a friend
    if (friends.some(f => f.id === trimmedId)) {
      return { success: false, error: 'This user is already your friend' };
    }

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedId)) {
      return { success: false, error: 'Invalid user ID format. Please paste the complete ID.' };
    }

    // Create a friend with a generated color based on their ID
    const randomTheme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
    const newFriend: Friend = {
      id: trimmedId,
      username: `user_${trimmedId.slice(0, 8)}`,
      displayName: `User ${trimmedId.slice(0, 8)}`,
      avatarColor: stringToColor(trimmedId),
      colorTheme: randomTheme,
      status: onlineUsers.has(trimmedId) ? 'online' : 'offline',
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
    if (activeChat?.id === friendId) {
      setActiveChat(null);
    }
  }, [activeChat]);

  // Send message
  const sendMessage = useCallback(async (content: string, type: Message['type'], fileUrl?: string) => {
    if (!activeChat) return;

    const newMessage: Message = {
      id: uuidv4(),
      senderId: user.id,
      receiverId: activeChat.id,
      content,
      type,
      fileUrl,
      createdAt: new Date(),
      read: false,
    };

    setMessages(prev => [...prev, newMessage]);
    playSound('pop');

    // Broadcast message to the chat channel
    if (chatChannelRef.current) {
      try {
        await chatChannelRef.current.send({
          type: 'broadcast',
          event: 'message',
          payload: {
            ...newMessage,
            createdAt: newMessage.createdAt.toISOString(),
          },
        });
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  }, [user.id, activeChat, playSound]);

  // Add reaction
  const addReaction = useCallback((emoji: string) => {
    const newReaction: Reaction = {
      id: uuidv4(),
      emoji,
      userId: user.id,
      timestamp: Date.now(),
    };

    setReactions(prev => [...prev, newReaction]);
    playSound('pop');

    // Auto-remove after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);
  }, [user.id, playSound]);

  // Handle typing indicator
  useEffect(() => {
    if (!isTyping || !chatChannelRef.current) return;

    chatChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { odis_playName: user.id },
    });

    // Clear typing after 3 seconds of no activity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  }, [isTyping, user.id]);

  // Setup presence channel when connected
  useEffect(() => {
    if (!isConnected) return;

    console.log('Setting up presence channel for user:', user.id);

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: user.id } }
    });

    // Type for presence data
    type PresenceData = {
      odis_playName?: string;
      username?: string;
      displayName?: string;
      avatarColor?: string;
      colorTheme?: ColorTheme;
    };

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const online = new Set<string>();
      const userProfiles: Record<string, PresenceData> = {};
      
      // Presence state structure: { "presence_key": [{ ...userData }] }
      Object.entries(state).forEach(([presenceKey, presences]) => {
        if (presences && Array.isArray(presences) && presences.length > 0) {
          const presenceData = presences[0] as PresenceData;
          // The presence key IS the user id (we set it that way in config)
          const odis_playName = presenceKey;
          online.add(odis_playName);
          userProfiles[odis_playName] = presenceData;
          console.log('Presence data for ' + odis_playName + ':', presenceData);
        }
      });
      
      console.log('Presence sync - online users:', Array.from(online));
      console.log('User profiles from presence:', userProfiles);
      setOnlineUsers(online);
      
      // Update friends' online status AND their profile data if we have it
      setFriends(prev => prev.map(friend => {
        const profile = userProfiles[friend.id];
        const isOnline = online.has(friend.id);
        
        // Only update profile data if we actually got data from presence
        if (profile && (profile.username || profile.displayName)) {
          console.log(`Updating friend ${friend.id} with profile:`, profile);
          return {
            ...friend,
            username: profile.username || friend.username,
            displayName: profile.displayName || friend.displayName,
            avatarColor: profile.avatarColor || friend.avatarColor,
            colorTheme: profile.colorTheme || friend.colorTheme,
            status: isOnline ? 'online' : 'offline',
            lastSeen: isOnline ? new Date() : friend.lastSeen,
          };
        }
        
        return {
          ...friend,
          status: isOnline ? 'online' : 'offline',
          lastSeen: isOnline ? new Date() : friend.lastSeen,
        };
      }));
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined with key:', key);
      console.log('New presences data:', newPresences);
      
      setOnlineUsers(prev => new Set(prev).add(key));
      
      // Get profile data from the joining user
      if (newPresences && Array.isArray(newPresences) && newPresences.length > 0) {
        const profile = newPresences[0] as PresenceData;
        console.log('Join event profile data:', profile);
        
        setFriends(prev => prev.map(friend => {
          if (friend.id === key && (profile.username || profile.displayName)) {
            console.log(`Updating friend ${friend.id} on join:`, profile);
            return {
              ...friend,
              username: profile.username || friend.username,
              displayName: profile.displayName || friend.displayName,
              avatarColor: profile.avatarColor || friend.avatarColor,
              colorTheme: profile.colorTheme || friend.colorTheme,
              status: 'online' as const,
              lastSeen: new Date(),
            };
          }
          if (friend.id === key) {
            return { ...friend, status: 'online' as const, lastSeen: new Date() };
          }
          return friend;
        }));
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      console.log('User left:', key);
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setFriends(prev => prev.map(friend =>
        friend.id === key ? { ...friend, status: 'offline' as const, lastSeen: new Date() } : friend
      ));
    });

    channel.subscribe(async (status) => {
      console.log('Presence channel status:', status);
      if (status === 'SUBSCRIBED') {
        try {
          // Track presence with FULL user profile data so other users can see it
          const trackData = {
            odis_playName: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarColor: user.avatarColor,
            colorTheme: user.colorTheme,
            online_at: new Date().toISOString(),
          };
          console.log('Tracking presence with data:', trackData);
          await channel.track(trackData);
          console.log('Presence tracking started with profile data');
        } catch (err) {
          console.error('Failed to track presence:', err);
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Presence channel error');
        setConnectionError('Failed to connect to presence channel');
      } else if (status === 'TIMED_OUT') {
        console.error('Presence channel timed out');
        setConnectionError('Connection timed out');
      }
    });

    presenceChannelRef.current = channel;

    return () => {
      console.log('Cleaning up presence channel');
      supabase.removeChannel(channel);
    };
  }, [user.id, user.username, user.displayName, user.avatarColor, user.colorTheme, isConnected]);

  // Setup chat channel when active chat changes
  useEffect(() => {
    if (!activeChat) {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
      return;
    }

    // Create a consistent room ID (sorted user IDs)
    const roomId = [user.id, activeChat.id].sort().join(':');
    const channel = supabase.channel(`chat:${roomId}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'message' }, ({ payload }) => {
      const message = {
        ...payload,
        createdAt: new Date(payload.createdAt),
      } as Message;
      
      // Only add if from the other person
      if (message.senderId !== user.id) {
        setMessages(prev => [...prev, message]);
        playSound('message');
      }
    });

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.odis_playName !== user.id) {
        setFriendTyping(true);
        setTimeout(() => setFriendTyping(false), 3000);
      }
    });

    channel.subscribe();
    chatChannelRef.current = channel;

    // Clear messages when switching chats
    setMessages([]);
    setFriendTyping(false);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, activeChat, playSound]);

  return (
    <AppContext.Provider
      value={{
        // Connection
        isConnected,
        connectionError,
        
        // User
        user,
        
        // Friends
        friends,
        addFriend,
        removeFriend,
        onlineUsers,
        
        // Chat
        activeChat,
        setActiveChat,
        messages,
        sendMessage,
        isTyping,
        setIsTyping,
        friendTyping,
        
        // Call
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
        
        // Reactions
        reactions,
        addReaction,
        
        // UI
        showEmojiPicker,
        setShowEmojiPicker,
        
        // Utilities
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
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
