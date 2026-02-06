import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Palette, Bell, Shield, Info, Copy, Check, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useApp } from '@/context/AppContext';
import { colorThemes, ColorTheme } from '@/types';
import { v4 as uuidv4 } from 'uuid';

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Tab = 'profile' | 'theme' | 'notifications' | 'privacy' | 'about';

const avatarPresets = [
  'adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles', 'fun-emoji',
  'lorelei', 'micah', 'miniavs', 'open-peeps', 'personas', 'pixel-art',
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, setUser, copyUserIdToClipboard, playSound } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState('avataaars');
  const [avatarSeed, setAvatarSeed] = useState(user?.id || 'default');

  if (!user) return null;

  const getAvatarUrl = (style: string, seed: string) =>
    `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  const handleCopyId = () => {
    copyUserIdToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleThemeChange = (theme: ColorTheme) => {
    setUser({ ...user, colorTheme: theme });
    playSound('pop');
  };

  const handleAvatarChange = (style: string) => {
    setSelectedAvatarStyle(style);
    setUser({ ...user, avatarUrl: getAvatarUrl(style, avatarSeed) });
    playSound('pop');
  };

  const handleRandomizeAvatar = () => {
    const newSeed = uuidv4();
    setAvatarSeed(newSeed);
    setUser({ ...user, avatarUrl: getAvatarUrl(selectedAvatarStyle, newSeed) });
    playSound('pop');
  };

  const handleSaveDisplayName = () => {
    if (displayName.trim()) {
      setUser({ ...user, displayName: displayName.trim() });
      playSound('pop');
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl max-h-[80vh] backdrop-blur-xl bg-slate-900/90 rounded-3xl border border-white/20 overflow-hidden flex"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar */}
            <div className="w-48 bg-white/5 border-r border-white/10 p-4">
              <h2 className="text-white font-bold text-lg mb-4 px-2">Settings</h2>
              <nav className="space-y-1">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                      activeTab === id
                        ? `bg-gradient-to-r ${user.colorTheme.gradient} text-white`
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-semibold text-lg capitalize">{activeTab}</h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {activeTab === 'profile' && (
                <div className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-6">
                    <motion.div
                      className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${user.colorTheme.gradient} p-0.5`}
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="w-full h-full rounded-[14px] bg-white"
                      />
                    </motion.div>
                    <div>
                      <h4 className="text-white font-semibold">{user.displayName}</h4>
                      <p className="text-white/50">@{user.username}</p>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Display Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                      />
                      <motion.button
                        onClick={handleSaveDisplayName}
                        className={`px-4 py-2.5 bg-gradient-to-r ${user.colorTheme.gradient} rounded-xl text-white font-medium`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Save
                      </motion.button>
                    </div>
                  </div>

                  {/* User ID */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Your ID</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm font-mono truncate">
                        {user.id}
                      </div>
                      <motion.button
                        onClick={handleCopyId}
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                          copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </motion.button>
                    </div>
                  </div>

                  {/* Avatar Styles */}
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">Change Avatar Style</label>
                    <div className="grid grid-cols-6 gap-2">
                      {avatarPresets.map((style) => (
                        <motion.button
                          key={style}
                          onClick={() => handleAvatarChange(style)}
                          className={cn(
                            'p-1.5 rounded-lg border-2 transition-all',
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
                            className="w-full aspect-square rounded"
                          />
                        </motion.button>
                      ))}
                    </div>
                    <button
                      onClick={handleRandomizeAvatar}
                      className="mt-3 w-full py-2 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      Randomize Avatar
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'theme' && (
                <div className="space-y-4">
                  <p className="text-white/60 text-sm mb-4">Choose a color theme that matches your vibe</p>
                  <div className="grid grid-cols-2 gap-3">
                    {colorThemes.map((theme) => (
                      <motion.button
                        key={theme.name}
                        onClick={() => handleThemeChange(theme)}
                        className={cn(
                          'relative p-4 rounded-2xl border-2 transition-all',
                          user.colorTheme.name === theme.name
                            ? 'border-white bg-white/20'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`h-12 rounded-xl bg-gradient-to-r ${theme.gradient} mb-2`} />
                        <span className="text-white text-sm font-medium">{theme.name}</span>
                        {user.colorTheme.name === theme.name && (
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
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <h4 className="text-white font-medium">Sound Effects</h4>
                      <p className="text-white/50 text-sm">Play sounds for messages and calls</p>
                    </div>
                    <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <h4 className="text-white font-medium">Desktop Notifications</h4>
                      <p className="text-white/50 text-sm">Show notifications for new messages</p>
                    </div>
                    <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <h4 className="text-white font-medium mb-2">Data Privacy</h4>
                    <p className="text-white/50 text-sm">
                      Callie uses peer-to-peer WebRTC connections for calls. Your video and audio
                      data is streamed directly to your friends without going through our servers.
                    </p>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                    <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      Clear Data
                    </h4>
                    <p className="text-white/50 text-sm mb-3">
                      This will log you out and clear all local data.
                    </p>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        window.location.reload();
                      }}
                      className="px-4 py-2 bg-red-500 rounded-lg text-white text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      Clear All Data
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'about' && (
                <div className="space-y-4">
                  <div className="text-center py-6">
                    <motion.div
                      className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-r ${user.colorTheme.gradient} flex items-center justify-center mb-4`}
                      animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <Sparkles className="w-10 h-10 text-white" />
                    </motion.div>
                    <h3 className="text-white font-bold text-2xl">Callie</h3>
                    <p className="text-white/50">Version 1.0.0</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <h4 className="text-white font-medium mb-2">Features</h4>
                    <ul className="text-white/60 text-sm space-y-1">
                      <li>• Real-time video & voice calls</li>
                      <li>• Peer-to-peer WebRTC connections</li>
                      <li>• Real-time presence & messaging</li>
                      <li>• Custom themes & avatars</li>
                      <li>• Screen sharing</li>
                      <li>• Emoji reactions</li>
                    </ul>
                  </div>
                  <p className="text-white/40 text-xs text-center">
                    Made with ❤️ using React, Supabase, and WebRTC
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
