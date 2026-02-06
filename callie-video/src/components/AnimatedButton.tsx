import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/utils/cn';
import { ReactNode } from 'react';

type AnimatedButtonProps = HTMLMotionProps<'button'> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  gradient?: string;
  loading?: boolean;
};

const variants = {
  primary: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25',
  secondary: 'bg-white/10 border border-white/20 text-white hover:bg-white/20',
  ghost: 'text-white/60 hover:text-white hover:bg-white/10',
  danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-xl',
  md: 'px-4 py-2.5 rounded-xl',
  lg: 'px-6 py-3.5 text-lg rounded-2xl',
  icon: 'w-10 h-10 rounded-xl',
};

export function AnimatedButton({
  children,
  variant = 'primary',
  size = 'md',
  gradient,
  loading = false,
  className,
  disabled,
  ...props
}: AnimatedButtonProps) {
  return (
    <motion.button
      className={cn(
        'font-medium flex items-center justify-center gap-2 transition-all',
        variants[variant],
        sizes[size],
        gradient && `bg-gradient-to-r ${gradient}`,
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      whileHover={!disabled && !loading ? { scale: 1.05 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.95 } : {}}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <motion.div
          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        children
      )}
    </motion.button>
  );
}
