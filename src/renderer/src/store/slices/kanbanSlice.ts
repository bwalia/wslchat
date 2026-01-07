import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { KanbanProject, KanbanTask, RunningTimer, TimeEntry } from "../../types";

interface KanbanState {
  // Project-channel mapping (keyed by channel UUID)
  projectByChannel: { [channelUuid: string]: KanbanProject | null };

  // Tasks (keyed by board UUID - tasks are organized by board, not project)
  tasksByBoard: { [boardUuid: string]: KanbanTask[] };

  // Time entries (keyed by task UUID)
  timeEntriesByTask: { [taskUuid: string]: TimeEntry[] };

  // Running timer (global - user can only have one)
  runningTimer: RunningTimer | null;

  // Loading states
  isLoadingProject: boolean;
  isLoadingTasks: boolean;
  isTimerLoading: boolean;
  isLoadingTimeEntries: boolean;

  // Error state
  error: string | null;
}

const initialState: KanbanState = {
  projectByChannel: {},
  tasksByBoard: {},
  timeEntriesByTask: {},
  runningTimer: null,
  isLoadingProject: false,
  isLoadingTasks: false,
  isTimerLoading: false,
  isLoadingTimeEntries: false,
  error: null,
};

// Async thunks

/**
 * Fetch project linked to a channel
 */
export const fetchProjectByChannel = createAsyncThunk<
  { channelUuid: string; project: KanbanProject | null },
  string
>("kanban/fetchProjectByChannel", async (channelUuid, { rejectWithValue }) => {
  try {
    const result = await window.electronAPI.invoke<KanbanProject | null>(
      "kanban:get-project-by-channel",
      channelUuid
    );
    if (!result.success) {
      return rejectWithValue(result.error || "Failed to fetch project");
    }
    return { channelUuid, project: result.data || null };
  } catch (error: any) {
    return rejectWithValue(error.message || "Failed to fetch project");
  }
});

/**
 * Fetch tasks for a board
 * Note: Tasks are organized by board, not project directly.
 * Each project has boards, and each board contains tasks.
 */
export const fetchTasksByBoard = createAsyncThunk<
  { boardUuid: string; tasks: KanbanTask[] },
  { boardUuid: string; params?: { page?: number; perPage?: number; status?: string } }
>("kanban/fetchTasksByBoard", async ({ boardUuid, params = {} }, { rejectWithValue }) => {
  try {
    const result = await window.electronAPI.invoke<{ data: KanbanTask[] }>(
      "kanban:get-tasks",
      { boardUuid, params }
    );
    if (!result.success) {
      return rejectWithValue(result.error || "Failed to fetch tasks");
    }
    return { boardUuid, tasks: result.data?.data || [] };
  } catch (error: any) {
    return rejectWithValue(error.message || "Failed to fetch tasks");
  }
});

/**
 * Fetch current running timer
 */
export const fetchRunningTimer = createAsyncThunk<RunningTimer | null, void>(
  "kanban/fetchRunningTimer",
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ data: RunningTimer | { running: false } }>(
        "kanban:timer-current"
      );
      if (!result.success) {
        return rejectWithValue(result.error || "Failed to fetch timer");
      }
      // API returns { running: false } if no timer, or the timer object with running: true
      const data = result.data?.data;
      if (data && "running" in data && data.running === true) {
        return data as RunningTimer;
      }
      return null;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch timer");
    }
  }
);

/**
 * Start timer on a task
 */
export const startTimer = createAsyncThunk<
  RunningTimer,
  { taskUuid: string; description?: string }
>("kanban/startTimer", async ({ taskUuid, description }, { rejectWithValue }) => {
  try {
    console.log("[Kanban] Starting timer for task:", taskUuid);

    // First start the timer
    const result = await window.electronAPI.invoke<{ data: unknown }>(
      "kanban:timer-start",
      { taskUuid, description }
    );
    console.log("[Kanban] Timer start result:", result);

    if (!result.success) {
      console.error("[Kanban] Timer start failed:", result.error);
      return rejectWithValue(result.error || "Failed to start timer");
    }

    // Then fetch the running timer to get the full details (task_uuid, task_title, etc.)
    const timerResult = await window.electronAPI.invoke<{ data: RunningTimer | { running: false } }>(
      "kanban:timer-current"
    );
    console.log("[Kanban] Timer current result:", timerResult);

    if (!timerResult.success) {
      console.error("[Kanban] Fetch timer failed:", timerResult.error);
      return rejectWithValue(timerResult.error || "Failed to fetch timer");
    }

    const data = timerResult.data?.data;
    console.log("[Kanban] Timer data extracted:", data);

    if (data && "running" in data && data.running === true) {
      console.log("[Kanban] Timer is running, returning:", data);
      return data as RunningTimer;
    }

    // Fallback: construct a minimal RunningTimer from start response
    console.log("[Kanban] Using fallback timer construction");
    const entry = result.data?.data || result.data;
    return {
      uuid: (entry as any).uuid,
      task_id: (entry as any).task_id,
      task_uuid: taskUuid,
      task_title: "",
      started_at: (entry as any).started_at,
      running: true,
    } as RunningTimer;
  } catch (error: any) {
    console.error("[Kanban] Start timer error:", error);
    return rejectWithValue(error.message || "Failed to start timer");
  }
});

