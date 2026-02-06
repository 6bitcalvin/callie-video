export type ColorTheme = {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
};

export const colorThemes: ColorTheme[] = [
  {
    name: 'Electric Purple',
    primary: '#8B5CF6',
    secondary: '#A855F7',
    accent: '#C084FC',
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
  },
  {
    name: 'Cyber Cyan',
    primary: '#06B6D4',
    secondary: '#22D3EE',
    accent: '#67E8F9',
    gradient: 'from-cyan-400 via-teal-500 to-emerald-500',
  },
  {
    name: 'Hot Pink',
    primary: '#EC4899',
    secondary: '#F472B6',
    accent: '#F9A8D4',
    gradient: 'from-pink-500 via-rose-500 to-red-500',
  },
  {
    name: 'Ocean Teal',
    primary: '#14B8A6',
    secondary: '#2DD4BF',
    accent: '#5EEAD4',
    gradient: 'from-teal-400 via-cyan-500 to-blue-500',
  },
  {
    name: 'Sunset Orange',
    primary: '#F97316',
    secondary: '#FB923C',
    accent: '#FDBA74',
    gradient: 'from-orange-400 via-amber-500 to-yellow-500',
  },
  {
    name: 'Neon Green',
    primary: '#22C55E',
    secondary: '#4ADE80',
    accent: '#86EFAC',
    gradient: 'from-green-400 via-emerald-500 to-teal-500',
  },
];

export type UserStatus = 'online' | 'offline' | 'busy' | 'away';

export type User = {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  colorTheme: ColorTheme;
  status: UserStatus;
};

export type Friend = {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  colorTheme: ColorTheme;
  status: UserStatus;
  lastSeen: Date;
  unreadCount: number;
};

export type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'gif' | 'voice' | 'file' | 'emoji';
  fileUrl?: string;
  createdAt: Date;
  read: boolean;
};

export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

export type Reaction = {
  id: string;
  emoji: string;
  userId: string;
  timestamp: number;
};

export type Participant = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  colorTheme: ColorTheme;
  stream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
};
