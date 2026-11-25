import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import TasksPage from './components/TasksPage';
import DocumentationDetail from './components/DocumentationDetail';
import DecisionDetail from './components/DecisionDetail';
import DraftsList from './components/DraftsList';
import Settings from './components/Settings';
import Statistics from './components/Statistics';
import MilestonesPage from './components/MilestonesPage';
import TaskDetails from './components/TaskDetails';
import TaskPageLayout from './components/TaskPageLayout';
import { useOpenTask } from './components/TaskLink';
import InitializationScreen from './components/InitializationScreen';
import LoadingSpinner from './components/LoadingSpinner';
import { HealthIndicator } from './components/HealthIndicator';
import { SuccessToast } from './components/SuccessToast';
import { BrowserAccessProvider, useBrowserAccess } from './contexts/BrowserAccessContext';
import { browserSnapshot } from './lib/browser-snapshot';
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
import { formatDependencyCleanupMessage } from '../utils/dependency-graph';
import { ApiError, apiClient, readMovedFailureState } from './lib/api';
import type { TaskDetail } from '../core/task-detail';
import type { DuplicateRepairPlan } from '../core/duplicate-task-repair';
import { collectAvailableLabels } from '../utils/label-filter';
import { isValidTaskId } from '../utils/task-id';
import { useBrowserConnection } from './hooks/useBrowserConnection';
import { getWebVersion } from './utils/version';
import { collectArchivedMilestoneKeys, collectMilestoneIds, milestoneKey } from './utils/milestones';
import { getProjectValues } from '../utils/project-config';
import { getTaskTypeValues } from '../utils/task-type-config';
import { readRememberedTaskLayout, TASK_LAYOUT_PATHS, type TaskLayout } from './lib/task-view';
import { readTaskRouteState, type TaskRouteState } from './lib/task-links';
import { reconcileById } from './utils/reconcile';
import { parseBrowserLoadingState } from '../utils/browser-loading-state';

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

/**
 * What the task view is showing, as one value: nothing, the dialog that creates a task or a draft, or the task page.
 *
 * The task page shows the task its route names (/tasks/:id or /board/:id); every link to a task goes through that
 * route. A page entry carries the session it was opened in, the task it is open on, and whatever has been read for
 * it. Every route change to a task starts a new session before any read begins, and a detail response may change
 * the page only while its session and id are still the ones on screen. There is no ticket to take, nothing to
 * reconcile against the task list, and a response belonging to a task the reader has left cannot land on the one
 * they are looking at.
 */
type TaskViewState =
  | { kind: 'closed' }
  | { kind: 'create'; isDraft: boolean }
  | {
      kind: 'page';
      session: number;
      id: string;
      /** Null until the first read lands; the page shows its head meanwhile. */
      value: Task | TaskDetail | null;
    };

