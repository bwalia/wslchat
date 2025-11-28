// User types
export interface User {
  id: string;
  uuid: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: string;
  status?: PresenceStatus;
  status_text?: string;
  status_emoji?: string;
}

export type PresenceStatus = "online" | "away" | "dnd" | "offline";

// Channel types
export interface Channel {
  uuid: string;
  name: string;
  description?: string;
  type: "public" | "private" | "direct";
  created_by: string;
  uuid_business_id?: string;
  avatar_url?: string;
  is_archived?: boolean;
  member_count?: number;
  unread_count?: number;
  last_message_at?: string;
  current_user_role?: "admin" | "moderator" | "member";
  is_muted?: boolean;
  notification_preference?: "all" | "mentions" | "none";
  created_at: string;
  updated_at: string;
}

export interface ChannelMember {
  uuid: string;
  user_uuid: string;
  channel_uuid: string;
  role: "admin" | "moderator" | "member";
  joined_at: string;
  last_read_at?: string;
  is_muted: boolean;
  notification_preference: "all" | "mentions" | "none";
  user?: User;
}

// Message types
export interface Message {
  uuid: string;
  channel_uuid: string;
  user_uuid: string;
  content: string;
  content_type: "text" | "code" | "markdown";
  parent_message_uuid?: string;
  is_edited: boolean;
  is_deleted: boolean;
  is_pinned: boolean;
  reply_count: number;
  mentions?: string[];
  attachments?: Attachment[];
  reactions?: ReactionGroup[];
  user?: User;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  uuid: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

export interface Reaction {
  uuid: string;
  message_uuid: string;
  user_uuid: string;
  emoji: string;
  created_at: string;
}

// Thread types
export interface Thread {
  parent: Message;
  replies: Message[];
  reply_count: number;
  participants: User[];
}

// Typing indicator
export interface TypingUser {
  userUuid: string;
  userName: string;
  channelUuid: string;
  timestamp: number;
}

// Bookmark
export interface Bookmark {
  uuid: string;
  user_uuid: string;
  message_uuid: string;
  note?: string;
  message?: Message;
  created_at: string;
}

// Draft
export interface Draft {
  channel_uuid: string;
  content: string;
  parent_message_uuid?: string;
  updated_at: string;
}

// Mention
export interface Mention {
  uuid: string;
  user_uuid: string;
  message_uuid: string;
  channel_uuid: string;
  is_read: boolean;
  message?: Message;
  created_at: string;
}

// Channel Invite
export interface ChannelInvite {
  uuid: string;
  channel_uuid: string;
  user_uuid: string;
  invited_by: string;
  message?: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string;
  channel?: Channel;
  inviter?: User;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

// Auth types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// App settings
export interface AppSettings {
  theme: "light" | "dark" | "system";
  notifications: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
}

// IPC Response wrapper - handlers return { success, data?, error? }
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Electron API types
declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, ...args: any[]) => void;
      invoke: <T = any>(
        channel: string,
        ...args: any[]
      ) => Promise<IpcResponse<T>>;
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
      once: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      platform: string;
      isWindows: boolean;
      isMac: boolean;
      isLinux: boolean;
    };
    versions: {
      node: string;
      chrome: string;
      electron: string;
    };
  }
}

export {};
