import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Settings,
  Bell,
  Users,
  MessageSquare,
  Phone,
  Video,
  Sparkles,
  LogOut,
  Copy,
  Check,
  UserPlus,
  X,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useApp } from '@/context/AppContext';
import { FriendCard } from './FriendCard';
import { ChatView } from './ChatView';
import { CallOverlay } from './CallOverlay';
import { IncomingCallModal } from './IncomingCallModal';
import { GroupCallModal } from './GroupCallModal';
import { ColorAvatar, stringToColor } from './ColorAvatar';
import { Friend, colorThemes } from '@/types';

type Tab = 'friends' | 'messages' | 'calls';

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const {
    user,
    friends,
    activeChat,
    setActiveChat,
    callState,
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    isScreenSharing,
    incomingCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    currentCallTargets,
    addFriend,
    removeFriend,
    copyUserIdToClipboard,
    playSound,
    isConnected,
    connectionError,
  } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendIdInput, setFriendIdInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [addFriendError, setAddFriendError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showGroupCall, setShowGroupCall] = useState(false);

  // Get call participants as Friend objects
  const callParticipants: Friend[] = currentCallTargets.map(targetId => {
    const friend = friends.find(f => f.id === targetId);
    if (friend) return friend;
    return {
      id: targetId,
      username: 'unknown',
      displayName: 'Unknown User',
      avatarColor: stringToColor(targetId),
      colorTheme: colorThemes[0],
      status: 'online' as const,
      lastSeen: new Date(),
      unreadCount: 0,
    };
  });

  // Get incoming caller as Friend
  const incomingCaller: Friend | null = incomingCall ? {
    id: incomingCall.from,
    username: incomingCall.fromUser.displayName.toLowerCase().replace(/\s/g, '_'),
    displayName: incomingCall.fromUser.displayName,
    avatarColor: incomingCall.fromUser.avatarColor || stringToColor(incomingCall.from),
    colorTheme: colorThemes.find(t => t.gradient === incomingCall.fromUser.colorTheme) || colorThemes[0],
    status: 'online',
    lastSeen: new Date(),
    unreadCount: 0,
  } : null;

  const filteredFriends = friends.filter(
    (friend) =>
      friend.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineFriends = filteredFriends.filter((f) => f.status === 'online');
  const offlineFriends = filteredFriends.filter((f) => f.status !== 'online');

  const handleStartCall = async (friend: Friend, video: boolean) => {
    await initiateCall([friend.id], video);
    playSound('ring');
  };

  const handleCopyId = () => {
    copyUserIdToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddFriend = async () => {
    const result = await addFriend(friendIdInput);
    
    if (result.success) {
      setFriendIdInput('');
      setShowAddFriend(false);
      setAddFriendError('');
    } else {
      setAddFriendError(result.error || 'Failed to add friend');
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  const handleStartGroupCall = async (friendIds: string[], isVideo: boolean) => {
    await initiateCall(friendIds, isVideo);
    playSound('ring');
  };

  // Play sound on incoming call
  useEffect(() => {
    if (incomingCall) {
      playSound('ring');
    }
  }, [incomingCall, playSound]);

  if (!user) return null;

  // Show Chat View
  if (activeChat) {
    return (
      <ChatView
        friend={activeChat}
        onBack={() => setActiveChat(null)}
        onCall={(video) => handleStartCall(activeChat, video)}
        onRemoveFriend={removeFriend}
      />
    );
  }

  const inCall = callState !== 'idle';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 overflow-x-hidden">
      {/* Call Overlay */}
      <AnimatePresence>
        {inCall && (
          <CallOverlay
            participants={callParticipants}
            callState={callState}
            onEndCall={endCall}
            localStream={localStream}
            remoteStreams={remoteStreams}
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
          />
        )}
      </AnimatePresence>

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && incomingCaller && (
          <IncomingCallModal
            caller={incomingCaller}
            isVideo={incomingCall.isVideo}
            onAccept={acceptCall}
            onReject={rejectCall}
          />
        )}
      </AnimatePresence>

      {/* Group Call Modal */}
      <GroupCallModal
        isOpen={showGroupCall}
        onClose={() => setShowGroupCall(false)}
        friends={friends}
        onStartCall={handleStartGroupCall}
        themeGradient={user.colorTheme.gradient}
      />

      {/* Add Friend Modal */}
      <AnimatePresence>
        {showAddFriend && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddFriend(false)}
          >
            <motion.div
              className="w-full max-w-md backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Add Friend</h2>
                <button
                  onClick={() => setShowAddFriend(false)}
                  className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Your ID */}
              <div className="mb-6">
                <label className="text-white/60 text-sm mb-2 block">Your ID (share this with friends)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm font-mono truncate">
                    {user.id}
                  </div>
                  <motion.button
                    onClick={handleCopyId}
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                      copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </motion.button>
                </div>
              </div>

              {/* Add Friend Input */}
              <div className="mb-4">
                <label className="text-white/60 text-sm mb-2 block">Enter friend's ID</label>
                <input
                  type="text"
                  placeholder="Paste friend's ID here..."
                  value={friendIdInput}
                  onChange={(e) => {
                    setFriendIdInput(e.target.value);
                    setAddFriendError('');
                  }}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
                {addFriendError && (
                  <p className="text-red-400 text-sm mt-2">{addFriendError}</p>
                )}
              </div>

              <motion.button
                onClick={handleAddFriend}
                className={`w-full py-3 bg-gradient-to-r ${user.colorTheme.gradient} rounded-xl text-white font-medium flex items-center justify-center gap-2`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <UserPlus className="w-5 h-5" />
                Add Friend
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex h-screen">
        {/* Mobile Bottom Nav (shown on small screens) */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <div className="backdrop-blur-xl bg-slate-900/90 border-t border-white/10 flex items-center justify-around py-2 px-4 safe-area-pb">
            {[
              { id: 'friends' as Tab, icon: Users, label: 'Friends' },
              { id: 'messages' as Tab, icon: MessageSquare, label: 'Chats' },
              { id: 'calls' as Tab, icon: Phone, label: 'Calls' },
            ].map(({ id, icon: Icon, label }) => (
              <motion.button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                  activeTab === id
                    ? `bg-gradient-to-r ${user.colorTheme.gradient} text-white`
                    : 'text-white/50'
                )}
                whileTap={{ scale: 0.95 }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </motion.button>
            ))}
            <motion.button
              onClick={() => setShowGroupCall(true)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white"
              whileTap={{ scale: 0.95 }}
            >
              <UsersRound className="w-5 h-5" />
              <span className="text-xs font-medium">Group</span>
            </motion.button>
            <motion.button
              onClick={() => setShowAddFriend(true)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r ${user.colorTheme.gradient} text-white`}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs font-medium">Add</span>
            </motion.button>
          </div>
        </div>

        {/* Sidebar (hidden on mobile) */}
        <motion.div
          className="hidden md:flex w-20 backdrop-blur-xl bg-white/5 border-r border-white/10 flex-col items-center py-6 gap-4"
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          {/* Logo */}
          <motion.div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${user.colorTheme.gradient} flex items-center justify-center mb-4`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </motion.div>

          {/* Nav Items */}
          <div className="flex-1 flex flex-col items-center gap-2">
            {[
              { id: 'friends' as Tab, icon: Users },
              { id: 'messages' as Tab, icon: MessageSquare },
              { id: 'calls' as Tab, icon: Phone },
            ].map(({ id, icon: Icon }) => (
              <motion.button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                  activeTab === id
                    ? `bg-gradient-to-r ${user.colorTheme.gradient} text-white shadow-lg`
                    : 'text-white/50 hover:bg-white/10 hover:text-white'
                )}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Icon className="w-5 h-5" />
              </motion.button>
            ))}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col items-center gap-2">
            <motion.button
              className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-all relative"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Bell className="w-5 h-5" />
            </motion.button>

            <motion.button
              className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Settings className="w-5 h-5" />
            </motion.button>

            <motion.button
              onClick={handleLogout}
              className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <LogOut className="w-5 h-5" />
            </motion.button>

            {/* User Avatar */}
            <motion.div
              className="mt-2 cursor-pointer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCopyId}
            >
              <ColorAvatar
                name={user.displayName}
                color={user.avatarColor}
                size="md"
                showBorder
                borderGradient={user.colorTheme.gradient}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <motion.div
            className="backdrop-blur-xl bg-white/5 border-b border-white/10 px-4 md:px-6 py-3 md:py-4"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold text-white">
                    {activeTab === 'friends' && 'Friends'}
                    {activeTab === 'messages' && 'Messages'}
                    {activeTab === 'calls' && 'Recent Calls'}
                  </h1>
                  {/* Connection Status */}
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                      animate={isConnected ? {
                        scale: [1, 1.2, 1],
                        boxShadow: ['0 0 0 0 rgba(34, 197, 94, 0.4)', '0 0 0 4px rgba(34, 197, 94, 0)'],
                      } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'} hidden sm:inline`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                {connectionError && (
                  <p className="text-red-400 text-xs mt-1 truncate">Error: {connectionError}</p>
                )}
                {!isConnected && (
                  <p className="text-yellow-400 text-xs mt-1">Connecting...</p>
                )}
                <p className="text-white/50 text-xs md:text-sm mt-1">
                  {activeTab === 'friends' && `${onlineFriends.length} online, ${offlineFriends.length} offline`}
                  {activeTab === 'messages' && 'Your conversations'}
                  {activeTab === 'calls' && 'Call history'}
                </p>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                {/* Search - Hidden on mobile, shown on tablet+ */}
                <div className="relative hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 md:w-5 h-4 md:h-5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-40 md:w-64 pl-9 md:pl-10 pr-4 py-2 md:py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                </div>

                {/* Mobile Search Button */}
                <motion.button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="sm:hidden w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60"
                  whileTap={{ scale: 0.95 }}
                >
                  <Search className="w-5 h-5" />
                </motion.button>

                {/* Add Friend Button - Hidden on mobile (in bottom nav) */}
                <motion.button
                  onClick={() => setShowAddFriend(true)}
                  className={`hidden md:flex px-4 py-2.5 bg-gradient-to-r ${user.colorTheme.gradient} rounded-xl text-white font-medium items-center gap-2 shadow-lg`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Plus className="w-5 h-5" />
                  Add Friend
                </motion.button>

                {/* Mobile: User Avatar */}
                <motion.div
                  className="md:hidden cursor-pointer"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopyId}
                >
                  <ColorAvatar
                    name={user.displayName}
                    color={user.avatarColor}
                    size="sm"
                    showBorder
                    borderGradient={user.colorTheme.gradient}
                  />
                </motion.div>
              </div>
            </div>

            {/* Mobile Search Bar (expandable) */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="sm:hidden mt-3 overflow-hidden"
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-white/40 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
            <AnimatePresence mode="wait">
              {activeTab === 'friends' && (
                <motion.div
                  key="friends"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {friends.length === 0 ? (
                    <motion.div
                      className="flex flex-col items-center justify-center py-16"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
                        <Users className="w-12 h-12 text-white/40" />
                      </div>
                      <h3 className="text-white/60 text-lg font-medium">No friends yet</h3>
                      <p className="text-white/40 text-sm mt-1 text-center max-w-sm">
                        Share your ID with others or add friends using their ID to get started
                      </p>
                      <motion.button
                        onClick={() => setShowAddFriend(true)}
                        className={`mt-6 px-6 py-3 bg-gradient-to-r ${user.colorTheme.gradient} rounded-xl text-white font-medium flex items-center gap-2`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <UserPlus className="w-5 h-5" />
                        Add Your First Friend
                      </motion.button>
                    </motion.div>
                  ) : (
                    <>
                      {/* Online Friends */}
                      {onlineFriends.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
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
                            <h2 className="text-white/80 font-semibold">Online — {onlineFriends.length}</h2>
                          </div>
                          <div className="grid gap-3">
                            {onlineFriends.map((friend, index) => (
                              <motion.div
                                key={friend.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <FriendCard
                                  friend={friend}
                                  onChat={() => setActiveChat(friend)}
                                  onCall={(video) => handleStartCall(friend, video)}
                                  onRemove={removeFriend}
                                />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Offline Friends */}
                      {offlineFriends.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-3 h-3 bg-slate-500 rounded-full" />
                            <h2 className="text-white/60 font-semibold">Offline — {offlineFriends.length}</h2>
                          </div>
                          <div className="grid gap-3">
                            {offlineFriends.map((friend, index) => (
                              <motion.div
                                key={friend.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: (onlineFriends.length + index) * 0.05 }}
                              >
                                <FriendCard
                                  friend={friend}
                                  onChat={() => setActiveChat(friend)}
                                  onCall={(video) => handleStartCall(friend, video)}
                                  onRemove={removeFriend}
                                />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {filteredFriends.length === 0 && searchQuery && (
                        <motion.div
                          className="flex flex-col items-center justify-center py-16"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
                            <Search className="w-12 h-12 text-white/40" />
                          </div>
                          <h3 className="text-white/60 text-lg font-medium">No results found</h3>
                          <p className="text-white/40 text-sm mt-1">Try a different search term</p>
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {activeTab === 'messages' && (
                <motion.div
                  key="messages"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3"
                >
                  {friends.length === 0 ? (
                    <motion.div
                      className="flex flex-col items-center justify-center py-16"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
                        <MessageSquare className="w-12 h-12 text-white/40" />
                      </div>
                      <h3 className="text-white/60 text-lg font-medium">No messages yet</h3>
                      <p className="text-white/40 text-sm mt-1">Add friends to start chatting</p>
                    </motion.div>
                  ) : (
                    friends.map((friend, index) => (
                      <motion.div
                        key={friend.id}
                        onClick={() => setActiveChat(friend)}
                        className="group backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 p-4 hover:bg-white/15 transition-all cursor-pointer"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.01 }}
                      >
                        <div className="flex items-center gap-4">
                          <ColorAvatar
                            name={friend.displayName}
                            color={friend.avatarColor}
                            size="lg"
                            showBorder
                            borderGradient={friend.colorTheme.gradient}
                            status={friend.status}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-white font-semibold">{friend.displayName}</h3>
                              <span className="text-white/40 text-xs">
                                {friend.status === 'online' ? 'Active now' : 'Offline'}
                              </span>
                            </div>
                            <p className="text-white/50 text-sm truncate mt-1">
                              Click to start chatting...
                            </p>
                          </div>
                          {friend.unreadCount > 0 && (
                            <div
                              className={`min-w-6 h-6 rounded-full bg-gradient-to-r ${friend.colorTheme.gradient} flex items-center justify-center px-1.5`}
                            >
                              <span className="text-white text-xs font-bold">{friend.unreadCount}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'calls' && (
                <motion.div
                  key="calls"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3"
                >
                  {friends.length === 0 ? (
                    <motion.div
                      className="flex flex-col items-center justify-center py-16"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
                        <Phone className="w-12 h-12 text-white/40" />
                      </div>
                      <h3 className="text-white/60 text-lg font-medium">No calls yet</h3>
                      <p className="text-white/40 text-sm mt-1">Add friends to start calling</p>
                    </motion.div>
                  ) : (
                    friends.map((friend, index) => (
                      <motion.div
                        key={friend.id}
                        className="group backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 p-4 hover:bg-white/15 transition-all"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <ColorAvatar
                              name={friend.displayName}
                              color={friend.avatarColor}
                              size="lg"
                              showBorder
                              borderGradient={friend.colorTheme.gradient}
                            />
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                              <Video className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-semibold">{friend.displayName}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-white/50 text-sm">
                                {friend.status === 'online' ? 'Available' : 'Offline'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <motion.button
                              onClick={() => handleStartCall(friend, false)}
                              className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Phone className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              onClick={() => handleStartCall(friend, true)}
                              className={`w-12 h-12 rounded-xl bg-gradient-to-r ${friend.colorTheme.gradient} flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity`}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Video className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* FABs - Hidden on mobile (using bottom nav instead) */}
      <div className="hidden md:flex fixed bottom-6 right-6 flex-col gap-3 z-40">
        {/* Group Call FAB */}
        <motion.button
          onClick={() => setShowGroupCall(true)}
          className="w-14 h-14 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white shadow-2xl"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
          title="Start Group Call"
        >
          <UsersRound className="w-6 h-6" />
        </motion.button>

        {/* Add Friend FAB */}
        <motion.button
          onClick={() => setShowAddFriend(true)}
          className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${user.colorTheme.gradient} flex items-center justify-center text-white shadow-2xl`}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          title="Add Friend"
        >
          <Plus className="w-8 h-8" />
        </motion.button>
      </div>
    </div>
  );
}
