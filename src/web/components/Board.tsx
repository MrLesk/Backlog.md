import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Milestone, type Task } from '../../types';
import { apiClient, type ReorderTaskPayload } from '../lib/api';
import { buildLanes, DEFAULT_LANE_KEY, groupTasksByLaneAndStatus, type LaneMode } from '../lib/lanes';
import { collectAvailableLabels, labelsToLower } from '../../utils/label-filter';
import { collectArchivedMilestoneKeys, milestoneKey } from '../utils/milestones';
import { getTerminalStatus } from '../../utils/terminal-status';
import { getPriorityOptions, normalizePriorityValue } from '../../utils/priority-config';
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
  statuses: string[];
  isLoading: boolean;
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
  onFiltersChange?: (filters: { assignee: string; labels: string[]; priority: string; taskType: string }) => void;
  hideEmptyColumns?: boolean;
  onToggleHideEmptyColumns?: () => void;
  dateFormat?: string;
}

const BOARD_FILTER_SELECT_CLASS =
  'min-w-[140px] h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200';

// Colors are split out because Tailwind resolves conflicting utilities by stylesheet
// order, not class order: appending an active color on top of a default one is a coin
// flip. Pick one full set instead of layering them.
const BOARD_FILTER_BUTTON_BASE_CLASS =
  'h-10 py-2 px-3 text-sm border rounded-lg whitespace-nowrap transition-colors duration-200';

const BOARD_FILTER_BUTTON_CLASS =
  `${BOARD_FILTER_BUTTON_BASE_CLASS} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700`;

const BOARD_FILTER_BUTTON_ACTIVE_CLASS =
  `${BOARD_FILTER_BUTTON_BASE_CLASS} border-stone-700 dark:border-stone-600 text-white bg-stone-700 dark:bg-stone-600 hover:bg-stone-800 dark:hover:bg-stone-500`;

// Horizontal auto-scroll while dragging a card near the board edges.
const EDGE_AUTO_SCROLL_ZONE = 64; // px from an edge that starts auto-scroll
const EDGE_AUTO_SCROLL_SPEED = 20; // px moved per animation frame

