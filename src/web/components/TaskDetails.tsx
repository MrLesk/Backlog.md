import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isReadOnlyTask, isWorkingCopyTask, type AcceptanceCriterion, type Milestone, type Task, type TaskComment } from "../../types";
import { type TaskDetail, taskDependencyGraph, taskReadiness } from "../../core/task-detail";
import Modal, { isExpandedCombobox } from "./Modal";
import { apiClient, ApiError, NetworkError, readDemotionFailureCause, readMovedFailureState } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { useBrowserAccess } from "../contexts/BrowserAccessContext";
import MDEditor from "@uiw/react-md-editor";
import AcceptanceCriteriaEditor from "./AcceptanceCriteriaEditor";
import { ProgressRing } from "./AcceptanceCriteriaProgress";
import ActionsMenu, { type MenuAction } from "./ActionsMenu";
import MermaidMarkdown from "./MermaidMarkdown";
import ChipInput from "./ChipInput";
import DependencyInput from "./DependencyInput";
import { DependencyGraphSection } from "./DependencyGraphSection";
import PriorityBars from "./PriorityBars";
import StatusMark from "./StatusMark";
import StoredDate from "./StoredDate";
import TaskBranch from "./TaskBranch";
import TaskFileList from "./TaskFileList";
import TaskLink, { useOpenTask } from "./TaskLink";
import TaskPageLayout, { TaskColumns, TaskPanel, TaskSection } from "./TaskPageLayout";
import { DEFAULT_STATUSES } from "../../constants/index.ts";
import { formatPriorityLabel, getPriorityOptions } from "../../utils/priority-config";
import { getProjectValues, resolveProjectValue } from "../../utils/project-config";
import { getTaskTypeValues, resolveTaskTypeValue } from "../../utils/task-type-config";
import { formatReadinessBlockers } from "../../utils/readiness";
import { buildTaskIdIndex, resolveTaskReference } from "../utils/task-id-links";
import { summarizeSubtaskProgress } from "../../utils/task-subtasks.ts";
import { createUnfilteredNesting, useSubtaskLevels } from "../lib/task-nesting.ts";
import { describeSubtasks } from "./SubtaskControls";
import SubtaskTree from "./SubtaskTree";

interface Props {
  task?: Task | TaskDetail; // Absent while creating a task or a draft
  onClose: () => void;
  onSaved?: () => Promise<void> | void; // refresh callback
  onTaskUpdated?: (task: Task) => void; // Acknowledges a write before older parent reads can arrive
  onSubmit?: (taskData: Partial<Task>) => Promise<void>; // For creating new tasks
  onArchive?: () => Promise<void> | void; // For archiving tasks
  onDependencyCleanup?: (taskId: string, cleanedTaskIds: string[]) => void; // Reports records that lost a reference
  availableStatuses?: string[]; // The configured statuses in order, for the Status choices, status marks and subtask progress
  availableLabels?: string[];
  availableTasks?: Task[]; // Shared task corpus for dependency selection
  isDraftMode?: boolean; // Whether creating a draft
  availablePriorities?: string[];
  availableTypes?: string[];
  availableProjects?: string[];
  milestoneEntities?: Milestone[];
  archivedMilestoneEntities?: Milestone[];
  definitionOfDoneDefaults?: string[];
  defaultAssignee?: string[];
  dateFormat?: string;
}

type Mode = "preview" | "edit" | "create";

type TaskUpdatePayload = Omit<Partial<Task>, "dueDate" | "project" | "milestone"> & {
  expectedRevision?: string;
  milestone?: string | null;
	dueDate?: string | null;
  project?: string | null;
  definitionOfDoneAdd?: string[];
  definitionOfDoneRemove?: number[];
  definitionOfDoneCheck?: number[];
  definitionOfDoneUncheck?: number[];
  disableDefinitionOfDoneDefaults?: boolean;
  commentsAppend?: string[];
  commentAuthor?: string;
};

type InlineMetaUpdatePayload = Omit<Partial<Task>, "milestone"> & {
  milestone?: string | null;
};

type TaskDetailsFormState = {
  title: string;
  description: string;
  plan: string;
  notes: string;
  displayComments: TaskComment[];
  finalSummary: string;
  criteria: AcceptanceCriterion[];
  definitionOfDone: AcceptanceCriterion[];
  status: string;
  assignee: string[];
  labels: string[];
  priority: string;
  taskType: string;
  project: string;
  dependencies: string[];
  references: string[];
  modifiedFiles: string[];
  milestone: string;
  dueDate: string;
};

// Shared empty defaults. A `= []` default parameter allocates a fresh array on every render, so
// every memo and effect keyed on it re-runs each time; combined with a state update in that chain
// the page spins until React aborts with "Maximum update depth exceeded".
const EMPTY_STATUSES: string[] = [];
const EMPTY_TASKS: Task[] = [];

// What every way out of a task with unsaved edits asks first.
const LEAVE_WITH_UNSAVED_EDITS = "Discard unsaved changes and leave this task?";

const containsCommentDelimiterLine = (value: string): boolean => /^\s*---\s*$/m.test(value.replace(/\r\n/g, "\n"));

const areJsonEqual = (first: unknown, second: unknown): boolean => JSON.stringify(first) === JSON.stringify(second);

const isTaskChangedError = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 409 && typeof error.data === "object" &&
  error.data !== null && "code" in error.data && error.data.code === "TASK_CHANGED";


const isEditableKeyboardTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null;

const preserveDirtyRefreshValue = <T,>(
  current: T,
  previous: T,
  next: T,
  isEqual: (first: T, second: T) => boolean = Object.is,
): T => (isEqual(current, previous) ? next : current);

const buildTaskDetailsFormState = ({
  task,
  isCreateMode,
  isDraftMode,
  availableStatuses,
  defaultDefinitionOfDone,
  createModeAssignee,
}: {
  task?: Task | TaskDetail;
  isCreateMode: boolean;
  isDraftMode?: boolean;
  availableStatuses?: string[];
  defaultDefinitionOfDone: AcceptanceCriterion[];
  createModeAssignee: string[];
}): TaskDetailsFormState => ({
  title: task?.title || "",
  description: task?.description || "",
  plan: task?.implementationPlan || "",
  notes: task?.implementationNotes || "",
  displayComments: task?.comments ?? [],
  finalSummary: task?.finalSummary || "",
  criteria: task?.acceptanceCriteriaItems || [],
  definitionOfDone: task?.definitionOfDoneItems || (isCreateMode ? defaultDefinitionOfDone : []),
  status: isDraftMode ? "Draft" : (task?.status || (availableStatuses?.[0] || "To Do")),
  assignee: task?.assignee || createModeAssignee,
  labels: task?.labels || [],
  priority: task?.priority || "",
  taskType: task?.type || "",
  project: task?.project || "",
  dependencies: task?.dependencies || [],
  references: task?.references || [],
  modifiedFiles: task?.modifiedFiles || [],
  milestone: task?.milestone || "",
  dueDate: task?.dueDate || "",
});

/**
 * A task: an existing task or draft as the task page, or a new one in the dialog that creates it. It owns the form
 * state of the task, its edits and its writes; TaskPageLayout and the panels below only draw it. It is mounted only
 * while it shows something.
 */
