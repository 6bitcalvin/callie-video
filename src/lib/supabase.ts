import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egbpxmcyljjezmazbgup.supabase.co';

// IMPORTANT: You need to replace this with your actual anon key from Supabase Dashboard
// Go to: https://supabase.com/dashboard -> Your Project -> Settings -> API -> anon public key
// The key should start with "eyJ..."
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYnB4bWN5bGpqZXptYXpiZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1ODk2NDcsImV4cCI6MjA2NTE2NTY0N30.Lhs0gwMpa2vXBLit2PQNnWbpKFiox4W6aHOCHbzcVSc';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Test connection function
export async function testSupabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const channel = supabase.channel('test-connection');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        supabase.removeChannel(channel);
        resolve({ connected: false, error: 'Connection timeout - check your API key' });
      }, 5000);

      channel.subscribe((status) => {
        clearTimeout(timeout);
        supabase.removeChannel(channel);
        
        if (status === 'SUBSCRIBED') {
          resolve({ connected: true });
        } else if (status === 'CHANNEL_ERROR') {
          resolve({ connected: false, error: 'Channel error - check your API key' });
        } else if (status === 'TIMED_OUT') {
          resolve({ connected: false, error: 'Connection timed out' });
        } else {
          resolve({ connected: true });
        }
      });
    });
  } catch (error) {
    return { connected: false, error: String(error) };
  }
}

export type SignalingMessage = {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-invite' | 'call-accept' | 'call-reject' | 'call-end' | 'call-busy';
  from: string;
  to: string;
  roomId: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
  isVideo?: boolean;
  fromUser?: {
    displayName: string;
    avatarColor: string;
    colorTheme: string;
  };
};
