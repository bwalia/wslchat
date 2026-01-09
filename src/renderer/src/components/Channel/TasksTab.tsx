import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import {
  fetchProjectByChannel,
  fetchTasksByBoard,
} from "../../store/slices/kanbanSlice";
import {
  openTimerConfirmation,
  closeTimerConfirmation,
} from "../../store/slices/uiSlice";
import TaskItem from "./TaskItem";
import TaskDetailModal from "./TaskDetailModal";
import { TimerConfirmationDialog } from "./TimerButton";
import { useTimer } from "../../hooks/useTimer";
import type { KanbanTask } from "../../types";

interface TasksTabProps {
  channelUuid: string;
}

const TasksTab: React.FC<TasksTabProps> = ({ channelUuid }) => {
  const dispatch = useAppDispatch();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [isTimerLoading, setIsTimerLoading] = useState(false);

  // Timer service hook
  const {
    isRunning: timerIsRunning,
    taskUuid: timerTaskUuid,
    taskTitle: timerTaskTitle,
    formattedTime,
    startTimer,
    stopTimer,
    previousSeconds,
  } = useTimer();

  // Redux state
  const { projectByChannel, tasksByBoard, isLoadingTasks, isLoadingProject } =
    useAppSelector((state) => state.kanban);
  const { timerConfirmationOpen, pendingTimerTaskUuid } = useAppSelector(
    (state) => state.ui
  );
  const { user: currentUser } = useAppSelector((state) => state.auth);

  // Get project for this channel
  const project = projectByChannel[channelUuid];

  // Get the default board (first board or the one marked as default)
  const defaultBoard = useMemo(() => {
    if (!project?.boards || project.boards.length === 0) {
      return null;
    }
    // Try to find the default board, otherwise use the first one
    return project.boards.find(b => b.is_default) || project.boards[0];
  }, [project?.boards]);

  // Get tasks for the current board
  const tasks = defaultBoard ? tasksByBoard[defaultBoard.uuid] || [] : [];

  // Fetch project when channel changes
  useEffect(() => {
    if (channelUuid) {
      dispatch(fetchProjectByChannel(channelUuid));
    }
  }, [dispatch, channelUuid]);

  // Fetch tasks when board is available
  useEffect(() => {
    if (defaultBoard?.uuid) {
      dispatch(fetchTasksByBoard({ boardUuid: defaultBoard.uuid }));
    }
  }, [dispatch, defaultBoard?.uuid]);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Status filter
    if (statusFilter !== "all" && task.status !== statusFilter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.task_number?.toString().includes(query)
      );
    }
    return true;
  });

  // Handle start timer
  const handleStartTimer = useCallback(
    async (taskUuid: string) => {
      // Check if there's already a running timer on a different task
      if (timerIsRunning && timerTaskUuid !== taskUuid) {
        // Show confirmation dialog
        dispatch(openTimerConfirmation(taskUuid));
      } else {
        // Start timer directly
        setIsTimerLoading(true);
        const task = tasks.find(t => t.uuid === taskUuid);
        // Get previous seconds from the task's time_spent_minutes (converted to seconds)
        const prevSeconds = ((task?.time_spent_minutes || 0) * 60);
        await startTimer(taskUuid, task?.id || 0, task?.title || "", prevSeconds);
        setIsTimerLoading(false);
      }
    },
    [timerIsRunning, timerTaskUuid, tasks, startTimer, dispatch]
  );

  // Handle stop timer
  const handleStopTimer = useCallback(async () => {
    setIsTimerLoading(true);
    await stopTimer();
    setIsTimerLoading(false);
    // Refresh tasks to get updated time_spent_minutes
    if (defaultBoard?.uuid) {
      dispatch(fetchTasksByBoard({ boardUuid: defaultBoard.uuid }));
    }
  }, [stopTimer, dispatch, defaultBoard?.uuid]);

  // Handle timer switch confirmation
  const handleTimerSwitchConfirm = useCallback(async () => {
    if (pendingTimerTaskUuid) {
      setIsTimerLoading(true);
      // Stop current timer
      await stopTimer();
      // Start new timer
      const task = tasks.find(t => t.uuid === pendingTimerTaskUuid);
      const prevSeconds = ((task?.time_spent_minutes || 0) * 60);
      await startTimer(pendingTimerTaskUuid, task?.id || 0, task?.title || "", prevSeconds);
      setIsTimerLoading(false);
      dispatch(closeTimerConfirmation());
    }
  }, [pendingTimerTaskUuid, tasks, stopTimer, startTimer, dispatch]);

  // Handle timer switch cancel
  const handleTimerSwitchCancel = useCallback(() => {
    dispatch(closeTimerConfirmation());
  }, [dispatch]);

  // Handle task click - open detail modal
  const handleTaskClick = useCallback((task: KanbanTask) => {
    setSelectedTask(task);
  }, []);

  // Handle close task detail modal
  const handleCloseTaskDetail = useCallback(() => {
    setSelectedTask(null);
  }, []);

  // Get task title for pending timer
  const pendingTask = tasks.find((t) => t.uuid === pendingTimerTaskUuid);

  // Loading state
  if (isLoadingProject) {
    return (
      <div className="tasks-tab-loading">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        <span className="mt-2 text-secondary-500">Loading project...</span>
      </div>
    );
  }

  // No project linked
  if (project === null) {
    return (
      <div className="tasks-tab-empty">
        <svg
          className="w-16 h-16 text-secondary-300 dark:text-secondary-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-secondary-700 dark:text-secondary-300">
          No Project Linked
        </h3>
        <p className="mt-2 text-secondary-500">
          This channel is not linked to any project.
        </p>
      </div>
    );
  }

  // Project exists but no boards
  if (!defaultBoard) {
    return (
      <div className="tasks-tab-empty">
        <svg
          className="w-16 h-16 text-secondary-300 dark:text-secondary-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-secondary-700 dark:text-secondary-300">
          No Board Available
        </h3>
        <p className="mt-2 text-secondary-500">
          Project "{project.name}" has no boards yet. Create a board to add tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="tasks-tab">
      {/* Header */}
      <div className="tasks-tab-header">
        <div className="tasks-tab-title">
          <h2>{project.name}</h2>
          <span className="tasks-tab-count">{tasks.length} tasks</span>
        </div>

        {/* Running timer indicator */}
        {timerIsRunning && (
          <div className="tasks-tab-running-timer">
            <span className="animate-pulse w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-secondary-600 dark:text-secondary-400">
              Timer running on: <strong>{timerTaskTitle}</strong>
            </span>
            <span className="text-sm font-mono text-primary-600 dark:text-primary-400 ml-2">
              {formattedTime}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="tasks-tab-filters">
        {/* Search */}
        <div className="tasks-search">
          <svg
            className="w-4 h-4 text-secondary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tasks-search-input"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="tasks-filter-select"
        >
          <option value="all">All Status</option>
          <option value="backlog">Backlog</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
      </div>

      {/* Task list */}
      <div className="tasks-tab-list">
        {isLoadingTasks ? (
          <div className="tasks-tab-loading">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            <span className="mt-2 text-secondary-500">Loading tasks...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="tasks-tab-empty-list">
            <p className="text-secondary-500">
              {searchQuery || statusFilter !== "all"
                ? "No tasks match your filters"
                : "No tasks in this project"}
            </p>
          </div>
        ) : (
          filteredTasks.map((task: KanbanTask) => (
            <TaskItem
              key={task.uuid}
              task={task}
              timerTaskUuid={timerTaskUuid}
              formattedTime={formattedTime}
              isTimerLoading={isTimerLoading}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              onClick={handleTaskClick}
            />
          ))
        )}
      </div>

      {/* Timer confirmation dialog */}
      <TimerConfirmationDialog
        isOpen={timerConfirmationOpen}
        currentTaskTitle={timerTaskTitle || ""}
        newTaskTitle={pendingTask?.title || ""}
        onConfirm={handleTimerSwitchConfirm}
        onCancel={handleTimerSwitchCancel}
        isLoading={isTimerLoading}
      />

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={handleCloseTaskDetail}
          currentUser={currentUser}
          timerTaskUuid={timerTaskUuid}
          formattedTime={formattedTime}
          isTimerLoading={isTimerLoading}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
        />
      )}
    </div>
  );
};

export default TasksTab;
