import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Video, Users, Check } from 'lucide-react';
import { Friend } from '../types';
import { ColorAvatar } from './ColorAvatar';

interface GroupCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: Friend[];
  onStartCall: (friendIds: string[], isVideo: boolean) => void;
  themeGradient: string;
}

export const GroupCallModal: React.FC<GroupCallModalProps> = ({
  isOpen,
  onClose,
  friends,
  onStartCall,
  themeGradient,
}) => {
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const onlineFriends = friends.filter(f => f.status === 'online');

  const toggleFriend = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : prev.length < 3 ? [...prev, friendId] : prev
    );
  };

  const handleStartCall = (isVideo: boolean) => {
    if (selectedFriends.length > 0) {
      onStartCall(selectedFriends, isVideo);
      setSelectedFriends([]);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedFriends([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-gray-900/90 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden"
          >
            {/* Header */}
            <div className={`bg-gradient-to-r ${themeGradient} p-4 sm:p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Start Group Call</h2>
                    <p className="text-white/70 text-xs sm:text-sm">Select up to 3 friends</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Friend Selection */}
            <div className="p-4 sm:p-6 max-h-80 overflow-y-auto">
              {onlineFriends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No friends online</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Friends need to be online to join a call
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {onlineFriends.map((friend) => {
                    const isSelected = selectedFriends.includes(friend.id);
                    return (
                      <motion.button
                        key={friend.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleFriend(friend.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r ' + themeGradient + ' shadow-lg'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="relative">
                          <ColorAvatar
                            color={friend.avatarColor}
                            name={friend.displayName}
                            size="md"
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`font-medium ${isSelected ? 'text-white' : 'text-white'}`}>
                            {friend.displayName}
                          </p>
                          <p className={`text-sm ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                            @{friend.username}
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'bg-white text-gray-900' 
                            : 'bg-white/10 border border-white/20'
                        }`}>
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Count */}
            {selectedFriends.length > 0 && (
              <div className="px-4 sm:px-6 pb-2">
                <p className="text-sm text-gray-400">
                  {selectedFriends.length} friend{selectedFriends.length > 1 ? 's' : ''} selected
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 sm:p-6 pt-2 border-t border-white/10 flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleStartCall(false)}
                disabled={selectedFriends.length === 0}
                className={`flex-1 py-3 sm:py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  selectedFriends.length > 0
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Phone className="w-5 h-5" />
                <span className="hidden sm:inline">Audio</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleStartCall(true)}
                disabled={selectedFriends.length === 0}
                className={`flex-1 py-3 sm:py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  selectedFriends.length > 0
                    ? `bg-gradient-to-r ${themeGradient} text-white`
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Video className="w-5 h-5" />
                <span className="hidden sm:inline">Video</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
