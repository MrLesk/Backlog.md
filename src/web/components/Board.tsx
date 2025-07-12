import React, { useEffect, useState } from 'react';
import { type Task } from '../../types';
import { apiClient } from '../lib/api';
import TaskCard from './TaskCard';
import TaskColumn from './TaskColumn';

interface BoardProps {
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
  highlightTaskId?: string | null;
  tasks: Task[];
}

const Board: React.FC<BoardProps> = ({ onEditTask, onNewTask, highlightTaskId, tasks }) => {
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
      // Note: Task updates will be reflected when the parent component refreshes data
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    handleTaskUpdate(taskId, { status: newStatus });
  };

  const getTasksByStatus = (status: string): Task[] => {
    const filteredTasks = tasks.filter(task => task.status === status);
    
    // Sort tasks based on status
    return filteredTasks.sort((a, b) => {
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
        <div className="text-lg text-gray-600">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-red-600">Error: {error}</div>
        <button 
          onClick={loadStatuses}
          className="ml-4 inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const getGridStyle = () => {
    const columnCount = statuses.length;
    
    // For mobile screens, always use single column
    if (isMobile) {
      return { gridTemplateColumns: '1fr' };
    }
    
    // For larger screens, adapt based on number of statuses
    if (columnCount <= 1) {
      return { gridTemplateColumns: '1fr' };
    } else if (columnCount === 2) {
      return { gridTemplateColumns: 'repeat(2, minmax(20rem, 1fr))' };
    } else if (columnCount === 3) {
      return { gridTemplateColumns: 'repeat(3, minmax(22rem, 1fr))' };
    } else {
      // For 4+ columns, use all available with minimum width
      return { gridTemplateColumns: `repeat(${columnCount}, minmax(20rem, 1fr))` };
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Kanban Board</h2>
        <button 
          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-colors cursor-pointer" 
          onClick={onNewTask}
        >
          + New Task
        </button>
      </div>
      <div className={statuses.length > 3 ? 'overflow-x-auto pb-4' : ''}>
        <div 
          className="grid gap-6 min-w-fit"
          style={getGridStyle()}
        >
          {statuses.map(status => (
            <TaskColumn
              key={status}
              title={status}
              tasks={getTasksByStatus(status)}
              onTaskUpdate={handleTaskUpdate}
              onStatusChange={handleStatusChange}
              onEditTask={onEditTask}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Board;