import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isLocalEditableTask, type AcceptanceCriterion, type Milestone, type Task, type TaskComment } from "../../types";
import Modal from "./Modal";
import { ApiError, apiClient, NetworkError } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import AcceptanceCriteriaEditor from "./AcceptanceCriteriaEditor";
import LongFormField from './LongFormField';
import MermaidMarkdown from './MermaidMarkdown';
import ChipInput from "./ChipInput";
import DependencyInput from "./DependencyInput";
import { formatStoredUtcDateForDisplay } from "../utils/date-display";
import { getPriorityOptions } from "../../utils/priority-config";
import { getTaskTypeValues, resolveTaskTypeValue } from "../../utils/task-type-config";
import { createReadinessGraph, formatReadinessBlockers, getTaskReadiness } from "../../utils/readiness";
import { canonicalTaskId } from "../../utils/task-id.ts";
import { findDirectSubtasks, findParentTask, summarizeSubtaskProgress } from "../../utils/task-subtasks.ts";
import { isTerminalStatus } from "../../utils/terminal-status.ts";
import { createUrlPath } from "../utils/urlHelpers";

interface Props {
  task?: Task; // Optional for create mode
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void; // refresh callback
  onSubmit?: (taskData: Partial<Task>) => Promise<void>; // For creating new tasks
  onArchive?: () => Promise<void> | void; // For archiving tasks
  availableStatuses?: string[]; // Available statuses for new tasks
  availableTasks?: Task[]; // Shared task corpus for dependency selection
  onNavigateToTask?: (task: Task) => void; // Opens another task, preserving close/back context
  isDraftMode?: boolean; // Whether creating a draft
  availableMilestones?: string[];
  availablePriorities?: string[];
  availableTypes?: string[];
  milestoneEntities?: Milestone[];
  archivedMilestoneEntities?: Milestone[];
  definitionOfDoneDefaults?: string[];
  defaultAssignee?: string[];
  dateFormat?: string;
}

type Mode = "preview" | "edit" | "create";

type TaskUpdatePayload = Omit<Partial<Task>, "dueDate"> & {
	dueDate?: string | null;
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
  dependencies: string[];
  references: string[];
  modifiedFiles: string[];
  milestone: string;
  dueDate: string;
};

// Shared empty defaults. A `= []` default parameter allocates a fresh array on every render, so
// every memo and effect keyed on it re-runs each time; combined with a state update in that chain
// the modal spins until React aborts with "Maximum update depth exceeded".
const EMPTY_STATUSES: string[] = [];
const EMPTY_TASKS: Task[] = [];

const containsCommentDelimiterLine = (value: string): boolean => /^\s*---\s*$/m.test(value.replace(/\r\n/g, "\n"));

const areJsonEqual = (first: unknown, second: unknown): boolean => JSON.stringify(first) === JSON.stringify(second);

const getDemotionFailureState = (error: unknown): "moved" | "partial" | null => {
	if (
		!(error instanceof ApiError) ||
		error.status === undefined ||
		error.status < 500 ||
		typeof error.data !== "object" ||
		error.data === null
	) {
		return null;
	}
	const state = (error.data as { demotionState?: unknown }).demotionState;
	return state === "moved" || state === "partial" ? state : null;
};

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
  task?: Task;
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
  dependencies: task?.dependencies || [],
  references: task?.references || [],
  modifiedFiles: task?.modifiedFiles || [],
  milestone: task?.milestone || "",
  dueDate: task?.dueDate?.replace(" ", "T") || "",
});

const SectionHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="mb-2 flex items-center justify-between">
    <h3 className="text-sm font-medium text-gray-600 transition-colors duration-200 dark:text-gray-400">
      {title}
    </h3>
    {right ? <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">{right}</div> : null}
  </div>
);

const HierarchyStatusBadge: React.FC<{ status: string; statuses: string[] }> = ({ status, statuses }) => {
  const normalized = (status ?? '').toLowerCase();
  const tone = isTerminalStatus(status, statuses)
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : normalized.includes('progress')
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {status}
    </span>
  );
};

