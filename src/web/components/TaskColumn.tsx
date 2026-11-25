import React from 'react';
import { type Task } from '../../types';
import { compareTaskIds, sortByPriority } from '../../utils/task-sorting';
import type { ReorderTaskPayload } from '../lib/api';
import type { SubtaskLevels, TaskNesting } from '../lib/task-nesting';
import { parseStoredUtcDate } from '../../utils/utc-timestamp.ts';
import ActionsMenu from './ActionsMenu';
import CleanupButton from './CleanupButton';
import StatusMark from './StatusMark';
import TaskCard from './TaskCard';

const SORT_BY_PRIORITY_ICON = 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12';
const SORT_BY_OLDEST_ICON =
  'M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2zm5-7v4m0 0l-2-2m2 2l2-2';
const SORT_BY_NEWEST_ICON =
  'M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2zm5 11v-4m0 0l-2 2m2-2l2 2';

const SortIcon = ({ path }: { path: string }) => (
  <svg className="size-4 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
  </svg>
);

interface TaskColumnProps {
  title: string;
  /** The configured statuses in workflow order, for the status mark of the column. */
  statuses: string[];
  tasks: Task[];
  onEditTask: (task: Task) => void;
  /** Which tasks are subtasks of which, and the subtask levels opened on the board's cards. */
  nesting: TaskNesting;
  subtaskLevels: SubtaskLevels;
  onTaskReorder?: (payload: ReorderTaskPayload) => void;
  dragSourceStatus?: string | null;
  dragSourceLane?: string | null;
  onDragStart?: (context: { status: string; laneId?: string | null }) => void;
  onDragEnd?: () => void;
  onCleanup?: () => void;
  laneId?: string;
  targetMilestone?: string | null;
  priorityOrder?: string[];
  availableProjects?: string[];
  dateFormat?: string;
  selectedTaskIds?: string[];
  selectionAnchorId?: string | null;
  onToggleTaskSelection?: (taskId: string) => void;
  onSelectTaskRange?: (taskIds: string[]) => void;
  onBatchMove?: (targetStatus: string, targetMilestone?: string | null) => void;
  isSelectionDragging?: boolean;
  onSelectionDragChange?: (active: boolean) => void;
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
  statuses,
  tasks,
  onEditTask,
  nesting,
  subtaskLevels,
  onTaskReorder,
  dragSourceStatus,
  dragSourceLane,
  onDragStart,
  onDragEnd,
  onCleanup,
  laneId,
  targetMilestone,
  priorityOrder,
  availableProjects,
  dateFormat,
  selectedTaskIds,
  selectionAnchorId,
  onToggleTaskSelection,
  onSelectTaskRange,
  onBatchMove,
  isSelectionDragging,
  onSelectionDragChange,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [draggedTaskId, setDraggedTaskId] = React.useState<string | null>(null);
  const [dropPosition, setDropPosition] = React.useState<{ index: number; position: 'before' | 'after' | 'self' } | null>(null);
  // The space around and between the cards; dragging over it, rather than over a card, clears the insertion point.
  const cardListRef = React.useRef<HTMLDivElement>(null);
  const headingId = React.useId();
  const canDropTask = Boolean(onTaskReorder || onBatchMove);
  const canReorderColumn = Boolean(onTaskReorder) && tasks.length > 1 && tasks.every(task => !task.branch);

