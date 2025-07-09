import React from 'react';
import { Task, TaskStatus } from '../types/task';
import TaskCard from './TaskCard';

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onTaskReorder: (taskId: string, newPosition: number) => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({ 
  title, 
  tasks, 
  onTaskUpdate, 
  onStatusChange,
  onEditTask,
  onTaskReorder
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const getStatusBadgeClass = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('complete')) {
      return 'bg-green-100 text-green-800';
    }
    if (statusLower.includes('progress') || statusLower.includes('doing')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  const calculateDropPosition = (e: React.DragEvent): number => {
    const columnElement = e.currentTarget;
    const rect = columnElement.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    const taskElements = columnElement.querySelectorAll('[data-task-id]');
    
    for (let i = 0; i < taskElements.length; i++) {
      const taskElement = taskElements[i];
      const taskRect = taskElement.getBoundingClientRect();
      const taskY = taskRect.top - rect.top;
      const taskHeight = taskRect.height;
      
      if (y < taskY + taskHeight / 2) {
        return i;
      }
    }
    
    return tasks.length;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragOverIndex(null);
    
    const taskId = e.dataTransfer.getData('text/plain');
    const sourceStatus = e.dataTransfer.getData('source-status');
    
    if (taskId) {
      if (sourceStatus === title) {
        // Same column - reorder
        const dropPosition = calculateDropPosition(e);
        onTaskReorder(taskId, dropPosition);
      } else {
        // Different column - change status
        onStatusChange(taskId, title);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceStatus = e.dataTransfer.getData('source-status');
    
    if (sourceStatus === title) {
      // Same column - show drop position
      const dropPosition = calculateDropPosition(e);
      setDragOverIndex(dropPosition);
    }
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
      setDragOverIndex(null);
    }
  };

  return (
    <div 
      className={`rounded-lg p-4 min-h-96 transition-colors ${
        isDragOver 
          ? 'bg-green-50 border-2 border-green-300 border-dashed' 
          : 'bg-gray-50 border-2 border-transparent'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(title)}`}>
            {tasks.length}
          </span>
        </div>
      </div>
      
      <div className="space-y-3">
        {tasks.map((task, index) => (
          <React.Fragment key={task.id}>
            {/* Drop indicator for same column reordering */}
            {dragOverIndex === index && (
              <div className="border-2 border-blue-400 border-dashed rounded-md bg-blue-50 p-2 text-center">
                <div className="text-blue-600 text-xs font-medium">
                  Drop here
                </div>
              </div>
            )}
            <TaskCard
              task={task}
              onUpdate={onTaskUpdate}
              onEdit={onEditTask}
              data-task-id={task.id}
            />
          </React.Fragment>
        ))}
        
        {/* Drop indicator at the end */}
        {dragOverIndex === tasks.length && (
          <div className="border-2 border-blue-400 border-dashed rounded-md bg-blue-50 p-2 text-center">
            <div className="text-blue-600 text-xs font-medium">
              Drop here
            </div>
          </div>
        )}
        
        {/* Drop zone indicator for different column */}
        {isDragOver && dragOverIndex === null && (
          <div className="border-2 border-green-400 border-dashed rounded-md bg-green-50 p-4 text-center">
            <div className="text-green-600 text-sm font-medium">
              Drop task here
            </div>
          </div>
        )}
        
        {tasks.length === 0 && !isDragOver && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No tasks in {title}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskColumn;