import { motion } from 'framer-motion';
import { X, Phone, MessageCircle, Bell } from 'lucide-react';
import { cn } from '@/utils/cn';

type NotificationToastProps = {
  type: 'call' | 'message' | 'alert';
  title: string;
  message: string;
  avatarUrl?: string;
  gradient?: string;
  onClose: () => void;
  onAction?: () => void;
  actionLabel?: string;
};

const icons = {
  call: Phone,
  message: MessageCircle,
  alert: Bell,
};

export function NotificationToast({
  type,
  title,
  message,
  avatarUrl,
  gradient = 'from-purple-500 to-pink-500',
  onClose,
  onAction,
  actionLabel,
}: NotificationToastProps) {
  const Icon = icons[type];

  return (
    <motion.div
      className="fixed top-4 right-4 z-[200] max-w-sm w-full"
      initial={{ opacity: 0, y: -50, x: 50 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -50, x: 50 }}
    >
      <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-4 shadow-2xl">
        <div className="flex items-start gap-4">
          {/* Avatar or Icon */}
          {avatarUrl ? (
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${gradient} p-0.5 flex-shrink-0`}>
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full rounded-[10px] bg-white object-cover"
              />
            </div>
          ) : (
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold">{title}</h3>
                <p className="text-white/60 text-sm mt-1 line-clamp-2">{message}</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Button */}
            {onAction && actionLabel && (
              <motion.button
                onClick={onAction}
                className={cn(
                  'mt-3 px-4 py-1.5 rounded-lg text-sm font-medium',
                  `bg-gradient-to-r ${gradient} text-white`
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {actionLabel}
              </motion.button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <motion.div
          className={`h-1 mt-4 rounded-full bg-gradient-to-r ${gradient}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: 5, ease: 'linear' }}
          onAnimationComplete={onClose}
        />
      </div>
    </motion.div>
  );
}
