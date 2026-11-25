import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type Milestone, type Task } from '../../types';
import { apiClient, type ReorderTaskPayload } from '../lib/api';
import {
  buildLanes,
  createMilestoneCanonicalizer,
  DEFAULT_LANE_KEY,
  groupTasksByLaneAndStatus,
  type LaneMode,
  sortTasksForStatus,
} from '../lib/lanes';
import { collectArchivedMilestoneKeys } from '../utils/milestones';
import { createStatusResolver, getTerminalStatus } from '../../utils/terminal-status';
import { resolveTaskById } from '../../utils/task-id';
import { useBrowserAccess } from '../contexts/BrowserAccessContext';
import { type TaskNesting, useSubtaskLevels } from '../lib/task-nesting';
import TaskColumn from './TaskColumn';
import { BoardLoadingSkeleton } from './BoardLoadingSkeleton';

interface BoardProps {
  /** Every task of the page. Lanes are built from all of them, and moves look tasks up here. */
  tasks: Task[];
  /** The tasks the filters of the page keep. Columns and lane counts show these. */
  visibleTasks: Task[];
  /** Which tasks are subtasks of which, for the parent links and the subtask bars of the cards. */
  nesting: TaskNesting;
  onEditTask: (task: Task) => void;
  onRefreshData?: () => Promise<void>;
  onTasksUpdated?: (tasks: Task[], requestTask: Task) => void;
  statuses: string[];
  isLoading: boolean;
  milestoneEntities: Milestone[];
  archivedMilestones: Milestone[];
  laneMode: LaneMode;
  availablePriorities?: string[];
  availableProjects?: string[];
  hideEmptyColumns?: boolean;
  dateFormat?: string;
  /** Opens the cleanup dialog from the final column; absent without write access. */
  onCleanup?: () => void;
}

const SELECTION_CONTROL_CLASS =
  'h-8 rounded-control border border-line bg-surface px-2.5 text-sm text-ink transition-colors duration-200 hover:bg-hover focus-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The Board layout of the Tasks page: one column per configured status, optionally in milestone lanes, with drag
 * and drop of one card or a selection. The page filters the tasks; the board only shows and moves them.
 */
