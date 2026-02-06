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

function VideoTile({
  stream,
  participant,
  isLocal,
  isMuted,
  isCameraOff,
  isMain,
}: {
  stream: MediaStream | null;
  participant: Friend;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isMain?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-3xl backdrop-blur-xl bg-slate-800 border border-white/20',
        isMain ? 'col-span-2 row-span-2' : ''
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
          <motion.div
            className={`w-24 h-24 rounded-full bg-gradient-to-r ${participant.colorTheme.gradient} p-1`}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <img
              src={participant.avatarUrl}
              alt={participant.displayName}
              className="w-full h-full rounded-full bg-white"
            />
          </motion.div>
          <p className="text-white font-medium mt-4">{isLocal ? 'You' : participant.displayName}</p>
          {isCameraOff && (
            <p className="text-white/50 text-sm mt-1">Camera off</p>
          )}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Participant Info */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-2 backdrop-blur-md bg-black/30 rounded-full px-3 py-1.5">
          <span className="text-white text-sm font-medium">
            {isLocal ? 'You' : participant.displayName}
          </span>
          {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
        </div>
      </div>

      {/* Speaking Indicator */}
      <motion.div
        className="absolute inset-0 border-4 rounded-3xl pointer-events-none"
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
    const count = participants.length + 1;
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
    avatarUrl: user.avatarUrl,
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
              className={`w-40 h-40 rounded-full bg-gradient-to-r ${participants[0]?.colorTheme.gradient || 'from-purple-500 to-pink-500'} p-1`}
              animate={{
                scale: [1, 1.1, 1],
                boxShadow: [
                  '0 0 0 0 rgba(139, 92, 246, 0.4)',
                  '0 0 0 40px rgba(139, 92, 246, 0)',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <img
                src={participants[0]?.avatarUrl}
                alt="Calling"
                className="w-full h-full rounded-full bg-white"
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
              <motion.div
                className={`absolute inset-8 rounded-full bg-gradient-to-r ${participants[0]?.colorTheme.gradient || 'from-purple-500 to-pink-500'} p-1`}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <img
                  src={participants[0]?.avatarUrl}
                  alt="Connecting"
                  className="w-full h-full rounded-full bg-white"
                />
              </motion.div>
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
        <div className="relative h-full pt-16 pb-28 px-4">
          <div className={cn('h-full gap-4', layout === 'grid' ? `grid ${getGridClass()}` : 'flex')}>
            {/* Local Video */}
            <VideoTile
              stream={localStream}
              participant={localParticipant}
              isLocal
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isMain={layout === 'spotlight' && participants.length === 0}
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
              />
            ))}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <motion.div
        className="absolute top-0 left-0 right-0 backdrop-blur-xl bg-black/30 px-6 py-4 flex items-center justify-between"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-3 h-3 bg-green-500 rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                boxShadow: [
                  '0 0 0 0 rgba(34, 197, 94, 0.4)',
                  '0 0 0 8px rgba(34, 197, 94, 0)',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-white/80 font-medium">{formatDuration(callDuration)}</span>
          </div>
          <div className="flex -space-x-2">
            {participants.slice(0, 3).map((p) => (
              <img
                key={p.id}
                src={p.avatarUrl}
                alt={p.displayName}
                className="w-8 h-8 rounded-full border-2 border-slate-900"
              />
            ))}
            {participants.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold border-2 border-slate-900">
                +{participants.length - 3}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setLayout(layout === 'grid' ? 'spotlight' : 'grid')}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {layout === 'grid' ? <Maximize2 className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
          </motion.button>
          <motion.button
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Users className="w-5 h-5" />
          </motion.button>
          <motion.button
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MoreHorizontal className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            className="absolute bottom-32 left-1/2 -translate-x-1/2 backdrop-blur-xl bg-black/50 rounded-2xl p-4 border border-white/20"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            <div className="flex gap-3">
              {callEmojis.map((emoji) => (
                <motion.button
                  key={emoji}
                  onClick={() => {
                    addReaction(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="text-3xl"
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
        className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-black/30 px-6 py-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center justify-center gap-4">
          <motion.button
            onClick={onToggleMute}
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-all',
              isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </motion.button>

          <motion.button
            onClick={onToggleCamera}
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-all',
              isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </motion.button>

          <motion.button
            onClick={onToggleScreenShare}
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-all',
              isScreenSharing
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isScreenSharing ? <ScreenShareOff className="w-6 h-6" /> : <ScreenShare className="w-6 h-6" />}
          </motion.button>

          <motion.button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Smile className="w-6 h-6" />
          </motion.button>

          <motion.button
            onClick={() => setShowChat(!showChat)}
            className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>

          <motion.button
            onClick={onEndCall}
            className="w-20 h-14 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-500/25"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <PhoneOff className="w-6 h-6" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