function AppContent() {
  const { canWrite, sections } = useBrowserAccess();
  const landingPath = (sections.tasks && TASK_LAYOUT_PATHS[readRememberedTaskLayout()])
    || (sections.docs && '/documentation')
    || (sections.decisions && '/decisions')
    || '/milestones';
  const [taskView, setTaskView] = useState<TaskViewState>({ kind: 'closed' });
  // Each task page the route opens takes the next session number, so a response can name the page it was read for.
  const pageSessionRef = useRef(0);
  const taskViewRef = useRef<TaskViewState>(taskView);
  taskViewRef.current = taskView;
  // Advanced by every completed data refresh, whether or not the records visibly changed.
  const [dataVersion, setDataVersion] = useState(0);
  const detailReadGenerationRef = useRef(0);

  const acknowledgeTaskUpdate = useCallback((updated: Task) => {
    // A read started before this successful write cannot replace its acknowledged record.
    detailReadGenerationRef.current += 1;
    setTaskView(current => current.kind === 'page' && current.id === updated.id
      ? { ...current, value: updated } : current);
    setDataVersion(version => version + 1);
  }, []);

  // Only the route effect below calls this: a task page opens by navigation (TaskLink, useOpenTask), and this state
  // follows the route.
  const openTaskPage = useCallback((id: string) => {
    pageSessionRef.current += 1;
    setTaskView({ kind: 'page', session: pageSessionRef.current, id, value: null });
  }, []);

  const isCreatingDraft = taskView.kind === 'create' && taskView.isDraft;
  const [statuses, setStatuses] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [config, setConfig] = useState<BacklogConfig | null>(null);
  const availableTypes = React.useMemo(() => getTaskTypeValues(config), [config]);
  const availableProjects = React.useMemo(() => getProjectValues(config), [config]);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [milestoneEntities, setMilestoneEntities] = useState<Milestone[]>([]);
  const [archivedMilestones, setArchivedMilestones] = useState<Milestone[]>([]);
  const [showReconnectToast, setShowReconnectToast] = useState(false);
  const [taskConfirmation, setTaskConfirmation] = useState<{task: Task, isDraft: boolean} | null>(null);
  const [dependencyCleanupNotice, setDependencyCleanupNotice] = useState<string | null>(null);
  const dependencyCleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Initialization state
  const [isInitialized, setIsInitialized] = useState<boolean | null>(canWrite ? null : true);
  
  // Centralized data state
  const [tasks, setTasks] = useState<Task[]>([]);
  // Archived tasks stay off the Tasks page; they remain reachable through their task detail.
  const tasksPageTasks = React.useMemo(() => tasks.filter((task) => task.source !== 'archived'), [tasks]);
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
  const taskRouteAlertRef = useRef<HTMLDivElement | null>(null);
  const routeTaskId =
    tasksRouteWithTitle?.params.id ??
    tasksRoute?.params.id ??
    boardRouteWithTitle?.params.id ??
    boardRoute?.params.id;
  const routeBasePath = tasksRouteWithTitle || tasksRoute ? '/tasks' : boardRouteWithTitle || boardRoute ? '/board' : null;
  const routeState = readTaskRouteState(location.state);
  const taskRouteError = routeState.taskRouteError;

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
    if (!canWrite) return;
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
  }, [canWrite]);

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
    // Reconciling can be a no-op for every visible record and still follow a change the browser
    // never receives, so the refresh itself is what an open task detail reacts to.
    setDataVersion(version => version + 1);

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
      setAvailableLabels(collectAvailableLabels([], configData.labels || []));
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
      if (canWrite) {
        void apiClient.fetchDuplicateTaskRepairPlan().then((duplicatePlan) => {
          if (loadAllDataRequestRef.current === requestId) applyDuplicateRepairPlan(duplicatePlan);
        }).catch(() => {
          if (loadAllDataRequestRef.current === requestId) applyDuplicateRepairPlan(null);
        });
      }
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
  }, [applySearchResults, applyMilestoneIds, applyLoadError, applyDuplicateRepairPlan, canWrite]);

  React.useEffect(() => {
    // Only load data when initialized
    if (isInitialized === true) {
      loadAllData();
    }
  }, [loadAllData, isInitialized]);

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

  useEffect(() => {
    if (!showReconnectToast) return;
    const timer = setTimeout(() => setShowReconnectToast(false), 4000);
    return () => clearTimeout(timer);
  }, [showReconnectToast]);

  const handleNewTask = () => {
    setTaskView({ kind: 'create', isDraft: false });
  };

  const handleNewDraft = () => {
    // Create a draft task (same as new task but with status 'Draft')
    setTaskView({ kind: 'create', isDraft: true });
  };

  // Clears the task view without touching the URL: closes the create dialog, and follows a route that no longer
  // names a task. Closing an open task page is closeTaskPage, which changes the route.
  const clearTaskView = useCallback(() => {
    setTaskView({ kind: 'closed' });
  }, []);

  // Opens a task where its link goes, for the Tasks page's shortcuts that are not links: a click elsewhere on a List row
  // or a Board card, and the legacy highlight link.
  const handleOpenTask = useOpenTask();

  // Back to where the task was opened from when it was opened in this tab; a task opened from a link outside the app
  // closes to the Tasks page beneath it.
  const closeTaskPage = () => {
    clearTaskView();
    if (routeState.openedInApp) {
      navigate(-1);
    } else if (routeBasePath) {
      navigate(`${routeBasePath}${location.search}`, { replace: true });
    }
  };

  // The task route says which task is open; the reader below is what reads it. Opening the session
  // here rather than after a response is what stops an older task's read from answering for this
  // one: from this moment the page names a different session.
  useEffect(() => {
    const current = taskViewRef.current;
    if (!sections.tasks || !routeTaskId || !routeBasePath || isInitialized !== true) {
      if (!routeTaskId && current.kind === 'page') {
        clearTaskView();
      }
      return;
    }

    if (!isValidTaskId(routeTaskId)) {
      clearTaskView();
      navigate(`${routeBasePath}${location.search}`, {
        replace: true,
        state: { taskRouteError: `"${routeTaskId}" is not a valid task ID.` } satisfies TaskRouteState,
      });
      return;
    }

    // Re-running for an unrelated reason (a filter in the query string, say) must not restart the
    // task the route already opened.
    if (current.kind === 'page' && current.id === routeTaskId) {
      return;
    }
    openTaskPage(routeTaskId);
  }, [clearTaskView, isInitialized, location.search, navigate, openTaskPage, routeBasePath, routeTaskId, sections.tasks]);

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
      if (canWrite && (planUnsettled || idSignature(tasksList) !== previousIdSignature)) {
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
  }, [applySearchResults, applyMilestoneIds, applyDuplicateRepairPlan, canWrite, loadAllData]);

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

  /**
   * A detail read that could not be shown. A page that has nothing on screen yet cannot stay open,
   * and it says why on the way back to the Tasks page. A later read failing leaves what is already
   * on screen alone: the last successful read is better than an empty page.
   */
  const reportDetailReadFailure = useCallback(
    (taskId: string, error: unknown) => {
      clearTaskView();
      if (!routeBasePath) return;
      const message =
        error instanceof ApiError && error.status === 409
          ? `Task "${taskId}" is ambiguous. Repair duplicate task IDs before opening this link.`
          : error instanceof ApiError && error.status === 400
            ? `"${taskId}" is not a valid task ID.`
            : error instanceof ApiError && error.status === 404
              ? `Task "${taskId}" was not found.`
              : `Task "${taskId}" could not be opened. Try again.`;
      navigate(`${routeBasePath}${location.search}`, {
        replace: true,
        state: { taskRouteError: message } satisfies TaskRouteState,
      });
    },
    [clearTaskView, location.search, navigate, routeBasePath],
  );
  const reportDetailReadFailureRef = useRef(reportDetailReadFailure);
  useEffect(() => {
    reportDetailReadFailureRef.current = reportDetailReadFailure;
  }, [reportDetailReadFailure]);

  /**
   * The one rule for detail reads: the page shows the read for (session, task id, refresh
   * generation), and a response may change it only while that key is still what the page is
   * waiting for. Each route change opens a session before any read starts, every refresh generation
   * reads once, and React's cleanup retires the read a newer key replaced.
   *
   * Navigating to another task, closing the page and a refresh arriving are the same event under
   * that rule, so none of them can answer for another. Nothing here consults the task list, which is
   * why a draft - never part of that corpus - refreshes like everything else, and why a dependency
   * completing somewhere the browser cannot see still reaches the page: the refresh generation
   * advances, and the detail read is authoritative about what changed.
   */
  const detailSession = taskView.kind === 'page' ? taskView.session : null;
  const detailId = taskView.kind === 'page' ? taskView.id : null;
  useEffect(() => {
    if (detailSession === null || detailId === null) return;
    const generation = ++detailReadGenerationRef.current;
    let active = true;
    void apiClient
      .fetchTask(detailId)
      .then(detail => {
        if (!active || generation !== detailReadGenerationRef.current) return;
        setTaskView(current =>
          generation === detailReadGenerationRef.current && current.kind === 'page' && current.session === detailSession && current.id === detailId
            ? { ...current, value: detail }
            : current,
        );
      })
      .catch(error => {
        if (!active || generation !== detailReadGenerationRef.current) return;
        const current = taskViewRef.current;
        if (current.kind !== 'page' || current.session !== detailSession || current.id !== detailId) return;
        if (current.value !== null) return;
        reportDetailReadFailureRef.current(detailId, error);
      });

    return () => {
      active = false;
    };
  }, [detailSession, detailId, dataVersion]);

  const { isOnline, retry } = useBrowserConnection({
    enabled: canWrite,
    onMessage(data) {
      const loadingState = parseBrowserLoadingState(data);
      if (loadingState?.type === 'loading') {
        if (pendingDataRequestRef.current === null) protocolOnlyLoadingRef.current = true;
        // Keep existing content interactive while indexing and clear any previous error.
        if (!hasLoadedDataRef.current) setIsLoading(true);
        applyLoadError(null);
        setLoadingMessage(loadingState.message);
      } else if (loadingState?.type === 'loaded') {
        const shouldRefresh = protocolOnlyLoadingRef.current && pendingDataRequestRef.current === null;
        protocolOnlyLoadingRef.current = false;
        setLoadingMessage(null);
        // Indexing can surface cross-branch data, including duplicate findings.
        if (shouldRefresh) void fullRefreshData();
      } else if (loadingState?.type === 'error') {
        protocolOnlyLoadingRef.current = false;
        setIsLoading(false);
        setLoadingMessage(null);
        applyLoadError(new Error(loadingState.message));
      } else if (data === "tasks-updated") {
        void refreshData();
      } else if (data === "milestones-updated") {
        void refreshMilestoneData();
      } else if (data === "config-updated") {
        void loadAllData();
      }
    },
    onDisconnect() {
      setShowReconnectToast(false);
      if (!protocolOnlyLoadingRef.current || pendingDataRequestRef.current !== null) return;
      protocolOnlyLoadingRef.current = false;
      void fullRefreshData();
    },
    onReconnect() {
      void fullRefreshData();
      if (hasBeenRunningRef.current) setShowReconnectToast(true);
    },
  });

  const handleCreateTask = async (taskData: Partial<Task>) => {
    const finalTaskData = isCreatingDraft ? { ...taskData, status: 'Draft' } : taskData;
    const createdTask = await apiClient.createTask(finalTaskData as Omit<Task, "id" | "createdDate">);
    setTaskConfirmation({ task: createdTask, isDraft: isCreatingDraft });
    setTimeout(() => setTaskConfirmation(null), 4000);
    clearTaskView();
    await refreshData();
  };

  // Archiving and demoting vacate the task ID, so any dependent that referenced it was changed
  // too. Report that the same way a created task is confirmed instead of changing files silently.
  // The ID list arrives over the wire, so a response that omits it reports nothing rather than
  // throwing in the middle of the flow that was about to close the task page.
  const reportDependencyCleanup = (taskId: string, cleanedTaskIds: string[] | undefined) => {
    const message = formatDependencyCleanupMessage(taskId, cleanedTaskIds ?? []);
    if (!message) return;
    // A second cleanup within the display window must not inherit the first one's expiry, or the
    // pending timeout clears a notice the reader has only just been shown.
    if (dependencyCleanupTimer.current) clearTimeout(dependencyCleanupTimer.current);
    setDependencyCleanupNotice(message);
    dependencyCleanupTimer.current = setTimeout(() => {
      dependencyCleanupTimer.current = null;
      setDependencyCleanupNotice(null);
    }, 4000);
  };

  const handleArchiveTask = async (taskId: string) => {
    try {
      await apiClient.archiveTask(taskId);
      closeTaskPage();
      await refreshData();
    } catch (error) {
      console.error('Failed to archive task:', error);
      // The task reached the archive and the commit after it failed. Close and refresh so the view
      // shows what happened, and say so: a page left open on an archived task invites a retry.
      if (readMovedFailureState(error, 'archiveState')) {
        closeTaskPage();
        try {
          window.alert('The task was archived, but committing the change failed. Check the repository before retrying.');
        } catch {
          // A blocked dialog must not take the refresh down with it.
        }
        await refreshData();
        return;
      }
      // Any other failure is core's answer about the task the page still shows; the page reports it.
      throw error;
    }
  };

  // Show loading state while checking initialization
  if (isInitialized === null) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center" role="status">
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

  const tasksPage = (layout: TaskLayout) => (
    <TasksPage
      layout={layout}
      tasks={tasksPageTasks}
      statuses={statuses}
      availableLabels={availableLabels}
      milestones={milestones}
      milestoneEntities={milestoneEntities}
      archivedMilestones={archivedMilestones}
      availablePriorities={config?.priorities}
      availableTypes={availableTypes}
      availableProjects={availableProjects}
      isLoading={isLoading}
      loadError={loadError}
      hideEmptyColumns={config?.hideEmptyColumns ?? false}
      dateFormat={config?.dateFormat}
      onEditTask={handleOpenTask}
      onNewTask={handleNewTask}
      onRefreshData={refreshData}
      onTasksUpdated={applyReorderedTasks}
    />
  );

  const taskRoutes = sections.tasks && (
    <>
      <Route path="board" element={tasksPage('board')} />
      <Route path="board/:id" element={tasksPage('board')} />
      <Route path="board/:id/:title" element={tasksPage('board')} />
      <Route
        path="board/*"
        element={
          <Navigate
            to={{ pathname: '/board', search: location.search }}
            replace
            state={{ taskRouteError: 'That task link is not valid.' } satisfies TaskRouteState}
          />
        }
      />
      <Route path="tasks" element={tasksPage('list')} />
      <Route path="tasks/:id" element={tasksPage('list')} />
      <Route path="tasks/:id/:title" element={tasksPage('list')} />
      <Route
        path="tasks/*"
        element={
          <Navigate
            to={{ pathname: '/tasks', search: location.search }}
            replace
            state={{ taskRouteError: 'That task link is not valid.' } satisfies TaskRouteState}
          />
        }
      />
      <Route path="statistics" element={<Statistics statuses={statuses} tasks={tasks} isLoading={isLoading} projectName={projectName} dateFormat={config?.dateFormat} />} />
    </>
  );

  const projectRecordRoutes = (
    <>
      {sections.milestones && (
        <Route
          path="milestones"
          element={
            <MilestonesPage
              tasks={tasks}
              statuses={statuses}
              milestoneEntities={milestoneEntities}
              archivedMilestones={archivedMilestones}
              onRefreshData={refreshMilestoneData}
              dateFormat={config?.dateFormat}
            />
          }
        />
      )}
      {sections.docs && (
        <Route
          path="documentation/:id?/:title?"
          element={<DocumentationDetail docs={docs} onRefreshData={refreshData} dateFormat={config?.dateFormat} />}
        />
      )}
      {sections.decisions && (
        <Route
          path="decisions/:id?/:title?"
          element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} dateFormat={config?.dateFormat} />}
        />
      )}
    </>
  );

  // What the task page and the create dialog take from the data App holds.
  const taskDetailsProps = {
    onSaved: refreshData,
    onTaskUpdated: acknowledgeTaskUpdate,
    onDependencyCleanup: reportDependencyCleanup,
    availableLabels,
    availableTasks: tasks,
    availablePriorities: config?.priorities,
    availableTypes,
    availableProjects,
    milestoneEntities,
    archivedMilestoneEntities: archivedMilestones,
    definitionOfDoneDefaults: config?.definitionOfDone ?? [],
    defaultAssignee: config?.defaultAssignee,
    dateFormat: config?.dateFormat,
  };

  // The task the route names, which Layout shows over the Tasks page. Until its first read lands only the page's head
  // is drawn, so moving from one task to another never shows the list in between.
  const openTask = taskView.kind === 'page' ? taskView.value : null;
  const taskPage = sections.tasks && taskView.kind === 'page'
    ? openTask
      ? (
        <TaskDetails
          // One TaskDetails per task: another task gets a fresh one, so no form state carries over between tasks.
          key={openTask.id}
          task={openTask}
          onClose={closeTaskPage}
          onArchive={canWrite ? () => handleArchiveTask(openTask.id) : undefined}
          availableStatuses={statuses}
          {...taskDetailsProps}
        />
      )
      : <TaskPageLayout taskId={taskView.id} onClose={closeTaskPage} />
    : undefined;

  return (
    <ThemeProvider>
      <TaskIdIndexProvider tasks={tasks}>
        <Routes>
          <Route
            path="/"
            element={
              <Layout
                projectName={projectName}
                pagePath={routeBasePath ?? location.pathname}
                tasks={tasks}
                docs={docs}
                decisions={decisions}
                isLoading={isLoading}
                loadingMessage={loadingMessage}
                error={loadError}
                onRefreshData={refreshData}
                duplicateRepairPlan={duplicateRepairPlan}
                taskPage={taskPage}
              />
            }
          >
            <Route
              index
              element={<Navigate to={{ pathname: landingPath, search: location.search }} replace state={location.state} />}
            />
            {taskRoutes}
            {canWrite && (
              <Route path="drafts" element={<DraftsList onNewDraft={handleNewDraft} dateFormat={config?.dateFormat} />} />
            )}
            {projectRecordRoutes}
            <Route path="settings" element={<Settings />} />
            {!canWrite && <Route path="*" element={<Navigate to={landingPath} replace />} />}
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

      {canWrite && taskView.kind === 'create' && (
        <TaskDetails
          onClose={clearTaskView}
          onSubmit={handleCreateTask}
          isDraftMode={taskView.isDraft}
          availableStatuses={taskView.isDraft ? ['Draft', ...statuses] : statuses}
          {...taskDetailsProps}
        />
      )}

      {!isOnline && <HealthIndicator onRetry={retry} />}
      {showReconnectToast && (
        <SuccessToast message="Connection restored!" onDismiss={() => setShowReconnectToast(false)} />
      )}

      {dependencyCleanupNotice && (
        <SuccessToast
          message={dependencyCleanupNotice}
          onDismiss={() => setDependencyCleanupNotice(null)}
        />
      )}

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
  const Router = browserSnapshot ? HashRouter : BrowserRouter;
  return (
    <BrowserAccessProvider snapshot={browserSnapshot}>
      {/* No transitions: the Tasks search field shows the URL, so a URL that renders late loses the keys typed meanwhile. */}
      <Router useTransitions={false}>
        <AppContent />
      </Router>
    </BrowserAccessProvider>
  );
}

export default App;
