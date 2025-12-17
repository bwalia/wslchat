import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Message, Thread, ReactionGroup } from '../../types';

interface MessageState {
  messages: { [channelUuid: string]: Message[] };
  threads: { [messageUuid: string]: Thread };
  pinnedMessages: { [channelUuid: string]: Message[] };
  isLoading: boolean;
  isSending: boolean;
  isLoadingThread: boolean;
  error: string | null;
  hasMore: { [channelUuid: string]: boolean };
}

const initialState: MessageState = {
  messages: {},
  threads: {},
  pinnedMessages: {},
  isLoading: false,
  isSending: false,
  isLoadingThread: false,
  error: null,
  hasMore: {},
};

// Async thunks
export const fetchMessages = createAsyncThunk<
  { channelUuid: string; messages: Message[]; params?: { limit?: number; before?: string; after?: string } },
  { channelUuid: string; params?: { limit?: number; before?: string; after?: string } }
>(
  'message/fetchMessages',
  async ({ channelUuid, params = {} }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ data: Message[]; channel_uuid: string }>(
        'messages:list',
        { channelUuid, params }
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch messages');
      }
      // Ensure messages is always an array
      const messagesData = result.data?.data;
      const messagesArray = Array.isArray(messagesData) ? messagesData : [];
      return { channelUuid, messages: messagesArray, params };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch messages');
    }
  }
);

export const sendMessage = createAsyncThunk<
  { channelUuid: string; message: Message },
  {
    channelUuid: string;
    content: string;
    contentType?: 'text' | 'code' | 'markdown';
    parentMessageUuid?: string;
    attachments?: any[];
    mentions?: Array<{ uuid: string; type: string }>;
  }
>(
  'message/sendMessage',
  async ({ channelUuid, content, contentType = 'text', parentMessageUuid, attachments, mentions }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<Message>('messages:send', {
        channelUuid,
        messageData: {
          content,
          content_type: contentType,
          parent_message_uuid: parentMessageUuid,
          attachments,
          mentions,
        },
      });
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to send message');
      }
      return { channelUuid, message: result.data! };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to send message');
    }
  }
);

export const updateMessage = createAsyncThunk<Message, { messageUuid: string; content: string }>(
  'message/updateMessage',
  async ({ messageUuid, content }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<Message>('messages:update', {
        messageUuid,
        content,
      });
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to update message');
      }
      return result.data!;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update message');
    }
  }
);

export const deleteMessage = createAsyncThunk<
  { messageUuid: string; channelUuid: string },
  { messageUuid: string; channelUuid: string }
>(
  'message/deleteMessage',
  async ({ messageUuid, channelUuid }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('messages:delete', messageUuid);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to delete message');
      }
      return { messageUuid, channelUuid };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete message');
    }
  }
);

export const fetchThread = createAsyncThunk<
  { messageUuid: string; thread: Thread },
  { messageUuid: string; params?: { limit?: number; offset?: number } }
>(
  'message/fetchThread',
  async ({ messageUuid, params = {} }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<Thread>('messages:get-thread', {
        messageUuid,
        params,
      });
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch thread');
      }
      return { messageUuid, thread: result.data! };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch thread');
    }
  }
);

export const fetchPinnedMessages = createAsyncThunk<
  { channelUuid: string; messages: Message[] },
  string
>(
  'message/fetchPinned',
  async (channelUuid, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ data: Message[] }>(
        'messages:get-pinned',
        channelUuid
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch pinned messages');
      }
      return { channelUuid, messages: result.data?.data || [] };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch pinned messages');
    }
  }
);

export const pinMessage = createAsyncThunk<
  { messageUuid: string; channelUuid: string },
  { messageUuid: string; channelUuid: string }
>(
  'message/pin',
  async ({ messageUuid, channelUuid }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('messages:pin', messageUuid);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to pin message');
      }
      return { messageUuid, channelUuid };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to pin message');
    }
  }
);

export const unpinMessage = createAsyncThunk<
  { messageUuid: string; channelUuid: string },
  { messageUuid: string; channelUuid: string }
>(
  'message/unpin',
  async ({ messageUuid, channelUuid }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('messages:unpin', messageUuid);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to unpin message');
      }
      return { messageUuid, channelUuid };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to unpin message');
    }
  }
);

export const toggleReaction = createAsyncThunk<
  { messageUuid: string; action: 'added' | 'removed'; all_reactions: ReactionGroup[] },
  { messageUuid: string; emoji: string }
>(
  'message/toggleReaction',
  async ({ messageUuid, emoji }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ action: 'added' | 'removed'; all_reactions: ReactionGroup[] }>(
        'reactions:toggle',
        { messageUuid, emoji }
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to toggle reaction');
      }
      return { messageUuid, ...result.data! };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to toggle reaction');
    }
  }
);

