import React from 'react';
import { type Task } from '../../types';
import TaskCard from './TaskCard';

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onEditTask: (task: Task) => void;
  onTaskReorder?: (taskId: string, newOrdinal: number, columnTasks: Task[]) => void;
  dragSourceStatus?: string | null;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({
  title,
  tasks,
  onTaskUpdate,
  onStatusChange,
  onEditTask,
  onTaskReorder,
  dragSourceStatus,
  onDragStart,
  onDragEnd
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
    
    // If dropping from another column, just change status
    if (sourceStatus !== title) {
      onStatusChange(droppedTaskId, title);
      return;
    }
    
    // For same column drops, handle reordering if supported
    if (onTaskReorder && dropPosition) {
      const { index, position } = dropPosition;
      let newOrdinal: number;
      
      if (index === 0 && position === 'before') {
        // Dropping at the very beginning
        newOrdinal = tasks[0]?.ordinal !== undefined ? tasks[0].ordinal / 2 : 1000;
      } else if (index === tasks.length - 1 && position === 'after') {
        // Dropping at the very end
        const lastTask = tasks[tasks.length - 1];
        newOrdinal = lastTask?.ordinal !== undefined ? lastTask.ordinal + 1000 : (tasks.length + 1) * 1000;
      } else {
        // Dropping between two tasks
        const actualIndex = position === 'before' ? index : index + 1;
        const prevTask = tasks[actualIndex - 1];
        const nextTask = tasks[actualIndex];
        
        const prevOrdinal = prevTask?.ordinal ?? actualIndex * 1000;
        const nextOrdinal = nextTask?.ordinal ?? (actualIndex + 1) * 1000;
        
        newOrdinal = (prevOrdinal + nextOrdinal) / 2;
      }
      
      onTaskReorder(droppedTaskId, newOrdinal, tasks);
    }
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
          : 'bg-gray-50 dark:bg-gray-800 border border-transparent'
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
      </div>
    </div>
  );
};

export default TaskColumn;
