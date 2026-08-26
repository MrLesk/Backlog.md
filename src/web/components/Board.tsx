import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type Milestone, type Task } from '../../types';
import { apiClient, type ReorderTaskPayload } from '../lib/api';
import { buildLanes, DEFAULT_LANE_KEY, groupTasksByLaneAndStatus, type LaneMode } from '../lib/lanes';
import { collectAvailableLabels, labelsToLower } from '../../utils/label-filter';
import { collectArchivedMilestoneKeys, milestoneKey } from '../utils/milestones';
import { getTerminalStatus } from '../../utils/terminal-status';
import { getPriorityOptions, normalizePriorityValue } from '../../utils/priority-config';
import { getProjectValues, matchesProjectFilter } from '../../utils/project-config';
import { getTaskTypeValues, matchesTaskTypeFilter } from '../../utils/task-type-config';
import { resolveTaskById } from '../../utils/task-id';
import TaskColumn from './TaskColumn';
import CleanupModal from './CleanupModal';
import LabelFilterDropdown from './LabelFilterDropdown';
import { SuccessToast } from './SuccessToast';

interface BoardProps {
  onEditTask: (task: Task) => void;
  onNewTask: () => void;
  highlightTaskId?: string | null;
  tasks: Task[];
  onRefreshData?: () => Promise<void>;
  onTasksUpdated?: (tasks: Task[], requestTask: Task) => void;
  statuses: string[];
  isLoading: boolean;
  loadingMessage?: string | null;
  loadError?: Error | null;
  milestones: string[];
  availableLabels: string[];
  milestoneEntities: Milestone[];
  archivedMilestones: Milestone[];
  laneMode: LaneMode;
  onLaneChange: (mode: LaneMode) => void;
  milestoneFilter?: string | null;
  filterAssignee?: string;
  filterLabels?: string[];
  filterPriority?: string;
  availablePriorities?: string[];
  filterType?: string;
  availableTypes?: string[];
  filterProject?: string;
  availableProjects?: string[];
  onFiltersChange?: (filters: { assignee: string; labels: string[]; priority: string; taskType: string; project: string }) => void;
  hideEmptyColumns?: boolean;
  dateFormat?: string;
}

const BOARD_FILTER_SELECT_CLASS =
  'min-w-[140px] h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200';

const BOARD_FILTER_BUTTON_CLASS =
  'h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg whitespace-nowrap transition-colors duration-200 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700';

