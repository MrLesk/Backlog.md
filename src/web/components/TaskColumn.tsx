import React from 'react';
import { type Task } from '../../types';
import type { ReorderTaskPayload } from '../lib/api';
import TaskCard from './TaskCard';

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onEditTask: (task: Task) => void;
  onTaskReorder?: (payload: ReorderTaskPayload) => void;
  dragSourceStatus?: string | null;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onCleanup?: () => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({
  title,
  tasks,
  onTaskUpdate,
  onEditTask,
  onTaskReorder,
  dragSourceStatus,
  onDragStart,
  onDragEnd,
  onCleanup
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [draggedTaskId, setDraggedTaskId] = React.useState<string | null>(null);
  const [dropPosition, setDropPosition] = React.useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const getStatusBadgeClass = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('complete')) {
      return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 transition-colors duration-200';
    }
    if (statusLower.includes('progress') || statusLower.includes('doing')) {
      return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 transition-colors duration-200';
    }
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) {
      return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 transition-colors duration-200';
    }
    return 'bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 transition-colors duration-200';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropPosition(null);
    
    const droppedTaskId = e.dataTransfer.getData('text/plain');
    const sourceStatus = e.dataTransfer.getData('text/status');
    
    if (!droppedTaskId) return;
    
    if (!onTaskReorder) {
      return;
    }

    const columnWithoutDropped = tasks.filter((task) => task.id !== droppedTaskId);

    let insertIndex = columnWithoutDropped.length;
    if (dropPosition) {
      const { index, position } = dropPosition;
      const baseIndex = position === 'before' ? index : index + 1;
      let count = 0;
      for (let i = 0; i < Math.min(baseIndex, tasks.length); i += 1) {
        if (tasks[i]?.id === droppedTaskId) {
          continue;
        }
        count += 1;
      }
      insertIndex = count;
    }

    const orderedTaskIds = columnWithoutDropped.map((task) => task.id);
    orderedTaskIds.splice(insertIndex, 0, droppedTaskId);

    const isSameColumn = sourceStatus === title;
    const isOrderUnchanged =
      isSameColumn &&
      orderedTaskIds.length === tasks.length &&
      orderedTaskIds.every((taskId, idx) => taskId === tasks[idx]?.id);

    if (isOrderUnchanged) {
      return;
    }

    onTaskReorder({ taskId: droppedTaskId, targetStatus: title, orderedTaskIds });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set to false if we're leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDropPosition(null);
    }
  };
  
  const handleDragOverColumn = (e: React.DragEvent) => {
    e.preventDefault();
    // Clear drop position if dragging in empty space
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.classList.contains('space-y-3')) {
      setDropPosition(null);
    }
  };

  return (
    <div
      className={`rounded-lg p-4 min-h-96 transition-colors duration-200 ${
        isDragOver && dragSourceStatus !== title
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-600 border-dashed'
          : 'bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOverColumn}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-200">{title}</h3>
          <span className={`px-2 py-1 text-xs font-medium rounded-circle ${getStatusBadgeClass(title)}`}>
            {tasks.length}
          </span>
        </div>
      </div>
      
      <div className="space-y-3">
        {tasks.map((task, index) => (
          <div 
            key={task.id} 
            className="relative"
            onDragOver={(e) => {
              if (!onTaskReorder || !draggedTaskId || draggedTaskId === task.id) return;
              
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const height = rect.height;
              
              // Determine if we're in the top or bottom half
              if (y < height / 2) {
                setDropPosition({ index, position: 'before' });
              } else {
                setDropPosition({ index, position: 'after' });
              }
            }}
          >
            {/* Drop indicator for before this task */}
            {dropPosition?.index === index && dropPosition.position === 'before' && (
              <div className="h-1 bg-blue-500 rounded-full mb-2 animate-pulse" />
            )}
            
            <TaskCard
              task={task}
              onUpdate={onTaskUpdate}
              onEdit={onEditTask}
              onDragStart={() => {
                setDraggedTaskId(task.id);
                onDragStart?.();
              }}
              onDragEnd={() => {
                setDraggedTaskId(null);
                setDropPosition(null);
                onDragEnd?.();
              }}
              status={title}
            />
            
            {/* Drop indicator for after this task */}
            {dropPosition?.index === index && dropPosition.position === 'after' && (
              <div className="h-1 bg-blue-500 rounded-full mt-2 animate-pulse" />
            )}
          </div>
        ))}
        
        {/* Drop zone indicator - only show in different columns */}
        {isDragOver && dragSourceStatus !== title && (
          <div className="border-2 border-green-400 dark:border-green-500 border-dashed rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-center transition-colors duration-200">
            <div className="text-green-600 dark:text-green-400 text-sm font-medium transition-colors duration-200">
              Drop task here to change status
            </div>
          </div>
        )}
        
        {tasks.length === 0 && !isDragOver && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm transition-colors duration-200">
            {dragSourceStatus && dragSourceStatus !== title
              ? `Drop here to move to ${title}`
              : `No tasks in ${title}`}
          </div>
        )}

        {/* Cleanup button for Done column */}
        {onCleanup && title.toLowerCase() === 'done' && tasks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onCleanup}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200 cursor-pointer"
              title="Clean up old completed tasks"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clean Up Old Tasks
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskColumn;
