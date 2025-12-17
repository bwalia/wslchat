/**
 * Message IPC Handlers
 * Production-ready message management for Convo desktop app
 */

const { createApiClient, handleNetworkError, withRetry, TIMEOUTS } = require('../services/api');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');

/**
 * Get MIME type from file extension
 * @param {string} fileName - File name with extension
 * @returns {string} MIME type
 */
const getMimeType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    // Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.rtf': 'application/rtf',
    // Archives
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    // Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    // Video
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    // Code
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css': 'text/css',
    '.xml': 'application/xml',
    '.md': 'text/markdown',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Normalize a message from the API response format to the frontend format
 * The API returns flat user data (first_name, last_name, sender_username)
 * The frontend expects a nested user object with a name property
 * @param {Object} message - Raw message from API
 * @returns {Object} - Normalized message
 */
const normalizeMessage = (message) => {
  if (!message) return message;

  // Build user object from flat fields
  const user = {
    uuid: message.user_uuid,
    email: message.email || '',
    first_name: message.first_name || '',
    last_name: message.last_name || '',
    username: message.sender_username || message.username || '',
    // Create display name from available data
    name:
      message.first_name && message.last_name
        ? `${message.first_name} ${message.last_name}`
        : message.sender_username || message.username || message.email || 'Unknown User',
  };

  return {
    ...message,
    user,
    // Ensure required fields have defaults
    is_edited: message.is_edited || false,
    is_deleted: message.is_deleted || false,
    is_pinned: message.is_pinned || false,
    reply_count: message.reply_count || 0,
    reactions: message.reactions || [],
    attachments: message.attachments || [],
    mentions: message.mentions || [],
  };
};

/**
 * Normalize an array of messages and reverse to display order (oldest first)
 * API returns newest first (DESC), but display needs oldest first (ASC)
 * @param {Array} messages - Array of raw messages from API
 * @returns {Array} - Array of normalized messages in display order
 */
