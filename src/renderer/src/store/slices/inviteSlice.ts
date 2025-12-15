/**
 * Invite Slice - Production-grade invitation state management
 * Handles pending invitations, real-time updates, and invitation actions
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { ChannelInvite } from '../../types';

interface InviteState {
  // Pending invitations for current user
  pendingInvites: ChannelInvite[];
  // Loading states
  isLoading: boolean;
  isAccepting: boolean;
  isDeclining: boolean;
  // Error handling
  error: string | null;
  // UI state
  invitesPanelOpen: boolean;
  // Track which invite is being processed
  processingInviteUuid: string | null;
  // Last fetch timestamp for cache invalidation
  lastFetched: number | null;
}

const initialState: InviteState = {
  pendingInvites: [],
  isLoading: false,
  isAccepting: false,
  isDeclining: false,
  error: null,
  invitesPanelOpen: false,
  processingInviteUuid: null,
  lastFetched: null,
};

/**
 * Normalize invite data from API response
 */
const normalizeInvite = (invite: any): ChannelInvite => {
  return {
    uuid: invite.uuid || '',
    channel_uuid: invite.channel_uuid || '',
    invited_user_uuid: invite.invited_user_uuid || '',
    invited_by_uuid: invite.invited_by_uuid || '',
    message: invite.message || undefined,
    status: invite.status || 'pending',
    expires_at: invite.expires_at || undefined,
    responded_at: invite.responded_at || undefined,
    created_at: invite.created_at || new Date().toISOString(),
    updated_at: invite.updated_at || undefined,
    channel_name: invite.channel_name || undefined,
    channel_description: invite.channel_description || undefined,
    channel_type: invite.channel_type || undefined,
    inviter_first_name: invite.inviter_first_name || undefined,
    inviter_last_name: invite.inviter_last_name || undefined,
    inviter_email: invite.inviter_email || undefined,
    channel: invite.channel || undefined,
    inviter: invite.inviter || undefined,
  };
};

/**
 * Fetch pending invitations for the current user
 */
export const fetchPendingInvites = createAsyncThunk<ChannelInvite[], void>(
  'invite/fetchPending',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('invites:list');

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch invitations');
      }

      // Handle various response formats defensively
      let invites: any[] = [];
      if (Array.isArray(result.data)) {
        invites = result.data;
      } else if (result.data?.data && Array.isArray(result.data.data)) {
        invites = result.data.data;
      } else if (result.data) {
        // Single invite or unknown format
        invites = [result.data];
      }

      // Normalize and filter valid invites
      return invites
        .filter((i) => i && typeof i === 'object' && i.uuid)
        .map(normalizeInvite);
    } catch (error: any) {
      console.error('[InviteSlice] fetchPendingInvites error:', error);
      return rejectWithValue(error?.message || 'Failed to fetch invitations');
    }
  }
);

/**
 * Accept a channel invitation
 */
export const acceptInvite = createAsyncThunk<
  { inviteUuid: string; channelUuid: string },
  string
>(
  'invite/accept',
  async (inviteUuid, { rejectWithValue, getState }) => {
    // Validate input
    if (!inviteUuid || typeof inviteUuid !== 'string') {
      return rejectWithValue('Invalid invitation ID');
    }

    try {
      const result = await window.electronAPI.invoke('invites:accept', inviteUuid);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to accept invitation';
        console.error('[InviteSlice] acceptInvite failed:', errorMessage);
        return rejectWithValue(errorMessage);
      }

      // Get the channel UUID from the invite data or API response
      const state = getState() as { invite: InviteState };
      const invite = state.invite.pendingInvites.find((i) => i.uuid === inviteUuid);

      const channelUuid =
        invite?.channel_uuid ||
        result.data?.invite?.channel_uuid ||
        result.data?.channel_uuid ||
        '';

      return { inviteUuid, channelUuid };
    } catch (error: any) {
      console.error('[InviteSlice] acceptInvite error:', error);
      return rejectWithValue(error?.message || 'Failed to accept invitation');
    }
  }
);