const Board: React.FC<BoardProps> = ({
  onEditTask,
  onNewTask,
  highlightTaskId,
  tasks,
  onRefreshData,
  statuses,
  isLoading,
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
  onFiltersChange,
  hideEmptyColumns = false,
  onToggleHideEmptyColumns,
  dateFormat,
}) => {
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [dragSourceStatus, setDragSourceStatus] = useState<string | null>(null);
  const [dragSourceLane, setDragSourceLane] = useState<string | null>(null);
  // Deferred flag that re-shows hidden empty columns during a drag. It is set
  // one task after dragstart (see handleColumnDragStart) so the board layout is
  // not mutated synchronously with dragstart, which would cancel the native drag.
  const [dragActive, setDragActive] = useState(false);
  const dragExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Where the dragged column sat in the viewport before hidden columns expanded.
  const dragAnchor = useRef<{ status: string; viewportLeft: number } | null>(null);
  const autoScrollFrame = useRef<number | null>(null);
  const autoScrollDir = useRef<-1 | 0 | 1>(0);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState<string | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
  const terminalStatus = getTerminalStatus(statuses);
  const priorityOptions = useMemo(
    () => [{ label: 'All priorities', value: '' }, ...getPriorityOptions(availablePriorities)],
    [availablePriorities]
  );
  const typeOptions = useMemo(() => getTaskTypeValues(availableTypes), [availableTypes]);
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
    filterAssignee !== '' || normalizedFilterLabels.length > 0 || filterPriority !== '' || filterType !== '';

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
    return result;
  }, [tasks, milestoneFilter, canonicalMilestoneFilter, milestoneAliasToCanonical, filterAssignee, normalizedFilterLabels, filterPriority, filterType]);

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
      await apiClient.reorderTask(payload);
      // Refresh data to reflect the changes
      if (onRefreshData) {
        await onRefreshData();
      }
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
    if (!hideEmptyColumns || dragActive) return statuses;
    return statuses.filter(status => {
      for (const statusMap of displayTasksByLane.values()) {
        if ((statusMap.get(status) ?? []).length > 0) return true;
      }
      return false;
    });
  }, [hideEmptyColumns, dragActive, statuses, displayTasksByLane]);

  const findStatusColumn = (status: string): HTMLElement | null => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    for (const el of container.querySelectorAll<HTMLElement>('[data-status]')) {
      if (el.dataset.status === status) return el;
    }
    return null;
  };

  const stopAutoScroll = () => {
    if (autoScrollFrame.current !== null) {
      cancelAnimationFrame(autoScrollFrame.current);
      autoScrollFrame.current = null;
    }
    autoScrollDir.current = 0;
  };

  const stepAutoScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || autoScrollDir.current === 0) {
      autoScrollFrame.current = null;
      return;
    }
    container.scrollLeft += autoScrollDir.current * EDGE_AUTO_SCROLL_SPEED;
    autoScrollFrame.current = requestAnimationFrame(stepAutoScroll);
  };

  // While dragging, scroll the board horizontally when the cursor nears an edge
  // so off-screen columns become reachable (native DnD does not auto-scroll).
  const handleBoardDragOver = (e: React.DragEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    let dir: -1 | 0 | 1 = 0;
    if (e.clientX <= rect.left + EDGE_AUTO_SCROLL_ZONE) dir = -1;
    else if (e.clientX >= rect.right - EDGE_AUTO_SCROLL_ZONE) dir = 1;
    autoScrollDir.current = dir;
    if (dir !== 0) {
      if (autoScrollFrame.current === null) autoScrollFrame.current = requestAnimationFrame(stepAutoScroll);
    } else {
      stopAutoScroll();
    }
  };

  const handleColumnDragStart = ({ status, laneId }: { status: string; laneId?: string | null }) => {
    setDragSourceStatus(status);
    setDragSourceLane(laneId ?? null);
    // Remember where the dragged column sits so we can keep it in place once the
    // hidden columns expand (they are inserted to its left, shifting it away).
    const container = scrollContainerRef.current;
    const col = findStatusColumn(status);
    dragAnchor.current =
      container && col
        ? { status, viewportLeft: col.getBoundingClientRect().left - container.getBoundingClientRect().left }
        : null;
    // Re-show hidden empty columns on the next task, not synchronously here:
    // mutating the board layout during dragstart cancels the native drag.
    if (dragExpandTimer.current !== null) clearTimeout(dragExpandTimer.current);
    dragExpandTimer.current = setTimeout(() => {
      dragExpandTimer.current = null;
      setDragActive(true);
    }, 0);
  };

  const handleColumnDragEnd = () => {
    if (dragExpandTimer.current !== null) {
      clearTimeout(dragExpandTimer.current);
      dragExpandTimer.current = null;
    }
    stopAutoScroll();
    dragAnchor.current = null;
    setDragSourceStatus(null);
    setDragSourceLane(null);
    setDragActive(false);
  };

  // After hidden columns expand, restore scroll so the dragged column stays put.
  useLayoutEffect(() => {
    if (!dragActive) return;
    const anchor = dragAnchor.current;
    const container = scrollContainerRef.current;
    if (!anchor || !container) return;
    const col = findStatusColumn(anchor.status);
    if (!col) return;
    const newViewportLeft = col.getBoundingClientRect().left - container.getBoundingClientRect().left;
    container.scrollLeft += newViewportLeft - anchor.viewportLeft;
  }, [dragActive]);

  useEffect(() => () => {
    if (dragExpandTimer.current !== null) clearTimeout(dragExpandTimer.current);
    if (autoScrollFrame.current !== null) cancelAnimationFrame(autoScrollFrame.current);
  }, []);

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

  if (isLoading && statuses.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg text-gray-600 dark:text-gray-300 transition-colors duration-200">Loading tasks...</div>
      </div>
    );
  }

  // Dynamic layout using flexbox:
  // - Columns are flex items with equal growth (flex-1) to divide space evenly
  // - A minimum width keeps columns readable; beyond available space, container scrolls horizontally
  // - Works uniformly for any number of columns without per-count conditionals

  return (
    <div className="w-full">
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
            {onToggleHideEmptyColumns && (
              <button
                type="button"
                onClick={onToggleHideEmptyColumns}
                aria-pressed={hideEmptyColumns}
                title={hideEmptyColumns ? 'Show empty columns' : 'Hide empty columns'}
                className={hideEmptyColumns ? BOARD_FILTER_BUTTON_ACTIVE_CLASS : BOARD_FILTER_BUTTON_CLASS}
              >
                {hideEmptyColumns ? 'Show empty columns' : 'Hide empty columns'}
              </button>
            )}
            {onFiltersChange && (
              <div className="flex flex-wrap items-center gap-3" aria-label="Board filters">
                <select
                  aria-label="Filter board by assignee"
                  value={filterAssignee}
                  onChange={e => onFiltersChange({ assignee: e.target.value, labels: normalizedFilterLabels, priority: filterPriority, taskType: filterType })}
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
                  onChange={labels => onFiltersChange({ assignee: filterAssignee, labels, priority: filterPriority, taskType: filterType })}
                  menuId="board-labels-filter-menu"
                  className="min-w-[200px]"
                />

                <select
                  aria-label="Filter board by type"
                  value={filterType}
                  onChange={e => onFiltersChange({ assignee: filterAssignee, labels: normalizedFilterLabels, priority: filterPriority, taskType: e.target.value })}
                  className={BOARD_FILTER_SELECT_CLASS}
                >
                  <option value="">All types</option>
                  {typeOptions.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                <select
                  aria-label="Filter board by priority"
                  value={filterPriority}
                  onChange={e => onFiltersChange({ assignee: filterAssignee, labels: normalizedFilterLabels, priority: e.target.value, taskType: filterType })}
                  className={BOARD_FILTER_SELECT_CLASS}
                >
                  {priorityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ assignee: '', labels: [], priority: '', taskType: '' })}
                    className={BOARD_FILTER_BUTTON_CLASS}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {laneMode === 'milestone' ? (
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
                            onDragStart={handleColumnDragStart}
                            onDragEnd={handleColumnDragEnd}
                            onCleanup={status === terminalStatus ? () => setShowCleanupModal(true) : undefined}
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
        <div ref={scrollContainerRef} onDragOver={handleBoardDragOver} className="overflow-x-auto pb-2">
          <div className="flex flex-row flex-nowrap gap-4 w-full">
            {visibleStatuses.map((status) => (
              <div key={status} data-status={status} className="flex-1 min-w-[16rem]">
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
                  onDragStart={handleColumnDragStart}
                  onDragEnd={handleColumnDragEnd}
                  onCleanup={status === terminalStatus ? () => setShowCleanupModal(true) : undefined}
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
