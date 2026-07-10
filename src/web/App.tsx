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
import { SuccessToast } from './components/SuccessToast';
import { ThemeProvider } from './contexts/ThemeContext';
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
import type { DuplicateGroup } from '../utils/duplicate-detection';
import { isValidTaskId } from '../utils/task-id';
import { useHealthCheckContext } from './contexts/HealthCheckContext';
import { getWebVersion } from './utils/version';
import { collectArchivedMilestoneKeys, collectMilestoneIds, milestoneKey } from './utils/milestones';
import { createUrlPath } from './utils/urlHelpers';

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
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [config, setConfig] = useState<BacklogConfig | null>(null);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [milestoneEntities, setMilestoneEntities] = useState<Milestone[]>([]);
  const [archivedMilestones, setArchivedMilestones] = useState<Milestone[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [taskConfirmation, setTaskConfirmation] = useState<{task: Task, isDraft: boolean} | null>(null);
  
  // Initialization state
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  
  // Centralized data state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  
  const { isOnline } = useHealthCheckContext();
  const previousOnlineRef = useRef<boolean | null>(null);
  const hasBeenRunningRef = useRef(false);
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

    setTasks(normalizedTasks);
    setDocs(docsList);
    setDecisions(decisionsList);

    return { tasks: normalizedTasks, docs: docsList, decisions: decisionsList };
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statusesData, configData, searchResults, milestonesData, archivedMilestonesData, duplicates] = await Promise.all([
        apiClient.fetchStatuses(),
        apiClient.fetchConfig(),
        apiClient.search(),
        apiClient.fetchMilestones(),
        apiClient.fetchArchivedMilestones(),
        apiClient.fetchDuplicateTasks(),
      ]);

      const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestonesData, milestonesData));
      const milestoneAliases = buildMilestoneAliasMap(milestonesData, archivedMilestonesData);
      const { tasks: tasksList } = applySearchResults(searchResults, archivedKeys, milestoneAliases);

      setDuplicateGroups(duplicates);
      setStatuses(statusesData);
      setProjectName(configData.projectName);
      setAvailableLabels(configData.labels || []);
      setConfig(configData);
      setMilestoneEntities(milestonesData);
      setArchivedMilestones(archivedMilestonesData);
      setMilestones(
        collectMilestoneIds(tasksList, milestonesData, archivedMilestonesData).filter(
          (milestone) => !archivedKeys.has(milestoneKey(milestone)),
        ),
      );
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applySearchResults]);

  React.useEffect(() => {
    // Only load data when initialized
    if (isInitialized === true) {
      loadAllData();
    }
  }, [loadAllData, isInitialized]);

  // Reload data when connection is restored
  React.useEffect(() => {
    if (isOnline && previousOnlineRef.current === false) {
      // Connection restored, reload data
      const loadData = async () => {
        try {
          const [results, milestonesData, archivedMilestonesData] = await Promise.all([
            apiClient.search(),
            apiClient.fetchMilestones(),
            apiClient.fetchArchivedMilestones(),
          ]);
          const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestonesData, milestonesData));
          const milestoneAliases = buildMilestoneAliasMap(milestonesData, archivedMilestonesData);
          const { tasks: tasksList } = applySearchResults(results, archivedKeys, milestoneAliases);
          setMilestoneEntities(milestonesData);
          setArchivedMilestones(archivedMilestonesData);
          setMilestones(
            collectMilestoneIds(tasksList, milestonesData, archivedMilestonesData).filter(
              (milestone) => !archivedKeys.has(milestoneKey(milestone)),
            ),
          );
        } catch (error) {
          console.error('Failed to reload data:', error);
        }
      };
      loadData();
    }
  }, [applySearchResults, isOnline]);

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

  const handleEditTask = useCallback((task: Task) => {
    const basePath =
      location.pathname.startsWith('/board')
        ? '/board'
        : location.pathname.startsWith('/tasks')
          ? '/tasks'
          : null;

    if (!basePath) {
      openTaskModal(task);
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
    setShowModal(false);
    setEditingTask(null);
    setIsDraftMode(false);
    if (routeBasePath && routeTaskId) {
      isTaskRouteModalRef.current = false;
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
        isTaskRouteModalRef.current = false;
        setShowModal(false);
        setEditingTask(null);
        setIsDraftMode(false);
      }
      return;
    }

    if (!isValidTaskId(routeTaskId)) {
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

        isTaskRouteModalRef.current = false;
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
  }, [isInitialized, location.search, navigate, openTaskModal, routeBasePath, routeTaskId]);

  useEffect(() => {
    if (taskRouteError) {
      taskRouteAlertRef.current?.focus();
    }
  }, [taskRouteError]);

  const refreshData = useCallback(async () => {
    await loadAllData();
  }, [loadAllData]);

  // Sync editingTask with refreshed tasks data to prevent stale state
  // This fixes the bug where acceptance criteria disappears after save (GitHub #467)
  useEffect(() => {
    if (editingTask && showModal) {
      const updatedTask = tasks.find(t => t.id === editingTask.id);
      if (updatedTask && updatedTask !== editingTask) {
        setEditingTask(updatedTask);
      }
    }
  }, [tasks, editingTask, showModal]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    ws.onmessage = (event) => {
      if (event.data === "tasks-updated") {
        refreshData();
      } else if (event.data === "config-updated") {
        // Reload statuses when config changes
        loadAllData();
      }
    };
    return () => ws.close();
  }, [refreshData, loadAllData]);

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

    // If we're on the drafts page and created a draft, trigger a refresh
    if (isDraftMode && window.location.pathname === '/drafts') {
      // Trigger refresh by updating a timestamp that DraftsList can watch
      window.dispatchEvent(new Event('drafts-updated'));
    }
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
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
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
      tasks={tasks}
      onRefreshData={refreshData}
      statuses={statuses}
      milestones={milestones}
      availableLabels={availableLabels}
      milestoneEntities={milestoneEntities}
      archivedMilestones={archivedMilestones}
      isLoading={isLoading}
      hideEmptyColumns={config?.hideEmptyColumns ?? false}
      dateFormat={config?.dateFormat}
      availablePriorities={config?.priorities}
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
                onRefreshData={refreshData}
                duplicateGroups={duplicateGroups}
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
                onRefreshData={refreshData}
              />
            }
          />
            <Route path="drafts" element={<DraftsList onEditTask={handleEditTask} onNewDraft={handleNewDraft} dateFormat={config?.dateFormat} />} />
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
        availableMilestones={milestones}
        availablePriorities={config?.priorities}
        milestoneEntities={milestoneEntities}
        archivedMilestoneEntities={archivedMilestones}
        isDraftMode={isDraftMode}
        definitionOfDoneDefaults={config?.definitionOfDone ?? []}
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
