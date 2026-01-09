import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { AppSettings } from '../../types';

type ChannelTab = 'messages' | 'tasks';

interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  threadPanelOpen: boolean;
  activeThreadMessageUuid: string | null;
  searchOpen: boolean;
  searchQuery: string;
  settingsOpen: boolean;
  createChannelOpen: boolean;
  directMessageOpen: boolean;
  inviteUserOpen: boolean;
  profileOpen: boolean;
  membersDrawerOpen: boolean;
  settings: AppSettings;
  isSocketConnected: boolean;
  // Channel tabs
  activeChannelTab: ChannelTab;
  // Timer confirmation dialog
  timerConfirmationOpen: boolean;
  pendingTimerTaskUuid: string | null;
}

const initialState: UIState = {
  theme: 'system',
  sidebarCollapsed: false,
  threadPanelOpen: false,
  activeThreadMessageUuid: null,
  searchOpen: false,
  searchQuery: '',
  settingsOpen: false,
  createChannelOpen: false,
  directMessageOpen: false,
  inviteUserOpen: false,
  profileOpen: false,
  membersDrawerOpen: false,
  settings: {
    theme: 'system',
    notifications: true,
    startMinimized: false,
    minimizeToTray: true,
  },
  isSocketConnected: false,
  activeChannelTab: 'messages',
  timerConfirmationOpen: false,
  pendingTimerTaskUuid: null,
};

export const loadSettings = createAsyncThunk<AppSettings, void>(
  'ui/loadSettings',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<AppSettings>('app:get-settings');
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to load settings');
      }
      return result.data!;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load settings');
    }
  }
);

export const saveSettings = createAsyncThunk<Partial<AppSettings>, Partial<AppSettings>>(
  'ui/saveSettings',
  async (settings, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('app:set-settings', settings);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to save settings');
      }
      return settings;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to save settings');
    }
  }
);

export const setTheme = createAsyncThunk<'light' | 'dark' | 'system', 'light' | 'dark' | 'system'>(
  'ui/setTheme',
  async (theme, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke('app:set-theme', theme);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to set theme');
      }
      return theme;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to set theme');
    }
  }
);

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    openThread: (state, action: PayloadAction<string>) => {
      state.threadPanelOpen = true;
      state.activeThreadMessageUuid = action.payload;
    },
    closeThread: (state) => {
      state.threadPanelOpen = false;
      state.activeThreadMessageUuid = null;
    },
    toggleSearch: (state) => {
      state.searchOpen = !state.searchOpen;
      if (!state.searchOpen) {
        state.searchQuery = '';
      }
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    closeSearch: (state) => {
      state.searchOpen = false;
      state.searchQuery = '';
    },
    openSettings: (state) => {
      state.settingsOpen = true;
    },
    closeSettings: (state) => {
      state.settingsOpen = false;
    },
    openCreateChannel: (state) => {
      state.createChannelOpen = true;
    },
    closeCreateChannel: (state) => {
      state.createChannelOpen = false;
    },
    openDirectMessage: (state) => {
      state.directMessageOpen = true;
    },
    closeDirectMessage: (state) => {
      state.directMessageOpen = false;
    },
    openInviteUser: (state) => {
      state.inviteUserOpen = true;
    },
    closeInviteUser: (state) => {
      state.inviteUserOpen = false;
    },
    openProfile: (state) => {
      state.profileOpen = true;
    },
    closeProfile: (state) => {
      state.profileOpen = false;
    },
    toggleMembersDrawer: (state) => {
      state.membersDrawerOpen = !state.membersDrawerOpen;
    },
    setMembersDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.membersDrawerOpen = action.payload;
    },
    setSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.isSocketConnected = action.payload;
    },
    // Channel tab management
    setActiveChannelTab: (state, action: PayloadAction<ChannelTab>) => {
      state.activeChannelTab = action.payload;
    },
    // Timer confirmation dialog
    openTimerConfirmation: (state, action: PayloadAction<string>) => {
      state.timerConfirmationOpen = true;
      state.pendingTimerTaskUuid = action.payload;
    },
    closeTimerConfirmation: (state) => {
      state.timerConfirmationOpen = false;
      state.pendingTimerTaskUuid = null;
    },
    // Reset UI state on logout (keep theme settings)
    resetUIState: (state) => {
      return {
        ...initialState,
        theme: state.theme,
        settings: state.settings,
      };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadSettings.fulfilled, (state, action) => {
      if (action.payload) {
        state.settings = action.payload;
        state.theme = action.payload.theme;
      }
    });

    builder.addCase(saveSettings.fulfilled, (state, action) => {
      if (action.payload) {
        state.settings = { ...state.settings, ...action.payload };
      }
    });

    builder.addCase(setTheme.fulfilled, (state, action) => {
      if (action.payload) {
        state.theme = action.payload;
        state.settings.theme = action.payload;
      }
    });
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  openThread,
  closeThread,
  toggleSearch,
  setSearchQuery,
  closeSearch,
  openSettings,
  closeSettings,
  openCreateChannel,
  closeCreateChannel,
  openDirectMessage,
  closeDirectMessage,
  openInviteUser,
  closeInviteUser,
  openProfile,
  closeProfile,
  toggleMembersDrawer,
  setMembersDrawerOpen,
  setSocketConnected,
  setActiveChannelTab,
  openTimerConfirmation,
  closeTimerConfirmation,
  resetUIState,
} = uiSlice.actions;

export default uiSlice.reducer;
