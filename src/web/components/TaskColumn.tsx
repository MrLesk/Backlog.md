import React from 'react';
import { useI18n } from '../hooks/useI18n';
import { type Task } from '../../types';
import { compareTaskIds, groupSubtasksUnderParents, sortByPriority } from '../../utils/task-sorting';
import type { ReorderTaskPayload } from '../lib/api';
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
  terminalStatus?: string | null;
}

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
  terminalStatus,
}) => {
  const { t } = useI18n();
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [draggedTaskId, setDraggedTaskId] = React.useState<string | null>(null);
  const [dropPosition, setDropPosition] = React.useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const [showMenu, setShowMenu] = React.useState(false);
  const [columnSort, setColumnSort] = React.useState<{ field: "id" | "title" | "priority"; direction: "asc" | "desc" } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const columnActionsId = React.useId();
  const canSort = Boolean(onTaskReorder) && tasks.length > 1 && tasks.every(task => !task.branch);

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

  const getDisplayTasks = () => {
    if (!columnSort) return tasks;

    if (columnSort.field === "id") {
      const sorted = [...tasks].sort((a, b) => {
        const result = compareTaskIds(a.id, b.id);
        if (result !== 0) {
          return columnSort.direction === "asc" ? result : -result;
        }
        return compareTaskIds(a.id, b.id);
      });
      return groupSubtasksUnderParents(
        sorted,
        (a, b) => compareTaskIds(a.id, b.id),
        undefined,
        columnSort.direction,
      );
    }

    return [...tasks].sort((a, b) => {
      let result = 0;
      switch (columnSort.field) {
        case "title": {
          result = a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
          break;
        }
        case "priority": {
          const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
          const rankA = a.priority ? (rank[a.priority] ?? 0) : 0;
          const rankB = b.priority ? (rank[b.priority] ?? 0) : 0;
          result = rankA - rankB;
          break;
        }
      }
      if (result !== 0) {
        return columnSort.direction === "asc" ? result : -result;
      }
      return compareTaskIds(a.id, b.id);
    });
  };

  const handleLocalSort = (field: "id" | "title" | "priority", direction: "asc" | "desc") => {
    setColumnSort(current => {
      if (current?.field === field && current?.direction === direction) {
        return null;
      }
      return { field, direction };
    });
    setShowMenu(false);
  };

  const handleApplyPriorityOrder = () => {
    if (!onTaskReorder || !canSort) {
      setShowMenu(false);
      return;
    }
    setColumnSort(null);
    const sortedTasks = sortByPriority(tasks);
    const orderedTaskIds = sortedTasks.map(t => t.id);
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

  const sortOptions = [
    { label: "ID", field: "id" as const, direction: "asc" as const },
    { label: "ID", field: "id" as const, direction: "desc" as const },
    { label: t.milestones.tableHeaders.title, field: "title" as const, direction: "asc" as const },
    { label: t.milestones.tableHeaders.title, field: "title" as const, direction: "desc" as const },
    { label: t.milestones.tableHeaders.priority, field: "priority" as const, direction: "asc" as const },
    { label: t.milestones.tableHeaders.priority, field: "priority" as const, direction: "desc" as const },
  ];

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
      className={`rounded-lg p-4 transition-colors duration-200 h-full ${
        isEmpty ? 'min-h-24' : 'min-h-96'
      } ${
        isDragOver && (dragSourceStatus !== title || (dragSourceLane ?? null) !== (laneId ?? null))
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-600 border-dashed'
          : isEmpty
            ? 'bg-gray-50/50 dark:bg-gray-800/30 border border-gray-200/50 dark:border-gray-700/50'
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
        
        {canSort && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none"
              title={t.taskColumn.columnActions}
              aria-label={t.taskColumn.columnActions}
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
                className="absolute right-0 mt-1 min-w-[12rem] w-max bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 py-1 ring-1 ring-black ring-opacity-5"
              >
                {sortOptions.map((option) => {
                  const isActive = columnSort?.field === option.field && columnSort?.direction === option.direction;
                  return (
                    <button
                      key={`${option.field}-${option.direction}`}
                      type="button"
                      role="menuitem"
                      onClick={() => handleLocalSort(option.field, option.direction)}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors duration-150 whitespace-nowrap ${
                        isActive
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className={`text-xs font-medium w-4 text-center ${isActive ? "text-gray-600 dark:text-gray-300" : ""}`}>
                        {option.direction === "asc" ? "↑" : "↓"}
                      </span>
                      <span className="flex-1">{option.label}</span>
                      {isActive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setColumnSort(null);
                          }}
                          className="ml-2 p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded"
                          aria-label="Clear sort"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </button>
                  );
                })}
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleApplyPriorityOrder}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors duration-150 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4v-12" />
                  </svg>
                  {t.taskColumn.sortByPriority}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        {getDisplayTasks().map((task, index) => (
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
                setColumnSort(null);
                onDragStart?.({ status: title, laneId: laneId ?? null });
              }}
              onDragEnd={() => {
                setDraggedTaskId(null);
                setDropPosition(null);
                onDragEnd?.();
              }}
              status={title}
              laneId={laneId}
              terminalStatus={terminalStatus}
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
              {t.taskColumn.dropToChangeStatus}
            </div>
          </div>
        )}
        
        {isEmpty && !isDragOver && (
          <div className="text-center py-2 text-gray-400 dark:text-gray-500 text-xs transition-colors duration-200">
            {dragSourceStatus && dragSourceStatus !== title
              ? t.taskColumn.dropToMove
              : t.taskColumn.empty}
          </div>
        )}

        {/* Cleanup button for the configured terminal column */}
        {onCleanup && tasks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onCleanup}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
              title={t.taskColumn.cleanUpTitle}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t.taskColumn.cleanUp}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskColumn;
