import React from 'react';
import { type Task } from '../../types';
import { compareTaskIds, sortByPriority } from '../../utils/task-sorting';
import type { ReorderTaskPayload } from '../lib/api';
import { parseStoredUtcDate } from '../utils/date-display';
import TaskCard from './TaskCard';

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onEditTask: (task: Task) => void;
  onTaskReorder?: (payload: ReorderTaskPayload) => void;
  dragSourceStatus?: string | null;
  dragSourceLane?: string | null;
  onDragStart?: (context: { status: string; laneId?: string | null }) => void;
  onDragEnd?: () => void;
  onCleanup?: () => void;
  laneId?: string;
  targetMilestone?: string | null;
  priorityOrder?: string[];
  availableTypes?: string[];
  dateFormat?: string;
}

type CreatedDateSortDirection = 'asc' | 'desc';

const getCreatedDateTime = (task: Task): number | null => {
  const parsed = parseStoredUtcDate(task.createdDate ?? '');
  return parsed ? parsed.getTime() : null;
};

const sortByCreatedDate = (tasks: Task[], direction: CreatedDateSortDirection): Task[] => {
  return tasks.slice().sort((a, b) => {
    const aTime = getCreatedDateTime(a);
    const bTime = getCreatedDateTime(b);

    if (aTime === null && bTime === null) {
      return compareTaskIds(a.id, b.id);
    }
    if (aTime === null) {
      return 1;
    }
    if (bTime === null) {
      return -1;
    }
    if (aTime !== bTime) {
      return direction === 'asc' ? aTime - bTime : bTime - aTime;
    }
    return compareTaskIds(a.id, b.id);
  });
};

const TaskColumn: React.FC<TaskColumnProps> = ({
  title,
  tasks,
  onTaskUpdate,
  onEditTask,
  onTaskReorder,
  dragSourceStatus,
  dragSourceLane,
  onDragStart,
  onDragEnd,
  onCleanup,
  laneId,
  targetMilestone,
  priorityOrder,
  availableTypes,
  dateFormat,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [draggedTaskId, setDraggedTaskId] = React.useState<string | null>(null);
  const [dropPosition, setDropPosition] = React.useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const columnActionsId = React.useId();
  const canReorderColumn = Boolean(onTaskReorder) && tasks.length > 1 && tasks.every(task => !task.branch);

  React.useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const emitColumnReorder = (orderedTaskIds: string[]) => {
    if (!onTaskReorder || !canReorderColumn) {
      setShowMenu(false);
      return;
    }

    const currentIds = tasks.map(t => t.id);
    const hasChanged = orderedTaskIds.some((id, index) => id !== currentIds[index]);
    const leadTaskId = orderedTaskIds[0];

    if (hasChanged && leadTaskId) {
      onTaskReorder({
        taskId: leadTaskId,
        targetStatus: title,
        orderedTaskIds,
        ...(targetMilestone !== undefined ? { targetMilestone } : {}),
      });
    }

    setShowMenu(false);
  };

  const handleSortByPriority = () => {
    emitColumnReorder(sortByPriority(tasks, priorityOrder).map(t => t.id));
  };

  const handleSortByCreatedDate = (direction: CreatedDateSortDirection) => {
    emitColumnReorder(sortByCreatedDate(tasks, direction).map(t => t.id));
  };

  // vibe-kanban marks a column with a small coloured dot rather than a
  // filled pill, so the status reads at a glance without adding a second
  // block of colour to a header that already has a title and a count.
  const getStatusDotClass = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('complete')) {
      return 'bg-green-500';
    }
    if (statusLower.includes('progress') || statusLower.includes('doing')) {
      return 'bg-amber-500';
    }
    if (statusLower.includes('blocked') || statusLower.includes('stuck')) {
      return 'bg-red-500';
    }
    return 'bg-gray-400 dark:bg-gray-500';
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

    onTaskReorder({
      taskId: droppedTaskId,
      targetStatus: title,
      orderedTaskIds,
      ...(targetMilestone !== undefined ? { targetMilestone } : {}),
    });
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

  const isEmpty = tasks.length === 0;

  return (
    <div
      data-column-status={title}
      className={`flex h-full flex-col transition-colors duration-200 ${
        isEmpty ? 'min-h-24' : 'min-h-96'
      } ${
        isDragOver && (dragSourceStatus !== title || (dragSourceLane ?? null) !== (laneId ?? null))
          ? 'bg-blue-50/70 dark:bg-blue-900/15'
          : ''
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOverColumn}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/70 px-3 py-2 transition-colors duration-200 dark:bg-gray-800/50">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-circle ${getStatusDotClass(title)}`} aria-hidden="true" />
          <h3 className="truncate text-sm text-gray-900 transition-colors duration-200 dark:text-gray-100">{title}</h3>
          <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {tasks.length}
          </span>
        </div>
        
        {canReorderColumn && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none"
              title="Column actions"
              aria-label="Column actions"
              aria-haspopup="menu"
              aria-expanded={showMenu}
              aria-controls={columnActionsId}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {showMenu && (
              <div
                id={columnActionsId}
                role="menu"
                className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 py-1 ring-1 ring-black ring-opacity-5"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSortByPriority}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors duration-150"
                >
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Sort by Priority
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSortByCreatedDate('asc')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors duration-150"
                >
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2zm5-7v4m0 0l-2-2m2 2l2-2" />
                  </svg>
                  Sort by Creation Date (oldest first)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSortByCreatedDate('desc')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors duration-150"
                >
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2zm5 11v-4m0 0l-2 2m2-2l2 2" />
                  </svg>
                  Sort by Creation Date (newest first)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="flex-1 space-y-2 px-3 py-3">
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
              <div className="mb-2 h-0.5 bg-blue-500" />
            )}
            
            <TaskCard
              task={task}
              onUpdate={onTaskUpdate}
              onEdit={onEditTask}
              onDragStart={() => {
                setDraggedTaskId(task.id);
                onDragStart?.({ status: title, laneId: laneId ?? null });
              }}
              onDragEnd={() => {
                setDraggedTaskId(null);
                setDropPosition(null);
                onDragEnd?.();
              }}
              status={title}
              laneId={laneId}
              availableTypes={availableTypes}
              dateFormat={dateFormat}
            />
            
            {/* Drop indicator for after this task */}
            {dropPosition?.index === index && dropPosition.position === 'after' && (
              <div className="mt-2 h-0.5 bg-blue-500" />
            )}
          </div>
        ))}
        
        {/* Drop zone indicator - only show in different columns */}
        {isDragOver && dragSourceStatus !== title && (
          <div className="border border-dashed border-blue-400 bg-blue-50 p-4 text-center transition-colors duration-200 dark:border-blue-500 dark:bg-blue-900/20">
            <div className="text-sm text-blue-600 transition-colors duration-200 dark:text-blue-400">
              Drop task here to change status
            </div>
          </div>
        )}
        
        {isEmpty && !isDragOver && (
          <div className="border border-dashed border-gray-300 py-6 text-center text-xs text-gray-400 transition-colors duration-200 dark:border-gray-600 dark:text-gray-500">
            {dragSourceStatus && dragSourceStatus !== title ? `Drop to move` : `No tasks`}
          </div>
        )}

        {/* Cleanup button for the configured terminal column */}
        {onCleanup && tasks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
	            <button
	              onClick={onCleanup}
	              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
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
