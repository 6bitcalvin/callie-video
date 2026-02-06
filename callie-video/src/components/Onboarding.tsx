import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Sparkles, ArrowRight, Check, Copy, Video, MessageCircle, Palette } from 'lucide-react';
import { cn } from '@/utils/cn';
import { colorThemes, ColorTheme } from '@/types';
import { useApp } from '@/context/AppContext';
import { v4 as uuidv4 } from 'uuid';

const avatarPresets = [
  'adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles', 'fun-emoji',
  'lorelei', 'micah', 'miniavs', 'open-peeps', 'personas', 'pixel-art',
];

export function Onboarding() {
  const { setUser, setIsOnboarded, playSound } = useApp();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(colorThemes[0]);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState('avataaars');
  const [avatarSeed, setAvatarSeed] = useState('callie-user-' + Date.now());
  const [copied, setCopied] = useState(false);
  const [generatedId] = useState(uuidv4());

  const getAvatarUrl = (style: string, seed: string) =>
    `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  const handleComplete = () => {
    setUser({
      id: generatedId,
      username,
      displayName: displayName || username,
      avatarUrl: getAvatarUrl(selectedAvatarStyle, avatarSeed),
      colorTheme: selectedTheme,
      status: 'online',
    });
    setIsOnboarded(true);
    playSound('pop');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(generatedId);
    setCopied(true);
    playSound('pop');
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      title: 'Welcome to Callie! 🎉',
      subtitle: 'The most expressive way to stay connected',
    },
    {
      title: 'Create Your Identity',
      subtitle: 'Pick a username that represents you',
    },
    {
      title: 'Choose Your Vibe',
      subtitle: 'Select a color theme that matches your energy',
    },
    {
      title: 'Design Your Avatar',
      subtitle: 'Express yourself with a unique look',
    },
    {
      title: 'Your Unique ID',
      subtitle: 'Share this with friends to connect',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ top: '10%', left: '10%' }}
        />
        <motion.div
          className="absolute w-80 h-80 bg-cyan-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          style={{ bottom: '10%', right: '10%' }}
        />
        <motion.div
          className="absolute w-64 h-64 bg-pink-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 80, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          style={{ top: '50%', left: '50%' }}
        />
      </div>

      <motion.div
        className="relative w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Glassmorphic Card */}
        <div className="backdrop-blur-xl bg-white/10 rounded-[32px] border border-white/20 shadow-2xl overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1 bg-white/10">
            <motion.div
              className={`h-full bg-gradient-to-r ${selectedTheme.gradient}`}
              initial={{ width: '20%' }}
              animate={{ width: `${((step + 1) / 5) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="p-8">
            {/* Step Header */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center mb-8"
              >
                <motion.h1
                  className="text-3xl font-bold text-white mb-2"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {steps[step].title}
                </motion.h1>
                <p className="text-white/60">{steps[step].subtitle}</p>
              </motion.div>
            </AnimatePresence>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center space-y-6"
                >
                  <motion.div
                    className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-r ${selectedTheme.gradient} p-1`}
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                      <Sparkles className="w-16 h-16 text-white" />
                    </div>
                  </motion.div>

                  <div className="space-y-4 text-white/80">
                    <motion.div 
                      className="flex items-center gap-3 justify-center"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="w-12 h-12 rounded-xl bg-purple-500/30 flex items-center justify-center">
                        <Video className="w-6 h-6 text-purple-400" />
                      </div>
                      <span className="text-left">Crystal clear video calls</span>
                    </motion.div>
                    <motion.div 
                      className="flex items-center gap-3 justify-center"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/30 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-cyan-400" />
                      </div>
                      <span className="text-left">Real-time messaging</span>
                    </motion.div>
                    <motion.div 
                      className="flex items-center gap-3 justify-center"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      <div className="w-12 h-12 rounded-xl bg-pink-500/30 flex items-center justify-center">
                        <Palette className="w-6 h-6 text-pink-400" />
                      </div>
                      <span className="text-left">Personalized themes</span>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="identity"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        type="text"
                        placeholder="Username (e.g., cosmic_coder)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_').replace(/[^a-z0-9_]/g, ''))}
                        className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        type="text"
                        placeholder="Display Name (e.g., Alex Chen)"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-white/40 text-sm text-center">
                    Your username will be visible to other users
                  </p>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="theme"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {colorThemes.map((theme) => (
                      <motion.button
                        key={theme.name}
                        onClick={() => {
                          setSelectedTheme(theme);
                          playSound('pop');
                        }}
                        className={cn(
                          'relative p-4 rounded-2xl border-2 transition-all',
                          selectedTheme.name === theme.name
                            ? 'border-white bg-white/20'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`h-12 rounded-xl bg-gradient-to-r ${theme.gradient} mb-2`} />
                        <span className="text-white text-sm font-medium">{theme.name}</span>
                        {selectedTheme.name === theme.name && (
                          <motion.div
                            className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <Check className="w-4 h-4 text-slate-900" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="avatar"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Avatar Preview */}
                  <motion.div
                    className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-r ${selectedTheme.gradient} p-1`}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <img
                      src={getAvatarUrl(selectedAvatarStyle, avatarSeed)}
                      alt="Avatar"
                      className="w-full h-full rounded-full bg-white"
                    />
                  </motion.div>

                  {/* Avatar Styles */}
                  <div className="grid grid-cols-4 gap-2">
                    {avatarPresets.map((style) => (
                      <motion.button
                        key={style}
                        onClick={() => {
                          setSelectedAvatarStyle(style);
                          playSound('pop');
                        }}
                        className={cn(
                          'p-2 rounded-xl border-2 transition-all',
                          selectedAvatarStyle === style
                            ? 'border-white bg-white/20'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <img
                          src={getAvatarUrl(style, avatarSeed)}
                          alt={style}
                          className="w-full aspect-square rounded-lg"
                        />
                      </motion.button>
                    ))}
                  </div>

                  {/* Randomize Button */}
                  <button
                    onClick={() => {
                      setAvatarSeed(uuidv4());
                      playSound('pop');
                    }}
                    className="w-full py-3 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    Randomize
                  </button>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="id"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Final Avatar Preview */}
                  <motion.div
                    className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-r ${selectedTheme.gradient} p-1`}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <img
                      src={getAvatarUrl(selectedAvatarStyle, avatarSeed)}
                      alt="Avatar"
                      className="w-full h-full rounded-full bg-white"
                    />
                  </motion.div>

                  <div className="text-center">
                    <h3 className="text-white font-semibold text-lg">{displayName || username}</h3>
                    <p className="text-white/50">@{username}</p>
                  </div>

                  {/* User ID */}
                  <div className="space-y-2">
                    <label className="text-white/60 text-sm block text-center">
                      Your unique ID - share this with friends!
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm font-mono truncate text-center">
                        {generatedId}
                      </div>
                      <motion.button
                        onClick={handleCopyId}
                        className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                          copied ? 'bg-green-500 text-white' : `bg-gradient-to-r ${selectedTheme.gradient} text-white`
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </motion.button>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-white/60 text-sm text-center">
                      💡 <strong className="text-white/80">Tip:</strong> Copy and share your ID with friends. 
                      They can add you by pasting it in the "Add Friend" dialog.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-8">
              {step > 0 && (
                <motion.button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-medium hover:bg-white/20 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Back
                </motion.button>
              )}
              <motion.button
                onClick={() => {
                  if (step === 4) {
                    handleComplete();
                  } else {
                    setStep(step + 1);
                    playSound('pop');
                  }
                }}
                disabled={step === 1 && !username}
                className={cn(
                  'flex-1 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all',
                  step === 1 && !username
                    ? 'bg-white/20 text-white/40 cursor-not-allowed'
                    : `bg-gradient-to-r ${selectedTheme.gradient} text-white hover:shadow-lg hover:shadow-purple-500/25`
                )}
                whileHover={step === 1 && !username ? {} : { scale: 1.02 }}
                whileTap={step === 1 && !username ? {} : { scale: 0.98 }}
              >
                {step === 4 ? "Let's Go!" : 'Continue'}
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === step ? `bg-gradient-to-r ${selectedTheme.gradient}` : 'bg-white/30',
                i <= step ? 'w-6' : 'w-2'
              )}
              animate={i === step ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
