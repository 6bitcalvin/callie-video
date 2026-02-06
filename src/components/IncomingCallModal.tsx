import { motion } from 'framer-motion';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Friend } from '@/types';

type IncomingCallModalProps = {
  caller: Friend;
  isVideo: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallModal({ caller, isVideo, onAccept, onReject }: IncomingCallModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Animated Background Waves */}
      <div className="absolute inset-0 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{
              scale: [1, 2.5],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.75,
              ease: 'easeOut',
            }}
          >
            <div
              className={`w-64 h-64 rounded-full bg-gradient-to-r ${caller.colorTheme.gradient}`}
            />
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Avatar with Pulse Effect */}
        <motion.div
          className="relative"
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className={`w-48 h-48 rounded-full bg-gradient-to-r ${caller.colorTheme.gradient} p-1.5`}
            animate={{
              boxShadow: [
                `0 0 0 0 ${caller.colorTheme.primary}66`,
                `0 0 0 40px ${caller.colorTheme.primary}00`,
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <img
              src={caller.avatarUrl}
              alt={caller.displayName}
              className="w-full h-full rounded-full bg-white object-cover"
            />
          </motion.div>

          {/* Call Type Icon */}
          <motion.div
            className={`absolute -bottom-2 -right-2 w-14 h-14 rounded-full bg-gradient-to-r ${caller.colorTheme.gradient} flex items-center justify-center`}
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            {isVideo ? (
              <Video className="w-7 h-7 text-white" />
            ) : (
              <Phone className="w-7 h-7 text-white" />
            )}
          </motion.div>
        </motion.div>

        {/* Caller Info */}
        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-4xl font-bold text-white">{caller.displayName}</h1>
          <p className="text-white/60 text-lg mt-2">@{caller.username}</p>
          <motion.p
            className="text-white/80 text-xl mt-4"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {isVideo ? 'Incoming Video Call...' : 'Incoming Voice Call...'}
          </motion.p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="flex items-center gap-8 mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.button
            onClick={onReject}
            className="flex flex-col items-center gap-2"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-red-500/50"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(239, 68, 68, 0.4)',
                  '0 0 0 20px rgba(239, 68, 68, 0)',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <PhoneOff className="w-10 h-10 text-white" />
            </motion.div>
            <span className="text-white/80 font-medium">Decline</span>
          </motion.button>

          <motion.button
            onClick={onAccept}
            className="flex flex-col items-center gap-2"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/50"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(34, 197, 94, 0.4)',
                  '0 0 0 20px rgba(34, 197, 94, 0)',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Phone className="w-10 h-10 text-white" />
            </motion.div>
            <span className="text-white/80 font-medium">Accept</span>
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