const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<{ channelUuid: string; message: Message }>) => {
      const { channelUuid, message } = action.payload;
      const parentMessageUuid = message.parent_message_uuid;

      if (parentMessageUuid) {
        // This is a thread reply
        // Add to thread's replies array if thread is loaded
        if (state.threads[parentMessageUuid]) {
          const exists = state.threads[parentMessageUuid].replies?.some(
            (r) => r.uuid === message.uuid
          );
          if (!exists) {
            if (!state.threads[parentMessageUuid].replies) {
              state.threads[parentMessageUuid].replies = [];
            }
            state.threads[parentMessageUuid].replies.push(message);
          }
        }

        // Update parent message's reply_count
        if (state.messages[channelUuid]) {
          const parentMessage = state.messages[channelUuid].find(
            (m) => m.uuid === parentMessageUuid
          );
          if (parentMessage) {
            parentMessage.reply_count = (parentMessage.reply_count || 0) + 1;
          }
        }
      } else {
        // Regular channel message
        if (!state.messages[channelUuid]) {
          state.messages[channelUuid] = [];
        }
        // Check if message already exists
        const exists = state.messages[channelUuid].some((m) => m.uuid === message.uuid);
        if (!exists) {
          state.messages[channelUuid].push(message);
        }
      }
    },
    messageUpdated: (state, action: PayloadAction<Message>) => {
      const message = action.payload;
      const channelMessages = state.messages[message.channel_uuid];
      if (channelMessages) {
        const index = channelMessages.findIndex((m) => m.uuid === message.uuid);
        if (index !== -1) {
          channelMessages[index] = { ...channelMessages[index], ...message };
        }
      }
      // Update in threads if applicable
      if (message.parent_message_uuid && state.threads[message.parent_message_uuid]) {
        const replies = state.threads[message.parent_message_uuid].replies;
        const replyIndex = replies.findIndex((m) => m.uuid === message.uuid);
        if (replyIndex !== -1) {
          replies[replyIndex] = { ...replies[replyIndex], ...message };
        }
      }
    },
    messageDeleted: (state, action: PayloadAction<{ messageUuid: string; channelUuid: string }>) => {
      const { messageUuid, channelUuid } = action.payload;
      if (state.messages[channelUuid]) {
        const message = state.messages[channelUuid].find((m) => m.uuid === messageUuid);
        if (message) {
          message.is_deleted = true;
          message.content = 'This message was deleted';
        }
      }
    },
    reactionAdded: (
      state,
      action: PayloadAction<{ messageUuid: string; emoji: string; userUuid: string }>
    ) => {
      const { messageUuid, emoji, userUuid } = action.payload;
      // Find message in all channels
      for (const channelUuid of Object.keys(state.messages)) {
        const message = state.messages[channelUuid].find((m) => m.uuid === messageUuid);
        if (message) {
          if (!message.reactions) {
            message.reactions = [];
          }
          const reaction = message.reactions.find((r) => r.emoji === emoji);
          if (reaction) {
            if (!reaction.users.includes(userUuid)) {
              reaction.users.push(userUuid);
              reaction.count += 1;
            }
          } else {
            message.reactions.push({
              emoji,
              count: 1,
              users: [userUuid],
              hasReacted: false,
            });
          }
          break;
        }
      }
    },
    reactionRemoved: (
      state,
      action: PayloadAction<{ messageUuid: string; emoji: string; userUuid: string }>
    ) => {
      const { messageUuid, emoji, userUuid } = action.payload;
      for (const channelUuid of Object.keys(state.messages)) {
        const message = state.messages[channelUuid].find((m) => m.uuid === messageUuid);
        if (message && message.reactions) {
          const reaction = message.reactions.find((r) => r.emoji === emoji);
          if (reaction) {
            reaction.users = reaction.users.filter((u) => u !== userUuid);
            reaction.count = Math.max(0, reaction.count - 1);
            if (reaction.count === 0) {
              message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
            }
          }
          break;
        }
      }
    },
    clearChannelMessages: (state, action: PayloadAction<string>) => {
      delete state.messages[action.payload];
      delete state.hasMore[action.payload];
    },
    clearThread: (state, action: PayloadAction<string>) => {
      delete state.threads[action.payload];
    },
    // Reset entire state on logout
    resetMessageState: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch messages
    builder
      .addCase(fetchMessages.pending, (state, action) => {
        if (!action.meta.arg.params?.before) {
          state.isLoading = true;
        }
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.isLoading = false;
        const { channelUuid, messages, params } = action.payload;

        // Ensure messages is always an array
        const messagesArray = Array.isArray(messages) ? messages : [];

        if (params?.before) {
          // Prepend older messages
          const existing = state.messages[channelUuid] || [];
          state.messages[channelUuid] = [...messagesArray, ...existing];
        } else {
          state.messages[channelUuid] = messagesArray;
        }

        // Check if there are more messages
        state.hasMore[channelUuid] = messagesArray.length >= (params?.limit || 50);
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Send message
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isSending = false;
        const { channelUuid, message } = action.payload;

        // Check if this is a thread reply
        const parentMessageUuid = message.parent_message_uuid;

        if (parentMessageUuid) {
          // This is a thread reply - add to thread's replies array
          if (state.threads[parentMessageUuid]) {
            const exists = state.threads[parentMessageUuid].replies?.some(
              (r) => r.uuid === message.uuid
            );
            if (!exists) {
              if (!state.threads[parentMessageUuid].replies) {
                state.threads[parentMessageUuid].replies = [];
              }
              state.threads[parentMessageUuid].replies.push(message);
            }
          }

          // Update parent message's reply_count in the channel messages
          if (state.messages[channelUuid]) {
            const parentMessage = state.messages[channelUuid].find(
              (m) => m.uuid === parentMessageUuid
            );
            if (parentMessage) {
              parentMessage.reply_count = (parentMessage.reply_count || 0) + 1;
            }
          }
        } else {
          // Regular message - add to channel messages
          if (!state.messages[channelUuid]) {
            state.messages[channelUuid] = [];
          }
          // Avoid duplicates
          const exists = state.messages[channelUuid].some((m) => m.uuid === message.uuid);
          if (!exists) {
            state.messages[channelUuid].push(message);
          }
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload as string;
      });

    // Update message
    builder.addCase(updateMessage.fulfilled, (state, action) => {
      const message = action.payload;
      const channelMessages = state.messages[message.channel_uuid];
      if (channelMessages) {
        const index = channelMessages.findIndex((m) => m.uuid === message.uuid);
        if (index !== -1) {
          channelMessages[index] = message;
        }
      }
    });

    // Delete message
    builder.addCase(deleteMessage.fulfilled, (state, action) => {
      const { messageUuid, channelUuid } = action.payload;
      if (state.messages[channelUuid]) {
        const message = state.messages[channelUuid].find((m) => m.uuid === messageUuid);
        if (message) {
          message.is_deleted = true;
          message.content = 'This message was deleted';
        }
      }
    });

    // Fetch thread
    builder
      .addCase(fetchThread.pending, (state) => {
        state.isLoadingThread = true;
      })
      .addCase(fetchThread.fulfilled, (state, action) => {
        state.isLoadingThread = false;
        state.threads[action.payload.messageUuid] = action.payload.thread;
      })
      .addCase(fetchThread.rejected, (state) => {
        state.isLoadingThread = false;
      });

    // Fetch pinned messages
    builder.addCase(fetchPinnedMessages.fulfilled, (state, action) => {
      state.pinnedMessages[action.payload.channelUuid] = action.payload.messages;
    });

    // Pin message
    builder.addCase(pinMessage.fulfilled, (state, action) => {
      const { messageUuid, channelUuid } = action.payload;
      const message = state.messages[channelUuid]?.find((m) => m.uuid === messageUuid);
      if (message) {
        message.is_pinned = true;
        if (!state.pinnedMessages[channelUuid]) {
          state.pinnedMessages[channelUuid] = [];
        }
        state.pinnedMessages[channelUuid].push(message);
      }
    });

    // Unpin message
    builder.addCase(unpinMessage.fulfilled, (state, action) => {
      const { messageUuid, channelUuid } = action.payload;
      const message = state.messages[channelUuid]?.find((m) => m.uuid === messageUuid);
      if (message) {
        message.is_pinned = false;
      }
      if (state.pinnedMessages[channelUuid]) {
        state.pinnedMessages[channelUuid] = state.pinnedMessages[channelUuid].filter(
          (m) => m.uuid !== messageUuid
        );
      }
    });

    // Toggle reaction
    builder.addCase(toggleReaction.fulfilled, (state, action) => {
      const { messageUuid, all_reactions } = action.payload;
      for (const channelUuid of Object.keys(state.messages)) {
        const message = state.messages[channelUuid].find((m) => m.uuid === messageUuid);
        if (message) {
          message.reactions = all_reactions;
          break;
        }
      }
    });
  },
});

export const {
  addMessage,
  messageUpdated,
  messageDeleted,
  reactionAdded,
  reactionRemoved,
  clearChannelMessages,
  clearThread,
  resetMessageState,
} = messageSlice.actions;

export default messageSlice.reducer;
