import React from "react";
import clsx from "clsx";
import type { KanbanTask, TaskStatus, TaskPriority, User } from "../../types";
import { formatMinutes } from "../../hooks/useTimerTick";
import TimerButton from "./TimerButton";

interface TaskDetailModalProps {
  task: KanbanTask;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  timerTaskUuid: string | null;
  formattedTime: string;
  isTimerLoading: boolean;
  onStartTimer: (taskUuid: string) => void;
  onStopTimer: () => void;
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  backlog: { label: "Backlog", className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  todo: { label: "To Do", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  review: { label: "Review", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  done: { label: "Done", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const priorityConfig: Record<TaskPriority, { label: string; className: string; icon: string }> = {
  low: { label: "Low", className: "text-gray-500", icon: "↓" },
  medium: { label: "Medium", className: "text-blue-500", icon: "→" },
  high: { label: "High", className: "text-orange-500", icon: "↑" },
  urgent: { label: "Urgent", className: "text-red-500", icon: "⚡" },
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  currentUser,
  timerTaskUuid,
  formattedTime,
  isTimerLoading,
  onStartTimer,
  onStopTimer,
}) => {
  if (!isOpen) return null;

  const status = statusConfig[task.status] || statusConfig.backlog;
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const isTimerRunningOnThisTask = timerTaskUuid === task.uuid;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  // Check if current user is assigned to this task
  const isAssignedToCurrentUser = task.assignees?.some(
    (assignee) => assignee.user_uuid === currentUser?.uuid
  );

  // Get assignee display name
  const getAssigneeName = (assignee: { first_name?: string; last_name?: string; email?: string }) => {
    if (assignee.first_name && assignee.last_name) {
      return `${assignee.first_name} ${assignee.last_name}`;
    }
    if (assignee.first_name) {
      return assignee.first_name;
    }
    return assignee.email || "Unknown";
  };

  // Get assignee initials
  const getInitials = (assignee: { first_name?: string; last_name?: string; email?: string }) => {
    if (assignee.first_name && assignee.last_name) {
      return `${assignee.first_name[0]}${assignee.last_name[0]}`.toUpperCase();
    }
    if (assignee.first_name) {
      return assignee.first_name.slice(0, 2).toUpperCase();
    }
    if (assignee.email) {
      return assignee.email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="task-detail-overlay" onClick={handleBackdropClick}>
      <div className="task-detail-modal">
        {/* Header */}
        <div className="task-detail-header">
          <div className="task-detail-header-left">
            {task.task_number && (
              <span className="task-detail-number">#{task.task_number}</span>
            )}
            <h2 className="task-detail-title">{task.title}</h2>
          </div>
          <button className="task-detail-close" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="task-detail-content">
          {/* Status and Priority Row */}
          <div className="task-detail-row">
            <div className="task-detail-field">
              <label className="task-detail-label">Status</label>
              <span className={clsx("task-badge", status.className)}>
                {status.label}
              </span>
            </div>
            <div className="task-detail-field">
              <label className="task-detail-label">Priority</label>
              <span className={clsx("task-detail-priority", priority.className)}>
                {priority.icon} {priority.label}
              </span>
            </div>
          </div>

          {/* Due Date and Time Row */}
          <div className="task-detail-row">
            <div className="task-detail-field">
              <label className="task-detail-label">Due Date</label>
              {task.due_date ? (
                <span className={clsx("task-detail-date", isOverdue && "task-detail-date-overdue")}>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(task.due_date).toLocaleDateString()}
                  {isOverdue && <span className="ml-2 text-red-500">(Overdue)</span>}
                </span>
              ) : (
                <span className="text-secondary-400">Not set</span>
              )}
            </div>
            <div className="task-detail-field">
              <label className="task-detail-label">Time Spent</label>
              <span className={clsx("task-detail-time", isTimerRunningOnThisTask && "task-detail-time-live")}>
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Show live time when timer is running on this task, otherwise show stored time */}
                {isTimerRunningOnThisTask ? formattedTime : formatMinutes(task.time_spent_minutes || 0)}
                {task.estimated_minutes && (
                  <span className="text-secondary-400 ml-1">
                    / {formatMinutes(task.estimated_minutes)}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="task-detail-section">
            <label className="task-detail-label">Description</label>
            <div className="task-detail-description">
              {task.description || <span className="text-secondary-400 italic">No description provided</span>}
            </div>
          </div>

          {/* Assignees Section */}
          <div className="task-detail-section">
            <label className="task-detail-label">Assignees</label>
            {task.assignees && task.assignees.length > 0 ? (
              <div className="task-detail-assignees">
                {task.assignees.map((assignee) => (
                  <div
                    key={assignee.user_uuid}
                    className={clsx(
                      "task-detail-assignee",
                      assignee.user_uuid === currentUser?.uuid && "task-detail-assignee-current"
                    )}
                  >
                    <div className="task-detail-assignee-avatar">
                      {getInitials(assignee)}
                    </div>
                    <div className="task-detail-assignee-info">
                      <span className="task-detail-assignee-name">
                        {getAssigneeName(assignee)}
                        {assignee.user_uuid === currentUser?.uuid && (
                          <span className="task-detail-assignee-you">(You)</span>
                        )}
                      </span>
                      {assignee.email && (
                        <span className="task-detail-assignee-email">{assignee.email}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-secondary-400 italic">No one assigned</span>
            )}
          </div>

          {/* Time Tracking Section - Only show if user is assigned */}
          {isAssignedToCurrentUser && (
            <div className="task-detail-section task-detail-timer-section">
              <label className="task-detail-label">Time Tracking</label>
              <div className="task-detail-timer">
                <p className="task-detail-timer-hint">
                  You are assigned to this task. Track your time by starting the timer below.
                </p>
                <TimerButton
                  taskUuid={task.uuid}
                  isRunning={isTimerRunningOnThisTask}
                  isLoading={isTimerLoading}
                  onStart={onStartTimer}
                  onStop={onStopTimer}
                  formattedTime={isTimerRunningOnThisTask ? formattedTime : "0:00"}
                  size="large"
                />
              </div>
            </div>
          )}

          {/* Show message if not assigned but timer is available */}
          {!isAssignedToCurrentUser && (
            <div className="task-detail-section">
              <label className="task-detail-label">Time Tracking</label>
              <div className="task-detail-not-assigned">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>You need to be assigned to this task to track time.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer with dates */}
        <div className="task-detail-footer">
          <span className="text-secondary-400 text-xs">
            Created: {new Date(task.created_at).toLocaleString()}
          </span>
          <span className="text-secondary-400 text-xs">
            Updated: {new Date(task.updated_at).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
