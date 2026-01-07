import React from "react";
import clsx from "clsx";
import type { KanbanTask, TaskStatus, TaskPriority, RunningTimer } from "../../types";
import { formatMinutes } from "../../hooks/useTimerTick";
import TimerButton from "./TimerButton";

interface TaskItemProps {
  task: KanbanTask;
  runningTimer: RunningTimer | null;
  isTimerLoading: boolean;
  onStartTimer: (taskUuid: string) => void;
  onStopTimer: () => void;
  onClick: (task: KanbanTask) => void;
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

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  runningTimer,
  isTimerLoading,
  onStartTimer,
  onStopTimer,
  onClick,
}) => {
  const status = statusConfig[task.status] || statusConfig.backlog;
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const isTimerRunningOnThisTask = runningTimer?.task_uuid === task.uuid;

  // Check if task is overdue
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

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

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click when clicking on timer button
    if ((e.target as HTMLElement).closest('.timer-button')) {
      return;
    }
    onClick(task);
  };

  return (
    <div className="task-item task-item-clickable" onClick={handleClick}>
      {/* Left section: Task info */}
      <div className="task-item-content">
        {/* Task number and title */}
        <div className="task-item-header">
          {task.task_number && (
            <span className="task-item-number">#{task.task_number}</span>
          )}
          <h3 className="task-item-title">{task.title}</h3>
        </div>

        {/* Badges row */}
        <div className="task-item-badges">
          {/* Status badge */}
          <span className={clsx("task-badge", status.className)}>
            {status.label}
          </span>

          {/* Priority badge */}
          <span className={clsx("task-badge-priority", priority.className)} title={priority.label}>
            {priority.icon}
          </span>

          {/* Due date */}
          {task.due_date && (
            <span
              className={clsx(
                "task-badge-date",
                isOverdue && "task-badge-overdue"
              )}
              title={isOverdue ? "Overdue" : "Due date"}
            >
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}

          {/* Time spent */}
          {task.time_spent_minutes !== undefined && task.time_spent_minutes > 0 && (
            <span className="task-badge-time" title="Time spent">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatMinutes(task.time_spent_minutes)}
            </span>
          )}
        </div>
      </div>

      {/* Right section: Assignees and Timer */}
      <div className="task-item-actions">
        {/* Assignees */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="task-item-assignees">
            {task.assignees.slice(0, 3).map((assignee, index) => (
              <div
                key={assignee.user_uuid}
                className="task-assignee-avatar"
                style={{ zIndex: 10 - index }}
                title={`${assignee.first_name || ""} ${assignee.last_name || ""}`.trim() || assignee.email}
              >
                {getInitials(assignee)}
              </div>
            ))}
            {task.assignees.length > 3 && (
              <div className="task-assignee-avatar task-assignee-more">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        )}

        {/* Timer button */}
        <TimerButton
          taskUuid={task.uuid}
          isRunning={isTimerRunningOnThisTask}
          isLoading={isTimerLoading}
          onStart={onStartTimer}
          onStop={onStopTimer}
          startedAt={isTimerRunningOnThisTask ? runningTimer?.started_at : undefined}
          elapsedSeconds={isTimerRunningOnThisTask ? runningTimer?.elapsed_seconds : undefined}
        />
      </div>
    </div>
  );
};

export default TaskItem;
