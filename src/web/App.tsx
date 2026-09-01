import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import BoardPage from './components/BoardPage';
import DocumentationDetail from './components/DocumentationDetail';
import DecisionDetail from './components/DecisionDetail';
import TaskList from './components/TaskList';
import DraftsList from './components/DraftsList';
import Settings from './components/Settings';
import Statistics from './components/Statistics';
import MilestonesPage from './components/MilestonesPage';
import TaskDetailsModal from './components/TaskDetailsModal';
import InitializationScreen from './components/InitializationScreen';
import LoadingSpinner from './components/LoadingSpinner';
import { SuccessToast } from './components/SuccessToast';
import { ThemeProvider } from './contexts/ThemeContext';
import { TaskIdIndexProvider } from './contexts/TaskIdIndexContext';
import {
	type Decision,
	type DecisionSearchResult,
	type Document,
	type DocumentSearchResult,
	type BacklogConfig,
	type Milestone,
	type SearchResult,
	type Task,
	type TaskSearchResult,
} from '../types';
import { ApiError, apiClient } from './lib/api';
import type { TaskDetail } from '../core/task-detail';
import { type SyncedTaskRecord, syncOpenTaskDetail } from './utils/task-detail-sync';
import type { DuplicateRepairPlan } from '../core/duplicate-task-repair';
import { isValidTaskId } from '../utils/task-id';
import { useHealthCheckContext } from './contexts/HealthCheckContext';
import { getWebVersion } from './utils/version';
import { collectArchivedMilestoneKeys, collectMilestoneIds, milestoneKey } from './utils/milestones';
import { getProjectValues } from '../utils/project-config';
import { getTaskTypeValues } from '../utils/task-type-config';
import { createUrlPath } from './utils/urlHelpers';
import { filterKanbanTasks } from './utils/kanban-tasks';
import { reconcileById } from './utils/reconcile';
import { parseBrowserLoadingState } from '../utils/browser-loading-state';

type TaskRouteNavigationState = {
  taskModalFrom?: string;
  taskRouteError?: string;
};

const getTaskRouteNavigationState = (value: unknown): TaskRouteNavigationState => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as TaskRouteNavigationState;
};

