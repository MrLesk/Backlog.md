import React, { useState, useMemo } from 'react';
import { type Task } from '../../types';
import { useTaskFilters } from '../hooks/useTaskFilters';
import TaskFilters from './TaskFilters';
import { filterTasks } from '../utils/taskFiltering';
import { apiClient } from '../lib/api';

interface TaskListProps {
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
  tasks: Task[];
}

const TaskList: React.FC<TaskListProps> = ({ onEditTask, onNewTask, tasks }) => {
  const [error] = useState<string | null>(null);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  
  // Initialize filters with URL synchronization
  const {
    filters,
    setStatusFilter,
    setPriorityFilter,
    setSearchFilter,
    setAssigneeFilter,
    clearAllFilters,
    hasActiveFilters,
  } = useTaskFilters();

  // Load available statuses
  React.useEffect(() => {
    const loadStatuses = async () => {
      try {
        const statuses = await apiClient.fetchStatuses();
        setAvailableStatuses(statuses);
      } catch (error) {
        console.error('Failed to fetch statuses:', error);
      }
    };
    loadStatuses();
  }, []);

  // Apply filters and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    // First filter the tasks
    const filtered = filterTasks(tasks, filters);
    
    // Then sort by ID descending (newest first)
    return filtered.sort((a, b) => {
      // Extract numeric part from task IDs (task-1, task-2, etc.)
      const idA = parseInt(a.id.replace('task-', ''), 10);
      const idB = parseInt(b.id.replace('task-', ''), 10);
      return idB - idA; // Highest ID first (newest)
    });
  }, [tasks, filters]);
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'to do':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'in progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';
      case 'done':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 transition-colors duration-200">
      <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Tasks</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {filteredAndSortedTasks.length} task{filteredAndSortedTasks.length !== 1 ? 's' : ''}
              {hasActiveFilters && tasks.length !== filteredAndSortedTasks.length && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  (of {tasks.length} total)
                </span>
              )}
            </div>
            <button 
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer" 
              onClick={onNewTask}
            >
              + New Task
            </button>
          </div>
        </div>

        <TaskFilters
          filters={filters}
          onStatusChange={setStatusFilter}
          onPriorityChange={setPriorityFilter}
          onSearchChange={setSearchFilter}
          onAssigneeChange={setAssigneeFilter}
          onClearAll={clearAllFilters}
          availableStatuses={availableStatuses}
          hasActiveFilters={hasActiveFilters}
        />

        {filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {hasActiveFilters ? 'No matching tasks' : 'No tasks'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {hasActiveFilters 
                ? 'Try adjusting your filters or clear them to see all tasks.' 
                : 'Get started by creating a new task.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-3 inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedTasks.map((task) => (
              <div 
                key={task.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
                onClick={() => onEditTask(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{task.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-circle ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      {task.priority && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-circle ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                      <span>{task.id}</span>
                      <span>Created: {new Date(task.createdDate).toLocaleDateString()}</span>
                      {task.updatedDate && (
                        <span>Updated: {new Date(task.updatedDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    {task.assignee && task.assignee.length > 0 && (
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Assigned to:</span>
                        <div className="flex flex-wrap gap-1">
                          {task.assignee.map((person) => (
                            <span key={person} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-circle">
                              {person}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {task.labels && task.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.labels.map((label) => (
                          <span key={label} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-circle">
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
  );
};

export default TaskList;
