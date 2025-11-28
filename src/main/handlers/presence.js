/**
 * Presence IPC Handlers
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
  // Update presence status
  ipcMain.handle('presence:update', async (_, { status, statusText, statusEmoji, currentChannelUuid }) => {
    try {
      const api = createApiClient(store);
      const response = await api.put('/api/chat/presence', {
        status,
        status_text: statusText,
        status_emoji: statusEmoji,
        current_channel_uuid: currentChannelUuid,
      });

      // Also emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('presence:update', {
          status,
          statusText,
          statusEmoji,
          currentChannelUuid,
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

  // Get current user's presence
  ipcMain.handle('presence:get', async () => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/presence');
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Get online users in channel
  ipcMain.handle('presence:get-channel', async (_, channelUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/presence`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Set typing indicator
  ipcMain.handle('presence:set-typing', async (_, { channelUuid, isTyping }) => {
    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('typing', {
          channelUuid,
          isTyping,
        });
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Clear custom status
  ipcMain.handle('presence:clear-status', async () => {
    try {
      const api = createApiClient(store);
      await api.delete('/api/chat/presence/custom-status');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Socket connection handlers
  ipcMain.handle('socket:connect', async () => {
    try {
      const socketService = getSocketService();
      if (socketService) {
        const auth = store.get('auth');
        socketService.connect(auth?.token, auth?.user?.uuid);
        return { success: true };
      }
      return { success: false, error: 'Socket service not available' };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('socket:disconnect', async () => {
    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.disconnect();
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('socket:join-channel', async (_, channelUuid) => {
    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.joinChannel(channelUuid);
        return { success: true };
      }
      return { success: false, error: 'Socket service not available' };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('socket:leave-channel', async (_, channelUuid) => {
    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.leaveChannel(channelUuid);
        return { success: true };
      }
      return { success: false, error: 'Socket service not available' };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });
};

module.exports = { register };
