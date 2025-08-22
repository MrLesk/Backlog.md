import React from 'react';
import { type Task } from '../../types';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  status?: string;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onView, onEdit, onDragStart, onDragEnd, status }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [hoverArea, setHoverArea] = React.useState<'left' | 'right' | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    if (status) {
      e.dataTransfer.setData('text/status', status);
    }
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 2) {
      setHoverArea('left');
    } else {
      setHoverArea('right');
    }
  };

  const handleMouseLeave = () => {
    setHoverArea(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 2) {
      onView(task);
    } else {
      onEdit(task);
    }
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
    // Handle both date-only and datetime formats
    const hasTime = dateStr.includes(" ") || dateStr.includes("T");
    const date = new Date(dateStr.replace(" ", "T") + (hasTime ? ":00Z" : "T00:00:00Z"));
    
    if (hasTime) {
      // Show date and time for datetime values
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Show only date for date-only values
      return date.toLocaleDateString();
    }
  };

  const extractDescription = (body: string): string => {
    if (!body) return '';
    
    // Extract the Description section content
    const regex = /## Description\s*\n([\s\S]*?)(?=\n## |$)/i;
    const match = body.match(regex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // If no Description header found, return the body as-is
    // but remove any headers that might be at the start
    return body.replace(/^##\s+\w+.*\n/i, '').trim();
  };

  const truncateText = (text: string, maxLength: number = 120): string => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <div
      className={`relative bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-3 mb-2 cursor-pointer transition-all duration-200 hover:shadow-md dark:hover:shadow-lg hover:border-stone-500 dark:hover:border-stone-400 ${getPriorityClass(task.priority)} ${
        isDragging ? 'opacity-50 transform rotate-2 scale-105' : ''
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* hover hint */}
      {hoverArea === 'left' && (
        <div className="absolute top-1 left-1 bg-stone-500/80 dark:bg-stone-400/80 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none z-10 text-[10px] font-medium">
          View
        </div>
      )}
      
      {hoverArea === 'right' && (
        <div className="absolute top-1 right-1 bg-stone-500/80 dark:bg-stone-400/80 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none z-10 text-[10px] font-medium">
          Edit
        </div>
      )}
      <div className="mb-2">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 transition-colors duration-200">
          {task.title}
        </h4>
        <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">{task.id}</span>
      </div>
      
      {task.body && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3 transition-colors duration-200">
          {truncateText(extractDescription(task.body))}
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