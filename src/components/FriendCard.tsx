import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, MessageCircle, MoreVertical, UserMinus, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Friend } from '@/types';
import { ColorAvatar } from './ColorAvatar';

type FriendCardProps = {
  friend: Friend;
  onChat: () => void;
  onCall: (video: boolean) => void;
  onRemove?: (friendId: string) => void;
};

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-slate-400',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
};

const statusText = {
  online: 'Online',
  offline: 'Offline',
  busy: 'Busy',
  away: 'Away',
};

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function FriendCard({ friend, onChat, onCall, onRemove }: FriendCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleRemove = () => {
    if (onRemove) {
      onRemove(friend.id);
    }
    setShowRemoveConfirm(false);
    setShowMenu(false);
  };

  return (
    <>
      <motion.div
        className="group relative backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 p-4 hover:bg-white/15 transition-all cursor-pointer overflow-hidden"
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        layout
        onClick={onChat}
      >
        {/* Gradient Border Glow */}
        <motion.div
          className={`absolute inset-0 bg-gradient-to-r ${friend.colorTheme.gradient} opacity-0 group-hover:opacity-20 transition-opacity rounded-3xl`}
        />

        <div className="relative flex items-center gap-4">
          {/* Avatar with Status */}
          <ColorAvatar
            name={friend.displayName}
            color={friend.avatarColor}
            size="lg"
            showBorder
            borderGradient={friend.colorTheme.gradient}
            status={friend.status}
            animate={friend.status === 'online'}
          />

          {/* Unread Badge */}
          {friend.unreadCount > 0 && (
            <motion.div
              className="absolute top-0 left-10 min-w-6 h-6 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center px-1.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <span className="text-white text-xs font-bold">
                {friend.unreadCount > 99 ? '99+' : friend.unreadCount}
              </span>
            </motion.div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate">{friend.displayName}</h3>
            <p className="text-white/50 text-sm truncate">@{friend.username}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={cn('w-2 h-2 rounded-full', statusColors[friend.status])} />
              <span className="text-white/40 text-xs">
                {friend.status === 'online' ? statusText[friend.status] : getTimeAgo(friend.lastSeen)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onChat();
              }}
              className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <MessageCircle className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onCall(false);
              }}
              className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Phone className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onCall(true);
              }}
              className={`w-10 h-10 rounded-xl bg-gradient-to-r ${friend.colorTheme.gradient} flex items-center justify-center text-white transition-all`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Video className="w-5 h-5" />
            </motion.button>
            
            {/* More Menu */}
            {onRemove && (
              <div className="relative">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <MoreVertical className="w-5 h-5" />
                </motion.button>

                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -10 }}
                      className="absolute right-0 top-12 z-50 backdrop-blur-xl bg-slate-800/90 border border-white/20 rounded-2xl overflow-hidden shadow-2xl min-w-[180px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setShowRemoveConfirm(true);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/20 flex items-center gap-3 transition-colors"
                      >
                        <UserMinus className="w-5 h-5" />
                        <span>Remove Friend</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Remove Friend Confirmation Modal */}
      <AnimatePresence>
        {showRemoveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRemoveConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="backdrop-blur-xl bg-slate-800/90 border border-white/20 rounded-3xl p-6 max-w-sm mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Remove Friend</h3>
                  <p className="text-white/50 text-sm">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-white/70 mb-6">
                Are you sure you want to remove <span className="font-semibold text-white">{friend.displayName}</span> from your friends list?
              </p>
              
              <div className="flex gap-3">
                <motion.button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleRemove}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Remove
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
