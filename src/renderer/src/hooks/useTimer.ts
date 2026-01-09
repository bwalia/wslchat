/**
 * useTimer Hook - React hook for the timer service
 *
 * Provides a clean interface to the timer service with React state management
 */

import { useState, useEffect, useCallback } from "react";
import timerService, { LocalTimerState } from "../services/timerService";

interface UseTimerResult {
  // Timer state
  isRunning: boolean;
  taskUuid: string | null;
  taskTitle: string | null;
  accumulatedSeconds: number;
  previousSeconds: number;
  formattedTime: string;

  // Actions
  startTimer: (
    taskUuid: string,
    taskId: number,
    taskTitle: string,
    previousSeconds?: number
  ) => Promise<boolean>;
  stopTimer: () => Promise<boolean>;
  syncWithServer: () => Promise<void>;

  // Helpers
  isRunningForTask: (taskUuid: string) => boolean;
  hasPendingSync: boolean;
}

/**
 * Format seconds as HH:MM:SS or MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function useTimer(): UseTimerResult {
  const [state, setState] = useState<LocalTimerState>(timerService.getState());

  useEffect(() => {
    // Subscribe to timer service updates
    const unsubscribe = timerService.subscribe((newState) => {
      setState(newState);
    });

    // Sync with server on mount
    timerService.syncWithServer();

    return () => {
      unsubscribe();
    };
  }, []);

  const startTimer = useCallback(
    async (
      taskUuid: string,
      taskId: number,
      taskTitle: string,
      previousSeconds: number = 0
    ): Promise<boolean> => {
      return timerService.start(taskUuid, taskId, taskTitle, previousSeconds);
    },
    []
  );

  const stopTimer = useCallback(async (): Promise<boolean> => {
    return timerService.stop();
  }, []);

  const syncWithServer = useCallback(async (): Promise<void> => {
    return timerService.syncWithServer();
  }, []);

  const isRunningForTask = useCallback(
    (taskUuid: string): boolean => {
      return timerService.isRunningForTask(taskUuid);
    },
    []
  );

  return {
    isRunning: state.isRunning,
    taskUuid: state.taskUuid,
    taskTitle: state.taskTitle,
    accumulatedSeconds: state.accumulatedSeconds,
    previousSeconds: state.previousSeconds,
    formattedTime: formatTime(state.accumulatedSeconds),
    startTimer,
    stopTimer,
    syncWithServer,
    isRunningForTask,
    hasPendingSync: state.pendingSync || state.syncQueue.length > 0,
  };
}

export default useTimer;