/**
 * Stop running timer
 */
export const stopTimer = createAsyncThunk<TimeEntry, { description?: string } | void>(
  "kanban/stopTimer",
  async (params, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.invoke<{ data: TimeEntry }>(
        "kanban:timer-stop",
        params || {}
      );
      if (!result.success) {
        return rejectWithValue(result.error || "Failed to stop timer");
      }
      return result.data?.data || result.data as unknown as TimeEntry;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to stop timer");
    }
  }
);

/**
 * Fetch time entries for a task
 */
export const fetchTimeEntries = createAsyncThunk<
  { taskUuid: string; entries: TimeEntry[] },
  { taskUuid: string; params?: { page?: number; perPage?: number } }
>("kanban/fetchTimeEntries", async ({ taskUuid, params = {} }, { rejectWithValue }) => {
  try {
    const result = await window.electronAPI.invoke<{ data: TimeEntry[] }>(
      "kanban:get-task-time-entries",
      { taskUuid, params }
    );
    if (!result.success) {
      return rejectWithValue(result.error || "Failed to fetch time entries");
    }
    return { taskUuid, entries: result.data?.data || [] };
  } catch (error: any) {
    return rejectWithValue(error.message || "Failed to fetch time entries");
  }
});

// Slice
const kanbanSlice = createSlice({
  name: "kanban",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearProjectForChannel: (state, action: PayloadAction<string>) => {
      delete state.projectByChannel[action.payload];
    },
    clearTasksForBoard: (state, action: PayloadAction<string>) => {
      delete state.tasksByBoard[action.payload];
    },
    setRunningTimer: (state, action: PayloadAction<RunningTimer | null>) => {
      state.runningTimer = action.payload;
    },
    // Reset entire state on logout
    resetKanbanState: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch project by channel
    builder
      .addCase(fetchProjectByChannel.pending, (state) => {
        state.isLoadingProject = true;
        state.error = null;
      })
      .addCase(fetchProjectByChannel.fulfilled, (state, action) => {
        state.isLoadingProject = false;
        state.projectByChannel[action.payload.channelUuid] = action.payload.project;
      })
      .addCase(fetchProjectByChannel.rejected, (state, action) => {
        state.isLoadingProject = false;
        state.error = action.payload as string;
      });

    // Fetch tasks by board
    builder
      .addCase(fetchTasksByBoard.pending, (state) => {
        state.isLoadingTasks = true;
        state.error = null;
      })
      .addCase(fetchTasksByBoard.fulfilled, (state, action) => {
        state.isLoadingTasks = false;
        state.tasksByBoard[action.payload.boardUuid] = action.payload.tasks;
      })
      .addCase(fetchTasksByBoard.rejected, (state, action) => {
        state.isLoadingTasks = false;
        state.error = action.payload as string;
      });

    // Fetch running timer
    builder
      .addCase(fetchRunningTimer.pending, (state) => {
        state.isTimerLoading = true;
      })
      .addCase(fetchRunningTimer.fulfilled, (state, action) => {
        state.isTimerLoading = false;
        state.runningTimer = action.payload;
      })
      .addCase(fetchRunningTimer.rejected, (state, action) => {
        state.isTimerLoading = false;
        state.error = action.payload as string;
      });

    // Start timer
    builder
      .addCase(startTimer.pending, (state) => {
        state.isTimerLoading = true;
        state.error = null;
      })
      .addCase(startTimer.fulfilled, (state, action) => {
        state.isTimerLoading = false;
        state.runningTimer = action.payload;
      })
      .addCase(startTimer.rejected, (state, action) => {
        state.isTimerLoading = false;
        state.error = action.payload as string;
      });

    // Stop timer
    builder
      .addCase(stopTimer.pending, (state) => {
        state.isTimerLoading = true;
        state.error = null;
      })
      .addCase(stopTimer.fulfilled, (state) => {
        state.isTimerLoading = false;
        state.runningTimer = null;
      })
      .addCase(stopTimer.rejected, (state, action) => {
        state.isTimerLoading = false;
        state.error = action.payload as string;
      });

    // Fetch time entries
    builder
      .addCase(fetchTimeEntries.pending, (state) => {
        state.isLoadingTimeEntries = true;
        state.error = null;
      })
      .addCase(fetchTimeEntries.fulfilled, (state, action) => {
        state.isLoadingTimeEntries = false;
        state.timeEntriesByTask[action.payload.taskUuid] = action.payload.entries;
      })
      .addCase(fetchTimeEntries.rejected, (state, action) => {
        state.isLoadingTimeEntries = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  clearProjectForChannel,
  clearTasksForBoard,
  setRunningTimer,
  resetKanbanState,
} = kanbanSlice.actions;

export default kanbanSlice.reducer;
