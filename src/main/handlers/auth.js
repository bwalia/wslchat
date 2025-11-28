/**
 * Authentication IPC Handlers
 * Professional authentication handling for Convo desktop app
 *
 * Note: Lapis API expects form-urlencoded data for authentication endpoints,
 * not JSON. This is because Lapis uses `self.params` which parses form data.
 */

const axios = require('axios');
const querystring = require('querystring');
const config = require('../config');

// API configuration
const API_URL = config.apiUrl;

/**
 * Create an axios instance for form-urlencoded requests
 * Lapis API expects form data for authentication endpoints (uses self.params)
 * @param {string|null} token - Optional auth token
 * @returns {import('axios').AxiosInstance}
 */
const createApiClient = (token = null) => {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return axios.create({
    baseURL: API_URL,
    headers,
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });
};

/**
 * Handle common network errors and return appropriate error response
 * @param {Error} error - The error object
 * @param {string} defaultMessage - Default error message
 * @returns {{ success: false, error: string }}
 */
const handleNetworkError = (error, defaultMessage) => {
  const errorMap = {
    ECONNREFUSED: 'Cannot connect to server. Please check if the API is running.',
    ENOTFOUND: 'Server not found. Please check your network connection.',
    ETIMEDOUT: 'Request timed out. Please try again.',
    TIMEOUT: 'Request timed out. Please try again.',
    ECONNRESET: 'Connection was reset. Please try again.',
    ECONNABORTED: 'Connection was aborted. Please try again.',
  };

  if (error.code && errorMap[error.code]) {
    console.error(`Network error [${error.code}]:`, error.message);
    return { success: false, error: errorMap[error.code] };
  }

  console.error('Request error:', error.message);
  console.error('Error details:', error.response?.data);

  const message = error.response?.data?.error || error.message || defaultMessage;
  return { success: false, error: message };
};

/**
 * Register authentication IPC handlers
 * @param {import('electron').IpcMain} ipcMain
 * @param {import('electron-store')} store
 */
const register = (ipcMain, store) => {
  /**
   * Login with email/username and password
   * Sends form-urlencoded data as required by Lapis API
   */
  ipcMain.handle('auth:login', async (_, credentials) => {
    console.log('=== AUTH LOGIN ===');
    console.log('API_URL:', API_URL);
    console.log('Identifier:', credentials.email || credentials.username);

    try {
      const api = createApiClient();

      // Lapis expects 'username' or 'identifier' field as form data
      const formData = querystring.stringify({
        username: credentials.email || credentials.username,
        password: credentials.password,
      });

      console.log('POST:', `${API_URL}/auth/login`);
      console.log('Content-Type: application/x-www-form-urlencoded');

      const response = await api.post('/auth/login', formData);

      if (response.status >= 400) {
        const errorMessage = response.data?.error || 'Invalid credentials';
        console.error('Login failed:', response.status, errorMessage);
        return { success: false, error: errorMessage };
      }

      const { user, token } = response.data;

      if (!user || !token) {
        console.error('Invalid response: missing user or token');
        return { success: false, error: 'Invalid server response' };
      }

      // Store auth data securely
      store.set('auth', {
        user,
        token,
        loggedInAt: new Date().toISOString(),
      });

      console.log('Login successful:', user.email || user.id);
      return { success: true, user, token };

    } catch (error) {
      return handleNetworkError(error, 'Login failed');
    }
  });

  /**
   * Logout - clear local auth and notify server
   */
  ipcMain.handle('auth:logout', async () => {
    try {
      const auth = store.get('auth');
      if (auth?.token) {
        const api = createApiClient(auth.token);
        // Best effort - don't fail logout if server call fails
        await api.post('/auth/logout').catch((err) => {
          console.log('Server logout notification failed (non-blocking):', err.message);
        });
      }
    } finally {
      // Always clear local auth data
      store.delete('auth');
      console.log('Local auth cleared');
    }
    return { success: true };
  });

  /**
   * Validate stored token with the server
   * Sends form-urlencoded data as required by Lapis API
   */
  ipcMain.handle('auth:validate-token', async () => {
    try {
      const auth = store.get('auth');
      if (!auth?.token) {
        return { success: false, error: 'No token stored' };
      }

      console.log('Validating token...');
      const api = createApiClient();

      // Send token as form data
      const formData = querystring.stringify({
        token: auth.token,
      });

      const response = await api.post('/auth/oauth/validate', formData);

      if (response.status >= 400) {
        console.log('Token validation failed:', response.status);
        store.delete('auth');
        return { success: false, error: response.data?.error || 'Token invalid' };
      }

      const { user, token } = response.data;

      // Update stored auth data
      store.set('auth', {
        user,
        token: token || auth.token,
        loggedInAt: auth.loggedInAt,
        validatedAt: new Date().toISOString(),
      });

      console.log('Token validated successfully');
      return { success: true, user, token: token || auth.token };

    } catch (error) {
      console.error('Token validation error:', error.message);

      // Only clear auth on definitive auth failures, not network errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        store.delete('auth');
      }

      const message = error.response?.data?.error || 'Token validation failed';
      return { success: false, error: message };
    }
  });

  /**
   * Get stored auth data (without server validation)
   */
  ipcMain.handle('auth:get-stored-auth', async () => {
    const auth = store.get('auth');
    if (!auth) {
      return { success: false, error: 'Not logged in' };
    }
    return {
      success: true,
      user: auth.user,
      token: auth.token,
    };
  });

  /**
   * Get Google OAuth URL for browser-based authentication
   */
  ipcMain.handle('auth:google-login', async () => {
    return {
      success: true,
      url: `${API_URL}/auth/google`,
    };
  });

  /**
   * Handle OAuth callback token (for deep link handling)
   * This would be called when the app receives a callback URL with token
   */
  ipcMain.handle('auth:handle-oauth-callback', async (_, { token }) => {
    if (!token) {
      return { success: false, error: 'No token provided' };
    }

    try {
      const api = createApiClient();

      // Validate the received token
      const formData = querystring.stringify({ token });
      const response = await api.post('/auth/oauth/validate', formData);

      if (response.status >= 400) {
        return { success: false, error: response.data?.error || 'Invalid token' };
      }

      const { user } = response.data;

      // Store auth data
      store.set('auth', {
        user,
        token,
        loggedInAt: new Date().toISOString(),
      });

      console.log('OAuth callback handled successfully:', user.email || user.id);
      return { success: true, user, token };

    } catch (error) {
      return handleNetworkError(error, 'OAuth callback failed');
    }
  });
};

module.exports = { register };
