/**
 * Message IPC Handlers
 * Production-ready message management for Convo desktop app
 */

const { createApiClient, handleNetworkError, withRetry } = require('../services/api');

/**
 * Register message IPC handlers
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

  // ============ Messages ============

  /**
   * Get messages for channel
   */
  ipcMain.handle('messages:list', async (_, { channelUuid, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await withRetry(() =>
        api.get(`/api/chat/channels/${channelUuid}/messages`, { params })
      );

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch messages',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Messages] List error:', error.message);
      return handleNetworkError(error, 'Failed to fetch messages');
    }
  });

  /**
   * Get single message
   */
  ipcMain.handle('messages:get', async (_, messageUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/messages/${messageUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch message',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Messages] Get error:', error.message);
      return handleNetworkError(error, 'Failed to fetch message');
    }
  });

  /**
   * Send message
   */
  ipcMain.handle('messages:send', async (_, { channelUuid, messageData }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    if (!messageData?.content && !messageData?.attachments?.length) {
      return { success: false, error: 'Message content or attachments required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/messages`, messageData);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to send message',
        };
      }

      // Emit via socket for real-time delivery to other clients
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('message:send', {
          channelUuid,
          message: response.data,
        });
      }

      console.log('[Messages] Sent to:', channelUuid);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Messages] Send error:', error.message);
      return handleNetworkError(error, 'Failed to send message');
    }
  });

  /**
   * Update message
   */
  ipcMain.handle('messages:update', async (_, { messageUuid, content }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    if (!content || typeof content !== 'string') {
      return { success: false, error: 'Content is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/messages/${messageUuid}`, { content });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to update message',
        };
      }

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('message:update', {
          messageUuid,
          message: response.data,
        });
      }

      console.log('[Messages] Updated:', messageUuid);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Messages] Update error:', error.message);
      return handleNetworkError(error, 'Failed to update message');
    }
  });

  /**
   * Delete message
   */
  ipcMain.handle('messages:delete', async (_, messageUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    try {
      const api = createApiClient(store);

      // Get message first to know channel
      const msgResponse = await api.get(`/api/chat/messages/${messageUuid}`);
      const channelUuid = msgResponse.data?.channel_uuid;

      const response = await api.delete(`/api/chat/messages/${messageUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to delete message',
        };
      }

      // Emit via socket
      const socketService = getSocketService();
      if (socketService && channelUuid) {
        socketService.emit('message:delete', {
          messageUuid,
          channelUuid,
        });
      }

      console.log('[Messages] Deleted:', messageUuid);
      return { success: true };
    } catch (error) {
      console.error('[Messages] Delete error:', error.message);
      return handleNetworkError(error, 'Failed to delete message');
    }
  });

  /**
   * Get thread replies
   */
  ipcMain.handle('messages:get-thread', async (_, { messageUuid, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/messages/${messageUuid}/thread`, { params });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch thread',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Messages] Get thread error:', error.message);
      return handleNetworkError(error, 'Failed to fetch thread');
    }
  });

  /**
   * Search messages in channel
   */
  ipcMain.handle('messages:search', async (_, { channelUuid, query, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Search query is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/messages/search`, {
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
      console.error('[Messages] Search error:', error.message);
      return handleNetworkError(error, 'Search failed');
    }
  });

  /**
   * Get pinned messages
   */
  ipcMain.handle('messages:get-pinned', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/messages/pinned`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch pinned messages',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Messages] Get pinned error:', error.message);
      return handleNetworkError(error, 'Failed to fetch pinned messages');
    }
  });

  /**
   * Pin message
   */
  ipcMain.handle('messages:pin', async (_, messageUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/messages/${messageUuid}/pin`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to pin message',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[Messages] Pin error:', error.message);
      return handleNetworkError(error, 'Failed to pin message');
    }
  });

  /**
   * Unpin message
   */
  ipcMain.handle('messages:unpin', async (_, messageUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.delete(`/api/chat/messages/${messageUuid}/pin`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to unpin message',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[Messages] Unpin error:', error.message);
      return handleNetworkError(error, 'Failed to unpin message');
    }
  });

  // ============ Reactions ============

  /**
   * Add reaction
   */
  ipcMain.handle('reactions:add', async (_, { messageUuid, emoji }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid || !emoji) {
      return { success: false, error: 'Message UUID and emoji are required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/messages/${messageUuid}/reactions`, { emoji });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to add reaction',
        };
      }

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('reaction:add', { messageUuid, emoji });
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Reactions] Add error:', error.message);
      return handleNetworkError(error, 'Failed to add reaction');
    }
  });

  /**
   * Remove reaction
   */
  ipcMain.handle('reactions:remove', async (_, { messageUuid, emoji }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid || !emoji) {
      return { success: false, error: 'Message UUID and emoji are required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.delete(
        `/api/chat/messages/${messageUuid}/reactions/${encodeURIComponent(emoji)}`
      );

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to remove reaction',
        };
      }

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('reaction:remove', { messageUuid, emoji });
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Reactions] Remove error:', error.message);
      return handleNetworkError(error, 'Failed to remove reaction');
    }
  });

  /**
   * Toggle reaction
   */
  ipcMain.handle('reactions:toggle', async (_, { messageUuid, emoji }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid || !emoji) {
      return { success: false, error: 'Message UUID and emoji are required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/messages/${messageUuid}/reactions/toggle`, {
        emoji,
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to toggle reaction',
        };
      }

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('reaction:toggle', {
          messageUuid,
          emoji,
          action: response.data.action,
        });
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Reactions] Toggle error:', error.message);
      return handleNetworkError(error, 'Failed to toggle reaction');
    }
  });

  /**
   * Get reactions for message
   */
  ipcMain.handle('reactions:get', async (_, messageUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/messages/${messageUuid}/reactions`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get reactions',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Reactions] Get error:', error.message);
      return handleNetworkError(error, 'Failed to get reactions');
    }
  });

  // ============ Bookmarks ============

  /**
   * Add bookmark
   */
  ipcMain.handle('bookmarks:add', async (_, { messageUuid, note }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/bookmarks', {
        message_uuid: messageUuid,
        note,
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to add bookmark',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Bookmarks] Add error:', error.message);
      return handleNetworkError(error, 'Failed to add bookmark');
    }
  });

  /**
   * Remove bookmark
   */
  ipcMain.handle('bookmarks:remove', async (_, messageUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!messageUuid) {
      return { success: false, error: 'Message UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.delete(`/api/chat/bookmarks/${messageUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to remove bookmark',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[Bookmarks] Remove error:', error.message);
      return handleNetworkError(error, 'Failed to remove bookmark');
    }
  });

  /**
   * List bookmarks
   */
  ipcMain.handle('bookmarks:list', async (_, params = {}) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/bookmarks', { params });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to list bookmarks',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Bookmarks] List error:', error.message);
      return handleNetworkError(error, 'Failed to list bookmarks');
    }
  });

  // ============ Drafts ============

  /**
   * Save draft
   */
  ipcMain.handle('drafts:save', async (_, { channelUuid, content, parentMessageUuid }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.put(`/api/chat/drafts/${channelUuid}`, {
        content,
        parent_message_uuid: parentMessageUuid,
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to save draft',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Drafts] Save error:', error.message);
      return handleNetworkError(error, 'Failed to save draft');
    }
  });

  /**
   * Get draft
   */
  ipcMain.handle('drafts:get', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/drafts/${channelUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get draft',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Drafts] Get error:', error.message);
      return handleNetworkError(error, 'Failed to get draft');
    }
  });

  /**
   * Delete draft
   */
  ipcMain.handle('drafts:delete', async (_, channelUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.delete(`/api/chat/drafts/${channelUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to delete draft',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[Drafts] Delete error:', error.message);
      return handleNetworkError(error, 'Failed to delete draft');
    }
  });

  /**
   * List all drafts
   */
  ipcMain.handle('drafts:list', async () => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/drafts');

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to list drafts',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Drafts] List error:', error.message);
      return handleNetworkError(error, 'Failed to list drafts');
    }
  });

  // ============ Mentions ============

  /**
   * List mentions
   */
  ipcMain.handle('mentions:list', async (_, params = {}) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/mentions', { params });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to list mentions',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Mentions] List error:', error.message);
      return handleNetworkError(error, 'Failed to list mentions');
    }
  });

  /**
   * Mark mention as read
   */
  ipcMain.handle('mentions:mark-read', async (_, mentionUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!mentionUuid) {
      return { success: false, error: 'Mention UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/mentions/${mentionUuid}/read`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to mark mention as read',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Mentions] Mark read error:', error.message);
      return handleNetworkError(error, 'Failed to mark mention as read');
    }
  });

  /**
   * Mark all mentions as read
   */
  ipcMain.handle('mentions:mark-all-read', async () => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/mentions/read-all');

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to mark all mentions as read',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[Mentions] Mark all read error:', error.message);
      return handleNetworkError(error, 'Failed to mark all mentions as read');
    }
  });

  /**
   * Get unread mention count
   */
  ipcMain.handle('mentions:get-unread-count', async () => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/mentions', {
        params: { unread_only: true },
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get unread count',
        };
      }

      return { success: true, data: { count: response.data.unread_count || 0 } };
    } catch (error) {
      console.error('[Mentions] Get unread count error:', error.message);
      return handleNetworkError(error, 'Failed to get unread count');
    }
  });

  // ============ Files ============

  /**
   * Upload file (creates record)
   */
  ipcMain.handle('files:upload', async (_, fileData) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!fileData) {
      return { success: false, error: 'File data is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post('/api/chat/files', fileData);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to upload file',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Files] Upload error:', error.message);
      return handleNetworkError(error, 'Failed to upload file');
    }
  });

  /**
   * List files in channel
   */
  ipcMain.handle('files:list', async (_, { channelUuid, params = {} }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get(`/api/chat/channels/${channelUuid}/files`, { params });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to list files',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Files] List error:', error.message);
      return handleNetworkError(error, 'Failed to list files');
    }
  });

  /**
   * Delete file
   */
  ipcMain.handle('files:delete', async (_, fileUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!fileUuid) {
      return { success: false, error: 'File UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.delete(`/api/chat/files/${fileUuid}`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to delete file',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[Files] Delete error:', error.message);
      return handleNetworkError(error, 'Failed to delete file');
    }
  });

  // ============ Invites ============

  /**
   * Send invite
   */
  ipcMain.handle('invites:send', async (_, { channelUuid, userUuid, message, expiresInHours }) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid || !userUuid) {
      return { success: false, error: 'Channel UUID and User UUID are required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/channels/${channelUuid}/invites`, {
        user_uuid: userUuid,
        message,
        expires_in_hours: expiresInHours,
      });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to send invite',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Invites] Send error:', error.message);
      return handleNetworkError(error, 'Failed to send invite');
    }
  });

  /**
   * List pending invites
   */
  ipcMain.handle('invites:list', async () => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/invites');

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to list invites',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Invites] List error:', error.message);
      return handleNetworkError(error, 'Failed to list invites');
    }
  });

  /**
   * Accept invite
   */
  ipcMain.handle('invites:accept', async (_, inviteUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!inviteUuid) {
      return { success: false, error: 'Invite UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/invites/${inviteUuid}/accept`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to accept invite',
        };
      }

      // Join channel via socket
      const socketService = getSocketService();
      if (socketService && response.data?.invite?.channel_uuid) {
        socketService.joinChannel(response.data.invite.channel_uuid);
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Invites] Accept error:', error.message);
      return handleNetworkError(error, 'Failed to accept invite');
    }
  });

  /**
   * Decline invite
   */
  ipcMain.handle('invites:decline', async (_, inviteUuid) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    if (!inviteUuid) {
      return { success: false, error: 'Invite UUID is required' };
    }

    try {
      const api = createApiClient(store);
      const response = await api.post(`/api/chat/invites/${inviteUuid}/decline`);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to decline invite',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[Invites] Decline error:', error.message);
      return handleNetworkError(error, 'Failed to decline invite');
    }
  });
};

module.exports = { register };
