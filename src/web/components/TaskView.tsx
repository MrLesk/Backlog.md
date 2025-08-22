import React from 'react';
import { type Task } from '../../types';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from '../contexts/ThemeContext';

interface TaskViewProps {
  task: Task;
  onEdit: (task: Task) => void;
  onClose: () => void;
}

const TaskView: React.FC<TaskViewProps> = ({ task, onEdit, onClose }) => {
  const { theme } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
          Title *
        </label>
        <input
          id="task-title"
          type="text"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
          value={task.title}
          readOnly
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
          Content
        </label>
        <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-700">
          <div className="p-4 prose prose-sm max-w-none dark:prose-invert" data-color-mode={theme}>
            <MDEditor.Markdown source={task.body || '*No content provided*'} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
            Status
          </label>
          <input
            id="task-status"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
            value={task.status}
            readOnly
          />
        </div>

        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
            Priority
          </label>
          <input
            id="task-priority"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
            value={task.priority || 'No Priority'}
            readOnly
          />
        </div>
      </div>

      {/* Assignee */}
      {task.assignee.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
            Assignee(s)
          </label>
          <div className="flex flex-wrap gap-2">
            {task.assignee.map((assignee, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
              >
                {assignee.startsWith('@') ? assignee : `@${assignee}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Labels */}
      {task.labels.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
            Labels
          </label>
          <div className="flex flex-wrap gap-2">
            {task.labels.map((label, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {task.dependencies.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
            Dependencies
          </label>
          <div className="flex flex-wrap gap-2">
            {task.dependencies.map((dependency, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
              >
                {dependency}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Parent Task */}
      {task.parentTaskId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
            Parent Task
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
            value={task.parentTaskId}
            readOnly
          />
        </div>
      )}

      {/* Subtasks */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
            Subtasks
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
            value={`${task.subtasks.length} subtask${task.subtasks.length > 1 ? 's' : ''}`}
            readOnly
          />
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
            Created
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
            value={new Date(task.createdDate).toLocaleString()}
            readOnly
          />
        </div>
        {task.updatedDate && task.updatedDate !== task.createdDate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">
              Updated
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
              value={new Date(task.updatedDate).toLocaleString()}
              readOnly
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-600 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-400 dark:focus:ring-gray-500 dark:focus:ring-offset-gray-800 transition-colors duration-200 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-400 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200 cursor-pointer"
          >
            Edit Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskView;
