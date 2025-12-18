import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { Mention, MentionableUser, SpecialMention } from "../../types";

interface MentionState {
  mentions: Mention[];
  unreadCount: number;
  mentionableUsers: MentionableUser[];
  specialMentions: SpecialMention[];
  isLoading: boolean;
  isLoadingUsers: boolean;
  error: string | null;
  total: number;
}

const initialState: MentionState = {
  mentions: [],
  unreadCount: 0,
  mentionableUsers: [],
  specialMentions: [
    { id: "channel", display: "@channel", description: "Notify all members" },
    { id: "here", display: "@here", description: "Notify online members" },
    { id: "everyone", display: "@everyone", description: "Notify all members" },
  ],
  isLoading: false,
  isLoadingUsers: false,
  error: null,
  total: 0,
};

// Async thunks
export const fetchMentions = createAsyncThunk(
  "mentions/fetchMentions",
  async (
    params: { limit?: number; offset?: number; unread?: boolean } = {},
    { rejectWithValue }
  ) => {
    const result = await window.electronAPI.invoke<{
      data: Mention[];
      total: number;
    }>("mentions:list", {
      limit: params.limit || 50,
      offset: params.offset || 0,
      unread: params.unread ? "true" : undefined,
    });

    if (!result.success) {
      return rejectWithValue(result.error || "Failed to fetch mentions");
    }

    return result.data;
  }
);

export const fetchUnreadCount = createAsyncThunk(
  "mentions/fetchUnreadCount",
  async (_, { rejectWithValue }) => {
    const result = await window.electronAPI.invoke<{ unread_count: number }>(
      "mentions:unread-count"
    );

    if (!result.success) {
      return rejectWithValue(result.error || "Failed to fetch unread count");
    }

    return result.data?.unread_count || 0;
  }
);

export const markMentionAsRead = createAsyncThunk(
  "mentions/markAsRead",
  async (mentionUuid: string, { rejectWithValue }) => {
    const result = await window.electronAPI.invoke("mentions:mark-read", mentionUuid);

    if (!result.success) {
      return rejectWithValue(result.error || "Failed to mark mention as read");
    }

    return mentionUuid;
  }
);

export const markAllMentionsAsRead = createAsyncThunk(
  "mentions/markAllAsRead",
  async (_, { rejectWithValue }) => {
    const result = await window.electronAPI.invoke("mentions:mark-all-read");

    if (!result.success) {
      return rejectWithValue(result.error || "Failed to mark all mentions as read");
    }

    return true;
  }
);

export const fetchMentionableUsers = createAsyncThunk(
  "mentions/fetchUsers",
  async (
    params: { channelUuid?: string; search?: string } = {},
    { rejectWithValue }
  ) => {
    try {
      const result = await window.electronAPI.invoke<{
        data: MentionableUser[];
        special_mentions: SpecialMention[];
      }>("mentions:users", params);

      if (!result.success) {
        return rejectWithValue(result.error || "Failed to fetch mentionable users");
      }

      // The API returns { data: [...users], special_mentions: [...] }
      // result.data contains this structure
      const users = result.data?.data || [];
      const specialMentions = result.data?.special_mentions || [];

      return {
        users,
        specialMentions,
      };
    } catch (error) {
      return rejectWithValue("Failed to fetch mentionable users");
    }
  }
);

const mentionSlice = createSlice({
  name: "mentions",
  initialState,
  reducers: {
    clearMentions: (state) => {
      state.mentions = [];
      state.total = 0;
    },
    clearMentionableUsers: (state) => {
      state.mentionableUsers = [];
    },
    addMention: (state, action: PayloadAction<Mention>) => {
      // Add new mention to the beginning
      state.mentions.unshift(action.payload);
      state.unreadCount += 1;
      state.total += 1;
    },
    decrementUnreadCount: (state) => {
      if (state.unreadCount > 0) {
        state.unreadCount -= 1;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch mentions
    builder
      .addCase(fetchMentions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMentions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.mentions = action.payload?.data || [];
        state.total = action.payload?.total || 0;
      })
      .addCase(fetchMentions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch unread count
    builder
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      });

    // Mark as read
    builder
      .addCase(markMentionAsRead.fulfilled, (state, action) => {
        const mention = state.mentions.find(
          (m) => m.uuid === action.payload || m.mention_uuid === action.payload
        );
        if (mention && !mention.is_read) {
          mention.is_read = true;
          if (state.unreadCount > 0) {
            state.unreadCount -= 1;
          }
        }
      });

    // Mark all as read
    builder
      .addCase(markAllMentionsAsRead.fulfilled, (state) => {
        state.mentions.forEach((m) => {
          m.is_read = true;
        });
        state.unreadCount = 0;
      });

    // Fetch mentionable users
    builder
      .addCase(fetchMentionableUsers.pending, (state) => {
        state.isLoadingUsers = true;
      })
      .addCase(fetchMentionableUsers.fulfilled, (state, action) => {
        state.isLoadingUsers = false;
        state.mentionableUsers = action.payload?.users || [];
        if (action.payload?.specialMentions && action.payload.specialMentions.length > 0) {
          state.specialMentions = action.payload.specialMentions;
        }
      })
      .addCase(fetchMentionableUsers.rejected, (state) => {
        state.isLoadingUsers = false;
        state.mentionableUsers = [];
      });
  },
});

export const {
  clearMentions,
  clearMentionableUsers,
  addMention,
  decrementUnreadCount,
} = mentionSlice.actions;

export default mentionSlice.reducer;
