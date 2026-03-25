import React from 'react';
import { type Task } from '../../types';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onEdit: (task: Task) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  status?: string;
  laneId?: string;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDragStart, onDragEnd, status, laneId }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [showBranchTooltip, setShowBranchTooltip] = React.useState(false);

  // Check if task is from another branch (read-only)
  const isFromOtherBranch = Boolean(task.branch);

  const handleDragStart = (e: React.DragEvent) => {
    // Prevent dragging cross-branch tasks
    if (isFromOtherBranch) {
      e.preventDefault();
      setShowBranchTooltip(true);
      setTimeout(() => setShowBranchTooltip(false), 3000);
      return;
    }

    e.dataTransfer.setData('text/plain', task.id);
    if (status) {
      e.dataTransfer.setData('text/status', status);
    }
    if (laneId !== undefined) {
      e.dataTransfer.setData('text/lane', laneId);
    }
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  const getPriorityClass = (priority?: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-red-500 dark:border-l-red-400';
      case 'medium': return 'border-l-4 border-l-yellow-500 dark:border-l-yellow-400';
      case 'low': return 'border-l-4 border-l-green-500 dark:border-l-green-400';
      default: return 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const formatRelativeDate = (dateStr: string) => {
    // Handle both date-only and datetime formats
    const hasTime = dateStr.includes(" ") || dateStr.includes("T");
    const date = new Date(dateStr.replace(" ", "T") + (hasTime ? ":00Z" : "T00:00:00Z"));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high': return { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', label: 'High' };
      case 'medium': return { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', label: 'Med' };
      case 'low': return { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: 'Low' };
      default: return null;
    }
  };

  return (
    <div className="relative">
      {/* Branch tooltip when trying to drag cross-branch task */}
      {showBranchTooltip && isFromOtherBranch && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md shadow-lg whitespace-nowrap">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Switch to <span className="font-semibold text-amber-300">{task.branch}</span> branch to move this task
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900 dark:bg-gray-700"></div>
        </div>
      )}

      <div
        className={`bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-3 mb-2 transition-all duration-200 ${
          isFromOtherBranch 
            ? 'opacity-75 cursor-not-allowed border-dashed' 
            : 'cursor-pointer hover:shadow-md dark:hover:shadow-lg hover:border-stone-500 dark:hover:border-stone-400'
        } ${getPriorityClass(task.priority)} ${
          isDragging ? 'opacity-50 transform rotate-2 scale-105' : ''
        }`}
        draggable={!isFromOtherBranch}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => onEdit(task)}
      >
        {/* Cross-branch indicator banner */}
        {isFromOtherBranch && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 -mx-1 -mt-1 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 rounded-t text-xs text-amber-700 dark:text-amber-300">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="truncate">
              From <span className="font-semibold">{task.branch}</span> branch
            </span>
          </div>
        )}

        {/* Header row with priority badge and task ID */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono transition-colors duration-200">{task.id}</span>
          {(() => {
            const badge = getPriorityBadge(task.priority);
            return badge ? (
              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${badge.bg} ${badge.text} transition-colors duration-200`}>
                {badge.label}
              </span>
            ) : null;
          })()}
        </div>

        {/* Title */}
        <h4 className={`font-semibold text-sm line-clamp-2 transition-colors duration-200 ${
          isFromOtherBranch
            ? 'text-gray-600 dark:text-gray-400'
            : 'text-gray-900 dark:text-gray-100'
        }`}>
          {task.title}
        </h4>

        {/* Labels - limit to 3 */}
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.labels.slice(0, 3).map(label => (
              <span
                key={label}
                className="inline-block px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded transition-colors duration-200"
              >
                {label}
              </span>
            ))}
            {task.labels.length > 3 && (
              <span className="inline-block px-1.5 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                +{task.labels.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer with date */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-600/50 transition-colors duration-200">
          <span>{formatRelativeDate(task.createdDate)}</span>
          {task.assignee.length > 0 && (
            <span className="truncate max-w-[80px]" title={task.assignee.join(', ')}>
              {task.assignee[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