const buildMilestoneAliasMap = (milestones: Milestone[], archivedMilestones: Milestone[]): Map<string, string> => {
  const aliasMap = new Map<string, string>();
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
  for (const milestone of [...milestones, ...archivedMilestones]) {
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
  const addIdAliases = (id: string, allowOverwrite = true) => {
    const idKey = id.toLowerCase();
    setAlias(idKey, id, allowOverwrite);
    const idMatch = id.match(/^m-(\d+)$/i);
    if (!idMatch?.[1]) return;
    const numericAlias = String(Number.parseInt(idMatch[1], 10));
    const canonicalId = `m-${numericAlias}`;
    setAlias(canonicalId, id, allowOverwrite);
    setAlias(numericAlias, id, allowOverwrite);
  };
  const activeTitleCounts = new Map<string, number>();
  for (const milestone of milestones) {
    const title = milestone.title.trim();
    if (!title) continue;
    const titleKey = title.toLowerCase();
    activeTitleCounts.set(titleKey, (activeTitleCounts.get(titleKey) ?? 0) + 1);
  }
  const activeTitleKeys = new Set(activeTitleCounts.keys());

  for (const milestone of milestones) {
    const id = milestone.id.trim();
    const title = milestone.title.trim();
    if (!id) continue;
    addIdAliases(id);
    if (title && !reservedIdKeys.has(title.toLowerCase()) && activeTitleCounts.get(title.toLowerCase()) === 1) {
      const titleKey = title.toLowerCase();
      if (!aliasMap.has(titleKey)) {
        aliasMap.set(titleKey, id);
      }
    }
  }

  const archivedTitleCounts = new Map<string, number>();
  for (const milestone of archivedMilestones) {
    const title = milestone.title.trim();
    if (!title) continue;
    const titleKey = title.toLowerCase();
    if (activeTitleKeys.has(titleKey)) continue;
    archivedTitleCounts.set(titleKey, (archivedTitleCounts.get(titleKey) ?? 0) + 1);
  }
  for (const milestone of archivedMilestones) {
    const id = milestone.id.trim();
    const title = milestone.title.trim();
    if (!id) continue;
    addIdAliases(id, false);
    const titleKey = title.toLowerCase();
    if (
      title &&
      !activeTitleKeys.has(titleKey) &&
      !reservedIdKeys.has(titleKey) &&
      archivedTitleCounts.get(titleKey) === 1
    ) {
      if (!aliasMap.has(titleKey)) {
        aliasMap.set(titleKey, id);
      }
    }
  }
  return aliasMap;
};

const canonicalizeMilestone = (value: string | null | undefined, aliasMap?: Map<string, string>): string => {
  const normalized = (value ?? '').trim();
  if (!normalized) return '';
  const direct = aliasMap?.get(milestoneKey(normalized));
  if (direct) {
    return direct;
  }
  const idMatch = normalized.match(/^m-(\d+)$/i);
  if (idMatch?.[1]) {
    const numericAlias = String(Number.parseInt(idMatch[1], 10));
    return aliasMap?.get(`m-${numericAlias}`) ?? aliasMap?.get(numericAlias) ?? normalized;
  }
  if (/^\d+$/.test(normalized)) {
    const numericAlias = String(Number.parseInt(normalized, 10));
    return aliasMap?.get(`m-${numericAlias}`) ?? aliasMap?.get(numericAlias) ?? normalized;
  }
  return normalized;
};

function AppContent() {
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | TaskDetail | null>(null);
  // The list record the open task was last synced from, so re-syncing cannot loop.
  // The list record last folded into the open modal, with the readiness inputs it was read
  // against, so a dependency that changes out of band is noticed even though this task's own
  // record did not move.
  const syncedTaskRecordRef = useRef<SyncedTaskRecord | null>(null);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [config, setConfig] = useState<BacklogConfig | null>(null);
  const availableTypes = React.useMemo(() => getTaskTypeValues(config), [config]);
  const availableProjects = React.useMemo(() => getProjectValues(config), [config]);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [milestoneEntities, setMilestoneEntities] = useState<Milestone[]>([]);
  const [archivedMilestones, setArchivedMilestones] = useState<Milestone[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [taskConfirmation, setTaskConfirmation] = useState<{task: Task, isDraft: boolean} | null>(null);
  
  // Initialization state
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  
  // Centralized data state
  const [tasks, setTasks] = useState<Task[]>([]);
  const kanbanTasks = React.useMemo(() => filterKanbanTasks(tasks), [tasks]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  // Mirrors of the store lists, so refreshes can reconcile in place without
  // resubscribing the WebSocket effect to every state change.
  const tasksRef = useRef<Task[]>([]);
  const docsRef = useRef<Document[]>([]);
  const decisionsRef = useRef<Decision[]>([]);
  const milestoneEntitiesRef = useRef<Milestone[]>([]);
  const archivedMilestonesRef = useRef<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [duplicateRepairPlan, setDuplicateRepairPlan] = useState<DuplicateRepairPlan | null>(null);
  
  const { isOnline } = useHealthCheckContext();
  const previousOnlineRef = useRef<boolean | null>(null);
  const hasBeenRunningRef = useRef(false);
  const loadAllDataRequestRef = useRef(0);
  const hasLoadedDataRef = useRef(false);
  const pendingDataRequestRef = useRef<number | null>(null);
  // Scope of the in-flight data request (only meaningful while
  // pendingDataRequestRef is set): 0 tasks, 1 with milestones, 2 full load. A
  // newer, narrower refresh supersedes the in-flight request through the shared
  // counter, so it must adopt at least this scope or the wider data is lost.
  const pendingScopeRankRef = useRef(0);
  const loadErrorRef = useRef<Error | null>(null);
  const duplicateRepairPlanRef = useRef<DuplicateRepairPlan | null>(null);
  const protocolOnlyLoadingRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const tasksRouteWithTitle = useMatch('/tasks/:id/:title');
  const tasksRoute = useMatch('/tasks/:id');
  const boardRouteWithTitle = useMatch('/board/:id/:title');
  const boardRoute = useMatch('/board/:id');
  const taskRouteRequestRef = useRef(0);
  const isTaskRouteModalRef = useRef(false);
  const taskRouteAlertRef = useRef<HTMLDivElement | null>(null);
  const routeTaskId =
    tasksRouteWithTitle?.params.id ??
    tasksRoute?.params.id ??
    boardRouteWithTitle?.params.id ??
    boardRoute?.params.id;
  const routeBasePath = tasksRouteWithTitle || tasksRoute ? '/tasks' : boardRouteWithTitle || boardRoute ? '/board' : null;
  const routeNavigationState = getTaskRouteNavigationState(location.state);
  const taskRouteError = routeNavigationState.taskRouteError;

  // Set version data attribute on body
  React.useEffect(() => {
    getWebVersion().then(version => {
      if (version) {
        document.body.setAttribute('data-version', `Backlog.md - v${version}`);
      }
    });
  }, []);

  // Check initialization status on mount
  React.useEffect(() => {
    const checkInitStatus = async () => {
      try {
        const status = await apiClient.checkStatus();
        setIsInitialized(status.initialized);
      } catch (error) {
        // If we can't check status, assume not initialized
        console.error('Failed to check initialization status:', error);
        setIsInitialized(false);
      }
    };
    checkInitStatus();
  }, []);

  const handleInitialized = useCallback(() => {
    setIsInitialized(true);
  }, []);

  const applySearchResults = useCallback((
    results: SearchResult[],
    archivedMilestoneKeys?: Set<string>,
    milestoneAliases?: Map<string, string>,
  ) => {
    const taskResults = results.filter((result): result is TaskSearchResult => result.type === 'task');
    const documentResults = results.filter((result): result is DocumentSearchResult => result.type === 'document');
    const decisionResults = results.filter((result): result is DecisionSearchResult => result.type === 'decision');

    const tasksList = taskResults.map((result) => result.task);
    const normalizedTasks =
      archivedMilestoneKeys && archivedMilestoneKeys.size > 0
        ? tasksList.map((task) => {
            const canonicalMilestone = canonicalizeMilestone(task.milestone, milestoneAliases);
            const key = milestoneKey(canonicalMilestone);
            if (!key || !archivedMilestoneKeys.has(key)) {
              if (task.milestone === canonicalMilestone) {
                return task;
              }
              return { ...task, milestone: canonicalMilestone || undefined };
            }
            return { ...task, milestone: undefined };
          })
        : tasksList.map((task) => {
            const canonicalMilestone = canonicalizeMilestone(task.milestone, milestoneAliases);
            if (task.milestone === canonicalMilestone) {
              return task;
            }
            return { ...task, milestone: canonicalMilestone || undefined };
          });
    const docsList = documentResults.map((result) => result.document);
    const decisionsList = decisionResults.map((result) => result.decision);

    // Reconcile instead of replacing: unchanged records keep their identity, so
    // views re-render only for real changes and a refresh that merely echoes an
    // already-applied update (e.g. after a surgical drag update) is a no-op.
    const nextTasks = reconcileById(tasksRef.current, normalizedTasks);
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    const nextDocs = reconcileById(docsRef.current, docsList);
    docsRef.current = nextDocs;
    setDocs(nextDocs);
    const nextDecisions = reconcileById(decisionsRef.current, decisionsList);
    decisionsRef.current = nextDecisions;
    setDecisions(nextDecisions);

    return { tasks: nextTasks };
  }, []);

  const applyMilestoneIds = useCallback((next: string[]) => {
    setMilestones((current) =>
      next.length === current.length && next.every((id, index) => id === current[index]) ? current : next,
    );
  }, []);

  const applyLoadError = useCallback((error: Error | null) => {
    loadErrorRef.current = error;
    setLoadError(error);
  }, []);

  const applyDuplicateRepairPlan = useCallback((plan: DuplicateRepairPlan | null) => {
    duplicateRepairPlanRef.current = plan;
    setDuplicateRepairPlan(plan);
  }, []);

  const loadAllData = useCallback(async () => {
    const requestId = loadAllDataRequestRef.current + 1;
    loadAllDataRequestRef.current = requestId;
	protocolOnlyLoadingRef.current = false;
		pendingDataRequestRef.current = requestId;
		pendingScopeRankRef.current = 2;
		try {
			// Show the blocking skeleton only before the first successful load; later
			// refreshes keep the current content on screen and update it in place.
			if (!hasLoadedDataRef.current) setIsLoading(true);
			applyLoadError(null);
      const shellDataPromise = Promise.all([
        apiClient.fetchStatuses(),
        apiClient.fetchConfig(),
        apiClient.fetchMilestones(),
        apiClient.fetchArchivedMilestones(),
      ]);
      const searchResultsPromise = apiClient.search();
      void searchResultsPromise.catch(() => {});

      const [statusesData, configData, milestonesData, archivedMilestonesData] = await shellDataPromise;

      if (loadAllDataRequestRef.current !== requestId) {
        return;
      }

      setStatuses(statusesData);
      setProjectName(configData.projectName);
      setAvailableLabels(configData.labels || []);
      setConfig(configData);
      milestoneEntitiesRef.current = milestonesData;
      archivedMilestonesRef.current = archivedMilestonesData;
      setMilestoneEntities(milestonesData);
      setArchivedMilestones(archivedMilestonesData);

      const searchResults = await searchResultsPromise;

      if (loadAllDataRequestRef.current !== requestId) {
        return;
      }

      const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestonesData, milestonesData));
      const milestoneAliases = buildMilestoneAliasMap(milestonesData, archivedMilestonesData);
      const { tasks: tasksList } = applySearchResults(searchResults, archivedKeys, milestoneAliases);
      hasLoadedDataRef.current = true;

      applyMilestoneIds(
        collectMilestoneIds(tasksList, milestonesData, archivedMilestonesData).filter(
          (milestone) => !archivedKeys.has(milestoneKey(milestone)),
        ),
      );
      void apiClient.fetchDuplicateTaskRepairPlan().then((duplicatePlan) => {
        if (loadAllDataRequestRef.current === requestId) applyDuplicateRepairPlan(duplicatePlan);
      }).catch(() => {
        if (loadAllDataRequestRef.current === requestId) applyDuplicateRepairPlan(null);
      });
    } catch (error) {
      if (loadAllDataRequestRef.current === requestId) {
        console.error('Failed to load data:', error);
        applyLoadError(error instanceof Error ? error : new Error('Failed to load data'));
      }
    } finally {
      if (loadAllDataRequestRef.current === requestId) {
				pendingDataRequestRef.current = null;
        setIsLoading(false);
        setLoadingMessage(null);
      }
    }
  }, [applySearchResults, applyMilestoneIds, applyLoadError, applyDuplicateRepairPlan]);

  React.useEffect(() => {
    // Only load data when initialized
    if (isInitialized === true) {
      loadAllData();
    }
  }, [loadAllData, isInitialized]);

  // Reload data when connection is restored
  React.useEffect(() => {
    if (isOnline && previousOnlineRef.current === false) {
      void loadAllData();
    }
  }, [isOnline, loadAllData]);

  // Update document title when project name changes
  React.useEffect(() => {
    if (projectName) {
      document.title = `${projectName} - Task Management`;
    }
  }, [projectName]);

  // Mark that we've been running after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      hasBeenRunningRef.current = true;
    }, 2000); // Wait 2 seconds after page load
    return () => clearTimeout(timer);
  }, []);

  // Show success toast when connection is restored
  useEffect(() => {
    // Only show toast if:
    // 1. We went from offline to online AND
    // 2. We've been running for a while (not initial page load)
    if (isOnline && previousOnlineRef.current === false && hasBeenRunningRef.current) {
      setShowSuccessToast(true);
      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
    
    // Update the ref for next time
    previousOnlineRef.current = isOnline;
  }, [isOnline]);

  const handleNewTask = () => {
    setEditingTask(null);
    setIsDraftMode(false);
    setShowModal(true);
  };

  const handleNewDraft = () => {
    // Create a draft task (same as new task but with status 'Draft')
    setEditingTask(null);
    setIsDraftMode(true);
    setShowModal(true);
  };

  const openTaskModal = useCallback((task: Task) => {
    setEditingTask(task);
    setIsDraftMode(false);
    setShowModal(true);
  }, []);

  const openDraftModal = useCallback((draft: Task) => {
    setEditingTask(draft);
    setIsDraftMode(true);
    setShowModal(true);
  }, []);

  const clearTaskModal = useCallback(() => {
    isTaskRouteModalRef.current = false;
    setShowModal(false);
    setEditingTask(null);
    setIsDraftMode(false);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    const basePath =
      location.pathname.startsWith('/board')
        ? '/board'
        : location.pathname.startsWith('/tasks')
          ? '/tasks'
          : null;

    if (!basePath) {
      // Pages without a task route (milestones, statistics) open the modal directly, so they must
      // read the detail themselves. Otherwise they would show the compact list record, silently
      // without its dependency graph, while the board and the task list show the full detail.
      openTaskModal(task);
      void apiClient
        .fetchTask(task.id)
        // Upgrade in place, so a modal the reader already closed is never reopened.
        .then((detail) => setEditingTask((current) => (current && current.id === detail.id ? detail : current)))
        .catch(() => {});
      return;
    }

    const returnPath = `${basePath}${location.search}`;
    const isReplacingTaskRoute = routeBasePath === basePath && Boolean(routeTaskId);
    const taskModalFrom = isReplacingTaskRoute ? routeNavigationState.taskModalFrom : returnPath;
    navigate(`${createUrlPath(basePath, task.id, task.title)}${location.search}`, {
      replace: isReplacingTaskRoute,
      state: taskModalFrom ? ({ taskModalFrom } satisfies TaskRouteNavigationState) : undefined,
    });
  }, [
    location.pathname,
    location.search,
    navigate,
    openTaskModal,
    routeBasePath,
    routeNavigationState.taskModalFrom,
    routeTaskId,
  ]);

  const handleCloseModal = () => {
    clearTaskModal();
    if (routeBasePath && routeTaskId) {
      if (routeNavigationState.taskModalFrom) {
        navigate(-1);
      } else {
        navigate(`${routeBasePath}${location.search}`, { replace: true });
      }
    }
  };

  useEffect(() => {
    const requestId = taskRouteRequestRef.current + 1;
    taskRouteRequestRef.current = requestId;

    if (!routeTaskId || !routeBasePath || isInitialized !== true) {
      if (!routeTaskId && isTaskRouteModalRef.current) {
        clearTaskModal();
      }
      return;
    }

    if (!isValidTaskId(routeTaskId)) {
      clearTaskModal();
      navigate(`${routeBasePath}${location.search}`, {
        replace: true,
        state: { taskRouteError: `"${routeTaskId}" is not a valid task ID.` } satisfies TaskRouteNavigationState,
      });
      return;
    }

    const loadTaskFromRoute = async () => {
      try {
        const task = await apiClient.fetchTask(routeTaskId);
        if (taskRouteRequestRef.current !== requestId) {
          return;
        }
        isTaskRouteModalRef.current = true;
        openTaskModal(task);
      } catch (error) {
        if (taskRouteRequestRef.current !== requestId) {
          return;
        }

        clearTaskModal();
        const message =
          error instanceof ApiError && error.status === 409
            ? `Task "${routeTaskId}" is ambiguous. Repair duplicate task IDs before opening this link.`
            : error instanceof ApiError && error.status === 400
              ? `"${routeTaskId}" is not a valid task ID.`
              : error instanceof ApiError && error.status === 404
                ? `Task "${routeTaskId}" was not found.`
                : `Task "${routeTaskId}" could not be opened. Try again.`;
        navigate(`${routeBasePath}${location.search}`, {
          replace: true,
          state: { taskRouteError: message } satisfies TaskRouteNavigationState,
        });
      }
    };

    void loadTaskFromRoute();

    return () => {
      if (taskRouteRequestRef.current === requestId) {
        taskRouteRequestRef.current += 1;
      }
    };
  }, [clearTaskModal, isInitialized, location.search, navigate, openTaskModal, routeBasePath, routeTaskId]);

  useEffect(() => {
    if (taskRouteError) {
      taskRouteAlertRef.current?.focus();
    }
  }, [taskRouteError]);

  // Incremental refresh: the single-card reorder path's surgical store update,
  // generalized. Refetches only the search corpus (plus milestone entities when
  // the change was milestone-scoped) and reconciles it into the store in place;
  // statuses and config have their own "config-updated" broadcast, and the
  // duplicate repair plan (a filesystem rescan) refreshes in the background only
  // when it could have changed. Anything that cannot be applied incrementally
  // falls back to the full load.
  const refreshTasksData = useCallback(async (includeMilestones: boolean) => {
    // A never-completed or failed load leaves state an incremental refresh
    // cannot patch (the failed resources would never be requested again), so
    // both cases go through the full loader.
    if (!hasLoadedDataRef.current || loadErrorRef.current) {
      await loadAllData();
      return;
    }
    // Superseding an in-flight request discards its responses through the
    // shared counter, so this refresh must adopt at least that request's scope
    // or a concurrent config/milestone reload would be lost.
    const supersededRank = pendingDataRequestRef.current !== null ? pendingScopeRankRef.current : -1;
    if (supersededRank >= 2) {
      await loadAllData();
      return;
    }
    const withMilestones = includeMilestones || supersededRank >= 1;
    const requestId = loadAllDataRequestRef.current + 1;
    loadAllDataRequestRef.current = requestId;
    protocolOnlyLoadingRef.current = false;
    pendingDataRequestRef.current = requestId;
    pendingScopeRankRef.current = withMilestones ? 1 : 0;
    try {
      const [milestonesData, archivedMilestonesData, searchResults] = await Promise.all([
        withMilestones ? apiClient.fetchMilestones() : milestoneEntitiesRef.current,
        withMilestones ? apiClient.fetchArchivedMilestones() : archivedMilestonesRef.current,
        apiClient.search(),
      ]);
      if (loadAllDataRequestRef.current !== requestId) {
        return;
      }
      if (withMilestones) {
        milestoneEntitiesRef.current = milestonesData;
        archivedMilestonesRef.current = archivedMilestonesData;
        setMilestoneEntities(milestonesData);
        setArchivedMilestones(archivedMilestonesData);
      }
      const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestonesData, milestonesData));
      const milestoneAliases = buildMilestoneAliasMap(milestonesData, archivedMilestonesData);
      const idSignature = (list: Task[]) =>
        list
          .map((task) => task.id)
          .sort()
          .join("\n");
      const previousIdSignature = idSignature(tasksRef.current);
      const { tasks: tasksList } = applySearchResults(searchResults, archivedKeys, milestoneAliases);
      applyMilestoneIds(
        collectMilestoneIds(tasksList, milestonesData, archivedMilestonesData).filter(
          (milestone) => !archivedKeys.has(milestoneKey(milestone)),
        ),
      );
      // In the healthy steady state (an empty plan on record), duplicate IDs can
      // only appear when the set of task IDs changes, so edits and reorders skip
      // the plan's filesystem rescan. While duplicates exist their plan
      // fingerprint also covers content and references, and a still-null plan
      // means the initial read has not landed (or was superseded), so both keep
      // refreshing until the corpus is clean again.
      const plan = duplicateRepairPlanRef.current;
      const planUnsettled = plan === null || plan.groups.length > 0 || plan.crossBranchFindings.length > 0;
      if (planUnsettled || idSignature(tasksList) !== previousIdSignature) {
        void apiClient.fetchDuplicateTaskRepairPlan().then((duplicatePlan) => {
          if (loadAllDataRequestRef.current === requestId) applyDuplicateRepairPlan(duplicatePlan);
        }).catch(() => {});
      }
    } catch {
      if (loadAllDataRequestRef.current !== requestId) {
        return;
      }
      await loadAllData();
    } finally {
      if (loadAllDataRequestRef.current === requestId) {
        pendingDataRequestRef.current = null;
      }
    }
  }, [applySearchResults, applyMilestoneIds, applyDuplicateRepairPlan, loadAllData]);

  const refreshData = useCallback(async () => {
    await refreshTasksData(false);
    // Drafts are loaded by the drafts page, not by this refresh, and creating, editing, promoting or
    // demoting a task can change them, so tell that page to reload whenever the rest of the data does.
    window.dispatchEvent(new Event('drafts-updated'));
  }, [refreshTasksData]);

  const refreshMilestoneData = useCallback(async () => {
    await refreshTasksData(true);
    window.dispatchEvent(new Event('drafts-updated'));
  }, [refreshTasksData]);

  const fullRefreshData = useCallback(async () => {
    await loadAllData();
    window.dispatchEvent(new Event('drafts-updated'));
  }, [loadAllData]);

	const applyReorderedTasks = useCallback((updatedTasks: Task[], requestTask: Task) => {
		const current = tasksRef.current;
		const currentRequest = current.find((task) => task.id === requestTask.id);
		if (currentRequest !== requestTask) return;
		const updatesById = new Map(updatedTasks.map((task) => [task.id, task]));
		const next = current.map((task) => updatesById.get(task.id) ?? task);
		tasksRef.current = next;
		setTasks(next);
	}, []);

  // Sync editingTask with refreshed tasks data to prevent stale state
  // This fixes the bug where acceptance criteria disappears after save (GitHub #467)
  useEffect(() => {
    if (!editingTask || !showModal) {
      syncedTaskRecordRef.current = null;
      return;
    }
    const updatedTask = tasks.find(t => t.id === editingTask.id);
    if (!updatedTask) return;
    const synced = syncOpenTaskDetail({
      open: editingTask,
      refreshed: updatedTask,
      corpus: tasks,
      previous: syncedTaskRecordRef.current,
    });
    // The refresh left this task's record and everything its readiness answers about untouched, so
    // there is nothing to apply. This is also what keeps the state update below from looping.
    if (!synced.changed) return;
    syncedTaskRecordRef.current = { record: updatedTask, inputs: synced.readinessInputs };
    setEditingTask(synced.task);
    // The verdict moved: this task's own status or dependencies changed, or one of the records it
    // depends on did. Nothing else changes it, so nothing else pays for a request, and it is one
    // read of this task rather than one per dependency.
    if (synced.rereadDetail) {
      void apiClient
        .fetchTask(updatedTask.id)
        .then(detail => setEditingTask(current => (current && current.id === detail.id ? detail : current)))
        .catch(() => {});
    }
  }, [tasks, editingTask, showModal]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
	let disposed = false;
    ws.onmessage = (event) => {
	  const loadingState = parseBrowserLoadingState(event.data);
	  if (loadingState?.type === 'loading') {
		if (pendingDataRequestRef.current === null) protocolOnlyLoadingRef.current = true;
		// Once content is on screen it stays interactive; the header indexing
		// indicator (driven by loadingMessage) is the only loading signal. A new
		// loading attempt always clears a stale terminal error, so a passive
		// client shows its cached content instead of the obsolete failure.
		if (!hasLoadedDataRef.current) setIsLoading(true);
		applyLoadError(null);
		setLoadingMessage(loadingState.message);
	  } else if (loadingState?.type === 'loaded') {
		const shouldRefresh = protocolOnlyLoadingRef.current && pendingDataRequestRef.current === null;
		protocolOnlyLoadingRef.current = false;
		setLoadingMessage(null);
		// Indexing can surface cross-branch data (including duplicate findings)
		// that an incremental reconcile would miss, so reload everything.
		if (shouldRefresh) void fullRefreshData();
	  } else if (loadingState?.type === 'error') {
		protocolOnlyLoadingRef.current = false;
		setIsLoading(false);
		setLoadingMessage(null);
		applyLoadError(new Error(loadingState.message));
      } else if (event.data === "tasks-updated") {
        void refreshData();
      } else if (event.data === "milestones-updated") {
        void refreshMilestoneData();
      } else if (event.data === "config-updated") {
        // Reload statuses when config changes
        loadAllData();
      }
    };
	ws.onclose = () => {
		if (disposed || !protocolOnlyLoadingRef.current || pendingDataRequestRef.current !== null) return;
		protocolOnlyLoadingRef.current = false;
		void fullRefreshData();
	};
	return () => {
		disposed = true;
		ws.close();
	};
  }, [refreshData, refreshMilestoneData, fullRefreshData, loadAllData, applyLoadError]);

  const handleSubmitTask = async (taskData: Partial<Task>) => {
    // Don't catch errors here - let TaskDetailsModal handle them
    if (editingTask) {
      await apiClient.updateTask(editingTask.id, taskData);
    } else {
      // Set status to 'Draft' if in draft mode
      const finalTaskData = isDraftMode
        ? { ...taskData, status: 'Draft' }
        : taskData;
      const createdTask = await apiClient.createTask(finalTaskData as Omit<Task, "id" | "createdDate">);

      // Show task creation confirmation
      setTaskConfirmation({ task: createdTask, isDraft: isDraftMode });

      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        setTaskConfirmation(null);
      }, 4000);
    }
    handleCloseModal();
    await refreshData();
  };

  const handleArchiveTask = async (taskId: string) => {
    try {
      await apiClient.archiveTask(taskId);
      handleCloseModal();
      await refreshData();
    } catch (error) {
      console.error('Failed to archive task:', error);
    }
  };

  // Show loading state while checking initialization
  if (isInitialized === null) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900" role="status">
          <LoadingSpinner size="md" text="" />
          <span className="sr-only">Loading</span>
        </div>
      </ThemeProvider>
    );
  }

  // Show initialization screen if not initialized
  if (isInitialized === false) {
    return (
      <ThemeProvider>
        <InitializationScreen onInitialized={handleInitialized} />
      </ThemeProvider>
    );
  }

  const boardPage = (
    <BoardPage
      onEditTask={handleEditTask}
      onNewTask={handleNewTask}
      tasks={kanbanTasks}
      onRefreshData={refreshData}
	  onTasksUpdated={applyReorderedTasks}
      statuses={statuses}
      milestones={milestones}
      availableLabels={availableLabels}
      milestoneEntities={milestoneEntities}
      archivedMilestones={archivedMilestones}
      isLoading={isLoading}
      loadError={loadError}
      hideEmptyColumns={config?.hideEmptyColumns ?? false}
      dateFormat={config?.dateFormat}
      availablePriorities={config?.priorities}
      availableTypes={availableTypes}
      availableProjects={availableProjects}
    />
  );

  const taskListPage = (
    <TaskList
      onEditTask={handleEditTask}
      onNewTask={handleNewTask}
      tasks={tasks}
      availableStatuses={statuses}
      availableLabels={availableLabels}
      availableMilestones={milestones}
      availablePriorities={config?.priorities}
      milestoneEntities={milestoneEntities}
      archivedMilestones={archivedMilestones}
      onRefreshData={refreshData}
      dateFormat={config?.dateFormat}
      isLoading={isLoading}
    />
  );

  return (
    <ThemeProvider>
      <TaskIdIndexProvider tasks={tasks}>
      <Routes>
            <Route
            path="/"
            element={
              <Layout
                projectName={projectName}
                showSuccessToast={showSuccessToast}
                onDismissToast={() => setShowSuccessToast(false)}
                tasks={tasks}
                docs={docs}
                decisions={decisions}
                isLoading={isLoading}
                loadingMessage={loadingMessage}
                error={loadError}
                onRefreshData={refreshData}
                duplicateRepairPlan={duplicateRepairPlan}
              />
            }
          >
            <Route
              index
              element={<Navigate to={{ pathname: '/board', search: location.search }} replace state={location.state} />}
            />
            <Route path="board" element={boardPage} />
            <Route path="board/:id" element={boardPage} />
            <Route path="board/:id/:title" element={boardPage} />
            <Route
              path="board/*"
              element={
                <Navigate
                  to={{ pathname: '/board', search: location.search }}
                  replace
                  state={{ taskRouteError: 'That task link is not valid.' } satisfies TaskRouteNavigationState}
                />
              }
            />
            <Route path="tasks" element={taskListPage} />
            <Route path="tasks/:id" element={taskListPage} />
            <Route path="tasks/:id/:title" element={taskListPage} />
            <Route
              path="tasks/*"
              element={
                <Navigate
                  to={{ pathname: '/tasks', search: location.search }}
                  replace
                  state={{ taskRouteError: 'That task link is not valid.' } satisfies TaskRouteNavigationState}
                />
              }
            />
            <Route
              path="milestones"
              element={
              <MilestonesPage
                tasks={tasks}
                statuses={statuses}
                milestoneEntities={milestoneEntities}
                archivedMilestones={archivedMilestones}
                onEditTask={handleEditTask}
                onRefreshData={refreshMilestoneData}
                dateFormat={config?.dateFormat}
              />
            }
          />
            <Route path="drafts" element={<DraftsList onEditTask={openDraftModal} onNewDraft={handleNewDraft} dateFormat={config?.dateFormat} />} />
            <Route path="documentation" element={<DocumentationDetail docs={docs} onRefreshData={refreshData} dateFormat={config?.dateFormat} />} />
            <Route path="documentation/:id" element={<DocumentationDetail docs={docs} onRefreshData={refreshData} dateFormat={config?.dateFormat} />} />
            <Route path="documentation/:id/:title" element={<DocumentationDetail docs={docs} onRefreshData={refreshData} dateFormat={config?.dateFormat} />} />
            <Route path="decisions" element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} dateFormat={config?.dateFormat} />} />
            <Route path="decisions/:id" element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} dateFormat={config?.dateFormat} />} />
            <Route path="decisions/:id/:title" element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} dateFormat={config?.dateFormat} />} />
            <Route path="statistics" element={<Statistics tasks={tasks} isLoading={isLoading} onEditTask={handleEditTask} projectName={projectName} dateFormat={config?.dateFormat} />} />
            <Route path="settings" element={<Settings />} />
          </Route>
      </Routes>

      {taskRouteError && (
        <div
          ref={taskRouteAlertRef}
          role="alert"
          tabIndex={-1}
          className="fixed left-1/2 top-4 z-[70] flex w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          <span>{taskRouteError}</span>
          <button
            type="button"
            className="shrink-0 font-medium underline decoration-red-300 underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500"
            onClick={() => navigate(`${location.pathname}${location.search}`, { replace: true, state: null })}
          >
            Dismiss
          </button>
        </div>
      )}

      <TaskDetailsModal
        task={editingTask || undefined}
        isOpen={showModal}
        onClose={handleCloseModal}
        onSaved={refreshData}
        onSubmit={handleSubmitTask}
        onArchive={editingTask ? () => handleArchiveTask(editingTask.id) : undefined}
        availableStatuses={isDraftMode ? ['Draft', ...statuses] : statuses}
        availableTasks={tasks}
        onNavigateToTask={handleEditTask}
        availableMilestones={milestones}
        availablePriorities={config?.priorities}
        availableTypes={availableTypes}
        availableProjects={availableProjects}
        milestoneEntities={milestoneEntities}
        archivedMilestoneEntities={archivedMilestones}
        isDraftMode={isDraftMode}
        definitionOfDoneDefaults={config?.definitionOfDone ?? []}
        defaultAssignee={config?.defaultAssignee}
        dateFormat={config?.dateFormat}
      />

      {/* Task Creation Confirmation Toast */}
      {taskConfirmation && (
        <SuccessToast
          message={`${taskConfirmation.isDraft ? 'Draft' : 'Task'} "${taskConfirmation.task.title}" created successfully! (${taskConfirmation.task.id.replace('task-', '')})`}
          onDismiss={() => setTaskConfirmation(null)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      )}
      </TaskIdIndexProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