/**
 * Decline a channel invitation
 */
export const declineInvite = createAsyncThunk<string, string>(
  'invite/decline',
  async (inviteUuid, { rejectWithValue }) => {
    // Validate input
    if (!inviteUuid || typeof inviteUuid !== 'string') {
      return rejectWithValue('Invalid invitation ID');
    }

    try {
      const result = await window.electronAPI.invoke('invites:decline', inviteUuid);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to decline invitation';
        console.error('[InviteSlice] declineInvite failed:', errorMessage);
        return rejectWithValue(errorMessage);
      }

      return inviteUuid;
    } catch (error: any) {
      console.error('[InviteSlice] declineInvite error:', error);
      return rejectWithValue(error?.message || 'Failed to decline invitation');
    }
  }
);

const inviteSlice = createSlice({
  name: 'invite',
  initialState,
  reducers: {
    // Toggle invites panel visibility
    setInvitesPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.invitesPanelOpen = action.payload;
    },
    toggleInvitesPanel: (state) => {
      state.invitesPanelOpen = !state.invitesPanelOpen;
    },
    // Clear error
    clearInviteError: (state) => {
      state.error = null;
    },
    // Add new invite from real-time event
    inviteReceived: (state, action: PayloadAction<ChannelInvite>) => {
      // Prevent duplicates
      const exists = state.pendingInvites.some(i => i.uuid === action.payload.uuid);
      if (!exists && action.payload.status === 'pending') {
        state.pendingInvites.unshift(action.payload);
      }
    },
    // Remove invite (when expired or processed elsewhere)
    inviteRemoved: (state, action: PayloadAction<string>) => {
      state.pendingInvites = state.pendingInvites.filter(i => i.uuid !== action.payload);
    },
    // Update invite status from real-time event
    inviteUpdated: (state, action: PayloadAction<ChannelInvite>) => {
      const index = state.pendingInvites.findIndex(i => i.uuid === action.payload.uuid);
      if (index !== -1) {
        if (action.payload.status !== 'pending') {
          // Remove if no longer pending
          state.pendingInvites.splice(index, 1);
        } else {
          // Update in place
          state.pendingInvites[index] = action.payload;
        }
      }
    },
    // Reset state on logout
    resetInviteState: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch pending invites
    builder
      .addCase(fetchPendingInvites.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPendingInvites.fulfilled, (state, action) => {
        state.isLoading = false;
        state.pendingInvites = action.payload.filter(i => i.status === 'pending');
        state.lastFetched = Date.now();
      })
      .addCase(fetchPendingInvites.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Accept invite
    builder
      .addCase(acceptInvite.pending, (state, action) => {
        state.isAccepting = true;
        state.processingInviteUuid = action.meta.arg;
        state.error = null;
      })
      .addCase(acceptInvite.fulfilled, (state, action) => {
        state.isAccepting = false;
        state.processingInviteUuid = null;
        state.pendingInvites = state.pendingInvites.filter(
          i => i.uuid !== action.payload.inviteUuid
        );
      })
      .addCase(acceptInvite.rejected, (state, action) => {
        state.isAccepting = false;
        state.processingInviteUuid = null;
        state.error = action.payload as string;
      });

    // Decline invite
    builder
      .addCase(declineInvite.pending, (state, action) => {
        state.isDeclining = true;
        state.processingInviteUuid = action.meta.arg;
        state.error = null;
      })
      .addCase(declineInvite.fulfilled, (state, action) => {
        state.isDeclining = false;
        state.processingInviteUuid = null;
        state.pendingInvites = state.pendingInvites.filter(
          i => i.uuid !== action.payload
        );
      })
      .addCase(declineInvite.rejected, (state, action) => {
        state.isDeclining = false;
        state.processingInviteUuid = null;
        state.error = action.payload as string;
      });
  },
});

export const {
  setInvitesPanelOpen,
  toggleInvitesPanel,
  clearInviteError,
  inviteReceived,
  inviteRemoved,
  inviteUpdated,
  resetInviteState,
} = inviteSlice.actions;

export default inviteSlice.reducer;
