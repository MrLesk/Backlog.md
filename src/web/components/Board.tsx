import React, { useEffect, useState } from 'react';
import { type Task } from '../../types';
import { apiClient } from '../lib/api';
import TaskColumn from './TaskColumn';

interface BoardProps {
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
  highlightTaskId?: string | null;
  tasks: Task[];
  onRefreshData?: () => Promise<void>;
}

const Board: React.FC<BoardProps> = ({ onEditTask, onNewTask, highlightTaskId, tasks, onRefreshData }) => {
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    loadStatuses();
    
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const loadStatuses = async () => {
    try {
      setLoading(true);
      const statusesData = await apiClient.fetchStatuses();
      setStatuses(statusesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await apiClient.updateTask(taskId, updates);
      // Refresh data to reflect the changes
      if (onRefreshData) {
        await onRefreshData();
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    handleTaskUpdate(taskId, { status: newStatus });
  };

  const handleTaskReorder = async (taskId: string, newOrdinal: number, columnTasks: Task[]) => {
    try {
      await apiClient.reorderTask(taskId, newOrdinal, columnTasks);
      // Refresh data to reflect the changes
      if (onRefreshData) {
        await onRefreshData();
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder task');
    }
  };

  const getTasksByStatus = (status: string): Task[] => {
    const filteredTasks = tasks.filter(task => task.status === status);
    
    // Sort tasks based on ordinal first, then by priority/date
    return filteredTasks.sort((a, b) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg text-gray-600 dark:text-gray-300 transition-colors duration-200">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-red-600 dark:text-red-400 transition-colors duration-200">Error: {error}</div>
        <button 
          onClick={loadStatuses}
          className="ml-4 inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const getGridClasses = () => {
    const columnCount = statuses.length;
    // For 1–3 columns keep responsive fixed columns to avoid oversized min widths
    if (isMobile || columnCount <= 1) return 'grid grid-cols-1 gap-6';
    if (columnCount === 2) return 'grid grid-cols-2 gap-6';
    if (columnCount === 3) return 'grid grid-cols-3 gap-6';
    // For 4+ columns, prefer flow-by-column with fixed min column width to stabilize scrolling
    // Using Tailwind arbitrary values for auto-cols: minmax(20rem,1fr)
    // This avoids min-w-fit jitter seen on Safari/Chrome during horizontal scroll with dynamic counts
    return 'grid grid-flow-col auto-cols-[minmax(20rem,1fr)] gap-6';
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-200">Kanban Board</h2>
        <button 
          className="inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200 cursor-pointer" 
          onClick={onNewTask}
        >
          + New Task
        </button>
      </div>
      <div className={statuses.length > 3 ? 'overflow-x-auto pb-4' : ''}>
        <div className={`${getGridClasses()} ${statuses.length > 3 ? 'min-w-max' : ''}`}>
          {statuses.map(status => (
            <TaskColumn
              key={status}
              title={status}
              tasks={getTasksByStatus(status)}
              onTaskUpdate={handleTaskUpdate}
              onStatusChange={handleStatusChange}
              onEditTask={onEditTask}
              onTaskReorder={handleTaskReorder}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Board;
