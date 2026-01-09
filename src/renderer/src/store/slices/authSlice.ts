import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { User, LoginCredentials } from "../../types";

interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  error?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  lastAuthCheck: number | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  lastAuthCheck: null,
};

// Async thunks
export const login = createAsyncThunk<AuthResponse, LoginCredentials>(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const result = (await window.electronAPI.invoke(
        "auth:login",
        credentials
      )) as AuthResponse;
      if (!result.success) {
        return rejectWithValue(result.error || "Login failed");
      }
      // Connect socket after login
      await window.electronAPI.invoke("socket:connect");
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || "Login failed");
    }
  }
);

export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      // Disconnect socket before logout
      await window.electronAPI.invoke("socket:disconnect");
      const result = await window.electronAPI.invoke("auth:logout");

      // Import and dispatch reset actions for all slices
      // This ensures clean state for next user session
      const { resetChannelState } = await import("./channelSlice");
      const { resetMessageState } = await import("./messageSlice");
      const { resetPresenceState } = await import("./presenceSlice");
      const { resetUIState } = await import("./uiSlice");
      const { resetInviteState } = await import("./inviteSlice");
      const { resetKanbanState } = await import("./kanbanSlice");

      dispatch(resetChannelState());
      dispatch(resetMessageState());
      dispatch(resetPresenceState());
      dispatch(resetUIState());
      dispatch(resetInviteState());
      dispatch(resetKanbanState());

      // Cleanup timer service
      const { timerService } = await import("../../services/timerService");
      timerService.cleanup();

      // Purge persisted storage to ensure clean state for next user
      const { persistor } = await import("../index");
      await persistor.purge();

      if (!result.success) {
        return rejectWithValue(result.error || "Logout failed");
      }
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || "Logout failed");
    }
  }
);

export const validateToken = createAsyncThunk<AuthResponse, void>(
  "auth/validateToken",
  async (_, { rejectWithValue }) => {
    try {
      const result = (await window.electronAPI.invoke(
        "auth:validate-token"
      )) as AuthResponse;
      if (!result.success) {
        return rejectWithValue(result.error || "Token validation failed");
      }
      // Connect socket if token is valid
      await window.electronAPI.invoke("socket:connect");
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || "Token validation failed");
    }
  }
);

export const checkStoredAuth = createAsyncThunk(
  "auth/checkStoredAuth",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke("auth:get-stored-auth");
      if (!result.success) {
        return rejectWithValue("No stored auth");
      }
      // Validate the token
      return dispatch(validateToken()).unwrap();
    } catch (error: any) {
      return rejectWithValue(error.message || "No stored auth");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearError: (state) => {
      state.error = null;
    },
    setInitialized: (state) => {
      state.isInitialized = true;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload as string;
      });

    // Logout
    builder
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = null;
      })
      .addCase(logout.rejected, (state) => {
        // Even on error, clear auth state
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
      });

    // Validate Token
    builder
      .addCase(validateToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(validateToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isInitialized = true;
        state.lastAuthCheck = Date.now();
      })
      .addCase(validateToken.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.isInitialized = true;
      });

    // Check Stored Auth
    builder
      .addCase(checkStoredAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkStoredAuth.fulfilled, (state) => {
        state.isInitialized = true;
      })
      .addCase(checkStoredAuth.rejected, (state) => {
        state.isLoading = false;
        state.isInitialized = true;
      });
  },
});

export const { setUser, clearError, setInitialized } = authSlice.actions;
export default authSlice.reducer;
