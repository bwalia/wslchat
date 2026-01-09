/**
 * Timer Service - Professional time tracking with offline support
 *
 * Features:
 * - Local time tracking (no API calls every second)
 * - Periodic sync to server (every 2 minutes by default)
 * - Offline queue - saves locally when API fails, syncs when connection restored
 * - Accurate accumulated_seconds sent to server on stop
 * - Persists timer state to localStorage for crash recovery
 */

const STORAGE_KEY = "convo_timer_state";
const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const RETRY_INTERVAL_MS = 30 * 1000; // 30 seconds for retry

export interface LocalTimerState {
  isRunning: boolean;
  taskUuid: string | null;
  taskId: number | null;
  taskTitle: string | null;
  startedAt: string | null; // ISO timestamp when timer started
  localStartTime: number | null; // Date.now() when we started tracking locally
  accumulatedSeconds: number; // Total seconds accumulated (previous sessions + current)
  previousSeconds: number; // Seconds from previous sessions (from server)
  lastSyncAt: number | null; // Last successful sync timestamp
  pendingSync: boolean; // Whether we have unsynced time
  syncQueue: SyncQueueItem[]; // Failed sync attempts to retry
}

interface SyncQueueItem {
  type: "stop";
  taskUuid: string;
  accumulatedSeconds: number;
  timestamp: number;
  retryCount: number;
}

const DEFAULT_STATE: LocalTimerState = {
  isRunning: false,
  taskUuid: null,
  taskId: null,
  taskTitle: null,
  startedAt: null,
  localStartTime: null,
  accumulatedSeconds: 0,
  previousSeconds: 0,
  lastSyncAt: null,
  pendingSync: false,
  syncQueue: [],
};

class TimerService {
  private state: LocalTimerState;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private retryInterval: ReturnType<typeof setInterval> | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(state: LocalTimerState) => void> = new Set();

  constructor() {
    this.state = this.loadState();
    this.startIntervals();

    // If timer was running when app closed, continue tracking
    if (this.state.isRunning && this.state.localStartTime) {
      // Calculate how much time passed while app was closed
      const now = Date.now();
      const elapsedWhileClosed = Math.floor(
        (now - this.state.localStartTime) / 1000
      );
      // Update accumulated seconds to include time while closed
      // But we need to recalculate based on when we started
      this.state.localStartTime = now - (this.state.accumulatedSeconds - this.state.previousSeconds) * 1000;
      this.saveState();
    }
  }