const HierarchyChevron: React.FC = () => (
  <svg
    className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-gray-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const TaskDetailsModal: React.FC<Props> = ({
  task,
  isOpen,
  onClose,
  onSaved,
  onSubmit,
  onArchive,
  availableStatuses = EMPTY_STATUSES,
  availableTasks = EMPTY_TASKS,
  onNavigateToTask,
  availableMilestones: _availableMilestones,
  availablePriorities,
  availableTypes,
  milestoneEntities,
  archivedMilestoneEntities,
  isDraftMode,
  definitionOfDoneDefaults,
  defaultAssignee,
  dateFormat,
}) => {
  const { theme } = useTheme();
  const isCreateMode = !task;
  const isFromOtherBranch = Boolean(task?.branch);
  // Promoting a draft replaces it with a new task ID, which the Drafts page does through its own
  // Promote action, so the popup shows the draft status without turning the field into a second one.
  const isOpenDraft = (task?.status ?? "").trim().toLowerCase() === "draft";
  const demotionIdentity = [isOpen ? "open" : "closed", task?.id, task?.source, task?.branch, isOpenDraft ? "draft" : "task"].join("\0");
  const demotionIdentityRef = useRef(demotionIdentity);
  demotionIdentityRef.current = demotionIdentity;
  const [mode, setMode] = useState<Mode>(isCreateMode ? "create" : "preview");
  const modeRef = useRef(mode);
  const previousTaskId = useRef(task?.id ?? "");
  const previousIsOpen = useRef(isOpen);
  const formBaselineRef = useRef<TaskDetailsFormState | null>(null);
  const activeDemotionRequest = useRef<{ identity: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [demoting, setDemoting] = useState(false);
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
  const preserveEditModeAfterCommentRefresh = useRef(false);
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
  const [typeUpdateError, setTypeUpdateError] = useState<string | null>(null);
  const [isTypeUpdating, setIsTypeUpdating] = useState(false);
  const typeUpdateInFlightRef = useRef(false);
  const typeUpdateRequestRef = useRef(0);
  const [dependencies, setDependencies] = useState<string[]>(task?.dependencies || []);
  const [references, setReferences] = useState<string[]>(task?.references || []);
  const [modifiedFiles, setModifiedFiles] = useState<string[]>(task?.modifiedFiles || []);
  const [milestone, setMilestone] = useState<string>(task?.milestone || "");
  const [dueDate, setDueDate] = useState<string>(task?.dueDate?.replace(" ", "T") || "");
  const canonicalTypeSelection = resolveTaskTypeValue(taskType, typeOptions);
  const typeSelectionValue = canonicalTypeSelection ?? taskType;
  const milestoneSelectionValue = resolveMilestoneToId(milestone);
  const hasMilestoneSelection = (milestoneEntities ?? []).some((milestoneEntity) => milestoneEntity.id === milestoneSelectionValue);

  // Dependencies that already left the board corpus (completed tasks) are fetched by ID so the
  // browser resolves the same task graph the CLI does instead of calling them unknown.
  // Keyed on a string because availableTasks and dependencies are new arrays on every render.
  const unresolvedDependencyKey = useMemo(() => {
    const known = new Set(availableTasks.map((candidate) => canonicalTaskId(candidate.id)));
    return dependencies
      .filter((id) => !known.has(canonicalTaskId(id)))
      .join(",");
  }, [availableTasks, dependencies]);
  const [offBoardDependencies, setOffBoardDependencies] = useState<Task[]>([]);
  useEffect(() => {
    if (!isOpen || unresolvedDependencyKey === "") {
      setOffBoardDependencies((current) => (current.length === 0 ? current : []));
      return;
    }
    let cancelled = false;
    Promise.all(unresolvedDependencyKey.split(",").map((id) => apiClient.fetchTask(id).catch(() => null))).then(
      (results) => {
        if (!cancelled) setOffBoardDependencies(results.filter((result): result is Task => Boolean(result)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isOpen, unresolvedDependencyKey]);

  // Dependency readiness, derived at render time from the dependencies and status currently shown,
  // so an inline edit is reflected immediately instead of waiting for a refresh.
  // Only meaningful while dependencies exist and the task has not been completed.
  const readiness = useMemo(() => {
    if (!task || dependencies.length === 0) return null;
    // Records resolved outside the board corpus come from backlog/completed, where the record's
    // location is the completion evidence rather than its status string. That applies to the open
    // task itself as well: a direct link can open a completed task whose historical status is no
    // longer the configured terminal one.
    const offBoard = [...offBoardDependencies, ...(task.source === "completed" ? [task] : [])];
    const graph = createReadinessGraph({
      tasks: [...availableTasks, ...offBoard.filter((entry) => entry.source !== "completed")],
      completedTasks: offBoard.filter((entry) => entry.source === "completed"),
      statuses: availableStatuses,
    });
    const result = getTaskReadiness({ ...task, dependencies, status }, graph);
    return result.isReady || result.isBlocked ? result : null;
  }, [task, dependencies, status, availableTasks, offBoardDependencies, availableStatuses]);

  // Hierarchy is derived from the shared corpus rather than the task payload: the single-task
  // API does not carry parent/subtask fields, while the list the modal already receives does.
  const parentTask = useMemo(
    () => (task ? findParentTask(task, availableTasks) : null),
    [task, availableTasks],
  );

  const subtasks = useMemo(
    () => (task ? findDirectSubtasks(task, availableTasks) : []),
    [task, availableTasks],
  );

  const subtaskProgress = useMemo(
    () => (task ? summarizeSubtaskProgress(task, availableTasks, availableStatuses) : null),
    [task, availableTasks, availableStatuses],
  );

  // Keep a baseline for dirty-check
  const baseline = useMemo(() => ({
    title: task?.title || "",
    description: task?.description || "",
    plan: task?.implementationPlan || "",
    notes: task?.implementationNotes || "",
    finalSummary: task?.finalSummary || "",
    dueDate: task?.dueDate?.replace(" ", "T") || "",
    criteria: JSON.stringify(task?.acceptanceCriteriaItems || []),
    definitionOfDone: JSON.stringify(task?.definitionOfDoneItems || (isCreateMode ? defaultDefinitionOfDone : [])),
  }), [task, defaultDefinitionOfDone, isCreateMode]);

  const isDirty = useMemo(() => {
    return (
      title !== baseline.title ||
      description !== baseline.description ||
      plan !== baseline.plan ||
      notes !== baseline.notes ||
      finalSummary !== baseline.finalSummary ||
      dueDate !== baseline.dueDate ||
      JSON.stringify(criteria) !== baseline.criteria ||
      JSON.stringify(definitionOfDone) !== baseline.definitionOfDone
    );
  }, [title, description, plan, notes, finalSummary, dueDate, criteria, definitionOfDone, baseline]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(
    () => () => {
      activeDemotionRequest.current = null;
    },
    [],
  );

  useEffect(() => {
    activeDemotionRequest.current = null;
    setDemoting(false);
  }, [demotionIdentity]);

  // Intercept Escape to cancel edit (not close modal) when in edit mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === "edit" && (e.key === "Escape")) {
        e.preventDefault();
        e.stopPropagation();
        handleCancelEdit();
      }
      if (mode === "edit" && ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        e.stopPropagation();
        void handleSave();
      }
      if (mode !== "preview" || isEditableKeyboardTarget(e.target)) {
        return;
      }
      if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setMode("edit");
      }
      if (isDoneStatus && (e.key.toLowerCase() === "c") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleComplete();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [mode, title, description, plan, notes, finalSummary, criteria, definitionOfDone, status]);

  // Reset local state when task changes or modal opens
  useEffect(() => {
    const nextTaskId = task?.id ?? "";
    const modalIdentityChanged = previousTaskId.current !== nextTaskId || previousIsOpen.current !== isOpen;
    if (modalIdentityChanged) {
      typeUpdateRequestRef.current += 1;
      typeUpdateInFlightRef.current = false;
      setIsTypeUpdating(false);
      setTypeUpdateError(null);
    }
    const nextFormState = buildTaskDetailsFormState({
      task,
      isCreateMode,
      isDraftMode,
      availableStatuses,
      defaultDefinitionOfDone,
      createModeAssignee,
    });
    const previousFormState = formBaselineRef.current;
    const sameOpenModalRefresh =
      Boolean(previousFormState) && isOpen && previousIsOpen.current && previousTaskId.current === nextTaskId;
    const shouldPreserveEditMode =
      !isCreateMode &&
      sameOpenModalRefresh &&
      (modeRef.current === "edit" || preserveEditModeAfterCommentRefresh.current);

    if (sameOpenModalRefresh && previousFormState) {
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
      setMode(shouldPreserveEditMode ? "edit" : isCreateMode ? "create" : modeRef.current);
      preserveEditModeAfterCommentRefresh.current = false;
      previousTaskId.current = nextTaskId;
      previousIsOpen.current = isOpen;
      formBaselineRef.current = nextFormState;
      setError(null);
      return;
    }

    setTitle(nextFormState.title);
    setDescription(nextFormState.description);
    setPlan(nextFormState.plan);
    setNotes(nextFormState.notes);
    setDisplayComments(nextFormState.displayComments);
    setCommentBody("");
    setCommentAuthor("");
    setCommentSaving(false);
    setCommentsChanged(false);
    setFinalSummary(nextFormState.finalSummary);
    setCriteria(nextFormState.criteria);
    setDefinitionOfDone(nextFormState.definitionOfDone);
    setStatus(nextFormState.status);
    setAssignee(nextFormState.assignee);
    setLabels(nextFormState.labels);
    setPriority(nextFormState.priority);
    setTaskType(nextFormState.taskType);
    setDependencies(nextFormState.dependencies);
    setReferences(nextFormState.references);
    setModifiedFiles(nextFormState.modifiedFiles);
    setMilestone(nextFormState.milestone);
    setDueDate(nextFormState.dueDate);
    setMode(isCreateMode ? "create" : "preview");
    preserveEditModeAfterCommentRefresh.current = false;
    previousTaskId.current = nextTaskId;
    previousIsOpen.current = isOpen;
    formBaselineRef.current = nextFormState;
    setError(null);
  }, [task, isOpen, isCreateMode, isDraftMode, availableStatuses, defaultDefinitionOfDone, createModeAssignee]);

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

  // Links inside the modal (dependency chips, auto-linked task IDs in markdown) leave this
  // task behind, so they ask the same question closing does before the navigation happens.
  const confirmNavigationAwayFromEdits = (event: React.MouseEvent<HTMLElement>) => {
    if (!hasUnsavedEdits || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    const destination = new URL(link.href, window.location.href);
    if (destination.protocol !== "http:" && destination.protocol !== "https:") return;
    // Same-page anchors (markdown heading links) do not unload the form.
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    if (window.confirm("Discard unsaved changes and leave this task?")) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleCancelEdit = () => {
    if (demoting) return;
    if (isDirty) {
      const confirmDiscard = window.confirm("Discard unsaved changes?");
      if (!confirmDiscard) return;
    }
    if (isCreateMode) {
      // In create mode, close the modal on cancel
      onClose();
    } else {
      setTitle(task?.title || "");
      setDescription(task?.description || "");
      setPlan(task?.implementationPlan || "");
      setNotes(task?.implementationNotes || "");
      setCommentBody("");
      setCommentAuthor("");
      setFinalSummary(task?.finalSummary || "");
      setDueDate(task?.dueDate?.replace(" ", "T") || "");
      setCriteria(task?.acceptanceCriteriaItems || []);
      setDefinitionOfDone(task?.definitionOfDoneItems || []);
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
    const original = task?.definitionOfDoneItems ?? [];
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

  const handleSave = async () => {
    if (demoting) return;
    setSaving(true);
    setError(null);

    // Validation for create mode
    if (isCreateMode && !title.trim()) {
      setError("Title is required");
      setSaving(false);
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

      if (isCreateMode) {
        taskData.type = taskType;
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
        await apiClient.updateTask(task.id, taskData);
        setMode("preview");
        if (onSaved) await onSaved();
        setCommentsChanged(false);
      }
    } catch (err) {
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
      setSaving(false);
    }
  };

  const handleToggleCriterion = async (index: number, checked: boolean) => {
    if (demoting) return;
    if (!task) return; // Can't toggle in create mode
    if (isFromOtherBranch) return; // Can't toggle for cross-branch tasks
    // Optimistic update
    const next = (criteria || []).map((c) => (c.index === index ? { ...c, checked } : c));
    setCriteria(next);
    try {
      await apiClient.updateTask(task.id, { acceptanceCriteriaItems: next });
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
    if (isFromOtherBranch) return; // Can't toggle for cross-branch tasks
    const next = (definitionOfDone || []).map((c) => (c.index === index ? { ...c, checked } : c));
    setDefinitionOfDone(next);
    try {
      const updates: TaskUpdatePayload = checked
        ? { definitionOfDoneCheck: [index] }
        : { definitionOfDoneUncheck: [index] };
      await apiClient.updateTask(task.id, updates);
      if (onSaved) await onSaved();
    } catch (err) {
      setDefinitionOfDone(definitionOfDone);
      console.error("Failed to update Definition of Done item", err);
    }
  };

  const handleInlineMetaUpdate = async (updates: InlineMetaUpdatePayload) => {
    if (demoting) return;
    // Don't allow updates for cross-branch tasks
    if (isFromOtherBranch) return;

    setError(null);

    // Optimistic UI
    if (updates.status !== undefined) setStatus(String(updates.status));
    if (updates.assignee !== undefined) setAssignee(updates.assignee as string[]);
    if (updates.labels !== undefined) setLabels(updates.labels as string[]);
    if (updates.priority !== undefined) setPriority(String(updates.priority));
    if (updates.type !== undefined) setTaskType(String(updates.type));
    if (updates.dependencies !== undefined) setDependencies(updates.dependencies as string[]);
    if (updates.references !== undefined) setReferences(updates.references as string[]);
    if (updates.modifiedFiles !== undefined) setModifiedFiles(updates.modifiedFiles as string[]);
    if (updates.milestone !== undefined) setMilestone((updates.milestone ?? "") as string);
    if (updates.description !== undefined) setDescription(String(updates.description));
    if ((updates as { implementationPlan?: string }).implementationPlan !== undefined)
      setPlan(String((updates as { implementationPlan?: string }).implementationPlan));
    if ((updates as { implementationNotes?: string }).implementationNotes !== undefined)
      setNotes(String((updates as { implementationNotes?: string }).implementationNotes));
    if (updates.finalSummary !== undefined) setFinalSummary(String(updates.finalSummary));

    // Only update server if editing existing task
    if (task) {
      try {
        await apiClient.updateTask(task.id, updates);
        if (onSaved) await onSaved();
      } catch (err) {
        console.error("Failed to update task metadata", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleTaskTypeChange = async (nextType: string) => {
    if (demoting) return;
    if (isFromOtherBranch) return;
    if (!task) {
      setTaskType(nextType);
      setTypeUpdateError(null);
      return;
    }
    if (typeUpdateInFlightRef.current) return;

    const previousType = taskType;
    const requestId = typeUpdateRequestRef.current + 1;
    typeUpdateRequestRef.current = requestId;
    typeUpdateInFlightRef.current = true;
    setIsTypeUpdating(true);
    setTypeUpdateError(null);
    setTaskType(nextType);

    try {
      const updatedTask = await apiClient.updateTask(task.id, { type: nextType });
      if (typeUpdateRequestRef.current !== requestId) return;
      setTaskType(updatedTask.type ?? "");
      if (onSaved) {
        try {
          await onSaved();
        } catch (refreshError) {
          console.error("Task type was saved, but refreshing task data failed", refreshError);
        }
      }
    } catch (updateError) {
      if (typeUpdateRequestRef.current !== requestId) return;
      setTaskType(previousType);
      setTypeUpdateError(updateError instanceof Error ? updateError.message : String(updateError));
    } finally {
      if (typeUpdateRequestRef.current === requestId) {
        typeUpdateInFlightRef.current = false;
        setIsTypeUpdating(false);
      }
    }
  };

  const handleAddComment = async () => {
    if (demoting) return;
    if (!task || isFromOtherBranch) return;
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
    preserveEditModeAfterCommentRefresh.current = true;
    try {
      const updatedTask = await apiClient.updateTask(task.id, {
        commentsAppend: [body],
        ...(author.length > 0 && { commentAuthor: author }),
      });
      setDisplayComments(updatedTask.comments ?? []);
      setCommentsChanged(true);
      setCommentBody("");
      setCommentAuthor("");
    } catch (err) {
      preserveEditModeAfterCommentRefresh.current = false;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommentSaving(false);
    }
  };

  // labels handled via ChipInput; no textarea parsing

	const handleComplete = async () => {
		if (demoting) return;
		if (!task) return;
		if (!window.confirm("Complete this task? It will be moved to the completed folder.")) return;
		try {
			await apiClient.completeTask(task.id);
			if (onSaved) await onSaved();
			onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
		}
	};

	const handleDemote = async () => {
		if (!task || !canDemote || activeDemotionRequest.current !== null) return;
		if (!window.confirm(`Demote "${task.title}" to draft? It will be moved to the drafts folder.`)) return;

		const request = { identity: demotionIdentity };
		activeDemotionRequest.current = request;
		const isCurrentRequest = () =>
			activeDemotionRequest.current === request && demotionIdentityRef.current === request.identity;
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
			await apiClient.demoteTask(task.id);
			if (!isCurrentRequest()) return;
			try {
				window.dispatchEvent(new window.Event("drafts-updated"));
				if (onSaved) await onSaved();
			} catch {
				await finishWithRefreshWarning(
					"The task was moved to drafts, but refreshing the view failed. Close this dialog and verify the draft before retrying.",
				);
				return;
			}
			if (!isCurrentRequest()) return;
			onClose();
		} catch (err) {
			if (!isCurrentRequest()) return;
			const demotionFailureState = getDemotionFailureState(err);
			if (demotionFailureState) {
				const message =
					demotionFailureState === "moved"
						? "The task was moved to drafts, but recording the Git commit failed. The view was refreshed; verify the draft before retrying."
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
    if (demoting) return;
    if (!task || !onArchive) return;
    if (!window.confirm(`Are you sure you want to archive "${task.title}"? This will move the task to the archive folder.`)) return;
    await onArchive();
  };

  const checkedCount = (criteria || []).filter((c) => c.checked).length;
  const totalCount = (criteria || []).length;
  const definitionCheckedCount = (definitionOfDone || []).filter((c) => c.checked).length;
  const definitionTotalCount = (definitionOfDone || []).length;
	const isDoneStatus = (status || "").toLowerCase().includes("done");
	const canDemote = Boolean(
		task && !isDraftMode && !isOpenDraft && isLocalEditableTask(task) && task.source !== "completed" && !isFromOtherBranch,
	);
  const comments = displayComments;

  const displayId = task?.id ?? "";
  const documentation = task?.documentation ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
		if (demoting) return;
        // When in edit mode, confirm closing if dirty
        if (mode === "edit" && isDirty) {
          if (!window.confirm("Discard unsaved changes and close?")) return;
        }
        refreshAfterCommentChange();
        onClose();
      }}
      title={isCreateMode ? (isDraftMode ? "Create New Draft" : "Create New Task") : `${displayId} — ${task.title}`}
      maxWidthClass="max-w-5xl"
      disableEscapeClose={mode === "edit" || mode === "create" || demoting}
      actions={
		<div className="flex flex-nowrap items-center justify-end gap-2">
		          {isDoneStatus && mode === "preview" && !isCreateMode && !isFromOtherBranch && (
		            <button
		              onClick={handleComplete}
		              disabled={demoting}
		              className="inline-flex items-center px-3 py-2 sm:px-4 rounded-lg text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title="Move to completed folder (removes from board)"
		            >
		              <span className="sm:hidden">Complete</span>
		              <span className="hidden sm:inline">Mark as completed</span>
		            </button>
		          )}
		          {canDemote && mode === "preview" && (
		            <button
		              onClick={() => void handleDemote()}
		              disabled={demoting}
		              className="inline-flex items-center px-3 py-2 sm:px-4 rounded-lg text-sm font-medium text-white bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
		              title="Move task to drafts"
		            >
		              {demoting ? "Demoting…" : (
		                <>
		                  <span className="sm:hidden">Demote</span>
		                  <span className="hidden sm:inline">Demote to draft</span>
		                </>
		              )}
		            </button>
		          )}
		          {mode === "preview" && !isCreateMode && !isFromOtherBranch ? (
		            <button
		              onClick={() => setMode("edit")}
		              disabled={demoting}
		              className="inline-flex items-center px-3 py-2 sm:px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title="Edit"
		            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          ) : (mode === "edit" || mode === "create") ? (
            <div className="flex items-center gap-2">
	              <button
		                onClick={handleCancelEdit}
		                disabled={demoting}
		                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		                title="Cancel"
		              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
	              <button
		                onClick={() => void handleSave()}
		                disabled={saving || demoting}
		                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 disabled:opacity-50"
		                title="Save"
		              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {saving ? "Saving…" : (isCreateMode ? "Create" : "Save")}
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      {error && (
        <div role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

		<fieldset disabled={demoting} className="contents" aria-busy={demoting}>
      {/* Cross-branch task indicator */}
      {isFromOtherBranch && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-200">
          <svg className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <div className="flex-1">
            <span className="font-medium">Read-only:</span> This task exists in the <span className="font-semibold">{task?.branch}</span> branch. Switch to that branch to edit it.
          </div>
        </div>
      )}

      {parentTask && task && (
        <nav
          aria-label="Task hierarchy"
          className="mb-4"
          data-task-hierarchy
          onClickCapture={confirmNavigationAwayFromEdits}
        >
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
            <li className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Parent
            </li>
            <li className="min-w-0 max-w-full">
              <button
                type="button"
                onClick={() => onNavigateToTask?.(parentTask)}
                disabled={!onNavigateToTask}
                data-parent-task-id={parentTask.id}
                data-parent-task-href={createUrlPath('/tasks', parentTask.id, parentTask.title)}
                className="group inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-1 text-left text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-default disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white"
                aria-label={`Open parent task ${parentTask.id}: ${parentTask.title} (${parentTask.status})`}
              >
                <span className="shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {parentTask.id}
                </span>
                <span className="min-w-0 break-words font-medium">{parentTask.title}</span>
                <HierarchyStatusBadge status={parentTask.status} statuses={availableStatuses} />
              </button>
            </li>
            <li aria-hidden="true">
              <HierarchyChevron />
            </li>
            <li aria-current="page" className="font-mono text-xs text-gray-500 dark:text-gray-400">
              {task.id}
            </li>
          </ol>
        </nav>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" onClickCapture={confirmNavigationAwayFromEdits}>
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Title field for create mode */}
          {isCreateMode && (
            <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
              <SectionHeader title="Title" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300 focus:border-transparent transition-colors duration-200"
              />
            </div>
          )}
          {/* Description */}
          <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Description" />
            <LongFormField
              value={description}
              onCommit={(next) => {
                setDescription(next);
                void handleInlineMetaUpdate({ description: next } as InlineMetaUpdatePayload);
              }}
              emptyLabel="No description"
              placeholder="Describe the task"
              ariaLabel="description"
              colorMode={theme}
              minHeight="12rem"
              readOnly={isFromOtherBranch}
              startEditing={isCreateMode}
            />
          </div>

          {subtasks.length > 0 && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <SectionHeader
                title="Subtasks"
                right={
                  subtaskProgress
                    ? `${subtaskProgress.completed} of ${subtaskProgress.total} complete`
                    : undefined
                }
              />
              <div className="divide-y divide-gray-100 dark:divide-gray-700" data-subtask-list>
                {subtasks.map((subtask) => {
                  const nested = summarizeSubtaskProgress(subtask, availableTasks, availableStatuses);
                  return (
                    <button
                      key={subtask.id}
                      type="button"
                      onClick={() => onNavigateToTask?.(subtask)}
                      disabled={!onNavigateToTask}
                      data-subtask-id={subtask.id}
                      data-subtask-href={createUrlPath('/tasks', subtask.id, subtask.title)}
                      className="group flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-gray-700/50"
                      aria-label={`Open subtask ${subtask.id}: ${subtask.title} (${subtask.status})`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">
                            {subtask.id}
                          </span>
                          <HierarchyStatusBadge status={subtask.status} statuses={availableStatuses} />
                          {nested && (
                            <span
                              className="text-xs text-gray-500 dark:text-gray-400"
                              data-nested-progress={`${nested.completed}/${nested.total}`}
                            >
                              {nested.completed} of {nested.total} complete
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block break-words text-sm font-medium text-gray-900 dark:text-gray-100">
                          {subtask.title}
                        </span>
                      </span>
                      <HierarchyChevron />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* References */}
          <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="References" />
            <div className="space-y-3">
              {references.length > 0 ? (
                <ul className="space-y-2">
                  {references.map((ref, idx) => (
                    <li key={idx} className="flex items-center gap-3 group">
                      <span className="flex-1 min-w-0">
                        {ref.startsWith("http://") || ref.startsWith("https://") ? (
                          <a
                            href={ref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                          >
                            {ref}
                          </a>
                        ) : (
                          <code className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all">
                            {ref}
                          </code>
                        )}
                      </span>
                      {!isFromOtherBranch && (
                        <button
                          onClick={() => {
                            const newRefs = references.filter((_, i) => i !== idx);
                            handleInlineMetaUpdate({ references: newRefs });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                          title="Remove reference"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No references</p>
              )}
              {mode === "preview" && !isFromOtherBranch && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem("newRef") as HTMLInputElement;
                    const value = input.value.trim();
                    if (value && !references.includes(value)) {
                      handleInlineMetaUpdate({ references: [...references, value] });
                      input.value = "";
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    name="newRef"
                    type="text"
                    placeholder="URL or file path..."
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-900 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:focus:ring-gray-300"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Modified files */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={`Modified files${modifiedFiles.length ? ` (${modifiedFiles.length})` : ""}`} />
            <div className="space-y-3">
              {modifiedFiles.length > 0 ? (
                // A finished task can list hundreds of paths, so the list scrolls inside the
                // section instead of pushing the sections below it out of reach.
                <ul className="space-y-2 max-h-64 overflow-y-auto overscroll-contain pr-1">
                  {modifiedFiles.map((file, idx) => (
                    <li key={idx} className="flex items-start gap-3 group">
                      <span className="flex-1 min-w-0">
                        <code className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all">
                          {file}
                        </code>
                      </span>
                      {!isFromOtherBranch && (
                        <button
                          onClick={() => {
                            const newFiles = modifiedFiles.filter((_, i) => i !== idx);
                            handleInlineMetaUpdate({ modifiedFiles: newFiles });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
                          title="Remove modified file"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No modified files</p>
              )}
              {mode === "preview" && !isFromOtherBranch && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem("newModifiedFile") as HTMLInputElement;
                    const value = input.value.trim();
                    if (value && !modifiedFiles.includes(value)) {
                      handleInlineMetaUpdate({ modifiedFiles: [...modifiedFiles, value] });
                      input.value = "";
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    name="newModifiedFile"
                    type="text"
                    placeholder="Path from project root..."
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Documentation */}
          {documentation.length > 0 && (
            <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
              <SectionHeader title="Documentation" />
              <div className="space-y-2">
                <ul className="space-y-2">
                  {documentation.map((doc, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <span className="flex-1 min-w-0">
                        {doc.startsWith("http://") || doc.startsWith("https://") ? (
                          <a
                            href={doc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                          >
                            {doc}
                          </a>
                        ) : (
                          <code className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all">
                            {doc}
                          </code>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Acceptance Criteria */}
          <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
            <SectionHeader
              title={`Acceptance Criteria ${totalCount ? `(${checkedCount}/${totalCount})` : ""}`}
              right={mode === "preview" ? (
                <span>Toggle to update</span>
              ) : null}
            />
            {mode === "preview" ? (
              <ul className="space-y-2">
                {(criteria || []).map((c) => (
                  <li key={c.index} className="flex items-start gap-2 rounded-md px-2 py-1">
                    <input
                      type="checkbox"
                      checked={c.checked}
                      onChange={(e) => void handleToggleCriterion(c.index, e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-gray-900 focus:ring-gray-900 dark:accent-gray-300 border-gray-300 rounded"
                    />
                    <span className="mt-0.5 w-8 shrink-0 text-right font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {`#${c.index}`}
                    </span>
                    <div className="text-sm text-gray-800 dark:text-gray-100">{c.text}</div>
                  </li>
                ))}
                {totalCount === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">No acceptance criteria</li>
                )}
              </ul>
            ) : (
              <AcceptanceCriteriaEditor criteria={criteria} onChange={setCriteria} label="" />
            )}
          </div>

          {/* Definition of Done */}
          <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
            <SectionHeader
              title={`Definition of Done ${definitionTotalCount ? `(${definitionCheckedCount}/${definitionTotalCount})` : ""}`}
              right={mode === "preview" ? (
                <span>Toggle to update</span>
              ) : null}
            />
            {mode === "preview" ? (
              <ul className="space-y-2">
                {(definitionOfDone || []).map((item) => (
                  <li key={item.index} className="flex items-start gap-2 rounded-md px-2 py-1">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => void handleToggleDefinitionOfDone(item.index, e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-gray-900 focus:ring-gray-900 dark:accent-gray-300 border-gray-300 rounded"
                    />
                    <div className="text-sm text-gray-800 dark:text-gray-100">{item.text}</div>
                  </li>
                ))}
                {definitionTotalCount === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">No Definition of Done items</li>
                )}
              </ul>
            ) : (
              <AcceptanceCriteriaEditor
                criteria={definitionOfDone}
                onChange={setDefinitionOfDone}
                label=""
                preserveIndices
                disableToggle={isCreateMode}
              />
            )}
          </div>

          {/* Implementation Plan */}
          <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Implementation Plan" />
            <LongFormField
              value={plan}
              onCommit={(next) => {
                setPlan(next);
                void handleInlineMetaUpdate({ implementationPlan: next } as InlineMetaUpdatePayload);
              }}
              emptyLabel="No plan"
              placeholder="How will this be done"
              ariaLabel="implementation plan"
              colorMode={theme}
              minHeight="8rem"
              readOnly={isFromOtherBranch}
              startEditing={isCreateMode}
            />
          </div>

          {/* Implementation Notes */}
          <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Implementation Notes" />
            <LongFormField
              value={notes}
              onCommit={(next) => {
                setNotes(next);
                void handleInlineMetaUpdate({ implementationNotes: next } as InlineMetaUpdatePayload);
              }}
              emptyLabel="No notes"
              placeholder="What was actually done"
              ariaLabel="implementation notes"
              colorMode={theme}
              minHeight="8rem"
              readOnly={isFromOtherBranch}
              startEditing={isCreateMode}
            />
          </div>

          {/* Comments */}
          {!isCreateMode && (
            <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
              <SectionHeader title={`Comments${comments.length ? ` (${comments.length})` : ""}`} />
              {comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <article key={`${comment.index}-${comment.createdDate}`} className="border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">#{comment.index}</span>
                        {comment.author ? <span>{comment.author}</span> : null}
                        {comment.createdDate ? <span>{formatStoredUtcDateForDisplay(comment.createdDate, dateFormat)}</span> : null}
                      </div>
                      <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                        <MermaidMarkdown source={comment.body} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">No comments</div>
              )}
              {mode === "edit" && !isFromOtherBranch && (
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder="Author"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300 focus:border-transparent transition-colors duration-200"
                  />
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={4}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleAddComment()}
                      disabled={commentSaving || commentBody.trim().length === 0}
                      className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors disabled:opacity-50"
                    >
                      {commentSaving ? "Adding..." : "Add comment"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Final Summary */}
          {(mode !== "preview" || finalSummary.trim().length > 0) && (
            <div className="border-b border-gray-200 px-1 pb-5 last:border-b-0 dark:border-gray-700">
              <SectionHeader title="Final Summary" right="Completion summary" />
              <LongFormField
                value={finalSummary}
                onCommit={(next) => {
                  setFinalSummary(next);
                  void handleInlineMetaUpdate({ finalSummary: next } as InlineMetaUpdatePayload);
                }}
                emptyLabel="No summary"
                placeholder="PR-style summary of what was implemented"
                ariaLabel="final summary"
                colorMode={theme}
                minHeight="6rem"
                readOnly={isFromOtherBranch}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="md:col-span-1 space-y-4">
          {/* Dates */}
	          {task && (
	            <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-1">
	              <div><span className="font-semibold text-gray-800 dark:text-gray-100">Created:</span> <span className="text-gray-700 dark:text-gray-200">{formatStoredUtcDateForDisplay(task.createdDate, dateFormat)}</span></div>
	              {task.updatedDate && (
	                <div><span className="font-semibold text-gray-800 dark:text-gray-100">Updated:</span> <span className="text-gray-700 dark:text-gray-200">{formatStoredUtcDateForDisplay(task.updatedDate, dateFormat)}</span></div>
	              )}
	              {task.dueDate && mode === "preview" && (
	                <div><span className="font-semibold text-gray-800 dark:text-gray-100">Due (UTC):</span> <span className="text-gray-700 dark:text-gray-200">{formatStoredUtcDateForDisplay(task.dueDate, dateFormat)}</span></div>
	              )}
	            </div>
	          )}
          {mode !== "preview" && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <SectionHeader title="Due (UTC)" />
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          )}
          {/* Title (editable for existing tasks) */}
          {task && (
            <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
              <SectionHeader title="Title" />
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
                onBlur={() => {
                  if (title.trim() && title !== task.title) {
                    void handleInlineMetaUpdate({ title: title.trim() });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                disabled={isFromOtherBranch}
                className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          )}

          {/* Status */}
          <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Status" />
            <StatusSelect current={status} onChange={(val) => handleInlineMetaUpdate({ status: val })} disabled={isFromOtherBranch || isOpenDraft} />
          </div>

          {/* Type */}
          <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Type" />
            <select
              aria-label="Task type"
              aria-invalid={typeUpdateError ? true : undefined}
              aria-describedby={typeUpdateError ? "task-type-update-error" : undefined}
              className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${isFromOtherBranch || isTypeUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={typeSelectionValue}
              onChange={(event) => void handleTaskTypeChange(event.target.value)}
              disabled={isFromOtherBranch || isTypeUpdating}
            >
              <option value="">No type</option>
              {!canonicalTypeSelection && taskType.trim() ? (
                <option value={taskType}>{taskType} (not configured)</option>
              ) : null}
              {typeOptions.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>
            {typeUpdateError ? (
              <p id="task-type-update-error" role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                {typeUpdateError}
              </p>
            ) : null}
          </div>

          {/* Assignee */}
          <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Assignee" />
            <ChipInput
              name="assignee"
              label=""
              value={assignee}
              onChange={(value) => handleInlineMetaUpdate({ assignee: value })}
              placeholder="Type name and press Enter"
              disabled={isFromOtherBranch}
            />
          </div>

          {/* Labels */}
          <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Labels" />
            <ChipInput
              name="labels"
              label=""
              value={labels}
              onChange={(value) => handleInlineMetaUpdate({ labels: value })}
              placeholder="Type label and press Enter or comma"
              disabled={isFromOtherBranch}
            />
          </div>

          {/* Priority */}
          <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Priority" />
            <select
              className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={priority}
              onChange={(e) => handleInlineMetaUpdate({ priority: e.target.value as any })}
              disabled={isFromOtherBranch}
            >
              <option value="">No Priority</option>
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Milestone */}
          <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Milestone" />
            <select
              className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={milestoneSelectionValue}
				onChange={(e) => {
					const value = e.target.value;
					setMilestone(value);
					handleInlineMetaUpdate({ milestone: value.trim().length > 0 ? value : null });
				}}
              disabled={isFromOtherBranch}
            >
              <option value="">No milestone</option>
              {!hasMilestoneSelection && milestoneSelectionValue ? (
                <option value={milestoneSelectionValue}>{resolveMilestoneLabel(milestoneSelectionValue)}</option>
              ) : null}
              {(milestoneEntities ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Dependencies */}
          <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
            <SectionHeader title="Dependencies" />
            <DependencyInput
              value={dependencies}
              onChange={(value) => handleInlineMetaUpdate({ dependencies: value })}
              availableTasks={availableTasks}
              currentTaskId={task?.id}
              label=""
              disabled={isFromOtherBranch}
            />
            {readiness && (
              <div
                className={`mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ${
                  readiness.isReady
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                }`}
              >
                <span aria-hidden="true">{readiness.isReady ? '✓' : '⏳'}</span>
                <span>{readiness.isReady ? 'Ready to start' : formatReadinessBlockers(readiness)}</span>
              </div>
            )}
          </div>

          {/* Archive button at bottom of sidebar */}
		          {task && onArchive && !isFromOtherBranch && (
		            <div className="border-b border-gray-200 px-1 pb-4 last:border-b-0 dark:border-gray-700">
		              <button
		                onClick={handleArchive}
		                disabled={demoting}
		                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-600/10 focus:outline-none focus:ring-1 focus:ring-red-600 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10 dark:focus:ring-red-400"
		              >
		                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive Task
              </button>
            </div>
          )}
        </div>
	      </div>
		</fieldset>
    </Modal>
  );
};

const StatusSelect: React.FC<{ current: string; onChange: (v: string) => void; disabled?: boolean }> = ({ current, onChange, disabled }) => {
  const [statuses, setStatuses] = useState<string[]>([]);
  useEffect(() => {
    apiClient.fetchStatuses().then(setStatuses).catch(() => setStatuses(["To Do", "In Progress", "Done"]));
  }, []);
  // A draft is on status Draft, and a completed record can hold a historical status, neither of
  // which is configured. Showing the value the record actually has beats showing the first option.
  const options = !current || statuses.includes(current) ? statuses : [current, ...statuses];
  return (
    <select
      className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
};

export default TaskDetailsModal;
