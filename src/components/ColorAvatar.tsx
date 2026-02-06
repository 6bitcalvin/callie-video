import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

type ColorAvatarProps = {
  name: string;
  color: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showBorder?: boolean;
  borderGradient?: string;
  animate?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
};

const sizes = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
  '2xl': 'w-24 h-24 text-3xl',
};

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-slate-400',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
};

// Get initials from name
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Generate a consistent color from a string
export function stringToColor(str: string): string {
  const colors = [
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#84CC16', // Lime
    '#A855F7', // Violet
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function ColorAvatar({
  name,
  color,
  size = 'md',
  showBorder = false,
  borderGradient = 'from-purple-500 to-pink-500',
  animate = false,
  status,
  className,
}: ColorAvatarProps) {
  const initials = getInitials(name);
  const bgColor = color || stringToColor(name);

  return (
    <div className={cn('relative', className)}>
      <motion.div
        className={cn(
          'rounded-2xl flex items-center justify-center font-bold text-white relative overflow-hidden',
          sizes[size],
          showBorder && `p-0.5 bg-gradient-to-r ${borderGradient}`
        )}
        animate={animate ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {showBorder ? (
          <div
            className={cn(
              'w-full h-full rounded-[14px] flex items-center justify-center font-bold text-white'
            )}
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
        ) : (
          <div
            className={cn(
              'w-full h-full rounded-2xl flex items-center justify-center font-bold text-white'
            )}
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
        )}
      </motion.div>

      {/* Status Indicator */}
      {status && (
        <motion.div
          className={cn(
            'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900',
            statusColors[status]
          )}
          animate={
            status === 'online'
              ? {
                  scale: [1, 1.2, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(34, 197, 94, 0.4)',
                    '0 0 0 6px rgba(34, 197, 94, 0)',
                  ],
                }
              : {}
          }
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
  );
}
