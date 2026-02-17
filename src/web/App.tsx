import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { apiClient } from './lib/api';
import { useHealthCheckContext } from './contexts/HealthCheckContext';
import { getWebVersion } from './utils/version';
import { collectArchivedMilestoneKeys, collectMilestoneIds, milestoneKey } from './utils/milestones';

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

function App() {
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
  
  const { isOnline } = useHealthCheckContext();
  const previousOnlineRef = useRef<boolean | null>(null);
  const hasBeenRunningRef = useRef(false);

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
      const [statusesData, configData, searchResults, milestonesData, archivedMilestonesData] = await Promise.all([
        apiClient.fetchStatuses(),
        apiClient.fetchConfig(),
        apiClient.search(),
        apiClient.fetchMilestones(),
        apiClient.fetchArchivedMilestones(),
      ]);

      const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestonesData, milestonesData));
      const milestoneAliases = buildMilestoneAliasMap(milestonesData, archivedMilestonesData);
      const { tasks: tasksList } = applySearchResults(searchResults, archivedKeys, milestoneAliases);

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

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTask(null);
    setIsDraftMode(false);
  };

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

  return (
    <ThemeProvider>
      <BrowserRouter>
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
              />
            }
          >
            <Route
              index
              element={
                <BoardPage
                  onEditTask={handleEditTask}
                  onNewTask={handleNewTask}
                tasks={tasks}
                onRefreshData={refreshData}
                statuses={statuses}
                milestones={milestones}
                milestoneEntities={milestoneEntities}
                archivedMilestones={archivedMilestones}
                isLoading={isLoading}
              />
            }
          />
            <Route
              path="tasks"
              element={
	                <TaskList
	                  onEditTask={handleEditTask}
	                  onNewTask={handleNewTask}
	                  tasks={tasks}
	                  availableStatuses={statuses}
	                  availableLabels={availableLabels}
	                  availableMilestones={milestones}
	                  milestoneEntities={milestoneEntities}
	                  archivedMilestones={archivedMilestones}
	                  onRefreshData={refreshData}
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
            <Route path="drafts" element={<DraftsList onEditTask={handleEditTask} onNewDraft={handleNewDraft} />} />
            <Route path="documentation" element={<DocumentationDetail docs={docs} onRefreshData={refreshData} />} />
            <Route path="documentation/:id" element={<DocumentationDetail docs={docs} onRefreshData={refreshData} />} />
            <Route path="documentation/:id/:title" element={<DocumentationDetail docs={docs} onRefreshData={refreshData} />} />
            <Route path="decisions" element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} />} />
            <Route path="decisions/:id" element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} />} />
            <Route path="decisions/:id/:title" element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} />} />
            <Route path="statistics" element={<Statistics tasks={tasks} isLoading={isLoading} onEditTask={handleEditTask} projectName={projectName} />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>

        <TaskDetailsModal
          task={editingTask || undefined}
          isOpen={showModal}
          onClose={handleCloseModal}
          onSaved={refreshData}
          onSubmit={handleSubmitTask}
          onArchive={editingTask ? () => handleArchiveTask(editingTask.id) : undefined}
          availableStatuses={isDraftMode ? ['Draft', ...statuses] : statuses}
          availableMilestones={milestones}
          milestoneEntities={milestoneEntities}
          archivedMilestoneEntities={archivedMilestones}
          isDraftMode={isDraftMode}
          definitionOfDoneDefaults={config?.definitionOfDone ?? []}
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
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
