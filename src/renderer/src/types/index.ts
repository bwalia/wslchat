// User types
export interface User {
  id: string;
  uuid: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  username?: string;
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
  // Kanban project link
  linked_task_uuid?: string;
  linked_task_id?: number;
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
  // User fields returned directly from API (joined from users table)
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  // Legacy nested user object (for backwards compatibility)
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
  uuid?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  key?: string;
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
  mention_uuid?: string;
  message_uuid: string;
  channel_uuid: string;
  mentioned_by_uuid: string;
  mention_type: "user" | "channel" | "everyone" | "here";
  is_read: boolean;
  created_at: string;
  // Joined data from API
  message_content?: string;
  message_content_type?: string;
  channel_name?: string;
  channel_type?: string;
  mentioned_by_first_name?: string;
  mentioned_by_last_name?: string;
  mentioned_by_username?: string;
  mentioned_by_email?: string;
  // Nested objects
  message?: Message;
}

// Mentionable user for autocomplete
export interface MentionableUser {
  uuid: string;
  username?: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: PresenceStatus;
}

// Special mention types
export interface SpecialMention {
  id: string;
  display: string;
  description: string;
}

// Channel Invite
export interface ChannelInvite {
  uuid: string;
  channel_uuid: string;
  invited_user_uuid: string;
  invited_by_uuid: string;
  message?: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at?: string;
  responded_at?: string;
  created_at: string;
  updated_at?: string;
  // Joined data from API
  channel_name?: string;
  channel_description?: string;
  channel_type?: "public" | "private" | "direct";
  inviter_first_name?: string;
  inviter_last_name?: string;
  inviter_email?: string;
  // Computed/nested
  channel?: Channel;
  inviter?: User;
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
// Kanban types
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskAssignee {
  user_uuid: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
}

export interface KanbanTask {
  uuid: string;
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  estimated_minutes?: number;
  time_spent_minutes?: number;
  assignees?: TaskAssignee[];
  task_number?: number;
  board_id?: number;
  column_id?: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanBoard {
  uuid: string;
  id: number;
  project_id: number;
  name: string;
  description?: string;
  position?: number;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

export interface KanbanProject {
  uuid: string;
  id: number;
  name: string;
  description?: string;
  status: "active" | "on_hold" | "completed" | "archived" | "cancelled";
  chat_channel_uuid?: string;
  namespace_id?: number;
  boards?: KanbanBoard[];
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  uuid: string;
  task_id: number;
  user_uuid: string;
  description?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  status: "running" | "logged" | "approved" | "invoiced" | "rejected";
  is_billable: boolean;
  hourly_rate?: number;
  billed_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface RunningTimer {
  uuid: string;
  task_id: number;
  task_uuid: string;
  task_title: string;
  task_number?: number;
  board_name?: string;
  project_uuid?: string;
  project_name?: string;
  started_at: string;
  elapsed_seconds?: number;
  duration_minutes?: number;
  description?: string;
  user_uuid?: string;
  running: boolean;
}

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
