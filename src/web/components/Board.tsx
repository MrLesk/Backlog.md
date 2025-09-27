import React, { useEffect, useMemo, useState } from 'react';
import { type Task } from '../../types';
import { apiClient, type ReorderTaskPayload } from '../lib/api';
import TaskColumn from './TaskColumn';
import CleanupModal from './CleanupModal';
import { SuccessToast } from './SuccessToast';

interface BoardProps {
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
  highlightTaskId?: string | null;
  tasks: Task[];
  onRefreshData?: () => Promise<void>;
  statuses: string[];
  isLoading: boolean;
}

const Board: React.FC<BoardProps> = ({
  onEditTask,
  onNewTask,
  highlightTaskId,
  tasks,
  onRefreshData,
  statuses,
  isLoading,
}) => {
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [dragSourceStatus, setDragSourceStatus] = useState<string | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState<string | null>(null);

  // Handle highlighting a task (opening its edit popup)
  useEffect(() => {
    if (highlightTaskId && tasks.length > 0) {
      const taskToHighlight = tasks.find(task => task.id === highlightTaskId);
      if (taskToHighlight) {
        // Use setTimeout to ensure the task is found and modal opens properly
        setTimeout(() => {
          onEditTask(taskToHighlight);
        }, 100);
      }
    }
  }, [highlightTaskId, tasks, onEditTask]);

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await apiClient.updateTask(taskId, updates);
      // Refresh data to reflect the changes
      if (onRefreshData) {
        await onRefreshData();
      }
      setUpdateError(null);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleTaskReorder = async (payload: ReorderTaskPayload) => {
    try {
      await apiClient.reorderTask(payload);
      // Refresh data to reflect the changes
      if (onRefreshData) {
        await onRefreshData();
      }
      setUpdateError(null);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to reorder task');
    }
  };

  const handleCleanupSuccess = async (movedCount: number) => {
    setShowCleanupModal(false);
    setCleanupSuccessMessage(`Successfully moved ${movedCount} task${movedCount !== 1 ? 's' : ''} to completed folder`);

    // Refresh data to reflect the changes
    if (onRefreshData) {
      await onRefreshData();
    }

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setCleanupSuccessMessage(null);
    }, 4000);
  };

  const tasksByStatus = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const status of statuses) {
      grouped.set(status, []);
    }

    for (const task of tasks) {
      const statusKey = task.status ?? '';
      const list = grouped.get(statusKey);
      if (list) {
        list.push(task);
      } else if (statusKey) {
        grouped.set(statusKey, [task]);
      }
    }
    return grouped;
  }, [statuses, tasks]);

  const getTasksByStatus = (status: string): Task[] => {
    const filteredTasks = tasksByStatus.get(status) ?? tasks.filter(task => task.status === status);

    // Sort tasks based on ordinal first, then by priority/date
    return filteredTasks.slice().sort((a, b) => {
      // Tasks with ordinal come before tasks without
      if (a.ordinal !== undefined && b.ordinal === undefined) {
        return -1;
      }
      if (a.ordinal === undefined && b.ordinal !== undefined) {
        return 1;
      }
      
      // Both have ordinals - sort by ordinal value
      if (a.ordinal !== undefined && b.ordinal !== undefined) {
        if (a.ordinal !== b.ordinal) {
          return a.ordinal - b.ordinal;
        }
      }
      
      // Same ordinal (or both undefined) - use existing date-based sorting
      const isDoneStatus = status.toLowerCase().includes('done') || 
                          status.toLowerCase().includes('complete');
      
      if (isDoneStatus) {
        // For "Done" tasks, sort by updatedDate (descending) - newest first
        const aDate = a.updatedDate || a.createdDate;
        const bDate = b.updatedDate || b.createdDate;
        return bDate.localeCompare(aDate);
      } else {
        // For other statuses, sort by createdDate (ascending) - oldest first
        return a.createdDate.localeCompare(b.createdDate);
      }
    });
  };

  if (isLoading && statuses.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg text-gray-600 dark:text-gray-300 transition-colors duration-200">Loading tasks...</div>
      </div>
    );
  }

  // Dynamic layout using flexbox:
  // - Columns are flex items with equal growth (flex-1) to divide space evenly
  // - A minimum width keeps columns readable; beyond available space, container scrolls horizontally
  // - Works uniformly for any number of columns without per-count conditionals

  return (
    <div className="w-full">
      {updateError && (
        <div className="mb-4 rounded-md bg-red-100 px-4 py-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200 transition-colors duration-200">
          {updateError}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-200">Kanban Board</h2>
        <button 
          className="inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200 cursor-pointer" 
          onClick={onNewTask}
        >
          + New Task
        </button>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex flex-row flex-nowrap gap-4 w-full">
          {statuses.map((status) => (
            <div key={status} className="flex-1 min-w-[16rem]">
              <TaskColumn
                title={status}
                tasks={getTasksByStatus(status)}
                onTaskUpdate={handleTaskUpdate}
                onEditTask={onEditTask}
                onTaskReorder={handleTaskReorder}
                dragSourceStatus={dragSourceStatus}
                onDragStart={() => setDragSourceStatus(status)}
                onDragEnd={() => setDragSourceStatus(null)}
                onCleanup={status.toLowerCase() === 'done' ? () => setShowCleanupModal(true) : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Cleanup Modal */}
      <CleanupModal
        isOpen={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
        onSuccess={handleCleanupSuccess}
      />

      {/* Cleanup Success Toast */}
      {cleanupSuccessMessage && (
        <SuccessToast
          message={cleanupSuccessMessage}
          onDismiss={() => setCleanupSuccessMessage(null)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      )}
    </div>
  );
};

export default Board;
