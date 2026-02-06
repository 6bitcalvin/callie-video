import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

type Status = 'online' | 'offline' | 'busy' | 'away';

type StatusIndicatorProps = {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
};

const statusColors: Record<Status, string> = {
  online: 'bg-green-500',
  offline: 'bg-slate-400',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
};

const statusGlowColors: Record<Status, string> = {
  online: 'rgba(34, 197, 94, 0.4)',
  offline: 'rgba(148, 163, 184, 0)',
  busy: 'rgba(239, 68, 68, 0.4)',
  away: 'rgba(245, 158, 11, 0.4)',
};

const sizes = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-5 h-5',
};

export function StatusIndicator({ 
  status, 
  size = 'md', 
  showPulse = true, 
  className 
}: StatusIndicatorProps) {
  return (
    <motion.div
      className={cn(
        'rounded-full border-2 border-slate-900',
        statusColors[status],
        sizes[size],
        className
      )}
      animate={
        showPulse && status === 'online'
          ? {
              scale: [1, 1.2, 1],
              boxShadow: [
                `0 0 0 0 ${statusGlowColors[status]}`,
                `0 0 0 8px transparent`,
              ],
            }
          : {}
      }
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  );
}
