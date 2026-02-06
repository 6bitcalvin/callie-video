import { AppProvider, useApp } from '@/context/AppContext';
import { Onboarding } from '@/components/Onboarding';
import { Dashboard } from '@/components/Dashboard';
import { AnimatePresence, motion } from 'framer-motion';

function AppContent() {
  const { isOnboarded, user } = useApp();

  return (
    <AnimatePresence mode="wait">
      {!isOnboarded || !user ? (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Onboarding />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="h-screen"
        >
          <Dashboard />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
