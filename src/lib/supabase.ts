import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egbpxmcyljjezmazbgup.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYnB4bWN5bGpqZXptYXpiZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzc2NzcsImV4cCI6MjA4NTkxMzY3N30.9iH81-H8nlgS-YGz76Bs2Unhv93pQuLR6b2qrWEKa_w';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Sign in anonymously
export async function signInAnonymously(): Promise<{ userId: string | null; error: string | null }> {
  try {
    // Check if already signed in
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      console.log('Already signed in:', session.user.id);
      return { userId: session.user.id, error: null };
    }

    // Sign in anonymously
    console.log('Signing in anonymously...');
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) {
      console.error('Anonymous sign-in error:', error);
      return { userId: null, error: error.message };
    }

    if (data.user) {
      console.log('Signed in anonymously:', data.user.id);
      return { userId: data.user.id, error: null };
    }

    return { userId: null, error: 'Unknown error' };
  } catch (err) {
    console.error('Sign in error:', err);
    return { userId: null, error: String(err) };
  }
}

// Test realtime connection
export async function testRealtimeConnection(): Promise<{ connected: boolean; error?: string }> {
  return new Promise((resolve) => {
    const testChannel = supabase.channel('connection-test-' + Date.now());
    
    const timeout = setTimeout(() => {
      supabase.removeChannel(testChannel);
      resolve({ connected: false, error: 'Connection timeout' });
    }, 10000);

    testChannel.subscribe((status) => {
      console.log('Test channel status:', status);
      
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        supabase.removeChannel(testChannel);
        resolve({ connected: true });
      } else if (status === 'CHANNEL_ERROR') {
        clearTimeout(timeout);
        supabase.removeChannel(testChannel);
        resolve({ connected: false, error: 'Channel error' });
      } else if (status === 'TIMED_OUT') {
        clearTimeout(timeout);
        supabase.removeChannel(testChannel);
        resolve({ connected: false, error: 'Timed out' });
      }
    });
  });
}

export type SignalingMessage = {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-invite' | 'call-accept' | 'call-reject' | 'call-end' | 'call-busy' | 'participant-joined';
  from: string;
  to: string;
  roomId: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
  isVideo?: boolean;
  participants?: string[];
  fromUser?: {
    displayName: string;
    avatarColor: string;
    colorTheme: string;
  };
};
