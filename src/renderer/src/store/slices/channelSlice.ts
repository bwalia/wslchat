import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Channel, ChannelMember, PaginatedResponse } from '../../types';

interface ChannelState {
  channels: Channel[];
  currentChannel: Channel | null;
  members: { [channelUuid: string]: ChannelMember[] };
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  searchResults: Channel[];
  isSearching: boolean;
}

const initialState: ChannelState = {
  channels: [],
  currentChannel: null,
  members: {},
  isLoading: false,
  isCreating: false,
  error: null,
  searchResults: [],
  isSearching: false,
};

// Async thunks
export const fetchChannels = createAsyncThunk<
  PaginatedResponse<Channel>,
  { page?: number; perPage?: number }
>(
  'channel/fetchChannels',
  async (params = {}, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<PaginatedResponse<Channel>>(
        'channels:list',
        params
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch channels');
      }
      return result.data!;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch channels');
    }
  }
);

export const fetchChannel = createAsyncThunk<Channel, string>(
  'channel/fetchChannel',
  async (channelUuid, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<Channel>('channels:get', channelUuid);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch channel');
      }
      return result.data!;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch channel');
    }
  }
);

export const createChannel = createAsyncThunk<
  Channel,
  { name: string; description?: string; type?: string; members?: string[] }
>(
  'channel/createChannel',
  async (channelData, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<Channel>('channels:create', channelData);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to create channel');
      }
      return result.data!;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create channel');
    }
  }
);

export const updateChannel = createAsyncThunk<
  Channel,
  { channelUuid: string; updates: Partial<Channel> }
>(
  'channel/updateChannel',
  async ({ channelUuid, updates }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<Channel>('channels:update', {
        channelUuid,
        updates,
      });
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to update channel');
      }
      return result.data!;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update channel');
    }
  }
);

export const deleteChannel = createAsyncThunk<string, string>(
  'channel/deleteChannel',
  async (channelUuid, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('channels:delete', channelUuid);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to delete channel');
      }
      return channelUuid;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete channel');
    }
  }
);

export const joinChannel = createAsyncThunk<string, string>(
  'channel/joinChannel',
  async (channelUuid, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ member: ChannelMember }>(
        'channels:join',
        channelUuid
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to join channel');
      }
      // Join socket room
      await window.electronAPI.invoke('socket:join-channel', channelUuid);
      return channelUuid;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to join channel');
    }
  }
);

export const leaveChannel = createAsyncThunk<string, string>(
  'channel/leaveChannel',
  async (channelUuid, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('channels:leave', channelUuid);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to leave channel');
      }
      // Leave socket room
      await window.electronAPI.invoke('socket:leave-channel', channelUuid);
      return channelUuid;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to leave channel');
    }
  }
);

export const fetchChannelMembers = createAsyncThunk<
  { channelUuid: string; members: ChannelMember[] },
  { channelUuid: string; params?: { page?: number; perPage?: number } }
>(
  'channel/fetchMembers',
  async ({ channelUuid, params = {} }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<PaginatedResponse<ChannelMember>>(
        'channels:get-members',
        { channelUuid, params }
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch members');
      }
      return { channelUuid, members: result.data?.data || [] };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch members');
    }
  }
);

export const createDirectChannel = createAsyncThunk<
  { channel: Channel; created: boolean },
  string
>(
  'channel/createDirect',
  async (userUuid, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ channel: Channel; created: boolean }>(
        'channels:create-direct',
        userUuid
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to create direct channel');
      }
      // Join socket room
      if (result.data?.channel?.uuid) {
        await window.electronAPI.invoke('socket:join-channel', result.data.channel.uuid);
      }
      return result.data!;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create direct channel');
    }
  }
);

export const searchChannels = createAsyncThunk<Channel[], { query: string; params?: object }>(
  'channel/search',
  async ({ query, params = {} }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ data: Channel[] }>(
        'channels:search',
        { query, params }
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Search failed');
      }
      return result.data?.data || [];
    } catch (error: any) {
      return rejectWithValue(error.message || 'Search failed');
    }
  }
);

export const markChannelAsRead = createAsyncThunk<string, string>(
  'channel/markAsRead',
  async (channelUuid) => {
    try {
      // Fire and forget - don't block on errors for this non-critical operation
      const result = await window.electronAPI.invoke('channels:mark-as-read', channelUuid);
      if (!result.success) {
        // Log but don't reject - this is a non-critical operation
        console.warn('[Channel] Mark as read failed:', result.error);
      }
      return channelUuid;
    } catch (error: any) {
      // Log but don't reject - this is a non-critical operation
      console.warn('[Channel] Mark as read error:', error.message);
      return channelUuid;
    }
  }
);

