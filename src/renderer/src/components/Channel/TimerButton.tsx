import React from "react";
import clsx from "clsx";
import { useTimerTick } from "../../hooks/useTimerTick";

interface TimerButtonProps {
  taskUuid: string;
  isRunning: boolean;
  isLoading: boolean;
  onStart: (taskUuid: string) => void;
  onStop: () => void;
  startedAt?: string;
  elapsedSeconds?: number;
  size?: "default" | "large";
}

const TimerButton: React.FC<TimerButtonProps> = ({
  taskUuid,
  isRunning,
  isLoading,
  onStart,
  onStop,
  startedAt,
  elapsedSeconds,
  size = "default",
}) => {
  const { formattedTime } = useTimerTick(
    isRunning ? startedAt || null : null,
    isRunning ? elapsedSeconds : undefined
  );

  const handleClick = () => {
    if (isLoading) return;

    if (isRunning) {
      onStop();
    } else {
      onStart(taskUuid);
    }
  };

  const iconSize = size === "large" ? "w-5 h-5" : "w-4 h-4";

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={clsx(
        "timer-button",
        isRunning && "timer-button-running",
        isLoading && "timer-button-loading",
        size === "large" && "timer-button-large"
      )}
      title={isRunning ? "Stop timer" : "Start timer"}
    >
      {isLoading ? (
        // Loading spinner
        <svg
          className={clsx(iconSize, "animate-spin")}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : isRunning ? (
        // Stop icon with time
        <>
          <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
          <span className="timer-time">{formattedTime}</span>
        </>
      ) : (
        // Play icon with label for large size
        <>
          <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          {size === "large" && <span>Start Timer</span>}
        </>
      )}
    </button>
  );
};

// Timer confirmation dialog component
interface TimerConfirmationDialogProps {
  isOpen: boolean;
  currentTaskTitle: string;
  newTaskTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const TimerConfirmationDialog: React.FC<TimerConfirmationDialogProps> = ({
  isOpen,
  currentTaskTitle,
  newTaskTitle,
  onConfirm,
  onCancel,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="timer-confirmation-overlay" onClick={onCancel}>
      <div
        className="timer-confirmation-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="timer-confirmation-header">
          <svg
            className="w-6 h-6 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3>Timer Already Running</h3>
        </div>

        <div className="timer-confirmation-body">
          <p>
            You have a timer running on{" "}
            <strong className="text-primary-500">"{currentTaskTitle}"</strong>.
          </p>
          <p className="mt-2">
            Do you want to stop it and start a new timer on{" "}
            <strong className="text-primary-500">"{newTaskTitle}"</strong>?
          </p>
        </div>

        <div className="timer-confirmation-footer">
          <button
            onClick={onCancel}
            className="btn-ghost"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? "Switching..." : "Stop & Start New"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimerButton;
