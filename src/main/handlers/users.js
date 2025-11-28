/**
 * User IPC Handlers
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

const register = (ipcMain, store) => {
  // Get current user
  ipcMain.handle('users:get-current', async () => {
    try {
      const auth = store.get('auth');
      if (!auth?.user) {
        return { success: false, error: 'Not authenticated' };
      }
      return { success: true, data: auth.user };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Get user by UUID
  ipcMain.handle('users:get', async (_, userUuid) => {
    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/users/${userUuid}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Update current user profile
  ipcMain.handle('users:update-profile', async (_, profileData) => {
    try {
      const auth = store.get('auth');
      if (!auth?.user?.uuid) {
        return { success: false, error: 'Not authenticated' };
      }

      const api = createApiClient(store);
      const response = await api.put(`/api/users/${auth.user.uuid}`, profileData);

      // Update stored user data
      store.set('auth.user', {
        ...auth.user,
        ...response.data,
      });

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  });

  // Search users
  ipcMain.handle('users:search', async (_, { query, params = {} }) => {
    try {
      const api = createApiClient(store);
      const response = await api.get('/api/users', {
        params: { search: query, ...params },
      });
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
