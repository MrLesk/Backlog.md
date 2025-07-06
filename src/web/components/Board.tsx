import React, { useEffect, useState } from 'react';
import { Task, TaskStatus } from '../types/task';
import { apiClient } from '../lib/api';
import TaskCard from './TaskCard';
import TaskColumn from './TaskColumn';

interface BoardProps {
  onEditTask: (task: Task) => void;
}

const Board: React.FC<BoardProps> = ({ onEditTask }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    loadData();
    
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tasksData, statusesData] = await Promise.all([
        apiClient.fetchTasks(),
        apiClient.fetchStatuses()
      ]);
      setTasks(tasksData);
      setStatuses(statusesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const updatedTask = await apiClient.updateTask(taskId, updates);
      setTasks(prevTasks => 
        prevTasks.map(task => task.id === taskId ? updatedTask : task)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
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
          onClick={loadData}
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