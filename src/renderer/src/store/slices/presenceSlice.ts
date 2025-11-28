import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { PresenceStatus, TypingUser } from '../../types';

interface UserPresence {
  userUuid: string;
  status: PresenceStatus;
  statusText?: string;
  statusEmoji?: string;
  lastSeen?: string;
}

interface PresenceState {
  myStatus: PresenceStatus;
  myStatusText: string;
  myStatusEmoji: string;
  usersPresence: { [userUuid: string]: UserPresence };
  channelPresence: { [channelUuid: string]: string[] }; // user uuids online in channel
  typingUsers: { [channelUuid: string]: TypingUser[] };
  isUpdating: boolean;
}

const initialState: PresenceState = {
  myStatus: 'online',
  myStatusText: '',
  myStatusEmoji: '',
  usersPresence: {},
  channelPresence: {},
  typingUsers: {},
  isUpdating: false,
};

// Async thunks
export const updateMyPresence = createAsyncThunk(
  'presence/updateMyPresence',
  async (
    {
      status,
      statusText,
      statusEmoji,
    }: {
      status?: PresenceStatus;
      statusText?: string;
      statusEmoji?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const result = await window.electronAPI.invoke('presence:update', {
        status,
        statusText,
        statusEmoji,
      });
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to update presence');
      }
      return { status, statusText, statusEmoji };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update presence');
    }
  }
);

export const fetchChannelPresence = createAsyncThunk<
  { channelUuid: string; users: UserPresence[] },
  string
>(
  'presence/fetchChannelPresence',
  async (channelUuid, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ data: UserPresence[] }>(
        'presence:get-channel',
        channelUuid
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch presence');
      }
      return { channelUuid, users: result.data?.data || [] };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch presence');
    }
  }
);

export const sendTypingIndicator = createAsyncThunk(
  'presence/sendTyping',
  async ({ channelUuid, isTyping }: { channelUuid: string; isTyping: boolean }, { rejectWithValue }) => {
    try {
      await window.electronAPI.invoke('presence:set-typing', { channelUuid, isTyping });
      return { channelUuid, isTyping };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to send typing indicator');
    }
  }
);

export const clearMyCustomStatus = createAsyncThunk(
  'presence/clearCustomStatus',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('presence:clear-status');
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to clear status');
      }
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to clear status');
    }
  }
);

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setMyStatus: (state, action: PayloadAction<PresenceStatus>) => {
      state.myStatus = action.payload;
    },
    userPresenceUpdated: (state, action: PayloadAction<UserPresence>) => {
      const { userUuid, status, statusText, statusEmoji } = action.payload;
      state.usersPresence[userUuid] = {
        userUuid,
        status,
        statusText,
        statusEmoji,
        lastSeen: new Date().toISOString(),
      };
    },
    userWentOnline: (state, action: PayloadAction<{ userUuid: string; channelUuid?: string }>) => {
      const { userUuid, channelUuid } = action.payload;
      if (!state.usersPresence[userUuid]) {
        state.usersPresence[userUuid] = { userUuid, status: 'online' };
      } else {
        state.usersPresence[userUuid].status = 'online';
      }
      if (channelUuid) {
        if (!state.channelPresence[channelUuid]) {
          state.channelPresence[channelUuid] = [];
        }
        if (!state.channelPresence[channelUuid].includes(userUuid)) {
          state.channelPresence[channelUuid].push(userUuid);
        }
      }
    },
    userWentOffline: (state, action: PayloadAction<{ userUuid: string; channelUuid?: string }>) => {
      const { userUuid, channelUuid } = action.payload;
      if (state.usersPresence[userUuid]) {
        state.usersPresence[userUuid].status = 'offline';
        state.usersPresence[userUuid].lastSeen = new Date().toISOString();
      }
      if (channelUuid && state.channelPresence[channelUuid]) {
        state.channelPresence[channelUuid] = state.channelPresence[channelUuid].filter(
          (u) => u !== userUuid
        );
      }
    },
    typingStarted: (state, action: PayloadAction<TypingUser>) => {
      const { channelUuid, userUuid } = action.payload;
      if (!state.typingUsers[channelUuid]) {
        state.typingUsers[channelUuid] = [];
      }
      // Remove existing typing indicator for this user
      state.typingUsers[channelUuid] = state.typingUsers[channelUuid].filter(
        (t) => t.userUuid !== userUuid
      );
      // Add new typing indicator
      state.typingUsers[channelUuid].push({
        ...action.payload,
        timestamp: Date.now(),
      });
    },
    typingStopped: (state, action: PayloadAction<{ channelUuid: string; userUuid: string }>) => {
      const { channelUuid, userUuid } = action.payload;
      if (state.typingUsers[channelUuid]) {
        state.typingUsers[channelUuid] = state.typingUsers[channelUuid].filter(
          (t) => t.userUuid !== userUuid
        );
      }
    },
    clearStaleTypingIndicators: (state) => {
      const now = Date.now();
      const timeout = 5000; // 5 seconds
      for (const channelUuid of Object.keys(state.typingUsers)) {
        state.typingUsers[channelUuid] = state.typingUsers[channelUuid].filter(
          (t) => now - t.timestamp < timeout
        );
      }
    },
    clearChannelTyping: (state, action: PayloadAction<string>) => {
      delete state.typingUsers[action.payload];
    },
  },
  extraReducers: (builder) => {
    // Update my presence
    builder
      .addCase(updateMyPresence.pending, (state) => {
        state.isUpdating = true;
      })
      .addCase(updateMyPresence.fulfilled, (state, action) => {
        state.isUpdating = false;
        if (action.payload) {
          if (action.payload.status) state.myStatus = action.payload.status;
          if (action.payload.statusText !== undefined) state.myStatusText = action.payload.statusText;
          if (action.payload.statusEmoji !== undefined) state.myStatusEmoji = action.payload.statusEmoji;
        }
      })
      .addCase(updateMyPresence.rejected, (state) => {
        state.isUpdating = false;
      });

    // Fetch channel presence
    builder.addCase(fetchChannelPresence.fulfilled, (state, action) => {
      if (action.payload) {
        const { channelUuid, users } = action.payload;
        state.channelPresence[channelUuid] = users.map((u) => u.userUuid);
        users.forEach((user) => {
          state.usersPresence[user.userUuid] = user;
        });
      }
    });

    // Clear custom status
    builder.addCase(clearMyCustomStatus.fulfilled, (state) => {
      state.myStatusText = '';
      state.myStatusEmoji = '';
    });
  },
});

export const {
  setMyStatus,
  userPresenceUpdated,
  userWentOnline,
  userWentOffline,
  typingStarted,
  typingStopped,
  clearStaleTypingIndicators,
  clearChannelTyping,
} = presenceSlice.actions;

export default presenceSlice.reducer;
