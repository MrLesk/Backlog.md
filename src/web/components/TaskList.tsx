import React, { useState } from 'react';
import { apiClient } from '../lib/api';
import { type Task } from '../../types';

interface TaskListProps {
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
  tasks: Task[];
}

const TaskList: React.FC<TaskListProps> = ({ onEditTask, onNewTask, tasks }) => {
  const [error, setError] = useState<string | null>(null);

  // Sort tasks by ID descending (newest first)
  const sortedTasks = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Extract numeric part from task IDs (task-1, task-2, etc.)
      const idA = parseInt(a.id.replace('task-', ''), 10);
      const idB = parseInt(b.id.replace('task-', ''), 10);
      return idB - idA; // Highest ID first (newest)
    });
  }, [tasks]);

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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'to do':
        return 'bg-gray-100 text-gray-800';
      case 'in progress':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">All Tasks</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
            </div>
            <button 
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-colors cursor-pointer" 
              onClick={onNewTask}
            >
              + New Task
            </button>
          </div>
        </div>

        {sortedTasks.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new task.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedTasks.map((task) => (
              <div 
                key={task.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onEditTask(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      {task.priority && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                      <span>{task.id}</span>
                      <span>Created: {new Date(task.createdDate).toLocaleDateString()}</span>
                      {task.updatedDate && (
                        <span>Updated: {new Date(task.updatedDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    {task.assignee && task.assignee.length > 0 && (
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-500">Assigned to:</span>
                        <div className="flex flex-wrap gap-1">
                          {task.assignee.map((person) => (
                            <span key={person} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              {person}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {task.labels && task.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.labels.map((label) => (
                          <span key={label} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;