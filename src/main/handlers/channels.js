/**
 * Channel IPC Handlers
 * Production-ready channel management for Convo desktop app
 *
 * Note: Lapis chat API uses JSON body parsing (parse_json_body function),
 * unlike auth routes which use form-urlencoded.
 */

const { createApiClient, handleNetworkError, withRetry } = require('../services/api');

/**
 * Register channel IPC handlers
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
   * List channels for current user
   */
  ipcMain.handle('channels:list', async (_, params = {}) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await withRetry(() => api.get('/api/chat/channels', { params }));

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch channels',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] List error:', error.message);
      return handleNetworkError(error, 'Failed to fetch channels');
    }
  });

  /**
   * Get single channel details
   */
  ipcMain.handle('channels:get', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch channel',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Get error:', error.message);
      return handleNetworkError(error, 'Failed to fetch channel');
    }
  });

  /**
   * Create new channel
   */
  ipcMain.handle('channels:create', async (_, channelData) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelData?.name) {
      return { success: false, error: 'Channel name is required' };
    }

    // Validate channel type
    const validTypes = ['public', 'private', 'direct'];
    if (channelData.type && !validTypes.includes(channelData.type)) {
      return { success: false, error: 'Invalid channel type' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/channels', channelData);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to create channel',
        };
      }

      const channel = response.data;

      // Join the channel via socket
      const socketService = getSocketService();
      if (socketService && channel?.uuid) {
        socketService.joinChannel(channel.uuid);
      }

      console.log('[Channels] Created:', channel?.name || channel?.uuid);
      return { success: true, data: channel };
    } catch (error) {
      console.error('[Channels] Create error:', error.message);
      return handleNetworkError(error, 'Failed to create channel');
    }
  });

  /**
   * Update channel
   */
  ipcMain.handle('channels:update', async (_, { channelUuid, updates }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    if (!updates || Object.keys(updates).length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/channels/${channelUuid}`, updates);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to update channel',
        };
      }

      console.log('[Channels] Updated:', channelUuid);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Update error:', error.message);
      return handleNetworkError(error, 'Failed to update channel');
    }
  });

  /**
   * Delete/archive channel
   */
  ipcMain.handle('channels:delete', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.delete(`/api/chat/channels/${channelUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to delete channel',
        };
      }

      // Leave channel via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.leaveChannel(channelUuid);
      }

      console.log('[Channels] Deleted:', channelUuid);
      return { success: true };
    } catch (error) {
      console.error('[Channels] Delete error:', error.message);
      return handleNetworkError(error, 'Failed to delete channel');
    }
  });

  /**
   * Join public channel
   */
  ipcMain.handle('channels:join', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/join`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to join channel',
        };
      }

      // Join via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.joinChannel(channelUuid);
      }

      console.log('[Channels] Joined:', channelUuid);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Join error:', error.message);
      return handleNetworkError(error, 'Failed to join channel');
    }
  });

  /**
   * Leave channel
   */
  ipcMain.handle('channels:leave', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/leave`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to leave channel',
        };
      }

      // Leave via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.leaveChannel(channelUuid);
      }

      console.log('[Channels] Left:', channelUuid);
      return { success: true };
    } catch (error) {
      console.error('[Channels] Leave error:', error.message);
      return handleNetworkError(error, 'Failed to leave channel');
    }
  });

  /**
   * Get channel members
   */
  ipcMain.handle('channels:get-members', async (_, { channelUuid, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/members`, { params });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch members',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Get members error:', error.message);
      return handleNetworkError(error, 'Failed to fetch members');
    }
  });

  /**
   * Add members to channel
   */
  ipcMain.handle('channels:add-members', async (_, { channelUuid, userUuids, role }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    if (!userUuids || !Array.isArray(userUuids) || userUuids.length === 0) {
      return { success: false, error: 'User UUIDs are required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/members`, {
        user_uuids: userUuids,
        role: role || 'member',
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to add members',
        };
      }

      console.log('[Channels] Added members to:', channelUuid);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Add members error:', error.message);
      return handleNetworkError(error, 'Failed to add members');
    }
  });

  /**
   * Remove member from channel
   */
  ipcMain.handle('channels:remove-member', async (_, { channelUuid, userUuid }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid || !userUuid) {
      return { success: false, error: 'Channel UUID and User UUID are required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.delete(`/api/chat/channels/${channelUuid}/members/${userUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to remove member',
        };
      }

      console.log('[Channels] Removed member from:', channelUuid);
      return { success: true };
    } catch (error) {
      console.error('[Channels] Remove member error:', error.message);
      return handleNetworkError(error, 'Failed to remove member');
    }
  });

  /**
   * Update member role
   */
  ipcMain.handle('channels:update-member-role', async (_, { channelUuid, userUuid, role }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid || !userUuid || !role) {
      return { success: false, error: 'Channel UUID, User UUID, and role are required' };
    }

    const validRoles = ['admin', 'moderator', 'member'];
    if (!validRoles.includes(role)) {
      return { success: false, error: 'Invalid role' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/channels/${channelUuid}/members/${userUuid}/role`, {
        role,
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to update member role',
        };
      }

      console.log('[Channels] Updated member role in:', channelUuid);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Update member role error:', error.message);
      return handleNetworkError(error, 'Failed to update member role');
    }
  });

  /**
   * Mark channel as read
   */
  ipcMain.handle('channels:mark-as-read', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/read`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to mark as read',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Mark as read error:', error.message);
      return handleNetworkError(error, 'Failed to mark as read');
    }
  });

  /**
   * Create or get direct message channel
   */
  ipcMain.handle('channels:create-direct', async (_, userUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!userUuid) {
      return { success: false, error: 'User UUID is required' };
    }

    const auth = store.get('auth');
    if (userUuid === auth.user.uuid) {
      return { success: false, error: 'Cannot create direct channel with yourself' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/channels/direct', {
        user_uuid: userUuid,
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to create direct channel',
        };
      }

      // Join via socket
      const socketService = getSocketService();
      if (socketService && response.data?.channel?.uuid) {
        socketService.joinChannel(response.data.channel.uuid);
      }

      console.log('[Channels] Created/got direct channel with:', userUuid);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Create direct error:', error.message);
      return handleNetworkError(error, 'Failed to create direct channel');
    }
  });

  /**
   * Search channels
   */
  ipcMain.handle('channels:search', async (_, { query, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Search query is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/channels/search', {
        params: { q: query.trim(), ...params },
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Search failed',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Search error:', error.message);
      return handleNetworkError(error, 'Search failed');
    }
  });

  /**
   * Get unread count for channel
   */
  ipcMain.handle('channels:get-unread', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/unread`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get unread count',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Get unread error:', error.message);
      return handleNetworkError(error, 'Failed to get unread count');
    }
  });

  /**
   * Update channel settings
   */
  ipcMain.handle('channels:update-settings', async (_, { channelUuid, settings }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    if (!settings || Object.keys(settings).length === 0) {
      return { success: false, error: 'Settings are required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/channels/${channelUuid}/settings`, settings);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to update settings',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Channels] Update settings error:', error.message);
      return handleNetworkError(error, 'Failed to update settings');
    }
  });
};

module.exports = { register };
