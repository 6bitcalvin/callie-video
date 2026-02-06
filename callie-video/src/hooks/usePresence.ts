import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type PresenceData = {
  id: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastSeen: string;
};

export function usePresence(userId: string) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [userStatuses, setUserStatuses] = useState<Map<string, { status: string; lastSeen: string }>>(new Map());

  const updateStatus = useCallback(async (status: 'online' | 'offline' | 'busy' | 'away') => {
    const channel = supabase.channel('presence:global');
    
    await channel.track({
      id: userId,
      status,
      lastSeen: new Date().toISOString(),
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: userId } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const online = new Set<string>();
      const statuses = new Map<string, { status: string; lastSeen: string }>();

      Object.entries(state).forEach(([key, presences]) => {
        if (Array.isArray(presences) && presences.length > 0) {
          const presence = presences[0] as unknown as PresenceData;
          if (presence.status === 'online') {
            online.add(key);
          }
          statuses.set(key, {
            status: presence.status || 'online',
            lastSeen: presence.lastSeen || new Date().toISOString(),
          });
        }
      });

      setOnlineUsers(online);
      setUserStatuses(statuses);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (Array.isArray(newPresences) && newPresences.length > 0) {
        const presence = newPresences[0] as unknown as PresenceData;
        if (presence.status === 'online') {
          setOnlineUsers((prev) => new Set(prev).add(key));
        }
        setUserStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(key, {
            status: presence.status || 'online',
            lastSeen: presence.lastSeen || new Date().toISOString(),
          });
          return newMap;
        });
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
      setUserStatuses((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, {
          status: 'offline',
          lastSeen: new Date().toISOString(),
        });
        return newMap;
      });
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: userId,
          status: 'online',
          lastSeen: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    onlineUsers,
    userStatuses,
    updateStatus,
    isOnline: (id: string) => onlineUsers.has(id),
  };
}