const Board: React.FC<BoardProps> = ({
  tasks,
  visibleTasks,
  nesting,
  onEditTask,
  onRefreshData,
  onTasksUpdated,
  statuses,
  isLoading,
  milestoneEntities,
  archivedMilestones,
  laneMode,
  availablePriorities,
  availableProjects,
  hideEmptyColumns = false,
  dateFormat,
  onCleanup,
}) => {
  const { canWrite } = useBrowserAccess();
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  // True while a drag that moves the whole selection is in flight, so every selected card can
  // carry the same dragging treatment as the grabbed one.
  const [isSelectionDragging, setIsSelectionDragging] = useState(false);
  const [batchMoveStatus, setBatchMoveStatus] = useState<string>('');
  const [dragSourceStatus, setDragSourceStatus] = useState<string | null>(null);
  const [dragSourceLane, setDragSourceLane] = useState<string | null>(null);
  // Set one task after dragstart, never inside it: see handleColumnDragStart.
  const [hiddenColumnsRevealed, setHiddenColumnsRevealed] = useState(false);
  const revealHiddenColumnsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
  // The subtask levels opened on the cards, kept here so filters and lanes do not reset them.
  const subtaskLevels = useSubtaskLevels();
  const terminalStatus = getTerminalStatus(statuses);
  const resolveStatus = useMemo(() => createStatusResolver(statuses), [statuses]);
  const canonicalizeMilestone = useMemo(
    () => createMilestoneCanonicalizer(milestoneEntities, archivedMilestones),
    [milestoneEntities, archivedMilestones]
  );
  const archivedMilestoneIds = useMemo(
    () => collectArchivedMilestoneKeys(archivedMilestones, milestoneEntities),
    [archivedMilestones, milestoneEntities]
  );

  const clearSelection = React.useCallback(() => {
    setSelectedTaskIds([]);
    setSelectionAnchorId(null);
    // A completed batch drop can unmount the grabbed card before its dragend fires, so the
    // selection-drag state resets here rather than trusting that event.
    setIsSelectionDragging(false);
  }, []);

  const toggleTaskSelection = React.useCallback((taskId: string) => {
    setSelectedTaskIds((previous) =>
      previous.includes(taskId) ? previous.filter((id) => id !== taskId) : [...previous, taskId]
    );
    setSelectionAnchorId(taskId);
  }, []);

  // A range only adds to the selection, so leaving the anchor on the first clicked card reaches the
  // same union a moved anchor would. The anchor moves on ctrl-click, where it does change the range.
  const selectTaskRange = React.useCallback((taskIds: string[]) => {
    setSelectedTaskIds((previous) => {
      const next = [...previous];
      for (const taskId of taskIds) {
        if (!next.includes(taskId)) next.push(taskId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (selectedTaskIds.length === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearSelection();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskIds.length, clearSelection]);


  // targetMilestone is only supplied by a drop into a milestone lane; the toolbar moves the
  // selection between columns and leaves every task's milestone alone.
  const handleBatchMove = async (targetStatus: string, targetMilestone?: string | null) => {
    if (selectedTaskIds.length === 0 || !targetStatus) return;
    const resolutions = selectedTaskIds.map((taskId) => {
      const resolution = resolveTaskById(tasks, taskId);
      return { taskId, task: resolution.status === 'found' ? resolution.task : undefined };
    });
    const selectedTasks = resolutions
      .map((resolution) => resolution.task)
      .filter((task): task is Task => task !== undefined);

    // The batch lands in the target column in the order it reads on the board, not in the order
    // the cards happened to be clicked. Unresolvable IDs stay in the request so the server can
    // report them per task.
    const orderedTasks = statuses.flatMap((status) =>
      sortTasksForStatus(selectedTasks.filter((task) => resolveStatus(task.status) === status), status, statuses)
    );
    const orderedIds = new Set(orderedTasks.map((task) => task.id));
    const taskIds = [
      ...orderedTasks.map((task) => task.id),
      ...resolutions.filter(({ task }) => !task || !orderedIds.has(task.id)).map(({ taskId }) => taskId),
    ];

    // Dropping the selection back where it already sits changes nothing, so it stays a pure no-op:
    // no request, no refresh, and the selection survives so the drag can be retried.
    const landsWhereItAlreadyIs =
      selectedTasks.length === taskIds.length &&
      selectedTasks.every(
        (task) =>
          resolveStatus(task.status) === targetStatus &&
          (targetMilestone === undefined ||
            canonicalizeMilestone(task.milestone) === canonicalizeMilestone(targetMilestone))
      );
    if (landsWhereItAlreadyIs) return;

    const requestTask = selectedTasks[0];
    clearSelection();
    setBatchMoveStatus('');
    try {
      const result = await apiClient.moveTasks({
        taskIds,
        targetStatus,
        ...(targetMilestone !== undefined ? { targetMilestone } : {}),
      });
      setUpdateError(
        result.failures.length > 0
          ? `Could not move ${result.failures.length} of ${taskIds.length} tasks. ${result.failures
              .map((failure) => `${failure.taskId}: ${failure.reason}`)
              .join(' ')}`
          : null
      );
      // Feed the moved tasks back through the board's own store update, exactly as a single-card
      // reorder does. Reloading every board resource instead remounts the whole view.
      const movedTasks = result.changedTasks ?? result.tasks;
      if (requestTask && onTasksUpdated && movedTasks.length > 0) {
        onTasksUpdated(movedTasks, requestTask);
      } else if (onRefreshData) await onRefreshData();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to move tasks');
    }
  };

  const handleTaskReorder = async (payload: ReorderTaskPayload) => {
    try {
      const requestResolution = resolveTaskById(tasks, payload.taskId);
      const requestTask = requestResolution.status === 'found' ? requestResolution.task : undefined;
      const result = await apiClient.reorderTask(payload);
      if (requestTask && onTasksUpdated) {
        onTasksUpdated(result.changedTasks ?? [result.task], requestTask);
      } else if (onRefreshData) await onRefreshData();
      setUpdateError(null);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to reorder task');
    }
  };

  // Lanes come from every task, so their order and keys, and the collapse state kept by key, stay put while the
  // filters change. visibleLanes below hides a lane the filters leave empty.
  const lanes = useMemo(
    () => buildLanes(laneMode, tasks, milestoneEntities.map((milestone) => milestone.id), milestoneEntities, {
      archivedMilestoneIds,
      archivedMilestones,
    }),
    [laneMode, tasks, milestoneEntities, archivedMilestoneIds, archivedMilestones]
  );

  // What the columns show, and what lane counts and progress are computed from.
  const visibleTasksByLane = useMemo(
    () =>
      groupTasksByLaneAndStatus(laneMode, lanes, statuses, visibleTasks, {
        archivedMilestoneIds,
        milestoneEntities,
        archivedMilestones,
      }),
    [laneMode, lanes, statuses, visibleTasks, archivedMilestoneIds, milestoneEntities, archivedMilestones]
  );

  const getTasksForLane = (laneKey: string, status: string): Task[] => {
    const statusMap = visibleTasksByLane.get(laneKey);
    if (!statusMap) {
      return [];
    }
    return statusMap.get(status) ?? [];
  };

  const laneTaskCount = (laneKey: string): number => {
    const statusMap = visibleTasksByLane.get(laneKey);
    if (!statusMap) return 0;
    let count = 0;
    for (const list of statusMap.values()) {
      count += list.length;
    }
    return count;
  };

  const getLaneProgress = (laneKey: string): number => {
    const total = laneTaskCount(laneKey);
    if (total === 0 || !terminalStatus) return 0;
    const done = visibleTasksByLane.get(laneKey)?.get(terminalStatus)?.length ?? 0;
    return Math.round((done / total) * 100);
  };

  // In milestone mode a lane shows only while it has tasks to show.
  const visibleLanes = useMemo(() => {
    if (laneMode !== 'milestone') return lanes;
    return lanes.filter(l => laneTaskCount(l.key) > 0);
  }, [laneMode, lanes, visibleTasksByLane]);

  const visibleStatuses = useMemo(() => {
    // Empty columns are still drop targets while dragging.
    if (!hideEmptyColumns || hiddenColumnsRevealed) return statuses;
    const groups = Array.from(visibleTasksByLane.values());
    return statuses.filter((status) => groups.some((group) => group.get(status)?.length));
  }, [hideEmptyColumns, hiddenColumnsRevealed, statuses, visibleTasksByLane]);

  const cancelHiddenColumnsReveal = () => {
    if (revealHiddenColumnsTimer.current !== null) clearTimeout(revealHiddenColumnsTimer.current);
    revealHiddenColumnsTimer.current = null;
  };

  const handleColumnDragStart = ({ status, laneId }: { status: string; laneId?: string | null }) => {
    setDragSourceStatus(status);
    setDragSourceLane(laneId ?? null);
    if (!hideEmptyColumns) return;
    // Adding the hidden columns changes the board layout, and Chromium aborts a native drag whose
    // dragstart handler does that: the card never becomes draggable. React commits this state
    // update synchronously inside the event, so the reveal has to wait for the next task, by which
    // time the browser has committed the drag.
    cancelHiddenColumnsReveal();
    revealHiddenColumnsTimer.current = setTimeout(() => {
      revealHiddenColumnsTimer.current = null;
      setHiddenColumnsRevealed(true);
    }, 0);
  };

  const handleColumnDragEnd = () => {
    cancelHiddenColumnsReveal();
    setDragSourceStatus(null);
    setDragSourceLane(null);
    setHiddenColumnsRevealed(false);
  };

  useEffect(() => cancelHiddenColumnsReveal, []);

  // Only show lane headers when multiple lanes exist
  const shouldShowLaneHeaders = useMemo(() => {
    if (laneMode !== 'milestone') return false;
    return visibleLanes.length > 1;
  }, [laneMode, visibleLanes]);

  // Only a lane header opens a collapsed lane, so a lane shown without one, the only lane left, is always open.
  const isLaneCollapsed = (laneKey: string): boolean =>
    shouldShowLaneHeaders && (collapsedLanes[laneKey] ?? false);

  const getLaneLabel = (lane: typeof lanes[0]): string => {
    if (lane.isNoMilestone || !lane.milestone) {
      return 'Unassigned';
    }
    return lane.label;
  };

  const toggleLaneCollapse = (laneKey: string) => {
    setCollapsedLanes(prev => ({
      ...prev,
      [laneKey]: !prev[laneKey],
    }));
  };

  // A card hidden by a filter or a collapsed lane is no longer part of what the user sees, so it
  // must not ride along in a batch move. Pruning here keeps the selection equal to the visible cards.
  useEffect(() => {
    if (!canWrite) return;
    const visibleIds = new Set(visibleTasks.map((task) => task.id));
    if (laneMode === 'milestone') {
      for (const lane of lanes) {
        if (!isLaneCollapsed(lane.key)) continue;
        const statusMap = visibleTasksByLane.get(lane.key);
        if (!statusMap) continue;
        for (const laneTasks of statusMap.values()) {
          for (const task of laneTasks) visibleIds.delete(task.id);
        }
      }
    }
    setSelectedTaskIds((previous) => {
      const next = previous.filter((taskId) => visibleIds.has(taskId));
      return next.length === previous.length ? previous : next;
    });
    setSelectionAnchorId((previous) => (previous && visibleIds.has(previous) ? previous : null));
    // biome-ignore lint/correctness/useExhaustiveDependencies: isLaneCollapsed is a plain render-scope helper; its inputs are listed.
  }, [canWrite, visibleTasks, laneMode, lanes, visibleTasksByLane, collapsedLanes]);

  const columnActions = canWrite ? {
    onTaskReorder: handleTaskReorder,
    dragSourceStatus,
    dragSourceLane,
    onDragStart: handleColumnDragStart,
    onDragEnd: handleColumnDragEnd,
    selectedTaskIds,
    selectionAnchorId,
    onToggleTaskSelection: toggleTaskSelection,
    onSelectTaskRange: selectTaskRange,
    onBatchMove: handleBatchMove,
    isSelectionDragging,
    onSelectionDragChange: setIsSelectionDragging,
  } : undefined;

  const renderColumns = (laneKey: string, targetMilestone?: string | null) => (
    <div className="grid grid-flow-col auto-cols-[minmax(11.5rem,1fr)] overflow-x-auto pb-2 sm:auto-cols-[minmax(14rem,1fr)] lg:auto-cols-[minmax(16rem,1fr)]">
      {visibleStatuses.map((status) => (
        <TaskColumn
          key={status}
          title={status}
          statuses={statuses}
          tasks={getTasksForLane(laneKey, status)}
          onEditTask={onEditTask}
          nesting={nesting}
          subtaskLevels={subtaskLevels}
          laneId={laneKey}
          targetMilestone={targetMilestone}
          priorityOrder={availablePriorities}
          availableProjects={availableProjects}
          dateFormat={dateFormat}
          onCleanup={status === terminalStatus ? onCleanup : undefined}
          {...columnActions}
        />
      ))}
    </div>
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape already clears the selection for keyboard users.
    <div
      className="w-full panel-gutter pt-2 pb-4"
      onClick={(event) => {
        if (selectedTaskIds.length > 0 && event.target === event.currentTarget) clearSelection();
      }}
    >
      {updateError && (
        <div className="mb-4 rounded-md bg-red-100 px-4 py-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200 transition-colors duration-200">
          {updateError}
        </div>
      )}
      {selectedTaskIds.length > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface-2 px-3 py-2"
          role="toolbar"
          aria-label="Task selection"
        >
          <span className="text-sm font-medium text-ink">
            <span className="font-mono">{selectedTaskIds.length}</span> selected
          </span>
          <label className="sr-only" htmlFor="batch-move-status">
            Move selected tasks to
          </label>
          <select
            id="batch-move-status"
            className={SELECTION_CONTROL_CLASS}
            value={batchMoveStatus}
            onChange={(event) => setBatchMoveStatus(event.target.value)}
          >
            <option value="">Move to...</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={SELECTION_CONTROL_CLASS}
            disabled={!batchMoveStatus}
            onClick={() => handleBatchMove(batchMoveStatus)}
          >
            Move
          </button>
          <button type="button" className={SELECTION_CONTROL_CLASS} onClick={clearSelection}>
            Clear
          </button>
        </div>
      )}

      {isLoading ? (
        <BoardLoadingSkeleton columnCount={statuses.length} />
      ) : laneMode === 'milestone' ? (
        <div className="space-y-4">
          {visibleLanes.map((lane) => {
            const taskCount = laneTaskCount(lane.key);
            const progress = getLaneProgress(lane.key);
            const isCollapsed = isLaneCollapsed(lane.key);

            return (
              <div key={lane.key} role="group" aria-label={getLaneLabel(lane)} className="overflow-hidden rounded-panel border border-line">
                {/* Lane header inside the box */}
                {shouldShowLaneHeaders && (
                  <button
                    type="button"
                    onClick={() => toggleLaneCollapse(lane.key)}
                    aria-expanded={!isCollapsed}
                    className={`group flex w-full items-center justify-between gap-4 bg-surface-2 px-4 py-2.5 transition-colors duration-200 hover:bg-hover focus-ring ${!isCollapsed ? 'border-b border-line' : ''}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <svg
                        className={`size-3.5 text-ink-3 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <h3 className="truncate text-sm font-semibold text-ink">
                        {getLaneLabel(lane)}
                      </h3>
                      <span className="shrink-0 font-mono text-[11.5px] font-medium text-ink-3">
                        {taskCount}
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-circle bg-line">
                        <div
                          className="h-full bg-ink transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="w-9 text-right font-mono text-[11.5px] font-medium text-ink-3">
                        {progress}%
                      </span>
                    </div>
                  </button>
                )}

                {/* Lane content - columns */}
                {!isCollapsed && (
                  <div className="p-2">
                    {renderColumns(lane.key, lane.milestone ?? null)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : renderColumns(DEFAULT_LANE_KEY)}
    </div>
  );
};

export default Board;