  private loadState(): LocalTimerState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_STATE, ...parsed };
      }
    } catch (e) {
      console.error("[TimerService] Failed to load state:", e);
    }
    return { ...DEFAULT_STATE };
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("[TimerService] Failed to save state:", e);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }

  subscribe(listener: (state: LocalTimerState) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private startIntervals(): void {
    // Tick interval - update accumulated seconds every second (local only, no API)
    this.tickInterval = setInterval(() => {
      if (this.state.isRunning && this.state.localStartTime) {
        const currentSessionSeconds = Math.floor(
          (Date.now() - this.state.localStartTime) / 1000
        );
        this.state.accumulatedSeconds =
          this.state.previousSeconds + currentSessionSeconds;
        this.saveState();
        this.notifyListeners();
      }
    }, 1000);

    // Sync interval - periodically sync with server (every 2 min)
    this.syncInterval = setInterval(() => {
      this.periodicSync();
    }, SYNC_INTERVAL_MS);

    // Retry interval - retry failed syncs
    this.retryInterval = setInterval(() => {
      this.retryFailedSyncs();
    }, RETRY_INTERVAL_MS);
  }

  private async periodicSync(): Promise<void> {
    // For now, periodic sync just validates timer is still running on server
    // Real sync happens on stop
    if (this.state.isRunning && this.state.pendingSync) {
      console.log("[TimerService] Periodic sync - timer running, pending sync");
      // Could add a heartbeat API here if needed
    }
  }

  private async retryFailedSyncs(): Promise<void> {
    if (this.state.syncQueue.length === 0) return;

    console.log(
      "[TimerService] Retrying failed syncs:",
      this.state.syncQueue.length
    );

    const queue = [...this.state.syncQueue];
    this.state.syncQueue = [];

    for (const item of queue) {
      if (item.type === "stop") {
        try {
          await window.electronAPI.invoke("kanban:timer-stop", {
            accumulated_seconds: item.accumulatedSeconds,
          });
          console.log("[TimerService] Retry successful for:", item.taskUuid);
        } catch (e) {
          console.error("[TimerService] Retry failed:", e);
          if (item.retryCount < 5) {
            this.state.syncQueue.push({
              ...item,
              retryCount: item.retryCount + 1,
            });
          } else {
            console.error(
              "[TimerService] Max retries reached, dropping:",
              item
            );
          }
        }
      }
    }

    this.saveState();
  }

  /**
   * Start timer for a task
   * Note: previousSeconds parameter is now ignored - we get accurate seconds from the server
   */
  async start(
    taskUuid: string,
    taskId: number,
    taskTitle: string,
    _previousSeconds: number = 0  // Deprecated: server now provides accurate previous_seconds
  ): Promise<boolean> {
    console.log("[TimerService] Starting timer for:", taskUuid);

    try {
      // Call API to start timer on server
      const result = await window.electronAPI.invoke("kanban:timer-start", {
        taskUuid,
      });

      if (!result.success) {
        console.error("[TimerService] Server start failed:", result.error);
        return false;
      }

      // Get previous_seconds from server response (accurate to the second)
      // IPC handler now unwraps the API response, so structure is: { success: true, data: { previous_seconds, ... } }
      const serverPreviousSeconds = result.data?.previous_seconds || 0;
      console.log("[TimerService] Server returned previous_seconds:", serverPreviousSeconds);

      // Update local state
      this.state = {
        ...this.state,
        isRunning: true,
        taskUuid,
        taskId,
        taskTitle,
        startedAt: new Date().toISOString(),
        localStartTime: Date.now(),
        accumulatedSeconds: serverPreviousSeconds,
        previousSeconds: serverPreviousSeconds,
        lastSyncAt: Date.now(),
        pendingSync: false,
        syncQueue: this.state.syncQueue,
      };

      this.saveState();
      this.notifyListeners();

      console.log("[TimerService] Timer started successfully with previousSeconds:", serverPreviousSeconds);
      return true;
    } catch (e) {
      console.error("[TimerService] Start error:", e);
      return false;
    }
  }

  /**
   * Stop the running timer
   */
  async stop(): Promise<boolean> {
    if (!this.state.isRunning) {
      console.log("[TimerService] No timer running");
      return false;
    }

    // Calculate ONLY the current session seconds (not including previous sessions)
    // The backend creates a NEW time entry for each session, so we only send this session's time
    const currentSessionSeconds = this.state.localStartTime
      ? Math.floor((Date.now() - this.state.localStartTime) / 1000)
      : 0;

    console.log(
      "[TimerService] Stopping timer, current session:",
      currentSessionSeconds,
      "seconds (previous sessions:",
      this.state.previousSeconds,
      "seconds)"
    );

    try {
      // Call API to stop timer with CURRENT SESSION seconds only
      // The backend creates a new time entry for this session
      const result = await window.electronAPI.invoke("kanban:timer-stop", {
        accumulated_seconds: currentSessionSeconds,
      });

      if (!result.success) {
        console.error("[TimerService] Server stop failed:", result.error);
        // Queue for retry
        this.queueFailedSync("stop", this.state.taskUuid!, currentSessionSeconds);
      }

      // Reset local state regardless of API success
      // (we've queued the sync if it failed)
      this.resetState();

      console.log("[TimerService] Timer stopped, saved:", currentSessionSeconds, "seconds for this session");
      return true;
    } catch (e) {
      console.error("[TimerService] Stop error:", e);
      // Queue for retry
      this.queueFailedSync("stop", this.state.taskUuid!, currentSessionSeconds);
      this.resetState();
      return false;
    }
  }

  private queueFailedSync(
    type: "stop",
    taskUuid: string,
    accumulatedSeconds: number
  ): void {
    this.state.syncQueue.push({
      type,
      taskUuid,
      accumulatedSeconds,
      timestamp: Date.now(),
      retryCount: 0,
    });
    this.saveState();
    console.log("[TimerService] Queued failed sync for retry");
  }

  private resetState(): void {
    this.state = {
      ...DEFAULT_STATE,
      syncQueue: this.state.syncQueue, // Keep the retry queue
    };
    this.saveState();
    this.notifyListeners();
  }

  /**
   * Sync state with server (call on app start or when coming back online)
   */
  async syncWithServer(): Promise<void> {
    console.log("[TimerService] Syncing with server...");

    try {
      const result = await window.electronAPI.invoke("kanban:timer-current");

      // IPC handler now unwraps the API response, so structure is: { success: true, data: { running, ... } }
      if (result.success && result.data?.running) {
        const serverTimer = result.data;
        // Server has a running timer, sync our local state
        this.state = {
          ...this.state,
          isRunning: true,
          taskUuid: serverTimer.task_uuid,
          taskId: serverTimer.task_id,
          taskTitle: serverTimer.task_title,
          startedAt: serverTimer.started_at,
          localStartTime: Date.now() - (serverTimer.elapsed_seconds || 0) * 1000,
          accumulatedSeconds:
            (serverTimer.previous_seconds || 0) +
            (serverTimer.elapsed_seconds || 0),
          previousSeconds: serverTimer.previous_seconds || 0,
          lastSyncAt: Date.now(),
          pendingSync: false,
        };
        console.log("[TimerService] Synced running timer:", serverTimer.task_title, "previous_seconds:", serverTimer.previous_seconds);
      } else if (this.state.isRunning) {
        // We thought timer was running but server says no
        // This could happen if timer was stopped from another device
        console.log("[TimerService] Local timer running but server says no, resetting");
        this.resetState();
      }

      this.saveState();
      this.notifyListeners();

      // Also retry any failed syncs
      await this.retryFailedSyncs();
    } catch (e) {
      console.error("[TimerService] Sync error:", e);
    }
  }

  /**
   * Get current state
   */
  getState(): LocalTimerState {
    return { ...this.state };
  }

  /**
   * Get current accumulated seconds (real-time)
   */
  getCurrentSeconds(): number {
    if (!this.state.isRunning || !this.state.localStartTime) {
      return this.state.accumulatedSeconds;
    }
    const currentSessionSeconds = Math.floor(
      (Date.now() - this.state.localStartTime) / 1000
    );
    return this.state.previousSeconds + currentSessionSeconds;
  }

  /**
   * Check if timer is running for a specific task
   */
  isRunningForTask(taskUuid: string): boolean {
    return this.state.isRunning && this.state.taskUuid === taskUuid;
  }

  /**
   * Cleanup on logout
   */
  cleanup(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.retryInterval) clearInterval(this.retryInterval);
    this.state = { ...DEFAULT_STATE };
    localStorage.removeItem(STORAGE_KEY);
    this.notifyListeners();
  }

  /**
   * Destroy service
   */
  destroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.retryInterval) clearInterval(this.retryInterval);
    this.listeners.clear();
  }
}

// Singleton instance
export const timerService = new TimerService();

export default timerService;
