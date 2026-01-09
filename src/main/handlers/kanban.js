/**
 * Kanban IPC Handlers
 * Handles task management and time tracking for Convo desktop app
 */

const { createApiClient, handleNetworkError, withRetry } = require('../services/api');

/**
 * Register kanban IPC handlers
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
   * Get project linked to a channel
   */
  ipcMain.handle('kanban:get-project-by-channel', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      // Query projects filtering by chat_channel_uuid
      const response = await withRetry(() =>
        api.get('/api/v2/kanban/projects', {
          params: { chat_channel_uuid: channelUuid },
        })
      );

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch project',
        };
      }

      // Return the first project linked to this channel (should be only one)
      const projects = response.data?.data || [];
      return {
        success: true,
        data: projects.length > 0 ? projects[0] : null,
      };
    } catch (error) {
      console.error('[Kanban] Get project by channel error:', error.message);
      return handleNetworkError(error, 'Failed to fetch project');
    }
  });

  /**
   * Get tasks for a board
   * Note: Tasks are organized by board, not project directly.
   * The project contains boards, and each board has tasks.
   */
  ipcMain.handle('kanban:get-tasks', async (_, { boardUuid, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!boardUuid) {
      return { success: false, error: 'Board UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await withRetry(() =>
        api.get(`/api/v2/kanban/boards/${boardUuid}/tasks`, { params })
      );

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch tasks',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Kanban] Get tasks error:', error.message);
      return handleNetworkError(error, 'Failed to fetch tasks');
    }
  });

  /**
   * Start timer on a task
   */
  ipcMain.handle('kanban:timer-start', async (_, params) => {
    console.log('[Kanban] Timer start params received:', JSON.stringify(params));

    // Handle both destructured and direct params
    const taskUuid = params?.taskUuid;
    const description = params?.description;

    console.log('[Kanban] Extracted taskUuid:', taskUuid);

    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!taskUuid) {
      return { success: false, error: 'Task UUID is required' };
    }

    try {
      // Use JSON encoding - ensure Content-Type is application/json
      const api = createApiClient(store);
      const requestData = {
        task_uuid: taskUuid,
      };
      if (description) {
        requestData.description = description;
      }

      console.log('[Kanban] Sending timer start request (JSON):', JSON.stringify(requestData));

      const response = await api.post('/api/v2/kanban/timer/start', requestData);

      console.log('[Kanban] Timer start response status:', response.status);
      console.log('[Kanban] Timer start response data:', JSON.stringify(response.data));

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to start timer',
        };
      }

      console.log('[Kanban] Timer started for task:', taskUuid);
      // Unwrap the Lapis API response to simplify frontend access
      // Lapis returns { success: true, data: { ... } }, we flatten it
      const apiData = response.data?.data || response.data;
      return { success: true, data: apiData };
    } catch (error) {
      console.error('[Kanban] Start timer error:', error.message);
      if (error.response) {
        console.error('[Kanban] Response data:', JSON.stringify(error.response.data));
      }
      return handleNetworkError(error, 'Failed to start timer');
    }
  });

  /**
   * Stop running timer
   * @param {Object} params
   * @param {string} [params.description] - Optional description
   * @param {number} [params.accumulated_seconds] - Client-tracked seconds (more accurate)
   */
  ipcMain.handle('kanban:timer-stop', async (_, params = {}) => {
    const { description, accumulated_seconds } = params;

    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const requestData = {};
      if (description) {
        requestData.description = description;
      }
      if (accumulated_seconds !== undefined && accumulated_seconds !== null) {
        requestData.accumulated_seconds = accumulated_seconds;
      }

      console.log('[Kanban] Stopping timer with:', JSON.stringify(requestData));

      const response = await api.post('/api/v2/kanban/timer/stop', requestData);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to stop timer',
        };
      }

      console.log('[Kanban] Timer stopped');
      // Unwrap the Lapis API response to simplify frontend access
      const apiData = response.data?.data || response.data;
      return { success: true, data: apiData };
    } catch (error) {
      console.error('[Kanban] Stop timer error:', error.message);
      return handleNetworkError(error, 'Failed to stop timer');
    }
  });

  /**
   * Get current running timer
   */
  ipcMain.handle('kanban:timer-current', async () => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/v2/kanban/timer/current');

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch timer',
        };
      }

      // Unwrap the Lapis API response to simplify frontend access
      const apiData = response.data?.data || response.data;
      return { success: true, data: apiData };
    } catch (error) {
      console.error('[Kanban] Get current timer error:', error.message);
      return handleNetworkError(error, 'Failed to fetch timer');
    }
  });

  /**
   * Get time entries for a task
   */
  ipcMain.handle('kanban:get-task-time-entries', async (_, { taskUuid, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!taskUuid) {
      return { success: false, error: 'Task UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/v2/kanban/tasks/${taskUuid}/time-entries`, { params });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch time entries',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Kanban] Get time entries error:', error.message);
      return handleNetworkError(error, 'Failed to fetch time entries');
    }
  });
};

module.exports = { register };