export default function TaskDetails({
  task,
  onClose,
  onSaved,
  onTaskUpdated,
  onSubmit,
  onArchive,
  onDependencyCleanup,
  availableStatuses = EMPTY_STATUSES,
  availableLabels = [],
  availableTasks = EMPTY_TASKS,
  availablePriorities,
  availableTypes,
  availableProjects,
  milestoneEntities,
  archivedMilestoneEntities,
  isDraftMode,
  definitionOfDoneDefaults,
  defaultAssignee,
  dateFormat,
}: Props) {
  const { theme } = useTheme();
  const { canWrite } = useBrowserAccess();
  const isCreateMode = !task;
  const isReadOnlyRecord = Boolean(task && isReadOnlyTask(task));
  const isReadOnly = !canWrite || isReadOnlyRecord;
  // Promoting a draft replaces it with a new task ID, which the Drafts page does through its own
  // Promote action, so the page shows the draft status without turning the field into a second one.
  const isOpenDraft = (task?.status ?? "").trim().toLowerCase() === "draft";
  const recordIdentity = [task?.id, task?.source, task?.branch, isOpenDraft ? "draft" : "task"].join("\0");
  const recordIdentityRef = useRef(recordIdentity);
  recordIdentityRef.current = recordIdentity;
  const [interactiveMode, setMode] = useState<Mode>(isCreateMode ? "create" : "preview");
  const mode = canWrite ? interactiveMode : "preview";
  const canEditPreview = mode === "preview" && !isReadOnly;
  const modeRef = useRef(mode);
  const formBaselineRef = useRef<TaskDetailsFormState | null>(null);
  const formRevisionRef = useRef(task?.revision);
  const lastIncomingVersionRef = useRef<string | undefined>(undefined);
  const editSessionRef = useRef(0);
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveInFlightRef = useRef(false);
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState({ identity: recordIdentity, count: 0 });
  const pendingOwner = `${recordIdentity}\0${editSessionRef.current}`;
  const hasPendingUpdates = pendingUpdates.identity === pendingOwner && pendingUpdates.count > 0;
  const activeDemotionRequest = useRef<{ identity: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [demoting, setDemoting] = useState(false);
  const saveBlocked = isReadOnly || demoting || newVersionAvailable || refreshing || hasPendingUpdates;
  const [error, setError] = useState<string | null>(null);

  // Title field for create mode
  const [title, setTitle] = useState(task?.title || "");

  // Editable fields (edit mode)
  const [description, setDescription] = useState(task?.description || "");
  const [plan, setPlan] = useState(task?.implementationPlan || "");
  const [notes, setNotes] = useState(task?.implementationNotes || "");
  const [displayComments, setDisplayComments] = useState<TaskComment[]>(task?.comments ?? []);
  const [commentBody, setCommentBody] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentsChanged, setCommentsChanged] = useState(false);
  const [finalSummary, setFinalSummary] = useState(task?.finalSummary || "");
  const [criteria, setCriteria] = useState<AcceptanceCriterion[]>(task?.acceptanceCriteriaItems || []);
  const defaultDefinitionOfDone = useMemo(
    () => (definitionOfDoneDefaults ?? []).map((text, index) => ({ index: index + 1, text, checked: false })),
    [definitionOfDoneDefaults],
  );
  // Create mode starts with the configured defaultAssignee already in the field, as ordinary
  // removable chips, so emptying it says "unassigned" instead of "no opinion".
  const createModeAssignee = useMemo(
    () => (isCreateMode ? (defaultAssignee ?? []) : []),
    [isCreateMode, defaultAssignee],
  );
  const initialDefinitionOfDone = task?.definitionOfDoneItems ?? (isCreateMode ? defaultDefinitionOfDone : []);
  const [definitionOfDone, setDefinitionOfDone] = useState<AcceptanceCriterion[]>(initialDefinitionOfDone);
  const priorityOptions = useMemo(() => getPriorityOptions(availablePriorities), [availablePriorities]);
  const typeOptions = useMemo(() => getTaskTypeValues(availableTypes), [availableTypes]);
  const projectOptions = useMemo(() => getProjectValues(availableProjects), [availableProjects]);
  const resolveMilestoneToId = useCallback((value?: string | null): string => {
    const normalized = (value ?? "").trim();
    if (!normalized) return "";
    const key = normalized.toLowerCase();
    const aliasKeys = new Set<string>([key]);
    const looksLikeMilestoneId = /^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized);
    const canonicalInputId = looksLikeMilestoneId
      ? `m-${String(Number.parseInt(normalized.replace(/^m-/i, ""), 10))}`
      : null;
    if (/^\d+$/.test(normalized)) {
      const numericAlias = String(Number.parseInt(normalized, 10));
      aliasKeys.add(numericAlias);
      aliasKeys.add(`m-${numericAlias}`);
    } else {
      const idMatch = normalized.match(/^m-(\d+)$/i);
      if (idMatch?.[1]) {
        const numericAlias = String(Number.parseInt(idMatch[1], 10));
        aliasKeys.add(numericAlias);
        aliasKeys.add(`m-${numericAlias}`);
      }
    }
    const idMatchesAlias = (milestoneId: string): boolean => {
      const milestoneKey = milestoneId.trim().toLowerCase();
      if (aliasKeys.has(milestoneKey)) {
        return true;
      }
      const idMatch = milestoneId.trim().match(/^m-(\d+)$/i);
      if (!idMatch?.[1]) {
        return false;
      }
      const numericAlias = String(Number.parseInt(idMatch[1], 10));
      return aliasKeys.has(numericAlias) || aliasKeys.has(`m-${numericAlias}`);
    };
    const findIdMatch = (milestones: Milestone[]): Milestone | undefined => {
      const rawExactMatch = milestones.find((milestone) => milestone.id.trim().toLowerCase() === key);
      if (rawExactMatch) {
        return rawExactMatch;
      }
      if (canonicalInputId) {
        const canonicalRawMatch = milestones.find(
          (milestone) => milestone.id.trim().toLowerCase() === canonicalInputId,
        );
        if (canonicalRawMatch) {
          return canonicalRawMatch;
        }
      }
      return milestones.find((milestone) => idMatchesAlias(milestone.id));
    };
    const activeMilestones = milestoneEntities ?? [];
    const archivedMilestones = archivedMilestoneEntities ?? [];
    const activeIdMatch = findIdMatch(activeMilestones);
    if (activeIdMatch) {
      return activeIdMatch.id;
    }
    if (looksLikeMilestoneId) {
      const archivedIdMatch = findIdMatch(archivedMilestones);
      if (archivedIdMatch) {
        return archivedIdMatch.id;
      }
    }
    const activeTitleMatches = activeMilestones.filter((milestone) => milestone.title.trim().toLowerCase() === key);
    if (activeTitleMatches.length === 1) {
      return activeTitleMatches[0]?.id ?? normalized;
    }
    if (activeTitleMatches.length > 1) {
      return normalized;
    }
    const archivedIdMatch = findIdMatch(archivedMilestones);
    if (archivedIdMatch) {
      return archivedIdMatch.id;
    }
    const archivedTitleMatches = archivedMilestones.filter((milestone) => milestone.title.trim().toLowerCase() === key);
    if (archivedTitleMatches.length === 1) {
      return archivedTitleMatches[0]?.id ?? normalized;
    }
    return normalized;
  }, [milestoneEntities, archivedMilestoneEntities]);
  const resolveMilestoneLabel = useCallback((value?: string | null): string => {
    const normalized = (value ?? "").trim();
    if (!normalized) return "";
    const key = normalized.toLowerCase();
    const aliasKeys = new Set<string>([key]);
    const canonicalInputId =
      /^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized)
        ? `m-${String(Number.parseInt(normalized.replace(/^m-/i, ""), 10))}`
        : null;
    if (/^\d+$/.test(normalized)) {
      const numericAlias = String(Number.parseInt(normalized, 10));
      aliasKeys.add(numericAlias);
      aliasKeys.add(`m-${numericAlias}`);
    } else {
      const idMatch = normalized.match(/^m-(\d+)$/i);
      if (idMatch?.[1]) {
        const numericAlias = String(Number.parseInt(idMatch[1], 10));
        aliasKeys.add(numericAlias);
        aliasKeys.add(`m-${numericAlias}`);
      }
    }
    const idMatchesAlias = (milestoneId: string): boolean => {
      const milestoneKey = milestoneId.trim().toLowerCase();
      if (aliasKeys.has(milestoneKey)) {
        return true;
      }
      const idMatch = milestoneId.trim().match(/^m-(\d+)$/i);
      if (!idMatch?.[1]) {
        return false;
      }
      const numericAlias = String(Number.parseInt(idMatch[1], 10));
      return aliasKeys.has(numericAlias) || aliasKeys.has(`m-${numericAlias}`);
    };
    const findIdMatch = (milestones: Milestone[]): Milestone | undefined => {
      const rawExactMatch = milestones.find((milestone) => milestone.id.trim().toLowerCase() === key);
      if (rawExactMatch) {
        return rawExactMatch;
      }
      if (canonicalInputId) {
        const canonicalRawMatch = milestones.find(
          (milestone) => milestone.id.trim().toLowerCase() === canonicalInputId,
        );
        if (canonicalRawMatch) {
          return canonicalRawMatch;
        }
      }
      return milestones.find((milestone) => idMatchesAlias(milestone.id));
    };
    const allMilestones = [...(milestoneEntities ?? []), ...(archivedMilestoneEntities ?? [])];
    const idMatch = findIdMatch(allMilestones);
    if (idMatch) {
      return idMatch.title;
    }
    const titleMatches = allMilestones.filter((milestone) => milestone.title.trim().toLowerCase() === key);
    return titleMatches.length === 1 ? (titleMatches[0]?.title ?? normalized) : normalized;
  }, [milestoneEntities, archivedMilestoneEntities]);

  // Sidebar metadata (inline edit)
  const [status, setStatus] = useState(isDraftMode ? "Draft" : (task?.status || (availableStatuses?.[0] || "To Do")));
  const [assignee, setAssignee] = useState<string[]>(task?.assignee || createModeAssignee);
  const [labels, setLabels] = useState<string[]>(task?.labels || []);
  const [priority, setPriority] = useState<string>(task?.priority || "");
  const [taskType, setTaskType] = useState<string>(task?.type || "");
  const [project, setProject] = useState<string>(task?.project || "");
  const [typeUpdateError, setTypeUpdateError] = useState<string | null>(null);
  const [isTypeUpdating, setIsTypeUpdating] = useState(false);
  const typeUpdateInFlightRef = useRef(false);
  const [dependencies, setDependencies] = useState<string[]>(task?.dependencies || []);
  const [references, setReferences] = useState<string[]>(task?.references || []);
  const [modifiedFiles, setModifiedFiles] = useState<string[]>(task?.modifiedFiles || []);
  const [milestone, setMilestone] = useState<string>(task?.milestone || "");
  const [dueDate, setDueDate] = useState<string>(task?.dueDate || "");
  const canonicalTypeSelection = resolveTaskTypeValue(taskType, typeOptions);
  const typeSelectionValue = canonicalTypeSelection ?? taskType;
  const canonicalProjectSelection = resolveProjectValue(project, projectOptions);
  const projectSelectionValue = canonicalProjectSelection ?? project;
  const milestoneSelectionValue = resolveMilestoneToId(milestone);
  const hasMilestoneSelection = (milestoneEntities ?? []).some((milestoneEntity) => milestoneEntity.id === milestoneSelectionValue);

  // Both derived at read time and delivered with the task itself, so there is nothing to resolve
  // or fetch here: the verdict the page shows is the one every other surface shows.
  const dependencyGraph = taskDependencyGraph(task);
  const readiness = taskReadiness(task);
  // The verdict answers for the status and the dependencies it was read with, and it belongs to the
  // Dependencies card, so it is shown only while all of that still describes what is on screen. An
  // optimistic edit that has not come back yet - including one whose save failed and left the shown
  // status ahead of the record - shows no badge rather than a claim about what it replaced.
  const shownReadiness =
    readiness &&
    (readiness.isReady || readiness.isBlocked) &&
    dependencies.length > 0 &&
    dependencies.join(",") === (task?.dependencies ?? []).join(",") &&
    status === (task?.status ?? "")
      ? readiness
      : null;

  // Dependency validation stays local-only (see BACK-623), so the picker must only suggest what a
  // save can accept: a cross-branch task is rejected, and so is a canonically ambiguous ID that more
  // than one local file claims. The index drops those collisions already, so a task survives only
  // when it is the one its own canonical ID resolves to.
  const localAvailableTasks = useMemo(() => {
    const local = availableTasks.filter(isWorkingCopyTask);
    const index = buildTaskIdIndex(local);
    return local.filter((candidate) => resolveTaskReference(index, candidate.id) === candidate);
  }, [availableTasks]);

  // Hierarchy is derived from the shared corpus rather than the task payload: the single-task
  // API does not carry parent/subtask fields, while the list the page already receives does.
  // The task page has no filters, so its Subtasks tree lists every subtask in that list.
  const nesting = useMemo(() => createUnfilteredNesting(availableTasks), [availableTasks]);
  const parentTask = task ? nesting.all.parentOf(task) : null;
  const subtaskProgress = task ? summarizeSubtaskProgress(nesting.all.subtasksOf(task), availableStatuses) : null;
  // The subtask levels opened here. Their paths start with the task's ID, so each task keeps its own.
  const subtaskLevels = useSubtaskLevels();

  const resetForm = useCallback((next: TaskDetailsFormState, revision?: string) => {
    setTitle(next.title);
    setDescription(next.description);
    setPlan(next.plan);
    setNotes(next.notes);
    setDisplayComments(next.displayComments);
    setCommentSaving(false);
    setCommentsChanged(false);
    setFinalSummary(next.finalSummary);
    setCriteria(next.criteria);
    setDefinitionOfDone(next.definitionOfDone);
    setStatus(next.status);
    setAssignee(next.assignee);
    setLabels(next.labels);
    setPriority(next.priority);
    setTaskType(next.taskType);
    setProject(next.project);
    setDependencies(next.dependencies);
    setReferences(next.references);
    setModifiedFiles(next.modifiedFiles);
    setMilestone(next.milestone);
    setDueDate(next.dueDate);
    formBaselineRef.current = next;
    formRevisionRef.current = revision;
    setNewVersionAvailable(false);
    setError(null);
  }, []);

  const persistTaskUpdates = async (updates: TaskUpdatePayload): Promise<Task> => {
    if (!task) throw new Error("No task is open for editing.");
    const identity = recordIdentityRef.current;
    const session = editSessionRef.current;
    const owner = `${identity}\0${session}`;
    setPendingUpdates(current => ({ identity: owner, count: current.identity === owner ? current.count + 1 : 1 }));
    // Read the revision only after earlier writes have acknowledged their version.
    const result = updateQueueRef.current.then(async () => {
      if (recordIdentityRef.current !== identity || editSessionRef.current !== session) {
        throw new Error("The task editing session ended before this change could be saved.");
      }
      const updated = await apiClient.updateTask(task.id, { ...updates, expectedRevision: formRevisionRef.current });
      if (recordIdentityRef.current === identity && editSessionRef.current === session) {
        formRevisionRef.current = updated.revision;
        formBaselineRef.current = buildTaskDetailsFormState({
          task: updated, isCreateMode: false, isDraftMode, availableStatuses,
          defaultDefinitionOfDone, createModeAssignee,
        });
        onTaskUpdated?.(updated);
      }
      return updated;
    });
    updateQueueRef.current = result.then(() => {}, () => {});
    try {
      return await result;
    } catch (error) {
      if (recordIdentityRef.current === identity && editSessionRef.current === session && isTaskChangedError(error)) setNewVersionAvailable(true);
      throw error;
    } finally {
      setPendingUpdates(current => current.identity === owner ? { identity: owner, count: current.count - 1 } : current);
    }
  };

  const baseline = formBaselineRef.current;

  const isDirty = useMemo(() => {
    if (!baseline) return false;
    return (
      title !== baseline.title ||
      description !== baseline.description ||
      plan !== baseline.plan ||
      notes !== baseline.notes ||
      finalSummary !== baseline.finalSummary ||
      dueDate !== baseline.dueDate ||
      JSON.stringify(criteria) !== JSON.stringify(baseline.criteria) ||
      JSON.stringify(definitionOfDone) !== JSON.stringify(baseline.definitionOfDone)
    );
  }, [title, description, plan, notes, finalSummary, dueDate, criteria, definitionOfDone, baseline]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(
    () => () => {
      activeDemotionRequest.current = null;
      editSessionRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    editSessionRef.current += 1;
    activeDemotionRequest.current = null;
    saveInFlightRef.current = false;
    setSaving(false);
    setDemoting(false);
    setRefreshing(false);
    setNewVersionAvailable(false);
  }, [recordIdentity]);

  // The task page's keys, which act only while focus is in the page: E starts editing, Cmd/Ctrl+S saves, and Escape
  // cancels the edit (outside edit mode the page layout closes the page on Escape). They run before the controls of the
  // page see the key, so Escape in an open list closes the list first.
  const handlePageKeyDownCapture = (e: React.KeyboardEvent) => {
    if (isReadOnly) return;
    if (mode === "edit" && e.key === "Escape" && !isExpandedCombobox(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      handleCancelEdit();
      return;
    }
    if (mode === "edit" && ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")) {
      e.preventDefault();
      e.stopPropagation();
      void handleSave();
      return;
    }
    if (mode !== "preview" || isEditableKeyboardTarget(e.target)) {
      return;
    }
    if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      setMode("edit");
    }
  };

  useEffect(() => {
    if (isCreateMode || mode !== "edit" || saving || hasPendingUpdates) return;
    const previous = formBaselineRef.current;
    if (!previous) return;
    const next = buildTaskDetailsFormState({ task, isCreateMode, isDraftMode, availableStatuses,
      defaultDefinitionOfDone, createModeAssignee });
    const incoming = task?.revision ?? JSON.stringify(next);
    if (lastIncomingVersionRef.current === incoming) return;
    lastIncomingVersionRef.current = incoming;
    const changed = task?.revision !== undefined && formRevisionRef.current !== undefined
      ? task.revision !== formRevisionRef.current
      : !areJsonEqual(previous, next);
    if (changed) setNewVersionAvailable(true);
  }, [task, mode, isCreateMode, saving, hasPendingUpdates, isDraftMode, availableStatuses,
    defaultDefinitionOfDone, createModeAssignee]);

  // The first record sets the form up. Every later one is the same task read again, by a live update or after a write
  // of this view, which the form follows; while creating, it is the empty form with refreshed defaults. App gives every
  // task its own TaskDetails, so the task never changes here.
  useEffect(() => {
    const nextFormState = buildTaskDetailsFormState({
      task,
      isCreateMode,
      isDraftMode,
      availableStatuses,
      defaultDefinitionOfDone,
      createModeAssignee,
    });
    const previousFormState = formBaselineRef.current;
    if (!isCreateMode && previousFormState && modeRef.current === "edit") return;

    if (previousFormState) {
      setTitle((current) => preserveDirtyRefreshValue(current, previousFormState.title, nextFormState.title));
      setDescription((current) =>
        preserveDirtyRefreshValue(current, previousFormState.description, nextFormState.description),
      );
      setPlan((current) => preserveDirtyRefreshValue(current, previousFormState.plan, nextFormState.plan));
      setNotes((current) => preserveDirtyRefreshValue(current, previousFormState.notes, nextFormState.notes));
      setDisplayComments(nextFormState.displayComments);
      setCommentSaving(false);
      setCommentsChanged(false);
      setFinalSummary((current) =>
        preserveDirtyRefreshValue(current, previousFormState.finalSummary, nextFormState.finalSummary),
      );
      setCriteria((current) =>
        preserveDirtyRefreshValue(current, previousFormState.criteria, nextFormState.criteria, areJsonEqual),
      );
      setDefinitionOfDone((current) =>
        preserveDirtyRefreshValue(
          current,
          previousFormState.definitionOfDone,
          nextFormState.definitionOfDone,
          areJsonEqual,
        ),
      );
      setStatus((current) => preserveDirtyRefreshValue(current, previousFormState.status, nextFormState.status));
      setAssignee((current) =>
        preserveDirtyRefreshValue(current, previousFormState.assignee, nextFormState.assignee, areJsonEqual),
      );
      setLabels((current) =>
        preserveDirtyRefreshValue(current, previousFormState.labels, nextFormState.labels, areJsonEqual),
      );
      setPriority((current) => preserveDirtyRefreshValue(current, previousFormState.priority, nextFormState.priority));
      setTaskType((current) => preserveDirtyRefreshValue(current, previousFormState.taskType, nextFormState.taskType));
      setProject((current) => preserveDirtyRefreshValue(current, previousFormState.project, nextFormState.project));
      setDependencies((current) =>
        preserveDirtyRefreshValue(current, previousFormState.dependencies, nextFormState.dependencies, areJsonEqual),
      );
      setReferences((current) =>
        preserveDirtyRefreshValue(current, previousFormState.references, nextFormState.references, areJsonEqual),
      );
      setModifiedFiles((current) =>
        preserveDirtyRefreshValue(
          current,
          previousFormState.modifiedFiles,
          nextFormState.modifiedFiles,
          areJsonEqual,
        ),
      );
      setMilestone((current) =>
        preserveDirtyRefreshValue(current, previousFormState.milestone, nextFormState.milestone),
      );
      setDueDate((current) => preserveDirtyRefreshValue(current, previousFormState.dueDate, nextFormState.dueDate));
      setMode(isCreateMode ? "create" : modeRef.current);
      formBaselineRef.current = nextFormState;
      formRevisionRef.current = task?.revision;
      setNewVersionAvailable(false);
      setError(null);
      return;
    }

    resetForm(nextFormState, task?.revision);
    lastIncomingVersionRef.current = task?.revision ?? JSON.stringify(nextFormState);
    setCommentBody("");
    setCommentAuthor("");
    setMode(isCreateMode ? "create" : "preview");
  }, [task, isCreateMode, isDraftMode, availableStatuses, defaultDefinitionOfDone, createModeAssignee]);

  const refreshAfterCommentChange = useCallback(() => {
    if (!commentsChanged) return;
    setCommentsChanged(false);
    if (onSaved) void onSaved();
  }, [commentsChanged, onSaved]);

  const hasCommentDraft = commentBody.trim() !== "" || commentAuthor.trim() !== "";
  // Nothing is persisted while creating, so any entered field is unsaved work.
  const hasCreateModeEntries =
    isCreateMode &&
    (title.trim() !== "" ||
      taskType.trim() !== "" ||
      priority.trim() !== "" ||
      project.trim() !== "" ||
      milestone.trim() !== "" ||
      dueDate.trim() !== "" ||
      // The prefilled default is not the user's work, but removing or replacing it is.
      !areJsonEqual(assignee, createModeAssignee) ||
      labels.length > 0 ||
      dependencies.length > 0 ||
      references.length > 0 ||
      modifiedFiles.length > 0);
  const hasUnsavedEdits =
    (mode === "edit" || mode === "create") && (isDirty || hasCommentDraft || hasCreateModeEntries);

  // Every way out of this task asks this before it leaves unsaved edits behind: closing it, a subtask row, and any
  // link in the window (the guard below).
  const mayLeaveEdits = () => !hasUnsavedEdits || window.confirm(LEAVE_WITH_UNSAVED_EDITS);

  // A click on a subtask row outside its title link opens that subtask.
  const openTask = useOpenTask();
  const openRelatedTask = (relatedTask: Task) => {
    if (mayLeaveEdits()) openTask(relatedTask);
  };

  // While there are unsaved edits, a link anywhere in the window that leaves this page (a task link on the page, the
  // breadcrumb, the sidebar) asks the same question first. It listens on the document, before the link's own handler,
  // because the page is not modal: the sidebar and the header stay usable while a task is open.
  useEffect(() => {
    if (!hasUnsavedEdits) return;
    const askBeforeLeaving = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      // A link opened in another tab or window leaves nothing behind.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      const destination = new URL(link.href, window.location.href);
      if (destination.protocol !== "http:" && destination.protocol !== "https:") return;
      // Same-page anchors (markdown heading links) do not unload the form.
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (window.confirm(LEAVE_WITH_UNSAVED_EDITS)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("click", askBeforeLeaving, true);
    return () => document.removeEventListener("click", askBeforeLeaving, true);
  }, [hasUnsavedEdits]);

  // The close button: back to where the task was opened from, after the same question.
  const closeTask = () => {
    if (demoting || !mayLeaveEdits()) return;
    editSessionRef.current += 1;
    refreshAfterCommentChange();
    onClose();
  };

  const handleCancelEdit = () => {
    if (demoting) return;
    if (isDirty) {
      const confirmDiscard = window.confirm("Discard unsaved changes?");
      if (!confirmDiscard) return;
    }
    editSessionRef.current += 1;
    setRefreshing(false);
    saveInFlightRef.current = false;
    setSaving(false);
    if (isCreateMode) {
      // In create mode, close the modal on cancel
      onClose();
    } else {
      // Props may still precede an acknowledged own write. Cancel discards local edits,
      // while retaining that saved baseline unless a newer incoming version was reported.
      const next = newVersionAvailable || !formBaselineRef.current
        ? buildTaskDetailsFormState({ task, isCreateMode, isDraftMode, availableStatuses,
          defaultDefinitionOfDone, createModeAssignee })
        : formBaselineRef.current;
      resetForm(next, newVersionAvailable ? task?.revision : formRevisionRef.current);
      lastIncomingVersionRef.current = task?.revision;
      setCommentBody("");
      setCommentAuthor("");
      modeRef.current = "preview";
      setMode("preview");
      refreshAfterCommentChange();
    }
  };

  const normalizeChecklistItems = (items: AcceptanceCriterion[]): AcceptanceCriterion[] => {
    return items
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text.length > 0);
  };

  const buildDefinitionOfDoneCreatePayload = (): TaskUpdatePayload => {
    const cleanedCurrent = normalizeChecklistItems(definitionOfDone);
    const defaults = (definitionOfDoneDefaults ?? []).map((item) => item.trim()).filter((item) => item.length > 0);
    const defaultItems = defaults.map((text, index) => ({ index: index + 1, text, checked: false }));
    const defaultsMatch =
      cleanedCurrent.length >= defaultItems.length &&
      defaultItems.every(
        (item, index) =>
          cleanedCurrent[index]?.text === item.text && cleanedCurrent[index]?.checked === false,
      );

    const disableDefaults = !defaultsMatch;
    const definitionOfDoneAdd = disableDefaults
      ? cleanedCurrent.map((item) => item.text)
      : cleanedCurrent.slice(defaultItems.length).map((item) => item.text);

    const payload: TaskUpdatePayload = {};
    if (definitionOfDoneAdd.length > 0) {
      payload.definitionOfDoneAdd = definitionOfDoneAdd;
    }
    if (disableDefaults) {
      payload.disableDefinitionOfDoneDefaults = true;
    }
    return payload;
  };

  const buildDefinitionOfDoneEditPayload = (): TaskUpdatePayload => {
    const original = formBaselineRef.current?.definitionOfDone ?? [];
    const cleanedCurrent = normalizeChecklistItems(definitionOfDone);
    const originalByIndex = new Map(original.map((item) => [item.index, item]));
    const currentByIndex = new Map(cleanedCurrent.map((item) => [item.index, item]));
    const removals = new Set<number>();
    const additions: string[] = [];
    const checks: number[] = [];
    const unchecks: number[] = [];

    let nextIndex = original.reduce((max, item) => Math.max(max, item.index), 0);

    for (const item of cleanedCurrent) {
      const originalItem = originalByIndex.get(item.index);
      if (!originalItem) {
        additions.push(item.text);
        nextIndex += 1;
        if (item.checked) {
          checks.push(nextIndex);
        }
        continue;
      }
      if (originalItem.text !== item.text) {
        removals.add(item.index);
        additions.push(item.text);
        nextIndex += 1;
        if (item.checked) {
          checks.push(nextIndex);
        }
        continue;
      }
      if (originalItem.checked !== item.checked) {
        if (item.checked) {
          checks.push(item.index);
        } else {
          unchecks.push(item.index);
        }
      }
    }

    for (const originalItem of original) {
      if (!currentByIndex.has(originalItem.index)) {
        removals.add(originalItem.index);
      }
    }

    const payload: TaskUpdatePayload = {};
    if (additions.length > 0) {
      payload.definitionOfDoneAdd = additions;
    }
    if (removals.size > 0) {
      payload.definitionOfDoneRemove = Array.from(removals);
    }
    if (checks.length > 0) {
      payload.definitionOfDoneCheck = checks;
    }
    if (unchecks.length > 0) {
      payload.definitionOfDoneUncheck = unchecks;
    }
    return payload;
  };

  const handleRefreshTask = async () => {
    if (!task || refreshing) return;
    const identity = recordIdentityRef.current;
    const session = editSessionRef.current;
    const isCurrent = () => recordIdentityRef.current === identity && editSessionRef.current === session;
    const incomingAtStart = lastIncomingVersionRef.current;
    setRefreshing(true);
    setError(null);
    try {
      const latest = await apiClient.fetchTask(task.id);
      if (!isCurrent()) return;
      const next = buildTaskDetailsFormState({
        task: latest, isCreateMode: false, isDraftMode, availableStatuses,
        defaultDefinitionOfDone, createModeAssignee,
      });
      const fetchedVersion = latest.revision ?? JSON.stringify(next);
      if (lastIncomingVersionRef.current !== incomingAtStart && lastIncomingVersionRef.current !== fetchedVersion) {
        setNewVersionAvailable(true);
        return;
      }
      resetForm(next, latest.revision);
      setCommentBody("");
      setCommentAuthor("");
      modeRef.current = "edit";
      setMode("edit");
      if (onSaved) await onSaved();
    } catch (err) {
      if (isCurrent()) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (isCurrent()) setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (saveBlocked || saveInFlightRef.current) return;
    // Nothing was edited: leave edit mode without a request, because the file already holds every field. Properties
    // and comments changed in edit mode were written when they changed.
    if (!isCreateMode && !isDirty) {
      modeRef.current = "preview";
      setMode("preview");
      refreshAfterCommentChange();
      return;
    }
    const identity = recordIdentityRef.current;
    const session = editSessionRef.current;
    const isCurrent = () => recordIdentityRef.current === identity && editSessionRef.current === session;
    saveInFlightRef.current = true;
    setSaving(true);
    setError(null);

    // Validation for create mode
    if (isCreateMode && !title.trim()) {
      setError("Title is required");
      setSaving(false);
      saveInFlightRef.current = false;
      return;
    }

    try {
      const taskData: TaskUpdatePayload = {
        title: title.trim(),
        description,
        implementationPlan: plan,
        implementationNotes: notes,
        finalSummary,
        acceptanceCriteriaItems: criteria,
        status,
        // Create starts with the configured defaultAssignee in the field, so what the field
        // holds is what the user meant: empty is an explicit "unassigned". Only a project
        // without a default has nothing to remove, so there a blank field still omits the
        // field. On edit an explicit empty list clears the assignees.
        ...(isCreateMode && assignee.length === 0 && createModeAssignee.length === 0 ? {} : { assignee }),
        labels,
        priority: priority === "" ? undefined : priority,
        dependencies,
        milestone: milestone.trim().length > 0 ? milestone.trim() : undefined,
        dueDate: dueDate.trim().length > 0 ? dueDate.trim() : isCreateMode ? undefined : null,
      };

      // Like type, project is only sent from the create form. On edit the sidebar select
      // persists immediately through handleInlineMetaUpdate, so including it here would
      // re-send a value the form never showed -- clearing a stale project when none are
      // configured, or failing the whole save when the stored value is no longer valid.
      if (isCreateMode) {
        taskData.type = taskType;
        taskData.project = project.trim().length > 0 ? project.trim() : undefined;
      }

      if (isCreateMode && onSubmit) {
        Object.assign(taskData, buildDefinitionOfDoneCreatePayload());
        // Create new task
        await onSubmit({ ...taskData, dueDate: taskData.dueDate ?? undefined } as Partial<Task>);
        // Only close if successful (no error thrown)
        onClose();
      } else if (task) {
        Object.assign(taskData, buildDefinitionOfDoneEditPayload());
        // Update existing task
        const updated = await persistTaskUpdates(taskData);
        if (!isCurrent()) return;
        resetForm(buildTaskDetailsFormState({
          task: updated, isCreateMode: false, isDraftMode, availableStatuses,
          defaultDefinitionOfDone, createModeAssignee,
        }), updated.revision);
        modeRef.current = "preview";
        setMode("preview");
        if (onSaved) await onSaved();
        setCommentsChanged(false);
      }
    } catch (err) {
      if (!isCurrent()) return;
      if (isTaskChangedError(err)) {
        setNewVersionAvailable(true);
        return;
      }
      // Extract and display the error message from API response
      let errorMessage = 'Failed to save task';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'error' in err) {
        errorMessage = String((err as any).error);
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
    } finally {
      if (isCurrent()) {
        saveInFlightRef.current = false;
        setSaving(false);
      }
    }
  };

  const handleToggleCriterion = async (index: number, checked: boolean) => {
    if (demoting) return;
    if (!task) return; // Can't toggle in create mode
    if (isReadOnly) return; // Can't toggle on a read-only task
    // Optimistic update
    const next = (criteria || []).map((c) => (c.index === index ? { ...c, checked } : c));
    setCriteria(next);
    try {
      await persistTaskUpdates({ acceptanceCriteriaItems: next });
      if (onSaved) await onSaved();
    } catch (err) {
      // rollback
      setCriteria(criteria);
      console.error("Failed to update criterion", err);
    }
  };

  const handleToggleDefinitionOfDone = async (index: number, checked: boolean) => {
    if (demoting) return;
    if (!task) return; // Can't toggle in create mode
    if (isReadOnly) return; // Can't toggle on a read-only task
    const next = (definitionOfDone || []).map((c) => (c.index === index ? { ...c, checked } : c));
    setDefinitionOfDone(next);
    try {
      const updates: TaskUpdatePayload = checked
        ? { definitionOfDoneCheck: [index] }
        : { definitionOfDoneUncheck: [index] };
      await persistTaskUpdates(updates);
      if (onSaved) await onSaved();
    } catch (err) {
      setDefinitionOfDone(definitionOfDone);
      console.error("Failed to update Definition of Done item", err);
    }
  };

  const handleInlineMetaUpdate = async (updates: InlineMetaUpdatePayload) => {
    if (demoting) return;
    // Don't allow updates on a read-only task
    if (isReadOnly) return;

    setError(null);

    // Optimistic UI
    if (updates.status !== undefined) setStatus(String(updates.status));
    if (updates.assignee !== undefined) setAssignee(updates.assignee as string[]);
    if (updates.labels !== undefined) setLabels(updates.labels as string[]);
    if (updates.priority !== undefined) setPriority(String(updates.priority));
    if (updates.type !== undefined) setTaskType(String(updates.type));
    if (updates.project !== undefined) setProject(String(updates.project));
    if (updates.dependencies !== undefined) setDependencies(updates.dependencies as string[]);
    if (updates.references !== undefined) setReferences(updates.references as string[]);
    if (updates.modifiedFiles !== undefined) setModifiedFiles(updates.modifiedFiles as string[]);
    if (updates.milestone !== undefined) setMilestone((updates.milestone ?? "") as string);

    // Only update server if editing existing task
    if (task) {
      try {
        await persistTaskUpdates(updates);
        if (onSaved) await onSaved();
      } catch (err) {
        console.error("Failed to update task metadata", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleTaskTypeChange = async (nextType: string) => {
    if (demoting) return;
    if (isReadOnly) return;
    if (!task) {
      setTaskType(nextType);
      setTypeUpdateError(null);
      return;
    }
    if (typeUpdateInFlightRef.current) return;

    const previousType = taskType;
    typeUpdateInFlightRef.current = true;
    setIsTypeUpdating(true);
    setTypeUpdateError(null);
    setTaskType(nextType);

    try {
      const updatedTask = await persistTaskUpdates({ type: nextType });
      setTaskType(updatedTask.type ?? "");
      if (onSaved) {
        try {
          await onSaved();
        } catch (refreshError) {
          console.error("Task type was saved, but refreshing task data failed", refreshError);
        }
      }
    } catch (updateError) {
      setTaskType(previousType);
      setTypeUpdateError(updateError instanceof Error ? updateError.message : String(updateError));
    } finally {
      typeUpdateInFlightRef.current = false;
      setIsTypeUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (demoting) return;
    if (!task || isReadOnly) return;
    const body = commentBody.trim();
    if (!body) return;
    const author = commentAuthor.trim();
    if (containsCommentDelimiterLine(body)) {
      setError("Comment body cannot contain standalone '---' delimiter lines.");
      return;
    }
    if (author && containsCommentDelimiterLine(author)) {
      setError("Comment author cannot contain standalone '---' delimiter lines.");
      return;
    }
    setCommentSaving(true);
    setError(null);
    try {
      const updatedTask = await persistTaskUpdates({
        commentsAppend: [body],
        ...(author.length > 0 && { commentAuthor: author }),
      });
      setDisplayComments(updatedTask.comments ?? []);
      setCommentsChanged(true);
      setCommentBody("");
      setCommentAuthor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommentSaving(false);
    }
  };

  // labels handled via ChipInput; no textarea parsing

	const handleDemote = async () => {
		if (!task || !canDemote || activeDemotionRequest.current !== null) return;
		if (!window.confirm(`Demote "${task.title}" to draft? It will be moved to the drafts folder.`)) return;

		const request = { identity: recordIdentity };
		activeDemotionRequest.current = request;
		const isCurrentRequest = () =>
			activeDemotionRequest.current === request && recordIdentityRef.current === request.identity;
		const finishWithRefreshWarning = async (message: string) => {
			window.dispatchEvent(new window.Event("drafts-updated"));
			try {
				if (onSaved) await onSaved();
			} catch (refreshError) {
				console.error("Task was demoted, but refreshing the Web UI failed", refreshError);
			}
			if (!isCurrentRequest()) return;
			try {
				window.alert(message);
			} catch {
				setError(message);
			}
			onClose();
		};
		setDemoting(true);
		setError(null);
		try {
			const { cleanedTaskIds } = await apiClient.demoteTask(task.id);
			if (!isCurrentRequest()) return;
			onDependencyCleanup?.(task.id, cleanedTaskIds);
			try {
				window.dispatchEvent(new window.Event("drafts-updated"));
				if (onSaved) await onSaved();
			} catch {
				await finishWithRefreshWarning(
					"The task was moved to drafts, but refreshing the view failed. Verify the draft before retrying.",
				);
				return;
			}
			if (!isCurrentRequest()) return;
			onClose();
		} catch (err) {
			if (!isCurrentRequest()) return;
			const demotionFailureState = readMovedFailureState(err, "demotionState");
			if (demotionFailureState) {
				const demotionFailureCause = readDemotionFailureCause(err);
				const message =
					demotionFailureState === "moved"
						? demotionFailureCause === "cleanup"
							? "The task was moved to drafts, but removing references from dependent tasks failed. Some dependent tasks may still reference it. The view was refreshed; check those tasks before retrying."
							: demotionFailureCause === "commit"
								? "The task was moved to drafts, but recording the Git commit failed. The view was refreshed; verify the draft before retrying."
								: "The task was moved to drafts, but a later step failed. The view was refreshed; verify the draft and dependent tasks before retrying."
						: "The demotion encountered a filesystem failure and may have left both task and draft copies. The view was refreshed; inspect them before retrying.";
				await finishWithRefreshWarning(message);
				return;
			}
			if (err instanceof NetworkError) {
				await finishWithRefreshWarning(
					"The demotion request may have succeeded, but its response was lost. Check the task and drafts views before retrying.",
				);
				return;
			}
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			if (isCurrentRequest()) {
				activeDemotionRequest.current = null;
				setDemoting(false);
			}
		}
	};

  const handleArchive = async () => {
    if (isReadOnly || demoting || !task || !onArchive) return;
    if (!window.confirm(`Archive "${task.title}"? It moves off the board. Its ID, record, dependencies, and references are kept.`)) return;
    setError(null);
    try {
      await onArchive();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const checkedCount = criteria.filter((c) => c.checked).length;
  const definitionCheckedCount = definitionOfDone.filter((c) => c.checked).length;
  const canDemote = Boolean(task && !isOpenDraft && canEditPreview);
  const isEditing = mode === "edit" || mode === "create";
  const comments = displayComments;
  const documentation = task?.documentation ?? [];
  // Properties are controls while the task can be changed and plain values otherwise.
  const canChangeProperties = !isReadOnly;

  const editActions = (
    <>
      <button type="button" onClick={handleCancelEdit} disabled={demoting} className={SECONDARY_BUTTON}>
        Cancel
      </button>
      <button type="button" onClick={() => void handleSave()} disabled={saving || saveBlocked} className={PRIMARY_BUTTON}>
        {saving ? "Saving…" : isCreateMode ? "Create" : "Save"}
      </button>
    </>
  );

  // The title field has the heading's type. On the page its border and padding (1px and 7px, 8px in all) sit outside the
  // heading's box, in the negative margins, so the title stays where it was and nothing below it moves when Edit turns
  // it into the field. 8px also fits the page's narrowest side gutter, so the field never sticks out of the page.
  const titleField = (
    <input
      type="text"
      aria-label="Title"
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      placeholder="Enter task title"
      className={`rounded-control border border-line bg-surface px-[7px] py-1.5 text-2xl font-semibold leading-tight tracking-tight text-ink placeholder:font-normal placeholder:text-ink-3 focus-ring ${
        isCreateMode ? "w-full" : "-mx-2 -my-[7px] w-[calc(100%+1rem)]"
      }`}
    />
  );

  const sections = (
    <fieldset disabled={demoting} className="contents" aria-busy={demoting}>
      {isCreateMode && <TaskSection title="Title">{titleField}</TaskSection>}

      <TaskSection title="Description">
        <MarkdownField
          value={description}
          onChange={setDescription}
          isEditing={isEditing}
          emptyText="No description"
          editorHeight={320}
          theme={theme}
        />
      </TaskSection>

      {subtaskProgress && task && (
        <TaskSection
          title="Subtasks"
          detail={
            <ProgressRing
              done={subtaskProgress.completed}
              total={subtaskProgress.total}
              label={describeSubtasks(subtaskProgress)}
              title={describeSubtasks(subtaskProgress)}
              density="list"
            />
          }
        >
          <SubtaskTree
            parent={task}
            path={task.id}
            nesting={nesting}
            statuses={availableStatuses}
            levels={subtaskLevels}
            onOpenTask={openRelatedTask}
            variant="page"
          />
        </TaskSection>
      )}

      <TaskSection
        title="Acceptance criteria"
        detail={
          criteria.length > 0 && (
            <ProgressRing
              done={checkedCount}
              total={criteria.length}
              label="Acceptance criteria progress"
              title={`${checkedCount} of ${criteria.length} acceptance criteria checked`}
              density="list"
            />
          )
        }
      >
        {isEditing ? (
          <AcceptanceCriteriaEditor criteria={criteria} onChange={setCriteria} />
        ) : (
          <Checklist
            items={criteria}
            emptyText="No acceptance criteria"
            canToggle={canEditPreview}
            onToggle={(index, checked) => void handleToggleCriterion(index, checked)}
          />
        )}
      </TaskSection>

      <TaskSection
        title="Definition of Done"
        detail={
          definitionOfDone.length > 0 && (
            <ProgressRing
              done={definitionCheckedCount}
              total={definitionOfDone.length}
              label="Definition of Done progress"
              title={`${definitionCheckedCount} of ${definitionOfDone.length} Definition of Done items checked`}
              density="list"
            />
          )
        }
      >
        {isEditing ? (
          <AcceptanceCriteriaEditor
            criteria={definitionOfDone}
            onChange={setDefinitionOfDone}
            label="Definition of Done"
            singleLine={false}
            preserveIndices
            disableToggle={isCreateMode}
          />
        ) : (
          <Checklist
            items={definitionOfDone}
            emptyText="No Definition of Done items"
            canToggle={canEditPreview}
            onToggle={(index, checked) => void handleToggleDefinitionOfDone(index, checked)}
          />
        )}
      </TaskSection>

      {dependencyGraph && dependencyGraph.nodes.length > 1 && (
        <TaskSection title="Dependency graph">
          <DependencyGraphSection graph={dependencyGraph} />
        </TaskSection>
      )}

      <TaskSection title="Implementation plan">
        <MarkdownField
          value={plan}
          onChange={setPlan}
          isEditing={isEditing}
          emptyText="No plan"
          editorHeight={280}
          theme={theme}
        />
      </TaskSection>

      <TaskSection title="Implementation notes">
        <MarkdownField
          value={notes}
          onChange={setNotes}
          isEditing={isEditing}
          emptyText="No notes"
          editorHeight={280}
          theme={theme}
        />
      </TaskSection>

      {!isCreateMode && (
        <TaskSection
          title="Comments"
          detail={comments.length > 0 && <span className="font-mono text-[11.5px] font-medium text-ink-3">{comments.length}</span>}
        >
          {comments.length > 0 ? (
            <div className="flex flex-col gap-4">
              {comments.map((comment) => (
                <article key={`${comment.index}-${comment.createdDate}`} className="border-l-2 border-line pl-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-xs text-ink-3">
                    <span className="font-medium text-ink-2">#{comment.index}</span>
                    {comment.author ? <span>{comment.author}</span> : null}
                    {comment.createdDate ? <StoredDate value={comment.createdDate} dateFormat={dateFormat} /> : null}
                  </div>
                  <MarkdownText source={comment.body} theme={theme} />
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-3">No comments</p>
          )}
          {mode === "edit" && !isReadOnly && (
            <div className="mt-2 flex flex-col gap-2">
              <input
                type="text"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="Author"
                aria-label="Comment author"
                className={TEXT_FIELD}
              />
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={4}
                placeholder="Add a comment..."
                aria-label="Comment"
                className={TEXT_FIELD}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleAddComment()}
                  disabled={commentSaving || commentBody.trim().length === 0}
                  className={SECONDARY_BUTTON}
                >
                  {commentSaving ? "Adding..." : "Add comment"}
                </button>
              </div>
            </div>
          )}
        </TaskSection>
      )}

      {(isEditing || finalSummary.trim().length > 0) && (
        <TaskSection title="Final summary">
          <MarkdownField
            value={finalSummary}
            onChange={setFinalSummary}
            isEditing={isEditing}
            emptyText=""
            editorHeight={220}
            theme={theme}
            placeholder="PR-style summary of what was implemented (write when task is complete)"
          />
        </TaskSection>
      )}
    </fieldset>
  );

  const statusValues = availableStatuses.length ? availableStatuses : DEFAULT_STATUSES;
  const statusChoices = statusValues.map((value) => ({ value, label: value }));
  const typeChoices = [
    { value: "", label: "No type" },
    // A value the configuration no longer lists is still shown as it is.
    ...(!canonicalTypeSelection && taskType.trim() ? [{ value: taskType, label: `${taskType} (not configured)` }] : []),
    ...typeOptions.map((value) => ({ value, label: value })),
  ];
  const projectChoices = [
    { value: "", label: "No Project" },
    ...(!canonicalProjectSelection && project.trim() ? [{ value: project, label: `${project} (not configured)` }] : []),
    ...projectOptions.map((value) => ({ value, label: value })),
  ];
  const milestoneChoices = [
    { value: "", label: "No milestone" },
    ...(!hasMilestoneSelection && milestoneSelectionValue
      ? [{ value: milestoneSelectionValue, label: resolveMilestoneLabel(milestoneSelectionValue) }]
      : []),
    ...(milestoneEntities ?? []).map((milestoneEntity) => ({ value: milestoneEntity.id, label: milestoneEntity.title })),
  ];
  const priorityLabel = formatPriorityLabel(priority, availablePriorities);
  const milestoneLabel = resolveMilestoneLabel(milestoneSelectionValue);

  const properties = (
    <TaskPanel title="Properties">
      <fieldset disabled={demoting} className="contents" aria-busy={demoting}>
        {/* In the dialog that creates a task every property is a field to fill in, so their frames show (property-field). */}
        <dl
          className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1"
          data-framed-fields={isCreateMode || undefined}
        >
          <PropertyRow label="Status">
            {canChangeProperties && !isOpenDraft ? (
              <PropertySelect
                label="Task status"
                value={status}
                // A record can hold a status the configuration does not list (an archived one, say): it is shown as it is.
                choices={statusChoices.some((choice) => choice.value === status) || !status ? statusChoices : [{ value: status, label: status }, ...statusChoices]}
                onChange={(value) => void handleInlineMetaUpdate({ status: value })}
              >
                <StatusMark status={status} statuses={availableStatuses} decorative />
                <span className="truncate">{status}</span>
              </PropertySelect>
            ) : (
              <>
                <StatusMark status={status} statuses={availableStatuses} decorative />
                <span className="min-w-0 wrap-anywhere">{status}</span>
              </>
            )}
          </PropertyRow>

          <PropertyRow label="Priority">
            {canChangeProperties ? (
              <PropertySelect
                label="Task priority"
                value={priority}
                choices={[{ value: "", label: "No Priority" }, ...priorityOptions]}
                onChange={(value) => void handleInlineMetaUpdate({ priority: value as Task["priority"] })}
              >
                <PriorityBars priority={priority || undefined} priorities={availablePriorities} />
                <PropertyText value={priority ? priorityLabel : ""} />
              </PropertySelect>
            ) : (
              <>
                <PriorityBars priority={priority || undefined} priorities={availablePriorities} />
                <PropertyText value={priority ? priorityLabel : ""} />
              </>
            )}
          </PropertyRow>

          <PropertyRow label="Assignee">
            {canChangeProperties ? (
              <ChipInput
                name="assignee"
                label="Assignee"
                value={assignee}
                onChange={(value) => void handleInlineMetaUpdate({ assignee: value })}
                placeholder="Add a name"
              />
            ) : (
              <PropertyText value={assignee.join(", ")} mono />
            )}
          </PropertyRow>

          <PropertyRow label="Type">
            {canChangeProperties ? (
              <PropertySelect
                label="Task type"
                value={typeSelectionValue}
                choices={typeChoices}
                onChange={(value) => void handleTaskTypeChange(value)}
                disabled={isTypeUpdating}
                describedBy={typeUpdateError ? "task-type-update-error" : undefined}
                invalid={Boolean(typeUpdateError)}
              >
                {typeSelectionValue ? <span className={TYPE_CHIP}>{typeSelectionValue}</span> : <PropertyText value="" />}
              </PropertySelect>
            ) : typeSelectionValue ? (
              <span className={TYPE_CHIP}>{typeSelectionValue}</span>
            ) : (
              <PropertyText value="" />
            )}
            {typeUpdateError ? (
              <p id="task-type-update-error" role="alert" className="basis-full text-xs font-normal text-blocked">
                {typeUpdateError}
              </p>
            ) : null}
          </PropertyRow>

          <PropertyRow label="Labels">
            {canChangeProperties ? (
              <ChipInput
                name="labels"
                label="Labels"
                suggestions={availableLabels}
                value={labels}
                onChange={(value) => void handleInlineMetaUpdate({ labels: value })}
                placeholder="Add a label"
              />
            ) : labels.length > 0 ? (
              labels.map((label) => (
                <span key={label} className={LABEL_CHIP}>
                  {label}
                </span>
              ))
            ) : (
              <PropertyText value="" />
            )}
          </PropertyRow>

          {projectOptions.length > 0 && (
            <PropertyRow label="Project">
              {canChangeProperties ? (
                <PropertySelect
                  label="Task project"
                  value={projectSelectionValue}
                  choices={projectChoices}
                  onChange={(value) => void handleInlineMetaUpdate({ project: value })}
                >
                  <PropertyText value={projectSelectionValue} />
                </PropertySelect>
              ) : (
                <PropertyText value={projectSelectionValue} />
              )}
            </PropertyRow>
          )}

          <PropertyRow label="Milestone">
            {canChangeProperties ? (
              <PropertySelect
                label="Task milestone"
                value={milestoneSelectionValue}
                choices={milestoneChoices}
                onChange={(value) => {
                  setMilestone(value);
                  void handleInlineMetaUpdate({ milestone: value.trim().length > 0 ? value : null });
                }}
              >
                <PropertyText value={milestoneLabel} />
              </PropertySelect>
            ) : (
              <PropertyText value={milestoneLabel} />
            )}
          </PropertyRow>

          {isEditing ? (
            <PropertyRow label="Due">
              <input
                type="date"
                aria-label="Due date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="property-field font-mono text-xs text-ink"
              />
            </PropertyRow>
          ) : (
            task?.dueDate && (
              <PropertyRow label="Due">
                <StoredDate value={task.dueDate} dateFormat={dateFormat} className="font-mono text-xs font-normal text-ink-2" />
              </PropertyRow>
            )
          )}

          {task && (
            <PropertyRow label="Parent">
              {parentTask ? (
                <TaskLink
                  task={parentTask}
                  title={`Parent task ${parentTask.id}: ${parentTask.title}`}
                  aria-label={`Parent task ${parentTask.id}: ${parentTask.title}`}
                  className="flex min-w-0 items-baseline gap-1.5 rounded-[4px] hover:text-ink focus-ring"
                >
                  <span className="shrink-0 font-mono text-xs text-ink-3">{parentTask.id}</span>
                  <span className="truncate hover:underline">{parentTask.title}</span>
                </TaskLink>
              ) : (
                <PropertyText value={task.parentTaskId ?? ""} mono />
              )}
            </PropertyRow>
          )}

          <PropertyRow label="Dependencies">
            <div className="flex w-full min-w-0 flex-col gap-1.5">
              <DependencyInput
                value={dependencies}
                onChange={canChangeProperties ? (value) => void handleInlineMetaUpdate({ dependencies: value }) : undefined}
                availableTasks={availableTasks}
                suggestableTasks={localAvailableTasks}
                currentTaskId={task?.id}
                label=""
              />
              {shownReadiness && (
                <p className={`flex items-start gap-1.5 text-xs font-medium ${shownReadiness.isReady ? "text-accent-text" : "text-blocked"}`}>
                  <ReadinessMark isReady={shownReadiness.isReady} />
                  <span>{shownReadiness.isReady ? "Ready to start" : formatReadinessBlockers(shownReadiness)}</span>
                </p>
              )}
            </div>
          </PropertyRow>

          {task?.branch && (
            <PropertyRow label="Branch">
              <TaskBranch branch={task.branch} />
            </PropertyRow>
          )}

          {task && (
            <PropertyRow label="Created">
              <StoredDate value={task.createdDate} dateFormat={dateFormat} className="font-mono text-xs font-normal text-ink-2" />
            </PropertyRow>
          )}

          {task?.updatedDate && (
            <PropertyRow label="Updated">
              <StoredDate value={task.updatedDate} dateFormat={dateFormat} className="font-mono text-xs font-normal text-ink-2" />
            </PropertyRow>
          )}
        </dl>
      </fieldset>
    </TaskPanel>
  );

  // Removing an entry saves at once whenever the task can be changed; the field that adds one is offered in preview mode.
  const fileLists = (
    <>
      {(canWrite || references.length > 0) && (
        <TaskFileList
          title="References"
          items={references}
          emptyText="No references"
          entryName="reference"
          onRemove={canChangeProperties ? (index) => void handleInlineMetaUpdate({ references: references.filter((_, i) => i !== index) }) : undefined}
          onAdd={canEditPreview ? (value) => void handleInlineMetaUpdate({ references: [...references, value] }) : undefined}
          addPlaceholder="URL or file path"
        />
      )}
      {(canWrite || modifiedFiles.length > 0) && (
        <TaskFileList
          title="Modified files"
          items={modifiedFiles}
          emptyText="No modified files"
          entryName="modified file"
          onRemove={canChangeProperties ? (index) => void handleInlineMetaUpdate({ modifiedFiles: modifiedFiles.filter((_, i) => i !== index) }) : undefined}
          onAdd={canEditPreview ? (value) => void handleInlineMetaUpdate({ modifiedFiles: [...modifiedFiles, value] }) : undefined}
          addPlaceholder="Path from the project root"
          scrolls
        />
      )}
      {documentation.length > 0 && (
        <TaskFileList title="Documentation" items={documentation} emptyText="" entryName="document" />
      )}
    </>
  );

  if (!task) {
    return (
      <Modal
        isOpen
        onClose={closeTask}
        title={isDraftMode ? "Create New Draft" : "Create New Task"}
        maxWidthClass="max-w-5xl"
        disableEscapeClose
        actions={<div className="flex flex-nowrap items-center justify-end gap-2">{editActions}</div>}
      >
        {error && <p role="alert" className="mb-3 text-sm text-blocked">{error}</p>}
        <TaskColumns
          main={sections}
          side={
            <>
              {properties}
              {fileLists}
            </>
          }
        />
      </Modal>
    );
  }

  const moreActions: MenuAction[] = [
    ...(canDemote ? [{ label: "Demote to draft", onSelect: () => void handleDemote() }] : []),
    ...(onArchive && !isReadOnly ? [{ label: "Archive", onSelect: () => void handleArchive() }] : []),
  ];
  const pageActions = isEditing ? (
    editActions
  ) : canEditPreview ? (
    <>
      <button type="button" onClick={() => setMode("edit")} disabled={demoting} className={SECONDARY_BUTTON}>
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path d="M10.8 2.8 13.2 5.2 5.5 12.9 2.5 13.5l.6-3zM9.5 4.1l2.4 2.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        Edit
      </button>
      {moreActions.length > 0 && (
        <div className="relative">
          <ActionsMenu label="More actions" actions={moreActions} menuClassName="absolute right-0 top-full mt-1 w-48" disabled={demoting} />
        </div>
      )}
    </>
  ) : null;

  const notices = (
    <>
      {error && <p role="alert" className="text-sm text-blocked">{error}</p>}
      {demoting && <p role="status" className="text-sm text-ink-2">Moving the task to drafts…</p>}
      {newVersionAvailable && mode === "edit" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-you-bg px-3 py-2.5 text-sm text-you">
          <span>A newer version of this task is available.</span>
          <button
            type="button"
            onClick={() => void handleRefreshTask()}
            disabled={refreshing}
            className="rounded-control border border-you px-3 py-1.5 font-medium transition-opacity duration-200 hover:opacity-80 focus-ring disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh and discard edits"}
          </button>
        </div>
      )}
      {/* One note for every task that cannot be changed; only the reason differs. */}
      {isReadOnlyRecord && (
        <p className="flex items-center gap-2 rounded-control bg-surface-2 px-3 py-[9px] text-sm text-ink-2">
          {task.branch && (
            <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-ink-3" aria-hidden="true">
              <path d="M4.5 5.5v5M11.5 7c0 2.5-3 2-5.5 3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="4.5" cy="4" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="4.5" cy="12" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="11.5" cy="5.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )}
          <span>
            {task.branch ? (
              <>
                This task is on branch <b className="font-semibold text-ink">{task.branch}</b>. Switch to that branch to edit it.
              </>
            ) : (
              "This task is archived, so it cannot be changed."
            )}
          </span>
        </p>
      )}
    </>
  );

  return (
    <TaskPageLayout
      taskId={task.id}
      label={`${task.id}: ${title}`}
      onClose={closeTask}
      closeDisabled={demoting}
      actions={pageActions}
      notices={notices}
      heading={
        mode === "edit" ? (
          titleField
        ) : (
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-ink wrap-anywhere">{title}</h2>
        )
      }
      main={sections}
      side={
        <>
          {properties}
          {fileLists}
        </>
      }
      onKeyDownCapture={handlePageKeyDownCapture}
    />
  );
}

/** The two kinds of buttons of the page head and the create dialog, as drawn: outlined, and ink for the main action. */
const SECONDARY_BUTTON =
  "inline-flex compact-control items-center gap-1.5 border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors duration-200 hover:bg-hover focus-ring disabled:opacity-50";
const PRIMARY_BUTTON =
  "inline-flex compact-control items-center bg-ink px-2.5 text-xs font-medium text-on-ink transition-opacity duration-200 hover:opacity-90 focus-ring disabled:opacity-50";
const TEXT_FIELD =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-ring";
/** The quiet type chip and the label chips of the Tasks page's rows. */
const TYPE_CHIP = "rounded-chip px-1.5 py-0.5 text-[11.5px] font-medium text-ink-2 ring-1 ring-line ring-inset";
const LABEL_CHIP = "rounded-chip bg-surface-2 px-1.5 py-0.5 text-[11.5px] font-medium text-ink-2";

/** One property of the side panel: its name and its value, or the control that changes it. */
function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="flex min-h-[26px] items-center text-[12.5px] text-ink-3">{label}</dt>
      <dd className="flex min-h-[26px] min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium text-ink">{children}</dd>
    </>
  );
}

/** The mark before the readiness verdict, in the verdict's color: a check when ready, an hourglass when blocked. */
function ReadinessMark({ isReady }: { isReady: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="mt-px size-3.5 shrink-0" aria-hidden="true">
      <path
        d={isReady ? "m3.5 8.5 3 3 6-7" : "M4.5 2.5h7M4.5 13.5h7M5.5 2.5c0 3.5 5 3.5 5 5.5s-5 2-5 5.5M10.5 2.5c0 3.5-5 3.5-5 5.5s5 2 5 5.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A property's value as text; an empty one reads None. */
function PropertyText({ value, mono = false }: { value: string; mono?: boolean }) {
  if (!value) return <span className="font-mono text-xs font-normal text-ink-3">None</span>;
  return <span className={`min-w-0 wrap-anywhere ${mono ? "font-mono text-xs font-normal text-ink-2" : ""}`}>{value}</span>;
}

interface PropertySelectProps {
  /** The accessible name of the select, such as "Task status". */
  label: string;
  value: string;
  choices: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
  /** The value as drawn: a status mark, priority bars, a chip or text. */
  children: React.ReactNode;
}

/**
 * A property value that changes in place: the value is drawn as in the page, and a native select lies over it,
 * invisible, so a click anywhere on it opens the choices and the keyboard and screen readers use the select as usual.
 * Only a change of the choice calls onChange. The filter panel of the Tasks page draws its selects the same way.
 */
function PropertySelect({ label, value, choices, onChange, disabled, describedBy, invalid, children }: PropertySelectProps) {
  return (
    <span className="relative inline-flex property-field min-w-0 items-center gap-[7px] hover:bg-hover has-[select:disabled]:opacity-60">
      <span aria-hidden="true" className="flex min-w-0 items-center gap-[7px]">
        {children}
      </span>
      <select
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="absolute inset-0 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Acceptance criteria or Definition of Done items outside edit mode, each checked in place while the task can change. */
function Checklist({
  items,
  emptyText,
  canToggle,
  onToggle,
}: {
  items: AcceptanceCriterion[];
  emptyText: string;
  canToggle: boolean;
  onToggle: (index: number, checked: boolean) => void;
}) {
  if (items.length === 0) return <p className="text-sm text-ink-3">{emptyText}</p>;
  return (
    <ul role="list" className="flex flex-col">
      {items.map((item) => (
        <li key={item.index}>
          <label className="grid max-w-[72ch] grid-cols-[16px_minmax(0,1fr)] items-start gap-x-2.5 py-1 text-sm leading-normal text-ink">
            <input
              type="checkbox"
              checked={item.checked}
              disabled={!canToggle}
              onChange={(event) => onToggle(item.index, event.target.checked)}
              className="mt-[3px] checkbox focus-ring"
            />
            <span>
              <span className="mr-1.5 font-mono text-xs font-medium text-ink-3">#{item.index}</span>
              {item.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Markdown as the page shows it, in the reading column's type and the shared colors. */
function MarkdownText({ source, theme }: { source: string; theme: "light" | "dark" }) {
  return (
    <div className="task-markdown" data-color-mode={theme}>
      <MermaidMarkdown source={source} />
    </div>
  );
}

/** A Markdown field of the task: rendered outside edit mode, an editor in it. */
function MarkdownField({
  value,
  onChange,
  isEditing,
  emptyText,
  editorHeight,
  theme,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  emptyText: string;
  editorHeight: number;
  theme: "light" | "dark";
  placeholder?: string;
}) {
  if (!isEditing) {
    return value ? <MarkdownText source={value} theme={theme} /> : <p className="text-sm text-ink-3">{emptyText}</p>;
  }
  return (
    <div className="task-markdown overflow-hidden rounded-control border border-line">
      <MDEditor
        value={value}
        onChange={(next) => onChange(next || "")}
        preview="edit"
        height={editorHeight}
        data-color-mode={theme}
        textareaProps={placeholder ? { placeholder } : undefined}
      />
    </div>
  );
}
