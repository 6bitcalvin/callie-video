import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Send,
  Smile,
  Paperclip,
  Mic,
  Image,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Friend } from '@/types';
import { useApp } from '@/context/AppContext';
import { ColorAvatar } from './ColorAvatar';

type ChatViewProps = {
  friend: Friend;
  onBack: () => void;
  onCall: (video: boolean) => void;
};

const emojis = ['😀', '😂', '😍', '🥳', '🤔', '😎', '🔥', '💯', '❤️', '👍', '🎉', '✨', '🙌', '😭', '🤣', '💀'];

export function ChatView({ friend, onBack, onCall }: ChatViewProps) {
  const { messages, sendMessage, user, showEmojiPicker, setShowEmojiPicker, friendTyping, setIsTyping } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    await sendMessage(inputValue, 'text');
    setInputValue('');
    setIsTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsTyping(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleEmojiClick = async (emoji: string) => {
    await sendMessage(emoji, 'emoji');
    setShowEmojiPicker(false);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900">
      {/* Header */}
      <motion.div
        className="backdrop-blur-xl bg-white/5 border-b border-white/10 px-4 py-3 flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <div className="flex items-center gap-3 flex-1">
          <ColorAvatar
            name={friend.displayName}
            color={friend.avatarColor}
            size="md"
            showBorder
            borderGradient={friend.colorTheme.gradient}
            status={friend.status}
            animate={friend.status === 'online'}
          />
          <div>
            <h2 className="text-white font-semibold">{friend.displayName}</h2>
            <p className="text-white/50 text-sm">
              {friendTyping ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-purple-400"
                >
                  typing...
                </motion.span>
              ) : friend.status === 'online' ? (
                'Active now'
              ) : (
                `Last seen ${formatTime(friend.lastSeen)}`
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => onCall(false)}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Phone className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={() => onCall(true)}
            className={`w-10 h-10 rounded-xl bg-gradient-to-r ${friend.colorTheme.gradient} flex items-center justify-center text-white transition-all`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Video className="w-5 h-5" />
          </motion.button>
          <motion.button
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MoreVertical className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center h-full text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <ColorAvatar
              name={friend.displayName}
              color={friend.avatarColor}
              size="xl"
              showBorder
              borderGradient={friend.colorTheme.gradient}
              animate
            />
            <h3 className="text-white font-semibold text-lg mt-4">{friend.displayName}</h3>
            <p className="text-white/50 text-sm mt-1">@{friend.username}</p>
            <p className="text-white/40 text-sm mt-4">
              Start the conversation by sending a message!
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {messages.map((message, index) => {
              const isOwn = message.senderId === user?.id;
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
                >
                  <div className={cn('flex items-end gap-2 max-w-[80%]', isOwn && 'flex-row-reverse')}>
                    {!isOwn && (
                      <ColorAvatar
                        name={friend.displayName}
                        color={friend.avatarColor}
                        size="xs"
                      />
                    )}
                    <motion.div
                      className={cn(
                        'px-4 py-3 rounded-3xl',
                        isOwn
                          ? `bg-gradient-to-r ${friend.colorTheme.gradient} text-white`
                          : 'bg-white/10 backdrop-blur-xl text-white border border-white/10',
                        isOwn ? 'rounded-br-lg' : 'rounded-bl-lg'
                      )}
                      whileHover={{ scale: 1.02 }}
                    >
                      {message.type === 'gif' ? (
                        <img src={message.content} alt="GIF" className="rounded-xl max-w-[200px]" />
                      ) : message.type === 'emoji' ? (
                        <span className="text-4xl">{message.content}</span>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                      <p className={cn('text-xs mt-1', isOwn ? 'text-white/70' : 'text-white/40')}>
                        {formatTime(message.createdAt)}
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Typing Indicator */}
        <AnimatePresence>
          {friendTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2"
            >
              <ColorAvatar
                name={friend.displayName}
                color={friend.avatarColor}
                size="xs"
              />
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl px-4 py-3 border border-white/10">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-white/60 rounded-full"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ delay: i * 0.15, duration: 0.6, repeat: Infinity }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-4 mb-2 backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-4"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-white/60 text-sm font-medium">Emoji</span>
              <button onClick={() => setShowEmojiPicker(false)} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {emojis.map((emoji) => (
                <motion.button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-2xl p-2 hover:bg-white/10 rounded-lg transition-colors"
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

      {/* Input Area */}
      <motion.div
        className="backdrop-blur-xl bg-white/5 border-t border-white/10 p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Smile className="w-5 h-5" />
          </motion.button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>

          <motion.button
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Paperclip className="w-5 h-5" />
          </motion.button>

          <motion.button
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Image className="w-5 h-5" />
          </motion.button>

          {inputValue ? (
            <motion.button
              onClick={handleSend}
              className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${friend.colorTheme.gradient} flex items-center justify-center text-white transition-all shadow-lg`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <Send className="w-5 h-5" />
            </motion.button>
          ) : (
            <motion.button
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => setIsRecording(false)}
              onMouseLeave={() => setIsRecording(false)}
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all',
                isRecording
                  ? 'bg-red-500 shadow-lg shadow-red-500/50'
                  : `bg-gradient-to-r ${friend.colorTheme.gradient} shadow-lg`
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: isRecording ? Infinity : 0 }}
            >
              <Mic className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
