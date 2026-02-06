import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { StatusIndicator } from './StatusIndicator';

type AvatarProps = {
  src: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  gradient?: string;
  showBorder?: boolean;
  animate?: boolean;
  className?: string;
};

const sizes = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const statusSizes = {
  xs: 'sm' as const,
  sm: 'sm' as const,
  md: 'md' as const,
  lg: 'md' as const,
  xl: 'lg' as const,
};

export function Avatar({
  src,
  alt,
  size = 'md',
  status,
  gradient = 'from-purple-500 to-pink-500',
  showBorder = true,
  animate = true,
  className,
}: AvatarProps) {
  return (
    <div className={cn('relative', className)}>
      <motion.div
        className={cn(
          'rounded-2xl p-0.5',
          sizes[size],
          showBorder && `bg-gradient-to-r ${gradient}`
        )}
        animate={animate && status === 'online' ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <img
          src={src}
          alt={alt}
          className={cn(
            'w-full h-full object-cover bg-white',
            showBorder ? 'rounded-[14px]' : 'rounded-2xl'
          )}
        />
      </motion.div>
      
      {status && (
        <div className="absolute -bottom-1 -right-1">
          <StatusIndicator status={status} size={statusSizes[size]} />
        </div>
      )}
    </div>
  );
}
