/**
 * Preload Script - Secure Bridge between Main and Renderer
 * Exposes only necessary APIs to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of valid channels for security
const validSendChannels = [
  'window:minimize',
  'window:maximize',
  'window:close',
];

const validInvokeChannels = [
  // Auth
  'auth:login',
  'auth:logout',
  'auth:validate-token',
  'auth:get-stored-auth',
  'auth:google-login',
  'auth:refresh-token',
  'auth:update-profile',
  'auth:handle-oauth-callback',

  // Channels
  'channels:list',
  'channels:get',
  'channels:create',
  'channels:update',
  'channels:delete',
  'channels:join',
  'channels:leave',
  'channels:get-members',
  'channels:add-members',
  'channels:remove-member',
  'channels:update-member-role',
  'channels:mark-as-read',
  'channels:create-direct',
  'channels:search',
  'channels:get-unread',

  // Messages
  'messages:list',
  'messages:get',
  'messages:send',
  'messages:update',
  'messages:delete',
  'messages:get-thread',
  'messages:search',
  'messages:get-pinned',
  'messages:pin',
  'messages:unpin',

  // Reactions
  'reactions:add',
  'reactions:remove',
  'reactions:toggle',
  'reactions:get',

  // Users
  'users:get-current',
  'users:get',
  'users:update-profile',
  'users:search',

  // Presence
  'presence:update',
  'presence:get',
  'presence:get-channel',
  'presence:set-typing',
  'presence:clear-status',

  // Bookmarks & Drafts
  'bookmarks:add',
  'bookmarks:remove',
  'bookmarks:list',
  'drafts:save',
  'drafts:get',
  'drafts:delete',
  'drafts:list',

  // Mentions
  'mentions:list',
  'mentions:mark-read',
  'mentions:mark-all-read',
  'mentions:get-unread-count',

  // Files
  'files:upload',
  'files:list',
  'files:delete',

  // Invites
  'invites:send',
  'invites:list',
  'invites:accept',
  'invites:decline',

  // App settings
  'app:get-theme',
  'app:set-theme',
  'app:get-settings',
  'app:set-settings',

  // Socket
  'socket:connect',
  'socket:disconnect',
  'socket:join-channel',
  'socket:leave-channel',
];

const validReceiveChannels = [
  // Socket events
  'socket:connected',
  'socket:disconnected',

  // Real-time message events
  'message:new',
  'message:updated',
  'message:deleted',

  // Typing indicators
  'typing:start',
  'typing:stop',

  // Reactions
  'reaction:added',
  'reaction:removed',

  // Presence
  'presence:updated',

  // Channel events
  'channel:updated',
  'member:joined',
  'member:left',

  // Notifications
  'notification:show',
];

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main (no response expected)
  send: (channel, ...args) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`Invalid send channel: ${channel}`);
    }
  },

  // Invoke methods and get response (Promise-based)
  invoke: async (channel, ...args) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`Invalid invoke channel: ${channel}`);
    throw new Error(`Invalid channel: ${channel}`);
  },

  // Listen for events from main process
  on: (channel, callback) => {
    if (validReceiveChannels.includes(channel)) {
      const subscription = (_, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    console.warn(`Invalid receive channel: ${channel}`);
    return () => {};
  },

  // Listen for event once
  once: (channel, callback) => {
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.once(channel, (_, ...args) => callback(...args));
    } else {
      console.warn(`Invalid receive channel: ${channel}`);
    }
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // Platform info
  platform: process.platform,
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
});

// Expose versions for debugging
contextBridge.exposeInMainWorld('versions', {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
});

console.log('Preload script loaded successfully');
