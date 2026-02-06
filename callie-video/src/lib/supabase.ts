import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egbpxmcyljjezmazbgup.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYnB4bWN5bGpqZXptYXpiZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1ODk2NDcsImV4cCI6MjA2NTE2NTY0N30.Lhs0gwMpa2vXBLit2PQNnWbpKFiox4W6aHOCHbzcVSc';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string;
          color_theme: string;
          status: 'online' | 'offline' | 'busy' | 'away';
          last_seen: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          display_name: string;
          avatar_url: string;
          color_theme: string;
          status?: 'online' | 'offline' | 'busy' | 'away';
          last_seen?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string;
          color_theme?: string;
          status?: 'online' | 'offline' | 'busy' | 'away';
          last_seen?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          message_type: 'text' | 'gif' | 'voice' | 'file' | 'emoji';
          file_url: string | null;
          created_at: string;
          read: boolean;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          message_type?: 'text' | 'gif' | 'voice' | 'file' | 'emoji';
          file_url?: string | null;
          created_at?: string;
          read?: boolean;
        };
        Update: {
          read?: boolean;
        };
      };
      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: 'pending' | 'accepted' | 'blocked';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: 'pending' | 'accepted' | 'blocked';
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'blocked';
        };
      };
    };
  };
};

export type UserProfile = Database['public']['Tables']['users']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Friendship = Database['public']['Tables']['friendships']['Row'];

export type SignalingMessage = {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-invite' | 'call-accept' | 'call-reject' | 'call-end' | 'call-busy';
  from: string;
  to: string;
  roomId: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
  isVideo?: boolean;
  fromUser?: {
    displayName: string;
    avatarUrl: string;
    colorTheme: string;
  };
};
