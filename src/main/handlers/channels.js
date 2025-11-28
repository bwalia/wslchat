/**
 * Channel IPC Handlers
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
  // List channels for current user
  ipcMain.handle('channels:list', async (_, params = {}) => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/channels', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get single channel details
  ipcMain.handle('channels:get', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Create new channel
  ipcMain.handle('channels:create', async (_, channelData) => {
    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/channels', channelData);

      // Join the channel via socket
      const socketService = getSocketService();
      if (socketService && response.data?.uuid) {
        socketService.joinChannel(response.data.uuid);
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Update channel
  ipcMain.handle('channels:update', async (_, { channelUuid, updates }) => {
    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/channels/${channelUuid}`, updates);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Delete/archive channel
  ipcMain.handle('channels:delete', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      await api.delete(`/api/chat/channels/${channelUuid}`);

      // Leave channel via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.leaveChannel(channelUuid);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Join public channel
  ipcMain.handle('channels:join', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/join`);

      // Join via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.joinChannel(channelUuid);
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Leave channel
  ipcMain.handle('channels:leave', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      await api.post(`/api/chat/channels/${channelUuid}/leave`);

      // Leave via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.leaveChannel(channelUuid);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get channel members
  ipcMain.handle('channels:get-members', async (_, { channelUuid, params = {} }) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/members`, { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Add members to channel
  ipcMain.handle('channels:add-members', async (_, { channelUuid, userUuids, role }) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/members`, {
        user_uuids: userUuids,
        role,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Remove member from channel
  ipcMain.handle('channels:remove-member', async (_, { channelUuid, userUuid }) => {
    try {
      const api = createApiClient(store);
      await api.delete(`/api/chat/channels/${channelUuid}/members/${userUuid}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Update member role
  ipcMain.handle('channels:update-member-role', async (_, { channelUuid, userUuid, role }) => {
    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/channels/${channelUuid}/members/${userUuid}/role`, { role });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Mark channel as read
  ipcMain.handle('channels:mark-as-read', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/read`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Create or get direct message channel
  ipcMain.handle('channels:create-direct', async (_, userUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/channels/direct', {
        user_uuid: userUuid,
      });

      // Join via socket
      const socketService = getSocketService();
      if (socketService && response.data?.channel?.uuid) {
        socketService.joinChannel(response.data.channel.uuid);
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Search channels
  ipcMain.handle('channels:search', async (_, { query, params = {} }) => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/channels/search', {
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

  // Get unread count for channel
  ipcMain.handle('channels:get-unread', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/unread`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Update channel settings
  ipcMain.handle('channels:update-settings', async (_, { channelUuid, settings }) => {
    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/channels/${channelUuid}/settings`, settings);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });
};

module.exports = { register };