  const emitColumnReorder = (orderedTaskIds: string[]) => {
    if (!onTaskReorder || !canReorderColumn) {
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
  };

  const handleSortByPriority = () => {
    emitColumnReorder(sortByPriority(tasks, priorityOrder).map(t => t.id));
  };

  const handleSortByCreatedDate = (direction: CreatedDateSortDirection) => {
    emitColumnReorder(sortByCreatedDate(tasks, direction).map(t => t.id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropPosition(null);
    
    const droppedTaskId = e.dataTransfer.getData('text/plain');
    const sourceStatus = e.dataTransfer.getData('text/status');
    
    if (!droppedTaskId) return;

    // Dragging one card of a selection moves the whole selection, so the drop skips reordering.
    // The lane travels with the column exactly as it does for a single-card drop below, so a batch
    // dropped into a milestone lane lands in that milestone too.
    if (onBatchMove && selectedTaskIds && selectedTaskIds.length > 1 && selectedTaskIds.includes(droppedTaskId)) {
      onBatchMove(title, targetMilestone);
      return;
    }

    if (!onTaskReorder) {
      return;
    }

    const columnWithoutDropped = tasks.filter((task) => task.id !== droppedTaskId);

    let insertIndex = columnWithoutDropped.length;
    if (dropPosition) {
      // 'self' resolves to the card's own spot, so releasing a lifted card in place falls through
      // to the unchanged-order guard below instead of appending it to the end of the column.
      const { index, position } = dropPosition;
      const baseIndex = position === 'after' ? index + 1 : index;
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
    if (target === e.currentTarget || target === cardListRef.current) {
      setDropPosition(null);
    }
  };

  const isEmpty = tasks.length === 0;
  const dropEvents = canDropTask ? {
    onDrop: handleDrop,
    onDragOver: handleDragOverColumn,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
  } : undefined;

  const handleCardDragOver = (event: React.DragEvent, taskId: string, index: number) => {
    if (!draggedTaskId) return;
    // Batch moves ignore the insertion position.
    if (selectedTaskIds && selectedTaskIds.length > 1 && selectedTaskIds.includes(draggedTaskId)) return;

    event.preventDefault();
    if (draggedTaskId === taskId) {
      setDropPosition({ index, position: 'self' });
      return;
    }

    const { top, height } = event.currentTarget.getBoundingClientRect();
    setDropPosition({ index, position: event.clientY - top < height / 2 ? 'before' : 'after' });
  };

  const startTaskDrag = (taskId: string) => {
    setDraggedTaskId(taskId);
    onDragStart?.({ status: title, laneId: laneId ?? null });
  };

  const finishTaskDrag = () => {
    setDraggedTaskId(null);
    setDropPosition(null);
    onDragEnd?.();
  };

  const taskSelectionHandler = (taskId: string, index: number) => {
    if (!onToggleTaskSelection) return undefined;

    return ({ shiftKey }: { shiftKey: boolean }) => {
      const anchorIndex = shiftKey && selectionAnchorId
        ? tasks.findIndex((candidate) => candidate.id === selectionAnchorId)
        : -1;
      if (!onSelectTaskRange || anchorIndex === -1) {
        onToggleTaskSelection(taskId);
        return;
      }

      const from = Math.min(anchorIndex, index);
      const to = Math.max(anchorIndex, index);
      // Skip read-only cross-branch cards, just as a direct click does.
      const taskIds = tasks
        .slice(from, to + 1)
        .filter((candidate) => !candidate.branch)
        .map((candidate) => candidate.id);
      onSelectTaskRange(taskIds);
    };
  };

  const isDropTarget = isDragOver && (dragSourceStatus !== title || (dragSourceLane ?? null) !== (laneId ?? null));

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className={`h-full min-w-0 border-l border-line-soft px-2.5 pb-3 transition-colors duration-200 first:border-l-0 ${
        isEmpty ? 'min-h-24' : 'min-h-96'
      } ${isDropTarget ? 'bg-hover' : ''}`}
      {...dropEvents}
    >
      <div className="relative flex h-[42px] items-center gap-2">
        <StatusMark status={title} statuses={statuses} decorative />
        <h3 id={headingId} className="min-w-0 text-sm font-semibold text-ink wrap-anywhere">{title}</h3>
        <span className="font-mono text-[11.5px] font-medium text-ink-3">{tasks.length}</span>

        <span className="ml-auto flex items-center gap-0.5">
          {onCleanup && tasks.length > 0 && <CleanupButton onClick={onCleanup} />}
          {canReorderColumn && (
            <ActionsMenu
              label="Column actions"
              // As wide as the column header it opens under, so the board's scroll area never cuts it off.
              menuClassName="absolute inset-x-0 top-full"
              actions={[
                { label: 'Sort by Priority', icon: <SortIcon path={SORT_BY_PRIORITY_ICON} />, onSelect: handleSortByPriority },
                {
                  label: 'Sort by Creation Date (oldest first)',
                  icon: <SortIcon path={SORT_BY_OLDEST_ICON} />,
                  onSelect: () => handleSortByCreatedDate('asc'),
                },
                {
                  label: 'Sort by Creation Date (newest first)',
                  icon: <SortIcon path={SORT_BY_NEWEST_ICON} />,
                  onSelect: () => handleSortByCreatedDate('desc'),
                },
              ]}
            />
          )}
        </span>
      </div>

      <div ref={cardListRef} className="space-y-2">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className="relative"
            onDragOver={onTaskReorder ? (event) => handleCardDragOver(event, task.id, index) : undefined}
          >
            {/* Drop indicator for before this task */}
            {dropPosition?.index === index && dropPosition.position === 'before' && (
              <div data-drop-indicator className="mb-2 h-1 animate-pulse rounded-circle bg-accent-strong" />
            )}

            <TaskCard
              task={task}
              onEdit={onEditTask}
              nesting={nesting}
              statuses={statuses}
              subtaskLevels={subtaskLevels}
              isSelected={selectedTaskIds?.includes(task.id) ?? false}
              selectionCount={selectedTaskIds?.length ?? 0}
              isSelectionDragging={isSelectionDragging}
              onSelectionDragChange={onSelectionDragChange}
              onSelect={taskSelectionHandler(task.id, index)}
              onDragStart={canDropTask ? () => startTaskDrag(task.id) : undefined}
              onDragEnd={canDropTask ? finishTaskDrag : undefined}
              status={title}
              laneId={laneId}
              priorities={priorityOrder}
              availableProjects={availableProjects}
              dateFormat={dateFormat}
            />

            {/* Drop indicator for after this task */}
            {dropPosition?.index === index && dropPosition.position === 'after' && (
              <div data-drop-indicator className="mt-2 h-1 animate-pulse rounded-circle bg-accent-strong" />
            )}
          </div>
        ))}

        {/* Drop zone indicator - only show in different columns */}
        {isDragOver && dragSourceStatus !== title && (
          <div className="rounded-control border-2 border-dashed border-accent-strong p-4 text-center text-sm font-medium text-accent-text transition-colors duration-200">
            Drop task here to change status
          </div>
        )}

        {isEmpty && !isDragOver && (
          <div className="py-2 text-center text-xs text-ink-3 transition-colors duration-200">
            {dragSourceStatus && dragSourceStatus !== title
              ? `Drop to move`
              : `Empty`}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskColumn;
