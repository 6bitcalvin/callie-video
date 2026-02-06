import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

type VoiceWaveformProps = {
  isRecording: boolean;
  duration?: number;
  className?: string;
};

export function VoiceWaveform({ isRecording, duration = 0, className }: VoiceWaveformProps) {
  const bars = 40;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex items-center gap-0.5 h-10">
        {Array.from({ length: bars }).map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              'w-1 rounded-full',
              isRecording ? 'bg-gradient-to-t from-purple-500 to-pink-500' : 'bg-white/30'
            )}
            animate={
              isRecording
                ? {
                    height: [8, Math.random() * 32 + 8, 8],
                  }
                : { height: 8 }
            }
            transition={{
              duration: 0.5,
              repeat: isRecording ? Infinity : 0,
              delay: i * 0.02,
              ease: 'easeInOut',
            }}
            style={{ height: 8 }}
          />
        ))}
      </div>
      <span className="text-white/60 text-sm font-mono min-w-[40px]">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
