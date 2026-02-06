import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/utils/cn';
import { ReactNode } from 'react';

type GlassCardProps = HTMLMotionProps<'div'> & {
  children: ReactNode;
  variant?: 'light' | 'dark' | 'gradient';
  gradient?: string;
  hover?: boolean;
  glow?: boolean;
};

export function GlassCard({
  children,
  variant = 'light',
  gradient,
  hover = true,
  glow = false,
  className,
  ...props
}: GlassCardProps) {
  const baseStyles = 'backdrop-blur-xl rounded-3xl border overflow-hidden';
  
  const variantStyles = {
    light: 'bg-white/10 border-white/20',
    dark: 'bg-black/30 border-white/10',
    gradient: `bg-gradient-to-r ${gradient || 'from-purple-500/20 to-pink-500/20'} border-white/20`,
  };

  return (
    <motion.div
      className={cn(
        baseStyles,
        variantStyles[variant],
        hover && 'hover:bg-white/15 transition-all cursor-pointer',
        glow && 'shadow-lg shadow-purple-500/20',
        className
      )}
      whileHover={hover ? { scale: 1.02, y: -4 } : {}}
      whileTap={hover ? { scale: 0.98 } : {}}
      {...props}
    >
      {children}
    </motion.div>
  );
}
