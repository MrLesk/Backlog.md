import React from 'react';
import { type Task } from '../../types';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onEdit: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit }) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const getPriorityClass = (priority?: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-red-500 dark:border-l-red-400';
      case 'medium': return 'border-l-4 border-l-yellow-500 dark:border-l-yellow-400';
      case 'low': return 'border-l-4 border-l-green-500 dark:border-l-green-400';
      default: return 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div
      className={`bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-3 mb-2 cursor-pointer transition-all duration-200 hover:shadow-md dark:hover:shadow-lg hover:border-stone-500 dark:hover:border-stone-400 ${getPriorityClass(task.priority)} ${
        isDragging ? 'opacity-50 transform rotate-2 scale-105' : ''
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onEdit(task)}
    >
      <div className="mb-2">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 transition-colors duration-200">
          {task.title}
        </h4>
        <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">{task.id}</span>
      </div>
      
      {task.body && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3 transition-colors duration-200">
          {task.body}
        </p>
      )}
      
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map(label => (
            <span
              key={label}
              className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors duration-200"
            >
              {label}
            </span>
          ))}
        </div>
      )}
      
      {task.assignee.length > 0 && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">Assignee:</span>
          <span className="text-xs text-gray-700 dark:text-gray-300 transition-colors duration-200">
            {task.assignee.join(', ')}
          </span>
        </div>
      )}
      
      {task.dependencies.length > 0 && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">Depends on:</span>
          <span className="text-xs text-gray-700 dark:text-gray-300 transition-colors duration-200">
            {task.dependencies.join(', ')}
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2 border-t border-gray-100 dark:border-gray-600 transition-colors duration-200">
        <span>Created: {formatDate(task.createdDate)}</span>
        {task.priority && (
          <span className={`font-medium transition-colors duration-200 ${
            task.priority === 'high' ? 'text-red-600 dark:text-red-400' :
            task.priority === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
            'text-green-600 dark:text-green-400'
          }`}>
            {task.priority}
          </span>
        )}
      </div>
    </div>
  );
};

export default TaskCard;