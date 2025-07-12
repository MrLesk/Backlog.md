import React, { useState, useEffect } from 'react';
import { type Task } from '../../types';
import ChipInput from './ChipInput';
import DependencyInput from './DependencyInput';
import { apiClient } from '../lib/api';
// MDEditor will be passed as prop

interface TaskFormProps {
  task?: Task;
  onSubmit: (taskData: Partial<Task>) => void;
  onCancel: () => void;
  onArchive?: () => void;
  availableStatuses: string[];
  MDEditor: React.ComponentType<any>;
}

const TaskForm: React.FC<TaskFormProps> = ({ 
  task, 
  onSubmit, 
  onCancel, 
  onArchive,
  availableStatuses,
  MDEditor
}) => {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    body: task?.body || '',
    status: task?.status || availableStatuses[0] || '',
    assignee: task?.assignee || [],
    labels: task?.labels || [],
    dependencies: task?.dependencies || [],
    priority: task?.priority || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Load available tasks for dependency selection
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const tasks = await apiClient.fetchTasks();
        setAvailableTasks(tasks);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    };
    loadTasks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const taskData: Partial<Task> = {
        title: formData.title.trim(),
        body: formData.body.trim(),
        status: formData.status,
        assignee: formData.assignee,
        labels: formData.labels,
        dependencies: formData.dependencies,
        priority: formData.priority as 'high' | 'medium' | 'low' | undefined,
      };

      // Remove empty priority
      if (!taskData.priority) {
        delete taskData.priority;
      }

      await onSubmit(taskData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArchiveClick = () => {
    setShowArchiveConfirm(true);
  };

  const handleArchiveConfirm = () => {
    if (onArchive) {
      onArchive();
    }
    setShowArchiveConfirm(false);
  };

  const handleArchiveCancel = () => {
    setShowArchiveConfirm(false);
  };

  const isValid = formData.title.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-1">
          Title *
        </label>
        <input
          id="task-title"
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Enter task title"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <MDEditor
          value={formData.body}
          onChange={(value: string | undefined) => handleChange('body', value || '')}
          preview="edit"
          hideToolbar={false}
          data-color-mode="light"
          height={200}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="task-status"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            {availableStatuses.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            id="task-priority"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={formData.priority}
            onChange={(e) => handleChange('priority', e.target.value)}
          >
            <option value="">No Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <ChipInput
        name="assignee"
        label="Assignee(s)"
        value={formData.assignee}
        onChange={(value) => handleChange('assignee', value)}
        placeholder="Type name and press Enter or comma"
      />

      <ChipInput
        name="labels"
        label="Labels"
        value={formData.labels}
        onChange={(value) => handleChange('labels', value)}
        placeholder="Type label and press Enter or comma"
      />

      <DependencyInput
        value={formData.dependencies}
        onChange={(value) => handleChange('dependencies', value)}
        availableTasks={availableTasks}
        currentTaskId={task?.id}
      />

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div>
          {/* Archive button - only show when editing existing task */}
          {task && onArchive && (
            <button
              type="button"
              onClick={handleArchiveClick}
              className="inline-flex items-center px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={isSubmitting}
            >
              Archive Task
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </div>

      {/* Archive Confirmation Dialog */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Archive Task
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to archive "{task?.title}"? This will move the task to the archive folder.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleArchiveCancel}
                className="inline-flex items-center px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                className="inline-flex items-center px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 transition-colors cursor-pointer"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default TaskForm;