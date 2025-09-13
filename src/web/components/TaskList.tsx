import React, { useState, useEffect, useMemo } from 'react';
import { type Task } from '../../types';
import { apiClient } from '../lib/api';

interface TaskListProps {
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
  tasks: Task[];
}

interface Filters {
  status: string;
  priority: string;
  textSearch: string;
}

const PRIORITIES = ['high', 'medium', 'low'];

const TaskList: React.FC<TaskListProps> = ({ onEditTask, onNewTask, tasks }) => {
  const [error] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({ status: '', priority: '', textSearch: '' });
  const [showDoneTasks, setShowDoneTasks] = useState<boolean>(() => {
    // Check sessionStorage for toggle state, default to false (hide done tasks)
    const saved = sessionStorage.getItem('showDoneTasks');
    return saved ? JSON.parse(saved) : false;
  });

  // Load statuses from API
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const fetchedStatuses = await apiClient.fetchStatuses();
        setStatuses(fetchedStatuses);
      } catch (error) {
        console.error('Failed to load statuses:', error);
      }
    };
    loadStatuses();
  }, []);

  // Load filters from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters({
      status: params.get('status') || '',
      priority: params.get('priority') || '',
      textSearch: params.get('search') || ''
    });
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.textSearch) params.set('search', filters.textSearch);

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [filters]);

  // Persist showDoneTasks to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('showDoneTasks', JSON.stringify(showDoneTasks));
  }, [showDoneTasks]);

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(task =>
        task.status.toLowerCase() === filters.status.toLowerCase()
      );
    }

    // Apply priority filter
    if (filters.priority) {
      filtered = filtered.filter(task =>
        task.priority?.toLowerCase() === filters.priority.toLowerCase()
      );
    }

    // Apply text search (title and description)
    if (filters.textSearch) {
      const searchTerm = filters.textSearch.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchTerm) ||
        (task.description && task.description.toLowerCase().includes(searchTerm))
      );
    }

    // Apply done tasks toggle (Task 265)
    if (!showDoneTasks) {
      filtered = filtered.filter(task =>
        task.status.toLowerCase() !== 'done'
      );
    }

    // Sort by ID descending (newest first)
    return filtered.sort((a, b) => {
      const idA = parseInt(a.id.replace('task-', ''), 10);
      const idB = parseInt(b.id.replace('task-', ''), 10);
      return idB - idA;
    });
  }, [tasks, filters, showDoneTasks]);
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

  // Enhanced styling for in-progress tasks (Task 265)
  const getTaskCardClasses = (task: Task) => {
    const baseClasses = "bg-white dark:bg-gray-800 border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer";

    if (task.status.toLowerCase() === 'in progress') {
      return `${baseClasses} border-blue-500 dark:border-blue-400 border-2 bg-blue-50/50 dark:bg-blue-900/20`;
    }

    return `${baseClasses} border-gray-200 dark:border-gray-700`;
  };

  const clearAllFilters = () => {
    setFilters({ status: '', priority: '', textSearch: '' });
  };

  const hasActiveFilters = filters.status || filters.priority || filters.textSearch;

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
              {filteredAndSortedTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </div>
            <button 
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer" 
              onClick={onNewTask}
            >
              + New Task
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Status Filter */}
            <div className="flex-1 min-w-48">
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                id="status-filter"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex-1 min-w-48">
              <label htmlFor="priority-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                id="priority-filter"
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All priorities</option>
                {PRIORITIES.map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Text Search */}
            <div className="flex-1 min-w-64">
              <label htmlFor="text-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <input
                id="text-search"
                type="text"
                placeholder="Search by title or description..."
                value={filters.textSearch}
                onChange={(e) => setFilters({ ...filters, textSearch: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Done Tasks Toggle */}
            <div className="flex items-center">
              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showDoneTasks}
                  onChange={(e) => setShowDoneTasks(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                  aria-label="Show completed tasks"
                />
                <span>Show done tasks</span>
              </label>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Clear all filters"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tasks</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {hasActiveFilters || !showDoneTasks ? 'No tasks match the current filters.' : 'Get started by creating a new task.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedTasks.map((task) => (
              <div
                key={task.id}
                className={getTaskCardClasses(task)}
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
