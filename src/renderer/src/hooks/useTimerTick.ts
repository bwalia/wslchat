import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook that calculates elapsed time from a start timestamp
 * Updates every second when a timer is running
 * Supports accumulated time from previous sessions (like Upwork tracker)
 *
 * @param startedAt - ISO timestamp string when timer started (should be UTC with 'Z' suffix), or null if not running
 * @param initialElapsedSeconds - Optional server-provided current session elapsed seconds for initial sync
 * @param previousSeconds - Optional accumulated time from previous sessions (in seconds)
 * @returns Object with elapsed seconds, total seconds (including previous), and formatted time strings
 */
export const useTimerTick = (
  startedAt: string | null,
  initialElapsedSeconds?: number,
  previousSeconds: number = 0
) => {
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Calculate elapsed time in seconds for current session
  const calculateSessionElapsed = useCallback(() => {
    if (!startedAt) return 0;

    // If we have a start time reference (synced with server), use it
    if (startTimeRef.current !== null) {
      return Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
    }

    // Parse the timestamp - should be ISO format with Z suffix (UTC)
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - start) / 1000));
  }, [startedAt]);

  useEffect(() => {
    if (!startedAt) {
      setSessionElapsed(0);
      startTimeRef.current = null;
      return;
    }

    // If server provides elapsed seconds, use that to sync our local clock
    // This helps avoid timezone issues
    if (initialElapsedSeconds !== undefined && initialElapsedSeconds >= 0) {
      // Calculate what the start time should be based on server's elapsed seconds
      startTimeRef.current = Date.now() - initialElapsedSeconds * 1000;
      setSessionElapsed(initialElapsedSeconds);
    } else {
      // Fall back to parsing the timestamp
      startTimeRef.current = null;
      setSessionElapsed(calculateSessionElapsed());
    }

    // Update every second
    const interval = setInterval(() => {
      setSessionElapsed(calculateSessionElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, initialElapsedSeconds, calculateSessionElapsed]);

  // Total elapsed = previous sessions + current session
  const totalElapsed = previousSeconds + sessionElapsed;

  // Format elapsed time as HH:MM:SS or MM:SS
  const formatElapsed = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    // Current session elapsed
    sessionElapsed,
    sessionFormattedTime: formatElapsed(sessionElapsed),
    // Total elapsed (previous + current session) - this is what we display
    elapsed: totalElapsed,
    formattedTime: formatElapsed(totalElapsed),
    hours: Math.floor(totalElapsed / 3600),
    minutes: Math.floor((totalElapsed % 3600) / 60),
    seconds: totalElapsed % 60,
    // Previous sessions total
    previousSeconds,
  };
};

/**
 * Format minutes to human readable string
 * @param minutes - Total minutes
 * @returns Formatted string like "2h 30m" or "45m"
 */
export const formatMinutes = (minutes: number): string => {
  if (!minutes || minutes <= 0) return "0m";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
};

export default useTimerTick;
