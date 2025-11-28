/**
 * Message IPC Handlers
 */

const axios = require('axios');
const config = require('../config');

const API_URL = config.apiUrl;

const createApiClient = (store) => {
  const auth = store.get('auth');
  const headers = {
    'Content-Type': 'application/json',
  };

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  // Lapis API expects X-User-Id header with user UUID
  if (auth?.user?.uuid) {
    headers['X-User-Id'] = auth.user.uuid;
  }

  // Include business ID if available
  if (auth?.user?.uuid_business_id) {
    headers['X-Business-Id'] = auth.user.uuid_business_id;
  }

  return axios.create({
    baseURL: API_URL,
    headers,
    timeout: 30000,
  });
};

const register = (ipcMain, store, getSocketService) => {
  // Get messages for channel
  ipcMain.handle('messages:list', async (_, { channelUuid, params = {} }) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/messages`, { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get single message
  ipcMain.handle('messages:get', async (_, messageUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/messages/${messageUuid}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Send message
  ipcMain.handle('messages:send', async (_, { channelUuid, messageData }) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/messages`, messageData);

      // Emit via socket for real-time delivery to other clients
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('message:send', {
          channelUuid,
          message: response.data,
        });
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Update message
  ipcMain.handle('messages:update', async (_, { messageUuid, content }) => {
    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/messages/${messageUuid}`, { content });

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('message:update', {
          messageUuid,
          message: response.data,
        });
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Delete message
  ipcMain.handle('messages:delete', async (_, messageUuid) => {
    try {
      const api = createApiClient(store);

      // Get message first to know channel
      const msgResponse = await api.get(`/api/chat/messages/${messageUuid}`);
      const channelUuid = msgResponse.data?.channel_uuid;

      await api.delete(`/api/chat/messages/${messageUuid}`);

      // Emit via socket
      const socketService = getSocketService();
      if (socketService && channelUuid) {
        socketService.emit('message:delete', {
          messageUuid,
          channelUuid,
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get thread replies
  ipcMain.handle('messages:get-thread', async (_, { messageUuid, params = {} }) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/messages/${messageUuid}/thread`, { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Search messages in channel
  ipcMain.handle('messages:search', async (_, { channelUuid, query, params = {} }) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/messages/search`, {
        params: { q: query, ...params },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get pinned messages
  ipcMain.handle('messages:get-pinned', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/messages/pinned`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Pin message
  ipcMain.handle('messages:pin', async (_, messageUuid) => {
    try {
      const api = createApiClient(store);
      await api.post(`/api/chat/messages/${messageUuid}/pin`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Unpin message
  ipcMain.handle('messages:unpin', async (_, messageUuid) => {
    try {
      const api = createApiClient(store);
      await api.delete(`/api/chat/messages/${messageUuid}/pin`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // === Reactions ===

  // Add reaction
  ipcMain.handle('reactions:add', async (_, { messageUuid, emoji }) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/messages/${messageUuid}/reactions`, { emoji });

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('reaction:add', { messageUuid, emoji });
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Remove reaction
  ipcMain.handle('reactions:remove', async (_, { messageUuid, emoji }) => {
    try {
      const api = createApiClient(store);
      const response = await api.delete(`/api/chat/messages/${messageUuid}/reactions/${encodeURIComponent(emoji)}`);

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('reaction:remove', { messageUuid, emoji });
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Toggle reaction
  ipcMain.handle('reactions:toggle', async (_, { messageUuid, emoji }) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/messages/${messageUuid}/reactions/toggle`, { emoji });

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('reaction:toggle', { messageUuid, emoji, action: response.data.action });
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get reactions for message
  ipcMain.handle('reactions:get', async (_, messageUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/messages/${messageUuid}/reactions`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // === Bookmarks ===

  // Add bookmark
  ipcMain.handle('bookmarks:add', async (_, { messageUuid, note }) => {
    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/bookmarks', {
        message_uuid: messageUuid,
        note,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Remove bookmark
  ipcMain.handle('bookmarks:remove', async (_, messageUuid) => {
    try {
      const api = createApiClient(store);
      await api.delete(`/api/chat/bookmarks/${messageUuid}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // List bookmarks
  ipcMain.handle('bookmarks:list', async (_, params = {}) => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/bookmarks', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // === Drafts ===

  // Save draft
  ipcMain.handle('drafts:save', async (_, { channelUuid, content, parentMessageUuid }) => {
    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/drafts/${channelUuid}`, {
        content,
        parent_message_uuid: parentMessageUuid,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get draft
  ipcMain.handle('drafts:get', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/drafts/${channelUuid}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Delete draft
  ipcMain.handle('drafts:delete', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      await api.delete(`/api/chat/drafts/${channelUuid}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // List all drafts
  ipcMain.handle('drafts:list', async () => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/drafts');
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // === Mentions ===

  // List mentions
  ipcMain.handle('mentions:list', async (_, params = {}) => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/mentions', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Mark mention as read
  ipcMain.handle('mentions:mark-read', async (_, mentionUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/mentions/${mentionUuid}/read`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Mark all mentions as read
  ipcMain.handle('mentions:mark-all-read', async () => {
    try {
      const api = createApiClient(store);
      await api.post('/api/chat/mentions/read-all');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get unread mention count
  ipcMain.handle('mentions:get-unread-count', async () => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/mentions', {
        params: { unread_only: true },
      });
      return { success: true, data: { count: response.data.unread_count } };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // === Files ===

  // Upload file (creates record)
  ipcMain.handle('files:upload', async (_, fileData) => {
    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/files', fileData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // List files in channel
  ipcMain.handle('files:list', async (_, { channelUuid, params = {} }) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/files`, { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Delete file
  ipcMain.handle('files:delete', async (_, fileUuid) => {
    try {
      const api = createApiClient(store);
      await api.delete(`/api/chat/files/${fileUuid}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // === Invites ===

  // Send invite
  ipcMain.handle('invites:send', async (_, { channelUuid, userUuid, message, expiresInHours }) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/invites`, {
        user_uuid: userUuid,
        message,
        expires_in_hours: expiresInHours,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // List pending invites
  ipcMain.handle('invites:list', async () => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/invites');
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Accept invite
  ipcMain.handle('invites:accept', async (_, inviteUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/invites/${inviteUuid}/accept`);

      // Join channel via socket
      const socketService = getSocketService();
      if (socketService && response.data?.invite?.channel_uuid) {
        socketService.joinChannel(response.data.invite.channel_uuid);
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Decline invite
  ipcMain.handle('invites:decline', async (_, inviteUuid) => {
    try {
      const api = createApiClient(store);
      await api.post(`/api/chat/invites/${inviteUuid}/decline`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });
};

module.exports = { register };
