import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInAnonymously } from './lib/supabase';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { AppProvider } from './context/AppContext';
import { UserProfile } from './types';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

type AppState = 'loading' | 'error' | 'onboarding' | 'dashboard';

function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const initializeApp = async () => {
    setAppState('loading');
    setErrorMessage('');

    try {
      // Sign in anonymously
      const { userId, error } = await signInAnonymously();
      
      if (error || !userId) {
        setErrorMessage(error || 'Failed to sign in');
        setAppState('error');
        return;
      }

      setAuthUserId(userId);

      // Check if profile exists in localStorage
      const savedProfile = localStorage.getItem(`callie_profile_${userId}`);
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile) as UserProfile;
          setUserProfile(profile);
          setAppState('dashboard');
        } catch {
          setAppState('onboarding');
        }
      } else {
        setAppState('onboarding');
      }
    } catch (err) {
      console.error('Initialization error:', err);
      setErrorMessage(String(err));
      setAppState('error');
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const handleOnboardingComplete = (profile: UserProfile) => {
    console.log('Onboarding complete:', profile);
    if (authUserId) {
      localStorage.setItem(`callie_profile_${authUserId}`, JSON.stringify(profile));
    }
    setUserProfile(profile);
    setAppState('dashboard');
  };

  const handleLogout = () => {
    if (authUserId) {
      localStorage.removeItem(`callie_profile_${authUserId}`);
    }
    setUserProfile(null);
    setAppState('onboarding');
  };

  // Loading screen
  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="inline-block mb-4"
          >
            <Loader2 className="w-12 h-12 text-purple-500" />
          </motion.div>
          <p className="text-white text-lg">Loading Callie...</p>
          <p className="text-white/50 text-sm mt-2">Connecting to server...</p>
        </motion.div>
      </div>
    );
  }

  // Error screen
  if (appState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-white/60 mb-4">{errorMessage}</p>
          <motion.button
            onClick={initializeApp}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium flex items-center gap-2 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {appState === 'onboarding' && authUserId && (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Onboarding
            onComplete={handleOnboardingComplete}
            authUserId={authUserId}
            authEmail={null}
          />
        </motion.div>
      )}

      {appState === 'dashboard' && userProfile && (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <AppProvider userProfile={userProfile}>
            <Dashboard onLogout={handleLogout} />
          </AppProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
