/**
 * User IPC Handlers
 * Production-ready user management for Convo desktop app
 */

const { createApiClient, handleNetworkError } = require('../services/api');

/**
 * Register user IPC handlers
 * @param {import('electron').IpcMain} ipcMain
 * @param {import('electron-store')} store
 */
const register = (ipcMain, store) => {
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
   * Get current user from local storage
   */
  ipcMain.handle('users:get-current', async () => {
    try {
      const auth = store.get('auth');
      if (!auth?.user) {
        return { success: false, error: 'Not authenticated' };
      }
      return { success: true, data: auth.user };
    } catch (error) {
      console.error('[Users] Get current error:', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get user by UUID
   */
  ipcMain.handle('users:get', async (_, userUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!userUuid) {
      return { success: false, error: 'User UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/users/${userUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get user',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Users] Get error:', error.message);
      return handleNetworkError(error, 'Failed to get user');
    }
  });

  /**
   * Update current user profile
   */
  ipcMain.handle('users:update-profile', async (_, profileData) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!profileData || Object.keys(profileData).length === 0) {
      return { success: false, error: 'Profile data is required' };
    }

    try {
      const auth = store.get('auth');
      const api = createApiClient(store);
      const response = await api.put(`/api/users/${auth.user.uuid}`, profileData);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to update profile',
        };
      }

      // Update stored user data
      store.set('auth.user', {
        ...auth.user,
        ...response.data,
      });

      console.log('[Users] Profile updated');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Users] Update profile error:', error.message);
      return handleNetworkError(error, 'Failed to update profile');
    }
  });

  /**
   * Search users
   */
  ipcMain.handle('users:search', async (_, { query, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Search query is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/users', {
        params: { search: query.trim(), ...params },
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Search failed',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Users] Search error:', error.message);
      return handleNetworkError(error, 'Search failed');
    }
  });
};

module.exports = { register };