const channelSlice = createSlice({
  name: 'channel',
  initialState,
  reducers: {
    setCurrentChannel: (state, action: PayloadAction<Channel | null>) => {
      state.currentChannel = action.payload;
    },
    updateChannelUnread: (state, action: PayloadAction<{ channelUuid: string; count: number }>) => {
      const channel = state.channels.find((c) => c.uuid === action.payload.channelUuid);
      if (channel) {
        channel.unread_count = action.payload.count;
      }
    },
    incrementUnread: (state, action: PayloadAction<string>) => {
      const channel = state.channels.find((c) => c.uuid === action.payload);
      if (channel) {
        channel.unread_count = (channel.unread_count || 0) + 1;
      }
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.isSearching = false;
    },
    channelUpdated: (state, action: PayloadAction<Channel>) => {
      const index = state.channels.findIndex((c) => c.uuid === action.payload.uuid);
      if (index !== -1) {
        state.channels[index] = { ...state.channels[index], ...action.payload };
      }
      if (state.currentChannel?.uuid === action.payload.uuid) {
        state.currentChannel = { ...state.currentChannel, ...action.payload };
      }
    },
    memberJoined: (state, action: PayloadAction<{ channelUuid: string; member: ChannelMember }>) => {
      const { channelUuid, member } = action.payload;
      if (state.members[channelUuid]) {
        state.members[channelUuid].push(member);
      }
      const channel = state.channels.find((c) => c.uuid === channelUuid);
      if (channel) {
        channel.member_count = (channel.member_count || 0) + 1;
      }
    },
    memberLeft: (state, action: PayloadAction<{ channelUuid: string; userUuid: string }>) => {
      const { channelUuid, userUuid } = action.payload;
      if (state.members[channelUuid]) {
        state.members[channelUuid] = state.members[channelUuid].filter(
          (m) => m.user_uuid !== userUuid
        );
      }
      const channel = state.channels.find((c) => c.uuid === channelUuid);
      if (channel && channel.member_count) {
        channel.member_count -= 1;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch channels
    builder
      .addCase(fetchChannels.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.isLoading = false;
        // Handle both array and paginated response formats
        const data = action.payload?.data;
        state.channels = Array.isArray(data) ? data : [];
      })
      .addCase(fetchChannels.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch single channel
    builder.addCase(fetchChannel.fulfilled, (state, action) => {
      const index = state.channels.findIndex((c) => c.uuid === action.payload.uuid);
      if (index !== -1) {
        state.channels[index] = action.payload;
      } else {
        state.channels.push(action.payload);
      }
    });

    // Create channel
    builder
      .addCase(createChannel.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createChannel.fulfilled, (state, action) => {
        state.isCreating = false;
        state.channels.unshift(action.payload);
      })
      .addCase(createChannel.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      });

    // Update channel
    builder.addCase(updateChannel.fulfilled, (state, action) => {
      const index = state.channels.findIndex((c) => c.uuid === action.payload.uuid);
      if (index !== -1) {
        state.channels[index] = action.payload;
      }
      if (state.currentChannel?.uuid === action.payload.uuid) {
        state.currentChannel = action.payload;
      }
    });

    // Delete channel
    builder.addCase(deleteChannel.fulfilled, (state, action) => {
      state.channels = state.channels.filter((c) => c.uuid !== action.payload);
      if (state.currentChannel?.uuid === action.payload) {
        state.currentChannel = null;
      }
    });

    // Join channel
    builder.addCase(joinChannel.fulfilled, () => {
      // Refetch channels to get the updated list
    });

    // Leave channel
    builder.addCase(leaveChannel.fulfilled, (state, action) => {
      state.channels = state.channels.filter((c) => c.uuid !== action.payload);
      if (state.currentChannel?.uuid === action.payload) {
        state.currentChannel = null;
      }
    });

    // Fetch members
    builder.addCase(fetchChannelMembers.fulfilled, (state, action) => {
      state.members[action.payload.channelUuid] = action.payload.members;
    });

    // Create direct channel
    builder.addCase(createDirectChannel.fulfilled, (state, action) => {
      if (action.payload.channel && action.payload.created) {
        state.channels.unshift(action.payload.channel);
      }
    });

    // Search
    builder
      .addCase(searchChannels.pending, (state) => {
        state.isSearching = true;
      })
      .addCase(searchChannels.fulfilled, (state, action) => {
        state.isSearching = false;
        state.searchResults = action.payload;
      })
      .addCase(searchChannels.rejected, (state) => {
        state.isSearching = false;
        state.searchResults = [];
      });

    // Mark as read
    builder.addCase(markChannelAsRead.fulfilled, (state, action) => {
      const channel = state.channels.find((c) => c.uuid === action.payload);
      if (channel) {
        channel.unread_count = 0;
      }
    });
  },
});

export const {
  setCurrentChannel,
  updateChannelUnread,
  incrementUnread,
  clearSearchResults,
  channelUpdated,
  memberJoined,
  memberLeft,
} = channelSlice.actions;

export default channelSlice.reducer;
