/**
 * Presence IPC Handlers
 * Production-ready presence and socket management for Convo desktop app
 */

const { createApiClient, handleNetworkError } = require('../services/api');

/**
 * Register presence IPC handlers
 * @param {import('electron').IpcMain} ipcMain
 * @param {import('electron-store')} store
 * @param {Function} getSocketService - Function to get socket service instance
 */
const register = (ipcMain, store, getSocketService) => {
  /**
   * Helper to validate authentication
   * @returns {{ isValid: boolean, error?: string }}
   */
  const validateAuth = () => {
    const auth = store.get('auth');
    if (!auth?.token || !auth?.user?.uuid) {
      return { isValid: false, error: 'Not authenticated' };
    }
    return { isValid: true };
  };

  /**
   * Update presence status
   */
  ipcMain.handle(
    'presence:update',
    async (_, { status, statusText, statusEmoji, currentChannelUuid }) => {
      const authCheck = validateAuth();
      if (!authCheck.isValid) {
        return { success: false, error: authCheck.error };
      }

      try {
        const api = createApiClient(store);
        const response = await api.put('/api/chat/presence', {
          status,
          status_text: statusText,
          status_emoji: statusEmoji,
          current_channel_uuid: currentChannelUuid,
        });

        if (response.status >= 400) {
          return {
            success: false,
            error: response.data?.error || 'Failed to update presence',
          };
        }

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
        console.error('[Presence] Update error:', error.message);
        return handleNetworkError(error, 'Failed to update presence');
      }
    }
  );

  /**
   * Get current user's presence
   */
  ipcMain.handle('presence:get', async () => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/presence');

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get presence',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Presence] Get error:', error.message);
      return handleNetworkError(error, 'Failed to get presence');
    }
  });

  /**
   * Get online users in channel
   */
  ipcMain.handle('presence:get-channel', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/presence`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get channel presence',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Presence] Get channel error:', error.message);
      return handleNetworkError(error, 'Failed to get channel presence');
    }
  });

  /**
   * Set typing indicator
   */
  ipcMain.handle('presence:set-typing', async (_, { channelUuid, isTyping }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('typing', {
          channelUuid,
          isTyping,
        });
        return { success: true };
      }
      return { success: false, error: 'Socket service not available' };
    } catch (error) {
      console.error('[Presence] Set typing error:', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Clear custom status
   */
  ipcMain.handle('presence:clear-status', async () => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.delete('/api/chat/presence/custom-status');

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to clear status',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[Presence] Clear status error:', error.message);
      return handleNetworkError(error, 'Failed to clear status');
    }
  });

  // ============ Socket Management ============

  /**
   * Connect to socket server
   */
  ipcMain.handle('socket:connect', async () => {
    try {
      const socketService = getSocketService();
      if (socketService) {
        const auth = store.get('auth');
        if (!auth?.token || !auth?.user?.uuid) {
          return { success: false, error: 'Not authenticated' };
        }
        socketService.connect(auth.token, auth.user.uuid);
        console.log('[Socket] Connection initiated');
        return { success: true };
      }
      return { success: false, error: 'Socket service not available' };
    } catch (error) {
      console.error('[Socket] Connect error:', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Disconnect from socket server
   */
  ipcMain.handle('socket:disconnect', async () => {
    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.disconnect();
        console.log('[Socket] Disconnected');
      }
      return { success: true };
    } catch (error) {
      console.error('[Socket] Disconnect error:', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Join a channel room
   */
  ipcMain.handle('socket:join-channel', async (_, channelUuid) => {
    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.joinChannel(channelUuid);
        console.log('[Socket] Joined channel:', channelUuid);
        return { success: true };
      }
      return { success: false, error: 'Socket service not available' };
    } catch (error) {
      console.error('[Socket] Join channel error:', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Leave a channel room
   */
  ipcMain.handle('socket:leave-channel', async (_, channelUuid) => {
    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.leaveChannel(channelUuid);
        console.log('[Socket] Left channel:', channelUuid);
        return { success: true };
      }
      return { success: false, error: 'Socket service not available' };
    } catch (error) {
      console.error('[Socket] Leave channel error:', error.message);
      return { success: false, error: error.message };
    }
  });
};

module.exports = { register };
