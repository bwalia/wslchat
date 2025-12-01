/**
 * Authentication IPC Handlers
 * Production-ready authentication handling for Convo desktop app
 *
 * Note: Lapis API expects form-urlencoded data for authentication endpoints,
 * not JSON. This is because Lapis uses `self.params` which parses form data.
 */

const { createApiClient, handleNetworkError, apiRequest, encodeFormData } = require('../services/api');

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
    console.log('[Auth] Login attempt for:', credentials.email || credentials.username);

    if (!credentials.email && !credentials.username) {
      return { success: false, error: 'Email or username is required' };
    }

    if (!credentials.password) {
      return { success: false, error: 'Password is required' };
    }

    try {
      const api = createApiClient(null, { useFormData: true });

      const formData = encodeFormData({
        username: credentials.email || credentials.username,
        password: credentials.password,
      });

      const response = await api.post('/auth/login', formData);

      if (response.status >= 400) {
        const errorMessage = response.data?.error || response.data?.message || 'Invalid credentials';
        console.error('[Auth] Login failed:', response.status, errorMessage);
        return { success: false, error: errorMessage };
      }

      const { user, token } = response.data;

      if (!user || !token) {
        console.error('[Auth] Invalid response: missing user or token');
        return { success: false, error: 'Invalid server response' };
      }

      // Normalize user data - Lapis returns 'id' but we use 'uuid' internally
      const normalizedUser = {
        ...user,
        uuid: user.uuid || user.id, // Lapis returns 'id', normalize to 'uuid'
      };

      // Validate user has required fields
      if (!normalizedUser.uuid) {
        console.error('[Auth] Invalid user data: missing uuid/id');
        return { success: false, error: 'Invalid user data received' };
      }

      // Store auth data
      store.set('auth', {
        user: normalizedUser,
        token,
        loggedInAt: new Date().toISOString(),
      });

      console.log('[Auth] Login successful:', normalizedUser.email || normalizedUser.name || normalizedUser.uuid);
      return { success: true, user: normalizedUser, token };
    } catch (error) {
      console.error('[Auth] Login error:', error.message);
      return handleNetworkError(error, 'Login failed. Please try again.');
    }
  });

  /**
   * Logout - clear local auth and notify server
   */
  ipcMain.handle('auth:logout', async () => {
    console.log('[Auth] Logout initiated');

    try {
      const auth = store.get('auth');

      if (auth?.token) {
        try {
          const api = createApiClient(store, { useFormData: true });
          await api.post('/auth/logout');
          console.log('[Auth] Server logout successful');
        } catch (error) {
          // Non-blocking - continue with local logout even if server call fails
          console.warn('[Auth] Server logout notification failed:', error.message);
        }
      }
    } finally {
      // Always clear local auth data
      store.delete('auth');
      console.log('[Auth] Local auth cleared');
    }

    return { success: true };
  });

  /**
   * Validate stored token with the server
   * Sends form-urlencoded data as required by Lapis API
   */
  ipcMain.handle('auth:validate-token', async () => {
    const auth = store.get('auth');

    if (!auth?.token) {
      console.log('[Auth] No token to validate');
      return { success: false, error: 'No token stored' };
    }

    console.log('[Auth] Validating token...');

    try {
      const api = createApiClient(null, { useFormData: true });

      const formData = encodeFormData({ token: auth.token });
      const response = await api.post('/auth/oauth/validate', formData);

      if (response.status >= 400) {
        console.log('[Auth] Token validation failed:', response.status);

        // Clear auth on definitive auth failures
        if (response.status === 401 || response.status === 403) {
          store.delete('auth');
        }

        return {
          success: false,
          error: response.data?.error || response.data?.message || 'Token invalid',
        };
      }

      const { user, token: newToken } = response.data;

      if (!user) {
        console.error('[Auth] Invalid validation response: missing user');
        store.delete('auth');
        return { success: false, error: 'Invalid validation response' };
      }

      // Normalize user data - Lapis returns 'id' but we use 'uuid' internally
      const normalizedUser = {
        ...user,
        uuid: user.uuid || user.id,
      };

      // Update stored auth data with fresh data
      const updatedAuth = {
        user: normalizedUser,
        token: newToken || auth.token,
        loggedInAt: auth.loggedInAt,
        validatedAt: new Date().toISOString(),
      };

      store.set('auth', updatedAuth);

      console.log('[Auth] Token validated successfully');
      return {
        success: true,
        user: normalizedUser,
        token: updatedAuth.token,
      };
    } catch (error) {
      console.error('[Auth] Token validation error:', error.message);

      // Only clear auth on definitive auth failures, not network errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        store.delete('auth');
      }

      return handleNetworkError(error, 'Token validation failed');
    }
  });

  /**
   * Get stored auth data (without server validation)
   */
  ipcMain.handle('auth:get-stored-auth', async () => {
    const auth = store.get('auth');

    if (!auth?.token || !auth?.user) {
      return { success: false, error: 'Not logged in' };
    }

    // Check if token might be expired (optional: add expiry check)
    const loggedInAt = auth.loggedInAt ? new Date(auth.loggedInAt) : null;
    const now = new Date();

    // If logged in more than 30 days ago, suggest revalidation
    if (loggedInAt && now - loggedInAt > 30 * 24 * 60 * 60 * 1000) {
      console.log('[Auth] Stored auth is old, recommending validation');
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
    const { API_URL } = require('../services/api');
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

    console.log('[Auth] Handling OAuth callback');

    try {
      const api = createApiClient(null, { useFormData: true });

      const formData = encodeFormData({ token });
      const response = await api.post('/auth/oauth/validate', formData);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || response.data?.message || 'Invalid token',
        };
      }

      const { user } = response.data;

      if (!user) {
        return { success: false, error: 'Invalid validation response' };
      }

      // Normalize user data - Lapis returns 'id' but we use 'uuid' internally
      const normalizedUser = {
        ...user,
        uuid: user.uuid || user.id,
      };

      // Store auth data
      store.set('auth', {
        user: normalizedUser,
        token,
        loggedInAt: new Date().toISOString(),
        authMethod: 'oauth',
      });

      console.log('[Auth] OAuth callback handled successfully:', normalizedUser.email || normalizedUser.uuid);
      return { success: true, user: normalizedUser, token };
    } catch (error) {
      console.error('[Auth] OAuth callback error:', error.message);
      return handleNetworkError(error, 'OAuth authentication failed');
    }
  });

  /**
   * Refresh authentication token
   * Call this when receiving a 401 response
   */
  ipcMain.handle('auth:refresh-token', async () => {
    const auth = store.get('auth');

    if (!auth?.token) {
      return { success: false, error: 'No token to refresh' };
    }

    console.log('[Auth] Attempting token refresh');

    try {
      const api = createApiClient(null, { useFormData: true });

      const formData = encodeFormData({ token: auth.token });
      const response = await api.post('/auth/refresh', formData);

      if (response.status >= 400) {
        console.log('[Auth] Token refresh failed:', response.status);

        // Clear auth on failure
        if (response.status === 401 || response.status === 403) {
          store.delete('auth');
        }

        return {
          success: false,
          error: response.data?.error || 'Token refresh failed',
        };
      }

      const { user, token: newToken } = response.data;

      if (!newToken) {
        return { success: false, error: 'No new token received' };
      }

      // Update stored auth
      store.set('auth', {
        ...auth,
        user: user || auth.user,
        token: newToken,
        refreshedAt: new Date().toISOString(),
      });

      console.log('[Auth] Token refreshed successfully');
      return { success: true, token: newToken, user: user || auth.user };
    } catch (error) {
      console.error('[Auth] Token refresh error:', error.message);

      if (error.response?.status === 401 || error.response?.status === 403) {
        store.delete('auth');
      }

      return handleNetworkError(error, 'Token refresh failed');
    }
  });

  /**
   * Update user profile
   */
  ipcMain.handle('auth:update-profile', async (_, updates) => {
    const auth = store.get('auth');

    if (!auth?.token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const api = createApiClient(store, { useFormData: true });

      const formData = encodeFormData(updates);
      const response = await api.put('/auth/profile', formData);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to update profile',
        };
      }

      const { user } = response.data;

      if (user) {
        store.set('auth', {
          ...auth,
          user,
          updatedAt: new Date().toISOString(),
        });
      }

      console.log('[Auth] Profile updated successfully');
      return { success: true, user: user || auth.user };
    } catch (error) {
      console.error('[Auth] Profile update error:', error.message);
      return handleNetworkError(error, 'Failed to update profile');
    }
  });
};

module.exports = { register };
