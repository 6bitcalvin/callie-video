import { motion } from 'framer-motion';
import { Phone, Video, MessageCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Friend } from '@/types';

type FriendCardProps = {
  friend: Friend;
  onChat: () => void;
  onCall: (video: boolean) => void;
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

export function FriendCard({ friend, onChat, onCall }: FriendCardProps) {
  return (
    <motion.div
      className="group relative backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 p-4 hover:bg-white/15 transition-all cursor-pointer overflow-hidden"
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      {/* Gradient Border Glow */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${friend.colorTheme.gradient} opacity-0 group-hover:opacity-20 transition-opacity rounded-3xl`}
      />

      <div className="relative flex items-center gap-4">
        {/* Avatar with Status */}
        <div className="relative">
          <motion.div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${friend.colorTheme.gradient} p-0.5`}
            animate={friend.status === 'online' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <img
              src={friend.avatarUrl}
              alt={friend.displayName}
              className="w-full h-full rounded-[14px] bg-white object-cover"
            />
          </motion.div>
          
          {/* Status Indicator */}
          <motion.div
            className={cn(
              'absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center',
              statusColors[friend.status]
            )}
            animate={friend.status === 'online' ? {
              scale: [1, 1.2, 1],
              boxShadow: [
                '0 0 0 0 rgba(34, 197, 94, 0.4)',
                '0 0 0 8px rgba(34, 197, 94, 0)',
              ],
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          {/* Unread Badge */}
          {friend.unreadCount > 0 && (
            <motion.div
              className="absolute -top-2 -right-2 min-w-6 h-6 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center px-1.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <span className="text-white text-xs font-bold">
                {friend.unreadCount > 99 ? '99+' : friend.unreadCount}
              </span>
            </motion.div>
          )}
        </div>

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
        </div>
      </div>
    </motion.div>
  );
}
