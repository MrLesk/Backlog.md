import React from 'react';
import { type Task } from '../../types';
import AcceptanceCriteriaProgress, { getAcceptanceCriteriaProgressCounts } from './AcceptanceCriteriaProgress';
import PriorityBars from './PriorityBars';
import StoredDate from './StoredDate';
import TaskBranch from './TaskBranch';
import TaskTags from './TaskTags';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  status?: string;
  laneId?: string;
  /** The configured priorities, highest first, for the priority bars. */
  priorities?: string[];
  availableProjects?: string[];
  dateFormat?: string;
  isSelected?: boolean;
  selectionCount?: number;
  onSelect?: (event: { shiftKey: boolean }) => void;
  isSelectionDragging?: boolean;
  onSelectionDragChange?: (active: boolean) => void;
}

// Dragging a selected card moves the whole selection, so the drag image has to show it. Stacking
// empty cards (up to two) behind a copy of the dragged one, plus the count of every task that will
// move, keeps the board's own card styling.
const buildSelectionDragImage = (source: HTMLElement, count: number): HTMLElement => {
  const width = source.offsetWidth;
  const height = source.offsetHeight;
  const layer = (offset: number) => `position:absolute;top:${offset}px;left:${offset}px;width:${width}px;height:${height}px;margin:0;`;

  const behind = Math.min(count - 1, 2);
  const spread = 6 * behind;
  const ghost = document.createElement('div');
  ghost.style.cssText = `position:fixed;top:-1000px;left:-1000px;width:${width + spread}px;height:${height + spread}px;pointer-events:none;`;

  for (let depth = behind; depth >= 1; depth -= 1) {
    const shell = document.createElement('div');
    shell.className = source.className;
    shell.style.cssText = layer(6 * depth);
    ghost.appendChild(shell);
  }

  const front = source.cloneNode(true) as HTMLElement;
  front.style.cssText = layer(0);
  ghost.appendChild(front);

  const badge = document.createElement('div');
  badge.textContent = String(count);
  badge.style.cssText =
    'position:absolute;top:-8px;right:-8px;min-width:24px;height:24px;padding:0 6px;border-radius:9999px;' +
    'background:var(--color-ink);color:var(--color-on-ink);font-size:12px;font-weight:600;line-height:24px;text-align:center;' +
    'box-shadow:0 1px 3px rgba(0,0,0,0.3);';
  ghost.appendChild(badge);

  return ghost;
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit: onOpenTask,
  onDragStart,
  onDragEnd,
  status,
  laneId,
  priorities,
  availableProjects,
  dateFormat,
  isSelected = false,
  selectionCount = 0,
  onSelect,
  isSelectionDragging = false,
  onSelectionDragChange,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [showBranchTooltip, setShowBranchTooltip] = React.useState(false);

  // Check if task is from another branch (read-only)
  const isFromOtherBranch = Boolean(task.branch);
  const acceptanceCriteriaProgress = getAcceptanceCriteriaProgressCounts(task);
  const accessibleLabel = acceptanceCriteriaProgress
    ? `Open ${task.id}: ${task.title}. Acceptance criteria progress: ${acceptanceCriteriaProgress.checked} of ${acceptanceCriteriaProgress.total}`
    : `Open ${task.id}: ${task.title}`;

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

    // A modifier-press that turns straight into a drag never completes the click, so the selection
    // would miss the very card being dragged and both the badge and the drop would come up one
    // short. Joining the selection here keeps them in agreement with what the user grabbed.
    const joinsSelection = !isSelected && selectionCount > 0 && (e.ctrlKey || e.metaKey) && Boolean(onSelect);
    if (joinsSelection) onSelect?.({ shiftKey: false });
    const batchCount = isSelected ? selectionCount : joinsSelection ? selectionCount + 1 : 1;

    if (batchCount > 1) {
      // The whole selection moves with this drag, so every selected card on the board carries the
      // same dragging treatment as the grabbed one.
      onSelectionDragChange?.(true);
      if (typeof e.dataTransfer.setDragImage === 'function') {
        const ghost = buildSelectionDragImage(e.currentTarget as HTMLElement, batchCount);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 16, 16);
        // The browser snapshots the element during setDragImage, so it only has to survive this tick.
        setTimeout(() => ghost.remove(), 0);
      }
    }

    setIsDragging(true);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onSelectionDragChange?.(false);
    onDragEnd?.();
  };

  const dragEvents = onDragStart ? {
    draggable: !isFromOtherBranch,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  } : { draggable: false };

  return (
    <div className="relative">
      {/* Shown when a read-only card from another branch is dragged. */}
      {showBranchTooltip && isFromOtherBranch && (
        <div className="absolute -top-12 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-control bg-ink px-3 py-2 text-xs text-on-ink shadow-lg">
          Switch to <span className="font-semibold">{task.branch}</span> branch to move this task
          <div className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rotate-45 bg-ink"></div>
        </div>
      )}

      <div
        className={`rounded-[10px] border bg-surface p-3 transition-all duration-200 ${
          isFromOtherBranch ? 'cursor-not-allowed border-dashed border-line' : 'cursor-pointer border-line hover:border-ink-3'
        } ${
          isDragging || (isSelected && isSelectionDragging) ? 'opacity-50 transform rotate-2 scale-105' : ''
        } ${isSelected ? 'border-accent-strong ring-2 ring-accent-strong' : ''} focus-ring`}
        aria-selected={isSelected}
		role="button"
		tabIndex={0}
		aria-label={accessibleLabel}
        {...dragEvents}
        onClick={(event) => {
          // Ctrl/Cmd and Shift select cards on the editable board.
          if (onSelect && !isFromOtherBranch && (event.ctrlKey || event.metaKey || event.shiftKey)) {
            event.preventDefault();
            event.stopPropagation();
            onSelect({ shiftKey: event.shiftKey });
            return;
          }
          onOpenTask(task);
        }}
		onKeyDown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				if (onSelect && !isFromOtherBranch && (event.ctrlKey || event.metaKey || event.shiftKey)) {
					onSelect({ shiftKey: event.shiftKey });
					return;
				}
				onOpenTask(task);
			}
		}}
      >
        {/* Header row: the same priority and ID as a row of the list, and the acceptance-criteria ring. */}
        <div className="flex items-center gap-2">
          <PriorityBars priority={task.priority} priorities={priorities} />
          <span className="min-w-0 font-mono text-xs font-medium text-ink-3 wrap-anywhere">{task.id}</span>
          <span className="ml-auto shrink-0">
            <AcceptanceCriteriaProgress task={task} density="card" />
          </span>
        </div>

        <h4 className="mt-1.5 text-sm font-medium leading-snug text-ink wrap-anywhere md:line-clamp-2">
          {task.title}
        </h4>

        <div className="mt-2 flex flex-wrap gap-1 empty:hidden">
          <TaskTags task={task} projects={availableProjects} />
        </div>

        {/* Footer with dates, branch and assignee */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line-soft pt-1.5 text-[11px] text-ink-3">
          {/* Grouped so the updated date sits beside the created date on every card, whatever else the footer shows.
              The group uses the same gaps as the footer row (gap-x-2 gap-y-1), so change the two together.
              A new labelled date in the compact style belongs inside this group. */}
          <span className="flex flex-wrap gap-x-2 gap-y-1">
            <StoredDate value={task.createdDate} dateFormat={dateFormat} compact />
            {task.updatedDate && <span>Updated: <StoredDate value={task.updatedDate} dateFormat={dateFormat} compact /></span>}
          </span>
          {task.dueDate && <span>Due: <StoredDate value={task.dueDate} dateFormat={dateFormat} /></span>}
          {task.branch && <TaskBranch branch={task.branch} />}
          {task.assignee.length > 0 && (
            <span className="ml-auto max-w-[7rem] truncate font-mono text-ink-2" title={task.assignee.join(', ')}>
              {task.assignee[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
