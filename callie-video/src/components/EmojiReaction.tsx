import { motion } from 'framer-motion';

type EmojiReactionProps = {
  emoji: string;
  x: number;
  y: number;
  onComplete: () => void;
};

export function EmojiReaction({ emoji, x, y, onComplete }: EmojiReactionProps) {
  return (
    <motion.div
      className="fixed text-6xl pointer-events-none z-50"
      initial={{ 
        opacity: 1, 
        scale: 0, 
        x: x, 
        y: y,
        rotate: 0 
      }}
      animate={{ 
        opacity: [1, 1, 0], 
        scale: [0, 1.5, 1], 
        y: y - 200,
        rotate: [0, -15, 15, 0] 
      }}
      transition={{ 
        duration: 2, 
        ease: 'easeOut' 
      }}
      onAnimationComplete={onComplete}
    >
      {emoji}
    </motion.div>
  );
}
