import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Users,
  Smile,
  MessageCircle,
  MoreHorizontal,
  Maximize2,
  Grid3X3,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Friend, Reaction } from '@/types';
import { useApp } from '@/context/AppContext';
import { ColorAvatar } from './ColorAvatar';

type CallOverlayProps = {
  participants: Friend[];
  callState: 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';
  onEndCall: () => void;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => Promise<void>;
};

const callEmojis = ['👍', '👏', '❤️', '😂', '😮', '🔥', '🎉', '💯'];

// Hook to detect mobile devices
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

function VideoTile({
  stream,
  participant,
  isLocal,
  isMuted,
  isCameraOff,
  isMain,
  isMobile,
  participantCount,
}: {
  stream: MediaStream | null;
  participant: Friend;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isMain?: boolean;
  isMobile?: boolean;
  participantCount?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Determine aspect ratio based on device and participant count
  const getAspectRatioClass = () => {
    if (isMobile) {
      // Mobile: Portrait-style videos
      if (participantCount && participantCount <= 2) {
        return 'aspect-[3/4]'; // Tall portrait for 1-2 people
      }
      return 'aspect-square'; // Square for 3+ people on mobile
    }
    // Desktop: Landscape videos
    if (participantCount && participantCount <= 2) {
      return 'aspect-video'; // 16:9 for 1-2 people
    }
    return 'aspect-[4/3]'; // 4:3 for 3+ people
  };

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl md:rounded-3xl backdrop-blur-xl bg-slate-800 border border-white/20',
        isMain ? 'col-span-2 row-span-2' : '',
        getAspectRatioClass()
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      layout
    >
      {/* Breathing Animation on Video Frame */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${participant.colorTheme.gradient} opacity-20`}
        animate={{
          scale: [1, 1.02, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {isCameraOff || !stream ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
          <ColorAvatar
            name={participant.displayName}
            color={participant.avatarColor}
            size={isMobile ? 'lg' : 'xl'}
            showBorder
            borderGradient={participant.colorTheme.gradient}
            animate
          />
          <p className="text-white font-medium mt-2 md:mt-4 text-sm md:text-base">{isLocal ? 'You' : participant.displayName}</p>
          {isCameraOff && (
            <p className="text-white/50 text-xs md:text-sm mt-1">Camera off</p>
          )}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "absolute inset-0 w-full h-full",
            isMobile ? "object-cover" : "object-cover"
          )}
          style={{
            // Mirror local video for selfie view
            transform: isLocal ? 'scaleX(-1)' : 'none'
          }}
        />
      )}

      {/* Participant Info */}
      <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 right-2 md:right-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 md:gap-2 backdrop-blur-md bg-black/30 rounded-full px-2 md:px-3 py-1 md:py-1.5">
          <span className="text-white text-xs md:text-sm font-medium truncate max-w-[80px] md:max-w-none">
            {isLocal ? 'You' : participant.displayName}
          </span>
          {isMuted && <MicOff className="w-3 md:w-4 h-3 md:h-4 text-red-400" />}
        </div>
      </div>

      {/* Speaking Indicator */}
      <motion.div
        className="absolute inset-0 border-2 md:border-4 rounded-2xl md:rounded-3xl pointer-events-none"
        animate={{
          borderColor: ['rgba(139, 92, 246, 0)', 'rgba(139, 92, 246, 0.5)', 'rgba(139, 92, 246, 0)'],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
}

function FloatingReaction({ reaction }: { reaction: Reaction }) {
  return (
    <motion.div
      className="absolute text-5xl pointer-events-none"
      initial={{ opacity: 1, y: 0, x: Math.random() * 200 - 100, scale: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: -200,
        scale: [0, 1.2, 1],
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2.5, ease: 'easeOut' }}
      style={{ bottom: '20%', left: '50%' }}
    >
      {reaction.emoji}
    </motion.div>
  );
}

export function CallOverlay({
  participants,
  callState,
  onEndCall,
  localStream,
  remoteStreams,
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
}: CallOverlayProps) {
  const { user, reactions, addReaction } = useApp();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [layout, setLayout] = useState<'grid' | 'spotlight'>('grid');
  const isMobile = useIsMobile();
  const totalParticipants = participants.length + 1;

  useEffect(() => {
    if (callState === 'connected') {
      const interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getGridClass = () => {
    const count = totalParticipants;
    if (isMobile) {
      // Mobile: Stack vertically for 1-2, 2x2 grid for more
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-1 gap-2';
      return 'grid-cols-2 gap-2';
    }
    // Desktop: Side by side for 2, grid for more
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    return 'grid-cols-3 grid-rows-2';
  };

  if (!user) return null;

  const localParticipant: Friend = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    colorTheme: user.colorTheme,
    status: 'online',
    lastSeen: new Date(),
    unreadCount: 0,
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-slate-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-slate-900 to-cyan-900/30" />

      {/* Floating Reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {reactions.map((reaction) => (
            <FloatingReaction key={reaction.id} reaction={reaction} />
          ))}
        </AnimatePresence>
      </div>

      {/* Call State Overlays */}
      <AnimatePresence>
        {callState === 'ringing' && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                boxShadow: [
                  '0 0 0 0 rgba(139, 92, 246, 0.4)',
                  '0 0 0 40px rgba(139, 92, 246, 0)',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ColorAvatar
                name={participants[0]?.displayName || 'Unknown'}
                color={participants[0]?.avatarColor || '#8B5CF6'}
                size="2xl"
                showBorder
                borderGradient={participants[0]?.colorTheme.gradient || 'from-purple-500 to-pink-500'}
              />
            </motion.div>
            <motion.h2
              className="text-white text-2xl font-bold mt-8"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Calling {participants[0]?.displayName}...
            </motion.h2>
            <p className="text-white/60 mt-2">Ringing</p>
          </motion.div>
        )}

        {callState === 'connecting' && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Wave Shimmer Skeleton */}
            <div className="relative w-64 h-64">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-purple-500/50"
                  animate={{
                    scale: [1, 1.5, 2],
                    opacity: [0.5, 0.3, 0],
                  }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                />
              ))}
              <div className="absolute inset-8">
                <ColorAvatar
                  name={participants[0]?.displayName || 'Unknown'}
                  color={participants[0]?.avatarColor || '#8B5CF6'}
                  size="2xl"
                  showBorder
                  borderGradient={participants[0]?.colorTheme.gradient || 'from-purple-500 to-pink-500'}
                  animate
                />
              </div>
            </div>
            <motion.h2
              className="text-white text-xl font-bold mt-8"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Connecting...
            </motion.h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Grid */}
      {callState === 'connected' && (
        <div className={cn(
          "relative h-full px-2 md:px-4",
          isMobile ? "pt-16 pb-28" : "pt-16 pb-28",
          isMobile && totalParticipants === 2 ? "flex flex-col justify-center" : ""
        )}>
          <div className={cn(
            layout === 'grid' ? `grid ${getGridClass()}` : 'flex',
            isMobile ? 'gap-2 h-auto' : 'gap-4 h-full',
            isMobile && totalParticipants === 2 ? 'max-h-[80vh]' : '',
            'place-items-center justify-center'
          )}>
            {/* Local Video */}
            <VideoTile
              stream={localStream}
              participant={localParticipant}
              isLocal
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isMain={layout === 'spotlight' && participants.length === 0}
              isMobile={isMobile}
              participantCount={totalParticipants}
            />

            {/* Remote Videos */}
            {participants.map((participant, index) => (
              <VideoTile
                key={participant.id}
                stream={remoteStreams.get(participant.id) || null}
                participant={participant}
                isMuted={false}
                isCameraOff={!remoteStreams.has(participant.id)}
                isMain={layout === 'spotlight' && index === 0}
                isMobile={isMobile}
                participantCount={totalParticipants}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <motion.div
        className="absolute top-0 left-0 right-0 backdrop-blur-xl bg-black/30 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between safe-area-pt"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1.5 md:gap-2">
            <motion.div
              className="w-2.5 md:w-3 h-2.5 md:h-3 bg-green-500 rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                boxShadow: [
                  '0 0 0 0 rgba(34, 197, 94, 0.4)',
                  '0 0 0 8px rgba(34, 197, 94, 0)',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-white/80 font-medium text-sm md:text-base">{formatDuration(callDuration)}</span>
          </div>
          <div className="flex -space-x-2">
            {participants.slice(0, 2).map((p) => (
              <div
                key={p.id}
                className="w-6 md:w-8 h-6 md:h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: p.avatarColor }}
              >
                {p.displayName.substring(0, 1).toUpperCase()}
              </div>
            ))}
            {participants.length > 2 && (
              <div className="w-6 md:w-8 h-6 md:h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold border-2 border-slate-900">
                +{participants.length - 2}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <motion.button
            onClick={() => setLayout(layout === 'grid' ? 'spotlight' : 'grid')}
            className="w-8 md:w-10 h-8 md:h-10 rounded-lg md:rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {layout === 'grid' ? <Maximize2 className="w-4 md:w-5 h-4 md:h-5" /> : <Grid3X3 className="w-4 md:w-5 h-4 md:h-5" />}
          </motion.button>
          <motion.button
            className="hidden sm:flex w-8 md:w-10 h-8 md:h-10 rounded-lg md:rounded-xl bg-white/10 items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Users className="w-4 md:w-5 h-4 md:h-5" />
          </motion.button>
          <motion.button
            className="w-8 md:w-10 h-8 md:h-10 rounded-lg md:rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MoreHorizontal className="w-4 md:w-5 h-4 md:h-5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            className="absolute bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 backdrop-blur-xl bg-black/50 rounded-2xl p-3 md:p-4 border border-white/20 mx-2"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            <div className="flex gap-2 md:gap-3 flex-wrap justify-center">
              {callEmojis.map((emoji) => (
                <motion.button
                  key={emoji}
                  onClick={() => {
                    addReaction(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="text-2xl md:text-3xl p-1"
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-black/30 px-3 md:px-6 py-4 md:py-6 safe-area-pb"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center justify-center gap-2 md:gap-4">
          <motion.button
            onClick={onToggleMute}
            className={cn(
              'w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all',
              isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
          </motion.button>

          <motion.button
            onClick={onToggleCamera}
            className={cn(
              'w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all',
              isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5 md:w-6 md:h-6" /> : <Video className="w-5 h-5 md:w-6 md:h-6" />}
          </motion.button>

          {/* Hide screen share on mobile since it's not well supported */}
          {!isMobile && (
            <motion.button
              onClick={onToggleScreenShare}
              className={cn(
                'w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all',
                isScreenSharing
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {isScreenSharing ? <ScreenShareOff className="w-5 h-5 md:w-6 md:h-6" /> : <ScreenShare className="w-5 h-5 md:w-6 md:h-6" />}
            </motion.button>
          )}

          <motion.button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Smile className="w-5 h-5 md:w-6 md:h-6" />
          </motion.button>

          <motion.button
            onClick={() => setShowChat(!showChat)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
          </motion.button>

          <motion.button
            onClick={onEndCall}
            className="w-14 h-12 md:w-20 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-500/25"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