const Board: React.FC<BoardProps> = ({
  onEditTask,
  onNewTask,
  highlightTaskId,
  tasks,
  onRefreshData,
  onTasksUpdated,
  statuses,
  isLoading,
  loadingMessage,
  loadError,
  availableLabels,
  milestoneEntities,
  archivedMilestones,
  laneMode,
  onLaneChange,
  milestoneFilter,
  filterAssignee = '',
  filterLabels = [],
  filterPriority = '',
  availablePriorities,
  filterType = '',
  availableTypes,
  filterProject = '',
  availableProjects,
  onFiltersChange,
  hideEmptyColumns = false,
  dateFormat,
}) => {
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [batchMoveStatus, setBatchMoveStatus] = useState<string>('');
  const [dragSourceStatus, setDragSourceStatus] = useState<string | null>(null);
  const [dragSourceLane, setDragSourceLane] = useState<string | null>(null);
  // Set one task after dragstart, never inside it: see handleColumnDragStart.
  const [hiddenColumnsRevealed, setHiddenColumnsRevealed] = useState(false);
  const revealHiddenColumnsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState<string | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
  const terminalStatus = getTerminalStatus(statuses);
  const priorityOptions = useMemo(
    () => [{ label: 'All priorities', value: '' }, ...getPriorityOptions(availablePriorities)],
    [availablePriorities]
  );
  const typeOptions = useMemo(() => getTaskTypeValues(availableTypes), [availableTypes]);
  const projectOptions = useMemo(() => getProjectValues(availableProjects), [availableProjects]);
  const archivedMilestoneIds = useMemo(
    () => collectArchivedMilestoneKeys(archivedMilestones, milestoneEntities),
    [archivedMilestones, milestoneEntities]
  );
  const milestoneAliasToCanonical = useMemo(() => {
    const aliasMap = new Map<string, string>();
    const activeTitleCounts = new Map<string, number>();
    const collectIdAliasKeys = (value: string): string[] => {
      const normalized = value.trim();
      const normalizedKey = normalized.toLowerCase();
      if (!normalizedKey) return [];
      const keys = new Set<string>([normalizedKey]);
      if (/^\d+$/.test(normalized)) {
        const numericAlias = String(Number.parseInt(normalized, 10));
        keys.add(numericAlias);
        keys.add(`m-${numericAlias}`);
        return Array.from(keys);
      }
      const idMatch = normalized.match(/^m-(\d+)$/i);
      if (idMatch?.[1]) {
        const numericAlias = String(Number.parseInt(idMatch[1], 10));
        keys.add(`m-${numericAlias}`);
        keys.add(numericAlias);
      }
      return Array.from(keys);
    };
    const reservedIdKeys = new Set<string>();
    for (const milestone of [...milestoneEntities, ...archivedMilestones]) {
      for (const key of collectIdAliasKeys(milestone.id)) {
        reservedIdKeys.add(key);
      }
    }
    const setAlias = (aliasKey: string, id: string, allowOverwrite: boolean) => {
      const existing = aliasMap.get(aliasKey);
      if (!existing) {
        aliasMap.set(aliasKey, id);
        return;
      }
      if (!allowOverwrite) {
        return;
      }
      const existingKey = existing.toLowerCase();
      const nextKey = id.toLowerCase();
      const preferredRawId = /^\d+$/.test(aliasKey) ? `m-${aliasKey}` : /^m-\d+$/.test(aliasKey) ? aliasKey : null;
      if (preferredRawId) {
        const existingIsPreferred = existingKey === preferredRawId;
        const nextIsPreferred = nextKey === preferredRawId;
        if (existingIsPreferred && !nextIsPreferred) {
          return;
        }
        if (nextIsPreferred && !existingIsPreferred) {
          aliasMap.set(aliasKey, id);
        }
        return;
      }
      aliasMap.set(aliasKey, id);
    };
    const addIdAliases = (id: string, options?: { allowOverwrite?: boolean }) => {
      const allowOverwrite = options?.allowOverwrite ?? true;
      const idKey = id.toLowerCase();
      setAlias(idKey, id, allowOverwrite);
      const idMatch = id.match(/^m-(\d+)$/i);
      if (!idMatch?.[1]) return;
      const numericAlias = String(Number.parseInt(idMatch[1], 10));
      const canonicalId = `m-${numericAlias}`;
      setAlias(canonicalId, id, allowOverwrite);
      setAlias(numericAlias, id, allowOverwrite);
    };
    for (const milestone of milestoneEntities) {
      const title = milestone.title.trim();
      if (!title) continue;
      const titleKey = title.toLowerCase();
      activeTitleCounts.set(titleKey, (activeTitleCounts.get(titleKey) ?? 0) + 1);
    }
    const activeTitleKeys = new Set(activeTitleCounts.keys());
    for (const milestone of milestoneEntities) {
      const id = milestone.id.trim();
      const title = milestone.title.trim();
      if (!id) continue;
      addIdAliases(id);
      if (title) {
        const titleKey = title.toLowerCase();
        if (!reservedIdKeys.has(titleKey) && activeTitleCounts.get(titleKey) === 1) {
          if (!aliasMap.has(titleKey)) {
            aliasMap.set(titleKey, id);
          }
        }
      }
    }
    const archivedTitleCounts = new Map<string, number>();
    for (const milestone of archivedMilestones) {
      const title = milestone.title.trim();
      if (!title) continue;
      const titleKey = title.toLowerCase();
      if (activeTitleKeys.has(titleKey)) {
        continue;
      }
      archivedTitleCounts.set(titleKey, (archivedTitleCounts.get(titleKey) ?? 0) + 1);
    }
    for (const milestone of archivedMilestones) {
      const id = milestone.id.trim();
      const title = milestone.title.trim();
      if (!id) continue;
      addIdAliases(id, { allowOverwrite: false });
      if (title) {
        const titleKey = title.toLowerCase();
        if (!activeTitleKeys.has(titleKey) && !reservedIdKeys.has(titleKey) && archivedTitleCounts.get(titleKey) === 1) {
          if (!aliasMap.has(titleKey)) {
            aliasMap.set(titleKey, id);
          }
        }
      }
    }
    return aliasMap;
  }, [milestoneEntities, archivedMilestones]);
  const canonicalizeMilestone = (value?: string | null): string => {
    const normalized = (value ?? "").trim();
    if (!normalized) return "";
    const key = normalized.toLowerCase();
    const direct = milestoneAliasToCanonical.get(key);
    if (direct) {
      return direct;
    }
    const idMatch = normalized.match(/^m-(\d+)$/i);
    if (idMatch?.[1]) {
      const numericAlias = String(Number.parseInt(idMatch[1], 10));
      return milestoneAliasToCanonical.get(`m-${numericAlias}`) ?? milestoneAliasToCanonical.get(numericAlias) ?? normalized;
    }
    if (/^\d+$/.test(normalized)) {
      const numericAlias = String(Number.parseInt(normalized, 10));
      return milestoneAliasToCanonical.get(`m-${numericAlias}`) ?? milestoneAliasToCanonical.get(numericAlias) ?? normalized;
    }
    return normalized;
  };
  const canonicalMilestoneFilter = canonicalizeMilestone(milestoneFilter);

  // Collect unique assignees and labels from all tasks for filter dropdowns
  const uniqueAssignees = useMemo(() => {
    const seen = new Set<string>();
    for (const task of tasks) {
      for (const a of task.assignee) {
        if (a.trim()) seen.add(a.trim());
      }
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const uniqueLabels = useMemo(
    () => collectAvailableLabels(tasks, availableLabels),
    [tasks, availableLabels]
  );

  const normalizedFilterLabels = useMemo(
    () => filterLabels.map(label => label.trim()).filter(label => label.length > 0),
    [filterLabels]
  );

  const hasActiveFilters =
    filterAssignee !== '' ||
    normalizedFilterLabels.length > 0 ||
    filterPriority !== '' ||
    filterType !== '' ||
    filterProject !== '';

  // Filter tasks by milestone when milestoneFilter is set, then apply assignee/label/priority filters
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (milestoneFilter) {
      result = result.filter(task => canonicalizeMilestone(task.milestone) === canonicalMilestoneFilter);
    }
    if (filterAssignee === '__unassigned__') {
      result = result.filter(task => !task.assignee || task.assignee.length === 0 || task.assignee.every(a => !a.trim()));
    } else if (filterAssignee) {
      result = result.filter(task => task.assignee.some(a => a.trim() === filterAssignee));
    }
    if (normalizedFilterLabels.length > 0) {
      const selectedLabels = new Set(labelsToLower(normalizedFilterLabels));
      result = result.filter(task => labelsToLower(task.labels).some(label => selectedLabels.has(label)));
    }
    if (filterPriority) {
      const normalizedFilterPriority = normalizePriorityValue(filterPriority);
      result = result.filter(task => normalizePriorityValue(task.priority) === normalizedFilterPriority);
    }
    if (filterType) {
      result = result.filter(task => matchesTaskTypeFilter(task.type, filterType));
    }
    if (filterProject) {
      result = result.filter(task => matchesProjectFilter(task.project, filterProject));
    }
    return result;
  }, [tasks, milestoneFilter, canonicalMilestoneFilter, milestoneAliasToCanonical, filterAssignee, normalizedFilterLabels, filterPriority, filterType, filterProject]);

  // Handle highlighting a task (opening its edit popup)
  useEffect(() => {
    if (highlightTaskId && tasks.length > 0) {
      const resolution = resolveTaskById(tasks, highlightTaskId);
      if (resolution.status === 'found') {
        const timer = setTimeout(() => {
          onEditTask(resolution.task);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightTaskId, tasks, onEditTask]);

  const clearSelection = React.useCallback(() => {
    setSelectedTaskIds([]);
    setSelectionAnchorId(null);
  }, []);

  const toggleTaskSelection = React.useCallback((taskId: string) => {
    setSelectedTaskIds((previous) =>
      previous.includes(taskId) ? previous.filter((id) => id !== taskId) : [...previous, taskId]
    );
    setSelectionAnchorId(taskId);
  }, []);

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

  const handleBatchMove = async (targetStatus: string) => {
    if (selectedTaskIds.length === 0 || !targetStatus) return;
    const taskIds = selectedTaskIds;
    clearSelection();
    setBatchMoveStatus('');
    try {
      const result = await apiClient.moveTasks({ taskIds, targetStatus });
      setUpdateError(
        result.failures.length > 0
          ? `Could not move ${result.failures.length} of ${taskIds.length} tasks. ${result.failures
              .map((failure) => `${failure.taskId}: ${failure.reason}`)
              .join(' ')}`
          : null
      );
      if (onRefreshData) await onRefreshData();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to move tasks');
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await apiClient.updateTask(taskId, updates);
      // Refresh data to reflect the changes
      if (onRefreshData) {
        await onRefreshData();
      }
      setUpdateError(null);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update task');
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

  const handleCleanupSuccess = async (movedCount: number) => {
    setShowCleanupModal(false);
    setCleanupSuccessMessage(`Successfully moved ${movedCount} task${movedCount !== 1 ? 's' : ''} to completed folder`);

    // Refresh data to reflect the changes
    if (onRefreshData) {
      await onRefreshData();
    }

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setCleanupSuccessMessage(null);
    }, 4000);
  };

  // Use all tasks for building lanes (so we can show/collapse other milestones)
  const lanes = useMemo(
    () => buildLanes(laneMode, tasks, milestoneEntities.map((milestone) => milestone.id), milestoneEntities, {
      archivedMilestoneIds,
      archivedMilestones,
    }),
    [laneMode, tasks, milestoneEntities, archivedMilestoneIds, archivedMilestones]
  );

  // Check if any tasks actually have milestones assigned
  const hasTasksWithMilestones = useMemo(() => {
    if (archivedMilestoneIds.length === 0) {
      return tasks.some(task => task.milestone && task.milestone.trim() !== '');
    }
    const archivedKeys = new Set(archivedMilestoneIds.map((value) => milestoneKey(value)));
    return tasks.some(task => {
      const key = milestoneKey(canonicalizeMilestone(task.milestone));
      return key.length > 0 && !archivedKeys.has(key);
    });
  }, [tasks, archivedMilestoneIds, milestoneAliasToCanonical]);

  // Use all tasks for lane grouping (for counts and visibility)
  const tasksByLane = useMemo(
    () => groupTasksByLaneAndStatus(laneMode, lanes, statuses, tasks, {
      archivedMilestoneIds,
      milestoneEntities,
      archivedMilestones,
    }),
    [laneMode, lanes, statuses, tasks, archivedMilestoneIds, milestoneEntities, archivedMilestones]
  );

  // Separate grouping for filtered display in columns
  const filteredTasksByLane = useMemo(
    () =>
      groupTasksByLaneAndStatus(laneMode, lanes, statuses, filteredTasks, {
        archivedMilestoneIds,
        milestoneEntities,
        archivedMilestones,
      }),
    [laneMode, lanes, statuses, filteredTasks, archivedMilestoneIds, milestoneEntities, archivedMilestones]
  );

  const displayTasksByLane = (milestoneFilter || hasActiveFilters) ? filteredTasksByLane : tasksByLane;
  const laneMetadataTasksByLane = hasActiveFilters ? filteredTasksByLane : tasksByLane;

  const getTasksForLane = (laneKey: string, status: string): Task[] => {
    const statusMap = displayTasksByLane.get(laneKey);
    if (!statusMap) {
      return [];
    }
    return statusMap.get(status) ?? [];
  };

  const laneTaskCount = (laneKey: string): number => {
    const statusMap = laneMetadataTasksByLane.get(laneKey);
    if (!statusMap) return 0;
    let count = 0;
    for (const list of statusMap.values()) {
      count += list.length;
    }
    return count;
  };

  const countDoneTasksInLane = (laneKey: string): number => {
    const statusMap = laneMetadataTasksByLane.get(laneKey);
    if (!statusMap) return 0;
    let count = 0;
    for (const [status, taskList] of statusMap) {
      if (status.toLowerCase().includes('done') || status.toLowerCase().includes('complete')) {
        count += taskList.length;
      }
    }
    return count;
  };

  const getLaneProgress = (laneKey: string): number => {
    const total = laneTaskCount(laneKey);
    if (total === 0) return 0;
    const done = countDoneTasksInLane(laneKey);
    return Math.round((done / total) * 100);
  };

  // Filter out empty lanes in milestone mode
  const visibleLanes = useMemo(() => {
    if (laneMode !== 'milestone') return lanes;
    return lanes.filter(l => laneTaskCount(l.key) > 0);
  }, [laneMode, lanes, laneMetadataTasksByLane]);

  // When hideEmptyColumns is on, filter out status columns with no tasks across all visible lanes.
  // While a task is being dragged we keep every column visible so empty statuses remain drop targets.
  const visibleStatuses = useMemo(() => {
    if (!hideEmptyColumns || hiddenColumnsRevealed) return statuses;
    return statuses.filter(status => {
      for (const statusMap of displayTasksByLane.values()) {
        if ((statusMap.get(status) ?? []).length > 0) return true;
      }
      return false;
    });
  }, [hideEmptyColumns, hiddenColumnsRevealed, statuses, displayTasksByLane]);

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

  // Determine if a lane should be collapsed (respects milestoneFilter)
  const isLaneCollapsed = (laneKey: string, laneMilestone?: string): boolean => {
    // If user manually toggled, respect that
    if (collapsedLanes[laneKey] !== undefined) {
      return collapsedLanes[laneKey];
    }
    // When filtering by milestone, collapse all other lanes by default
    if (milestoneFilter && canonicalizeMilestone(laneMilestone) !== canonicalMilestoneFilter) {
      return true;
    }
    return false;
  };

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

  // Dynamic layout using flexbox:
  // - Columns are flex items with equal growth (flex-1) to divide space evenly
  // - A minimum width keeps columns readable; beyond available space, container scrolls horizontally
  // - Works uniformly for any number of columns without per-count conditionals

  const selectionProps = {
    selectedTaskIds,
    selectionAnchorId,
    onToggleTaskSelection: toggleTaskSelection,
    onSelectTaskRange: selectTaskRange,
    onBatchMove: handleBatchMove,
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape already clears the selection for keyboard users.
    <div
      className="w-full"
      onClick={(event) => {
        if (selectedTaskIds.length > 0 && event.target === event.currentTarget) clearSelection();
      }}
    >
      {updateError && (
        <div className="mb-4 rounded-md bg-red-100 px-4 py-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200 transition-colors duration-200">
          {updateError}
        </div>
      )}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-200">Kanban Board</h2>
          <button
            className="inline-flex items-center px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
            onClick={onNewTask}
          >
            + New Task
          </button>
        </div>
        {selectedTaskIds.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 transition-colors duration-200"
            role="toolbar"
            aria-label="Task selection"
          >
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedTaskIds.length} selected
            </span>
            <label className="sr-only" htmlFor="batch-move-status">
              Move selected tasks to
            </label>
            <select
              id="batch-move-status"
              className={BOARD_FILTER_SELECT_CLASS}
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
              className={BOARD_FILTER_BUTTON_CLASS}
              disabled={!batchMoveStatus}
              onClick={() => handleBatchMove(batchMoveStatus)}
            >
              Move
            </button>
            <button type="button" className={BOARD_FILTER_BUTTON_CLASS} onClick={clearSelection}>
              Clear
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Board view controls">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800/50 transition-colors duration-200">
              <button
                type="button"
                onClick={() => onLaneChange('none')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  laneMode === 'none'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                All Tasks
              </button>
              <button
                type="button"
                onClick={() => onLaneChange('milestone')}
                disabled={!hasTasksWithMilestones}
                title={!hasTasksWithMilestones ? 'No tasks have milestones. Assign milestones to tasks first.' : 'Group tasks by milestone'}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  !hasTasksWithMilestones
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                    : laneMode === 'milestone'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Milestone
              </button>
            </div>
            {onFiltersChange && (
              <div className="flex flex-wrap items-center gap-3" aria-label="Board filters">
                <select
                  aria-label="Filter board by assignee"
                  value={filterAssignee}
                  onChange={e => onFiltersChange({ assignee: e.target.value, labels: normalizedFilterLabels, priority: filterPriority, taskType: filterType, project: filterProject })}
                  className={BOARD_FILTER_SELECT_CLASS}
                >
                  <option value="">All assignees</option>
                  <option value="__unassigned__">Unassigned</option>
                  {uniqueAssignees.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>

                <LabelFilterDropdown
                  availableLabels={uniqueLabels}
                  selectedLabels={normalizedFilterLabels}
                  onChange={labels => onFiltersChange({ assignee: filterAssignee, labels, priority: filterPriority, taskType: filterType, project: filterProject })}
                  menuId="board-labels-filter-menu"
                  className="min-w-[200px]"
                />

                <select
                  aria-label="Filter board by type"
                  value={filterType}
                  onChange={e => onFiltersChange({ assignee: filterAssignee, labels: normalizedFilterLabels, priority: filterPriority, taskType: e.target.value, project: filterProject })}
                  className={BOARD_FILTER_SELECT_CLASS}
                >
                  <option value="">All types</option>
                  {typeOptions.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                {projectOptions.length > 0 && (
                  <select
                    aria-label="Filter board by project"
                    value={filterProject}
                    onChange={e => onFiltersChange({ assignee: filterAssignee, labels: normalizedFilterLabels, priority: filterPriority, taskType: filterType, project: e.target.value })}
                    className={BOARD_FILTER_SELECT_CLASS}
                  >
                    <option value="">All projects</option>
                    {projectOptions.map(project => (
                      <option key={project} value={project}>{project}</option>
                    ))}
                  </select>
                )}

                <select
                  aria-label="Filter board by priority"
                  value={filterPriority}
                  onChange={e => onFiltersChange({ assignee: filterAssignee, labels: normalizedFilterLabels, priority: e.target.value, taskType: filterType, project: filterProject })}
                  className={BOARD_FILTER_SELECT_CLASS}
                >
                  {priorityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ assignee: '', labels: [], priority: '', taskType: '', project: '' })}
                    className={BOARD_FILTER_BUTTON_CLASS}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-800 dark:bg-red-900/20" role="alert">
          <p className="font-medium text-red-700 dark:text-red-300">Failed to load tasks</p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{loadError.message}</p>
          {onRefreshData && (
            <button
              type="button"
              onClick={() => void onRefreshData()}
              className="mt-4 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              Retry
            </button>
          )}
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-10 dark:border-gray-700 dark:bg-gray-800/30" role="status" aria-label="Loading tasks">
          <div className="mx-auto flex max-w-xl items-center justify-center gap-3 text-gray-600 dark:text-gray-300">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" aria-hidden="true" />
            {loadingMessage && <p>{loadingMessage}</p>}
          </div>
          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-3 gap-4" aria-hidden="true">
            {[0, 1, 2].map((column) => (
              <div key={column} className="h-24 animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-700/60" />
            ))}
          </div>
        </div>
      ) : laneMode === 'milestone' ? (
        <div className="space-y-6">
          {visibleLanes.map((lane) => {
            const taskCount = laneTaskCount(lane.key);
            const progress = getLaneProgress(lane.key);
            const isCollapsed = isLaneCollapsed(lane.key, lane.milestone);

            return (
              <div key={lane.key} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/20 overflow-hidden">
                {/* Lane header inside the box */}
                {shouldShowLaneHeaders && (
                  <button
                    type="button"
                    onClick={() => toggleLaneCollapse(lane.key)}
                    className={`w-full flex items-center justify-between gap-4 px-4 py-3 bg-gray-100/80 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 group ${!isCollapsed ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <svg
                        className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-200 truncate">
                        {getLaneLabel(lane)}
                      </h3>
                      <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors duration-200">
                        {taskCount}
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-8 text-right">
                        {progress}%
                      </span>
                    </div>
                  </button>
                )}

                {/* Lane content - columns */}
                {!isCollapsed && (
                  <div className="p-4">
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${visibleStatuses.length}, minmax(0, 1fr))` }}>
                      {visibleStatuses.map((status) => (
                        <div key={`${lane.key}-${status}`} className="min-w-0">
                          <TaskColumn
                            title={status}
                            tasks={getTasksForLane(lane.key, status)}
                            onTaskUpdate={handleTaskUpdate}
                            onEditTask={onEditTask}
                            onTaskReorder={handleTaskReorder}
                            dragSourceStatus={dragSourceStatus}
                            dragSourceLane={dragSourceLane}
                            laneId={lane.key}
                            targetMilestone={lane.milestone ?? null}
                            priorityOrder={availablePriorities}
                            availableTypes={typeOptions}
                            availableProjects={projectOptions}
                            dateFormat={dateFormat}
                            onDragStart={handleColumnDragStart}
                            onDragEnd={handleColumnDragEnd}
                            onCleanup={status === terminalStatus ? () => setShowCleanupModal(true) : undefined}
                            {...selectionProps}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex flex-row flex-nowrap gap-4 w-full">
            {visibleStatuses.map((status) => (
              <div key={status} className="flex-1 min-w-[16rem]">
                <TaskColumn
                  title={status}
                  tasks={getTasksForLane(DEFAULT_LANE_KEY, status)}
                  onTaskUpdate={handleTaskUpdate}
                  onEditTask={onEditTask}
                  onTaskReorder={handleTaskReorder}
                  dragSourceStatus={dragSourceStatus}
                  dragSourceLane={dragSourceLane}
                  laneId={DEFAULT_LANE_KEY}
                  priorityOrder={availablePriorities}
                  availableTypes={typeOptions}
                  availableProjects={projectOptions}
                  dateFormat={dateFormat}
                  onDragStart={handleColumnDragStart}
                  onDragEnd={handleColumnDragEnd}
                  onCleanup={status === terminalStatus ? () => setShowCleanupModal(true) : undefined}
                  {...selectionProps}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cleanup Modal */}
      <CleanupModal
        isOpen={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
        onSuccess={handleCleanupSuccess}
        dateFormat={dateFormat}
      />

      {/* Cleanup Success Toast */}
      {cleanupSuccessMessage && (
        <SuccessToast
          message={cleanupSuccessMessage}
          onDismiss={() => setCleanupSuccessMessage(null)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      )}
    </div>
  );
};

export default Board;