const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  // Normalize each message and reverse for display order (oldest first)
  return messages.map(normalizeMessage).reverse();
};

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
    console.log('[Messages] ========== LIST MESSAGES START ==========');
    console.log('[Messages] Channel UUID:', channelUuid);

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

      console.log('[Messages] List response status:', response.status);

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch messages',
        };
      }

      // Normalize messages: add user object and reverse for display order
      const rawMessages = response.data?.data || [];
      console.log('[Messages] Raw messages count:', rawMessages.length);

      // Log attachments for each message
      rawMessages.forEach((msg, idx) => {
        if (msg.attachments && msg.attachments.length > 0) {
          console.log(`[Messages] Message ${idx} (${msg.uuid}) has ${msg.attachments.length} attachments:`, msg.attachments);
        }
      });

      const normalizedMessages = normalizeMessages(rawMessages);

      console.log('[Messages] ========== LIST MESSAGES END ==========');

      return {
        success: true,
        data: {
          ...response.data,
          data: normalizedMessages,
        },
      };
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

      // Normalize the message
      return { success: true, data: normalizeMessage(response.data) };
    } catch (error) {
      console.error('[Messages] Get error:', error.message);
      return handleNetworkError(error, 'Failed to fetch message');
    }
  });

  /**
   * Send message
   */
  ipcMain.handle('messages:send', async (_, { channelUuid, messageData }) => {
    console.log('[Messages] ========== SEND MESSAGE START ==========');
    console.log('[Messages] Channel UUID:', channelUuid);
    console.log('[Messages] Message data:', JSON.stringify(messageData, null, 2));

    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      console.log('[Messages] Auth check failed');
      return { success: false, error: authCheck.error };
    }

    if (!channelUuid) {
      console.log('[Messages] No channel UUID');
      return { success: false, error: 'Channel UUID is required' };
    }

    if (!messageData?.content && !messageData?.attachments?.length) {
      console.log('[Messages] No content or attachments');
      return { success: false, error: 'Message content or attachments required' };
    }

    console.log('[Messages] Has attachments:', messageData?.attachments?.length || 0);

    try {
      const api = createApiClient(store);
      console.log('[Messages] Sending POST request to:', `/api/chat/channels/${channelUuid}/messages`);
      console.log('[Messages] Request body:', JSON.stringify(messageData, null, 2));

      const response = await api.post(`/api/chat/channels/${channelUuid}/messages`, messageData);

      console.log('[Messages] Response status:', response.status);
      console.log('[Messages] Response data:', JSON.stringify(response.data, null, 2));

      if (response.status >= 400) {
        console.log('[Messages] Error response:', response.data);
        return {
          success: false,
          error: response.data?.error || 'Failed to send message',
        };
      }

      // Normalize the message
      const normalizedMessage = normalizeMessage(response.data);
      console.log('[Messages] Normalized message attachments:', normalizedMessage.attachments);

      // Emit via socket for real-time delivery to other clients
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('message:send', {
          channelUuid,
          message: normalizedMessage,
        });
      }

      console.log('[Messages] ========== SEND MESSAGE END ==========');
      console.log('[Messages] Sent to:', channelUuid);
      return { success: true, data: normalizedMessage };
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

      // Normalize the message
      const normalizedMessage = normalizeMessage(response.data);

      // Emit via socket
      const socketService = getSocketService();
      if (socketService) {
        socketService.emit('message:update', {
          messageUuid,
          message: normalizedMessage,
        });
      }

      console.log('[Messages] Updated:', messageUuid);
      return { success: true, data: normalizedMessage };
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

      // Normalize thread data
      const threadData = response.data || {};
      return {
        success: true,
        data: {
          parent: normalizeMessage(threadData.parent),
          replies: (threadData.replies || []).map(normalizeMessage),
          total: threadData.total || 0,
        },
      };
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

      // Normalize search results
      const rawMessages = response.data?.data || [];
      return {
        success: true,
        data: {
          ...response.data,
          data: rawMessages.map(normalizeMessage),
        },
      };
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

      // Normalize pinned messages
      const rawMessages = response.data?.data || [];
      return {
        success: true,
        data: {
          ...response.data,
          data: rawMessages.map(normalizeMessage),
        },
      };
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

  // ============ Files ============

  /**
   * Upload file attachment to MinIO via documents API
   * Uses multipart form data for binary file upload
   */
  ipcMain.handle('files:upload-attachment', async (_, { filePath, channelUuid }) => {
    console.log('[Files] ========== UPLOAD ATTACHMENT START ==========');
    console.log('[Files] Input:', { filePath, channelUuid });

    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      console.log('[Files] Auth check failed:', authCheck.error);
      return { success: false, error: authCheck.error };
    }
    console.log('[Files] Auth check passed');

    if (!filePath) {
      console.log('[Files] No file path provided');
      return { success: false, error: 'File path is required' };
    }

    if (!channelUuid) {
      console.log('[Files] No channel UUID provided');
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      // Check if file exists
      console.log('[Files] Checking if file exists:', filePath);
      if (!fs.existsSync(filePath)) {
        console.log('[Files] File not found:', filePath);
        return { success: false, error: 'File not found' };
      }
      console.log('[Files] File exists');

      // Get file stats
      const stats = fs.statSync(filePath);
      const maxSize = 50 * 1024 * 1024; // 50MB limit

      console.log('[Files] File stats:', { size: stats.size, path: filePath });

      if (stats.size > maxSize) {
        return { success: false, error: 'File size exceeds 50MB limit' };
      }

      // Read file as buffer for more reliable upload
      const fileName = path.basename(filePath);
      const fileBuffer = fs.readFileSync(filePath);
      console.log('[Files] File read into buffer, size:', fileBuffer.length);

      // Create form data with buffer instead of stream
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: getMimeType(fileName),
        knownLength: fileBuffer.length,
      });
      formData.append('prefix', `chat-attachments/${channelUuid}`);

      // Get auth headers
      const auth = store.get('auth');
      const config = require('../config');

      const headers = {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${auth.token}`,
        'X-User-Id': auth.user?.uuid || '',
        'X-Business-Id': auth.user?.uuid_business_id || '',
      };

      // Upload to documents API
      const axios = require('axios');
      const uploadUrl = `${config.documentsApiUrl}/api/v2/documents/upload`;

      console.log('[Files] Uploading to:', uploadUrl);
      console.log('[Files] File name:', fileName);
      console.log('[Files] Content type:', getMimeType(fileName));

      const response = await axios.post(uploadUrl, formData, {
        headers,
        timeout: TIMEOUTS.upload,
        maxContentLength: maxSize,
        maxBodyLength: maxSize,
        validateStatus: () => true, // Accept all status codes to handle errors
      });

      console.log('[Files] Upload response status:', response.status);
      console.log('[Files] Upload response data:', JSON.stringify(response.data, null, 2));

      if (response.status >= 400) {
        const errorMsg = response.data?.error || response.data?.json?.error || 'Failed to upload file';
        console.error('[Files] Upload failed with status:', response.status, errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      // Extract attachment data from response - handle nested structure
      const responseData = response.data;
      const uploadData = responseData?.data || responseData?.json?.data || responseData;

      console.log('[Files] Parsed upload data:', uploadData);

      if (!uploadData?.url) {
        console.error('[Files] No URL in response:', responseData);
        return {
          success: false,
          error: 'Upload succeeded but no URL returned',
        };
      }

      console.log('[Files] Uploaded attachment successfully:', fileName);
      console.log('[Files] File URL:', uploadData.url);
      console.log('[Files] ========== UPLOAD ATTACHMENT END ==========');

      return {
        success: true,
        data: {
          file_name: uploadData.filename || fileName,
          file_type: uploadData.content_type || getMimeType(fileName),
          file_size: uploadData.size || stats.size,
          file_url: uploadData.url,
          key: uploadData.key,
        },
      };
    } catch (error) {
      console.error('[Files] ========== UPLOAD ERROR ==========');
      console.error('[Files] Error message:', error.message);
      console.error('[Files] Error code:', error.code);
      console.error('[Files] Error response:', error.response?.data);
      console.error('[Files] Full error:', error);
      return handleNetworkError(error, 'Failed to upload file');
    }
  });

  /**
   * Upload file from buffer (for drag and drop / paste)
   */
  ipcMain.handle('files:upload-buffer', async (_, { buffer, fileName, channelUuid }) => {
    console.log('[Files] ========== UPLOAD BUFFER START ==========');
    console.log('[Files] File name:', fileName);
    console.log('[Files] Channel UUID:', channelUuid);
    console.log('[Files] Buffer length:', buffer?.length);

    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      console.log('[Files] Auth check failed');
      return { success: false, error: authCheck.error };
    }

    if (!buffer || !fileName) {
      console.log('[Files] Missing buffer or fileName');
      return { success: false, error: 'Buffer and file name are required' };
    }

    if (!channelUuid) {
      console.log('[Files] Missing channelUuid');
      return { success: false, error: 'Channel UUID is required' };
    }

    try {
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      const bufferData = Buffer.from(buffer);

      console.log('[Files] Buffer created, size:', bufferData.length);

      if (bufferData.length > maxSize) {
        return { success: false, error: 'File size exceeds 50MB limit' };
      }

      // Create form data with buffer
      const formData = new FormData();
      formData.append('file', bufferData, {
        filename: fileName,
        contentType: getMimeType(fileName),
      });
      formData.append('prefix', `chat-attachments/${channelUuid}`);

      // Get auth headers
      const auth = store.get('auth');
      const config = require('../config');
      const headers = {
        ...formData.getHeaders(),
        Authorization: `Bearer ${auth.token}`,
        'X-User-Id': auth.user?.uuid,
        'X-Business-Id': auth.user?.uuid_business_id,
      };

      // Upload to documents API (separate service on port 4010)
      const axios = require('axios');
      const uploadUrl = `${config.documentsApiUrl}/api/v2/documents/upload`;

      console.log('[Files] Uploading buffer to:', uploadUrl);

      const response = await axios.post(uploadUrl, formData, {
        headers,
        timeout: TIMEOUTS.upload,
        maxContentLength: maxSize,
        maxBodyLength: maxSize,
        validateStatus: () => true,
      });

      console.log('[Files] Upload response status:', response.status);
      console.log('[Files] Upload response data:', JSON.stringify(response.data, null, 2));

      if (response.status >= 400) {
        const errorMsg = response.data?.error || response.data?.json?.error || 'Failed to upload file';
        console.error('[Files] Upload failed:', errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const responseData = response.data;
      const uploadData = responseData?.data || responseData?.json?.data || responseData;

      console.log('[Files] Parsed upload data:', uploadData);
      console.log('[Files] ========== UPLOAD BUFFER END ==========');

      return {
        success: true,
        data: {
          file_name: uploadData.filename || fileName,
          file_type: uploadData.content_type || getMimeType(fileName),
          file_size: uploadData.size || bufferData.length,
          file_url: uploadData.url,
          key: uploadData.key,
        },
      };
    } catch (error) {
      console.error('[Files] ========== UPLOAD BUFFER ERROR ==========');
      console.error('[Files] Error message:', error.message);
      console.error('[Files] Error code:', error.code);
      return handleNetworkError(error, 'Failed to upload file');
    }
  });

  /**
   * Upload file (creates record) - Legacy handler
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
   * Open file picker dialog
   */
  ipcMain.handle('files:select', async (_, options = {}) => {
    console.log('[Files] ========== FILE SELECT START ==========');
    console.log('[Files] Select options:', options);
    const { multiple = true, filters } = options;

    try {
      const defaultFilters = [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'] },
        { name: 'Archives', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
      ];

      console.log('[Files] Opening file dialog...');
      const result = await dialog.showOpenDialog({
        properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: filters || defaultFilters,
      });

      console.log('[Files] Dialog result:', { canceled: result.canceled, filePaths: result.filePaths });

      if (result.canceled || !result.filePaths.length) {
        console.log('[Files] Dialog canceled or no files selected');
        return { success: true, data: { files: [] } };
      }

      // Get file info for each selected file
      const files = result.filePaths.map((filePath) => {
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        const fileInfo = {
          path: filePath,
          name: fileName,
          size: stats.size,
          type: getMimeType(fileName),
        };
        console.log('[Files] File info:', fileInfo);
        return fileInfo;
      });

      console.log('[Files] Returning files:', files.length);
      console.log('[Files] ========== FILE SELECT END ==========');
      return { success: true, data: { files } };
    } catch (error) {
      console.error('[Files] Select error:', error.message);
      console.error('[Files] Select full error:', error);
      return { success: false, error: 'Failed to open file picker' };
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

  // ============ Mentions ============

  /**
   * Get mentions for current user
   */
  ipcMain.handle('mentions:list', async (_, params = {}) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await withRetry(() =>
        api.get('/api/chat/mentions', { params })
      );

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch mentions',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Mentions] List error:', error.message);
      return handleNetworkError(error, 'Failed to fetch mentions');
    }
  });

  /**
   * Get unread mentions count
   */
  ipcMain.handle('mentions:unread-count', async () => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const response = await api.get('/api/chat/mentions/unread/count');

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch unread count',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Mentions] Unread count error:', error.message);
      return handleNetworkError(error, 'Failed to fetch unread count');
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

      return { success: true };
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
   * Get mentionable users for autocomplete
   */
  ipcMain.handle('mentions:users', async (_, { channelUuid, search } = {}) => {
    const authCheck = validateAuth();
    if (!authCheck.isValid) {
      return { success: false, error: authCheck.error };
    }

    try {
      const api = createApiClient(store);
      const params = {};
      if (channelUuid) params.channel_uuid = channelUuid;
      if (search) params.q = search;

      const response = await api.get('/api/chat/users/mentionable', { params });

      if (response.status >= 400) {
        return {
          success: false,
          error: response.data?.error || 'Failed to fetch mentionable users',
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Mentions] Users error:', error.message);
      return handleNetworkError(error, 'Failed to fetch mentionable users');
    }
  });
};

module.exports = { register };
