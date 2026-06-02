import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AcceptanceCriterion, Milestone, Task, TaskComment } from "../../types";
import Modal from "./Modal";
import { apiClient } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";
import AcceptanceCriteriaEditor from "./AcceptanceCriteriaEditor";
import MermaidMarkdown from './MermaidMarkdown';
import FilePreviewModal from "./FilePreviewModal";
import ChipInput from "./ChipInput";
import DependencyInput from "./DependencyInput";
import { PathAutocomplete } from "./PathAutocomplete";
import { formatStoredUtcDateForDisplay } from "../utils/date-display";
import { useI18n } from "../hooks/useI18n";

interface Props {
  task?: Task; // Optional for create mode
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void; // refresh callback
  onSubmit?: (taskData: Partial<Task>) => Promise<void>; // For creating new tasks
  onArchive?: () => void; // For archiving tasks
  onPromoted?: (task: Task) => void; // For opening a newly promoted task
  availableStatuses?: string[]; // Available statuses for new tasks
  isDraftMode?: boolean; // Whether creating a draft
  availableMilestones?: string[];
  milestoneEntities?: Milestone[];
  archivedMilestoneEntities?: Milestone[];
  definitionOfDoneDefaults?: string[];
}

type Mode = "preview" | "edit" | "create";

type TaskUpdatePayload = Partial<Task> & {
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

const containsCommentDelimiterLine = (value: string): boolean => /^\s*---\s*$/m.test(value.replace(/\r\n/g, "\n"));

const SectionHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight transition-colors duration-200">
      {title}
    </h3>
    {right ? <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">{right}</div> : null}
  </div>
);

export const TaskDetailsModal: React.FC<Props> = ({
  task,
  isOpen,
  onClose,
  onSaved,
  onSubmit,
  onArchive,
  onPromoted,
  availableStatuses,
  availableMilestones: _availableMilestones,
  milestoneEntities,
  archivedMilestoneEntities,
  isDraftMode,
  definitionOfDoneDefaults,
}) => {
  const { theme } = useTheme();
  const { t } = useI18n();
  const isCreateMode = !task;
  const isFromOtherBranch = Boolean(task?.branch);
  const [mode, setMode] = useState<Mode>(isCreateMode ? "create" : "preview");
  const modeRef = useRef(mode);
  const previousTaskId = useRef(task?.id ?? "");
  const previousIsOpen = useRef(isOpen);
  const [saving, setSaving] = useState(false);
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
  const initialDefinitionOfDone = task?.definitionOfDoneItems ?? (isCreateMode ? defaultDefinitionOfDone : []);
  const [definitionOfDone, setDefinitionOfDone] = useState<AcceptanceCriterion[]>(initialDefinitionOfDone);
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
  const [status, setStatus] = useState(task?.status || (isDraftMode ? "Draft" : (availableStatuses?.[0] || "To Do")));
  const [assignee, setAssignee] = useState<string[]>(task?.assignee || []);
  const [labels, setLabels] = useState<string[]>(task?.labels || []);
  const [priority, setPriority] = useState<string>(task?.priority || "");
  const [dependencies, setDependencies] = useState<string[]>(task?.dependencies || []);
  const [references, setReferences] = useState<string[]>(task?.references || []);
  const [documentation, setDocumentation] = useState<string[]>(task?.documentation || []);
  const [milestone, setMilestone] = useState<string>(task?.milestone || "");
  const [dueDate, setDueDate] = useState<string>(task?.dueDate || "");
  const [plannedStart, setPlannedStart] = useState<string>(task?.plannedStart || "");
  const [plannedEnd, setPlannedEnd] = useState<string>(task?.plannedEnd || "");
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const milestoneSelectionValue = resolveMilestoneToId(milestone);
  const hasMilestoneSelection = (milestoneEntities ?? []).some((milestoneEntity) => milestoneEntity.id === milestoneSelectionValue);

  // Keep a baseline for dirty-check
  const baseline = useMemo(() => ({
    title: task?.title || "",
    description: task?.description || "",
    plan: task?.implementationPlan || "",
    notes: task?.implementationNotes || "",
    finalSummary: task?.finalSummary || "",
    criteria: JSON.stringify(task?.acceptanceCriteriaItems || []),
    definitionOfDone: JSON.stringify(task?.definitionOfDoneItems || (isCreateMode ? defaultDefinitionOfDone : [])),
    dueDate: task?.dueDate || "",
    plannedStart: task?.plannedStart || "",
    plannedEnd: task?.plannedEnd || "",
  }), [task, defaultDefinitionOfDone, isCreateMode]);

  const isDirty = useMemo(() => {
    return (
      title !== baseline.title ||
      description !== baseline.description ||
      plan !== baseline.plan ||
      notes !== baseline.notes ||
      finalSummary !== baseline.finalSummary ||
      JSON.stringify(criteria) !== baseline.criteria ||
      JSON.stringify(definitionOfDone) !== baseline.definitionOfDone ||
      dueDate !== baseline.dueDate ||
      plannedStart !== baseline.plannedStart ||
      plannedEnd !== baseline.plannedEnd
    );
  }, [title, description, plan, notes, finalSummary, criteria, definitionOfDone, dueDate, plannedStart, plannedEnd, baseline]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const isDoneStatus = (status || "").toLowerCase().includes("done");
  const isDraftTask = task?.id?.startsWith("DRAFT-") ?? false;

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
      if (mode === "preview" && (e.key.toLowerCase() === "e") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setMode("edit");
      }
      if (mode === "preview" && isDoneStatus && (e.key.toLowerCase() === "c") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleComplete();
      }
      if (mode === "preview" && !isDoneStatus && !isDraftTask && (e.key.toLowerCase() === "d") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleDemote();
      }
      if (mode === "preview" && isDraftTask && (e.key.toLowerCase() === "p") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        void handlePromote();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [mode, title, description, plan, notes, finalSummary, criteria, definitionOfDone, status, isDraftTask]);

  // Reset local state when task changes or modal opens
  useEffect(() => {
    const nextTaskId = task?.id ?? "";
    const sameOpenTaskRefresh = isOpen && previousIsOpen.current && nextTaskId.length > 0 && previousTaskId.current === nextTaskId;
    const shouldPreserveEditMode =
      !isCreateMode &&
      sameOpenTaskRefresh &&
      (modeRef.current === "edit" || preserveEditModeAfterCommentRefresh.current);

    setTitle(task?.title || "");
    setDescription(task?.description || "");
    setPlan(task?.implementationPlan || "");
    setNotes(task?.implementationNotes || "");
    setDisplayComments(task?.comments ?? []);
    setCommentBody("");
    setCommentAuthor("");
    setCommentSaving(false);
    setCommentsChanged(false);
    setFinalSummary(task?.finalSummary || "");
    setCriteria(task?.acceptanceCriteriaItems || []);
    setDefinitionOfDone(task?.definitionOfDoneItems || (isCreateMode ? defaultDefinitionOfDone : []));
    setStatus(task?.status || (isDraftMode ? "Draft" : (availableStatuses?.[0] || "To Do")));
    setAssignee(task?.assignee || []);
    setLabels(task?.labels || []);
    setPriority(task?.priority || "");
    setDependencies(task?.dependencies || []);
    setReferences(task?.references || []);
    setDocumentation(task?.documentation || []);
    setMilestone(task?.milestone || "");
    setDueDate(task?.dueDate || "");
    setPlannedStart(task?.plannedStart || "");
    setPlannedEnd(task?.plannedEnd || "");
    setMode(shouldPreserveEditMode ? "edit" : isCreateMode ? "create" : "preview");
    preserveEditModeAfterCommentRefresh.current = false;
    previousTaskId.current = nextTaskId;
    previousIsOpen.current = isOpen;
    setError(null);
    // Preload tasks for dependency picker
    apiClient.fetchTasks().then(setAvailableTasks).catch(() => setAvailableTasks([]));
  }, [task, isOpen, isCreateMode, isDraftMode, availableStatuses, defaultDefinitionOfDone]);

  const refreshAfterCommentChange = useCallback(() => {
    if (!commentsChanged) return;
    setCommentsChanged(false);
    if (onSaved) void onSaved();
  }, [commentsChanged, onSaved]);

  const handleCancelEdit = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm(t.taskDetails.unsavedChangesPrompt);
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
      setCriteria(task?.acceptanceCriteriaItems || []);
      setDefinitionOfDone(task?.definitionOfDoneItems || []);
      setDueDate(task?.dueDate || "");
      setPlannedStart(task?.plannedStart || "");
      setPlannedEnd(task?.plannedEnd || "");
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

  const extractTempImageUrls = (text: string): string[] => {
    const matches = text.match(/\/assets\/\.temp\/[^)\s\\"']+/g);
    return matches ? [...new Set(matches)] : [];
  };

  const replaceTempImageUrls = (text: string, mapping: Record<string, string>): string => {
    let result = text;
    for (const [oldUrl, newUrl] of Object.entries(mapping)) {
      result = result.replaceAll(oldUrl, newUrl);
    }
    return result;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Validation for create mode
    if (isCreateMode && !title.trim()) {
      setError(t.common.failedToSave);
      setSaving(false);
      return;
    }

    try {
      // Promote temporary pasted images before saving.
      let saveDescription = description;
      let savePlan = plan;
      let saveNotes = notes;
      let saveFinalSummary = finalSummary;

      const tempUrls = [
        ...extractTempImageUrls(description),
        ...extractTempImageUrls(plan),
        ...extractTempImageUrls(notes),
        ...extractTempImageUrls(finalSummary),
      ];
      const uniqueTempUrls = [...new Set(tempUrls)];
      if (uniqueTempUrls.length > 0) {
        const mapping = await apiClient.promoteAssets(uniqueTempUrls);
        saveDescription = replaceTempImageUrls(saveDescription, mapping);
        savePlan = replaceTempImageUrls(savePlan, mapping);
        saveNotes = replaceTempImageUrls(saveNotes, mapping);
        saveFinalSummary = replaceTempImageUrls(saveFinalSummary, mapping);
        setDescription(saveDescription);
        setPlan(savePlan);
        setNotes(saveNotes);
        setFinalSummary(saveFinalSummary);
      }

      const taskData: TaskUpdatePayload = {
        title: title.trim(),
        description: saveDescription,
        implementationPlan: savePlan,
        implementationNotes: saveNotes,
        finalSummary: saveFinalSummary,
        acceptanceCriteriaItems: criteria,
        status,
        assignee,
        labels,
        priority: (priority === "" ? undefined : priority) as "high" | "medium" | "low" | undefined,
        dependencies,
        milestone: milestone.trim().length > 0 ? milestone.trim() : undefined,
        dueDate: dueDate.trim().length > 0 ? dueDate.trim() : undefined,
        plannedStart: plannedStart.trim().length > 0 ? plannedStart.trim() : undefined,
        plannedEnd: plannedEnd.trim().length > 0 ? plannedEnd.trim() : undefined,
      };

      if (isCreateMode && onSubmit) {
        Object.assign(taskData, buildDefinitionOfDoneCreatePayload());
        // Create new task
        await onSubmit(taskData);
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
      let errorMessage = t.common.failedToSave;

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
      console.error(t.common.failedToSave, err);
    }
  };

  const handleToggleDefinitionOfDone = async (index: number, checked: boolean) => {
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
      console.error(t.common.failedToSave, err);
    }
  };

  const handleInlineMetaUpdate = async (updates: InlineMetaUpdatePayload) => {
    // Don't allow updates for cross-branch tasks
    if (isFromOtherBranch) return;

    // Optimistic UI
    if (updates.status !== undefined) setStatus(String(updates.status));
    if (updates.assignee !== undefined) setAssignee(updates.assignee as string[]);
    if (updates.labels !== undefined) setLabels(updates.labels as string[]);
    if (updates.priority !== undefined) setPriority(String(updates.priority));
    if (updates.dependencies !== undefined) setDependencies(updates.dependencies as string[]);
    if (updates.references !== undefined) setReferences(updates.references as string[]);
    if (updates.documentation !== undefined) setDocumentation(updates.documentation as string[]);
    if (updates.milestone !== undefined) setMilestone((updates.milestone ?? "") as string);

    // Only update server if editing existing task
    if (task) {
      try {
        await apiClient.updateTask(task.id, updates);
        if (onSaved) await onSaved();
      } catch (err) {
        console.error(t.common.failedToSave, err);
        // No rollback for simplicity; caller can refresh
      }
    }
  };

  const handleAddComment = async () => {
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
		if (!task) return;
		if (!window.confirm(t.taskDetails.completeConfirm)) return;
		try {
			await apiClient.completeTask(task.id);
			if (onSaved) await onSaved();
			onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

	const handleDemote = async () => {
		if (!task) return;
		if (!window.confirm(t.taskDetails.demoteConfirm)) return;
		try {
			await apiClient.demoteTask(task.id);
			if (onSaved) await onSaved();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const handlePromote = async () => {
		if (!task) return;
		if (!window.confirm(t.taskDetails.promoteConfirm)) return;
		try {
			const promotedTask = await apiClient.promoteDraft(task.id);
			if (onSaved) await onSaved();
			window.dispatchEvent(new CustomEvent('drafts-updated'));
			onClose();
			if (onPromoted) onPromoted(promotedTask);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

  const handleArchive = async () => {
    if (!task || !onArchive) return;
    if (!window.confirm(t.taskDetails.archiveConfirm(task.title))) return;
    onArchive();
    onClose();
  };

  const checkedCount = (criteria || []).filter((c) => c.checked).length;
  const totalCount = (criteria || []).length;
  const definitionCheckedCount = (definitionOfDone || []).filter((c) => c.checked).length;
  const definitionTotalCount = (definitionOfDone || []).length;
  const comments = displayComments;

  const displayId = task?.id ?? "";


  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // When in edit mode, confirm closing if dirty
        if (mode === "edit" && isDirty) {
          if (!window.confirm(t.taskDetails.discardAndClosePrompt)) return;
        }
        refreshAfterCommentChange();
        onClose();
      }}
      title={isCreateMode ? (isDraftMode ? t.taskDetails.createDraft : t.taskDetails.createTask) : `${displayId} — ${task.title}`}
      maxWidthClass="max-w-5xl"
      disableEscapeClose={mode === "edit" || mode === "create"}
      actions={
        <div className="flex items-center gap-2">
		          {isDoneStatus && mode === "preview" && !isCreateMode && !isFromOtherBranch && (
		            <button
		              onClick={handleComplete}
		              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title={t.taskDetails.markCompletedTitle}
		            >
		              {t.taskDetails.markCompleted}
		            </button>
		          )}
		          {!isDoneStatus && !isDraftTask && mode === "preview" && !isCreateMode && !isFromOtherBranch && (
		            <button
		              onClick={handleDemote}
		              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title={t.taskDetails.demoteToDraftTitle}
		            >
		              {t.taskDetails.demoteToDraft}
		            </button>
		          )}
		          {isDraftTask && mode === "preview" && !isCreateMode && !isFromOtherBranch && (
		            <button
		              onClick={handlePromote}
		              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title={t.taskDetails.promoteToTaskTitle}
		            >
		              {t.taskDetails.promoteToTask}
		            </button>
		          )}
		          {mode === "preview" && !isCreateMode && !isFromOtherBranch ? (
		            <button
		              onClick={() => setMode("edit")}
		              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title={t.common.edit}
		            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t.common.edit}
            </button>
          ) : (mode === "edit" || mode === "create") ? (
            <div className="flex items-center gap-2">
		              <button
		                onClick={handleCancelEdit}
		                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		                title={t.common.cancel}
		              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t.common.cancel}
              </button>
		              <button
		                onClick={() => void handleSave()}
		                disabled={saving}
		                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 disabled:opacity-50"
		                title={t.common.save}
		              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {saving ? t.common.saving : (isCreateMode ? t.common.create : t.common.save)}
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      {error && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Cross-branch task indicator */}
      {isFromOtherBranch && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-200">
          <svg className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <div className="flex-1">
            <span className="font-medium">{t.common.readOnly}:</span> {t.taskDetails.crossBranchHint(task?.branch || "")}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Title field for create mode */}
          {isCreateMode && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <SectionHeader title={t.taskDetails.section.title} />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.taskDetails.placeholderTitle}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
              />
            </div>
          )}
          {/* Description */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={t.taskDetails.section.description} />
            {mode === "preview" ? (
              description ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MermaidMarkdown source={description} onFileClick={(path) => setPreviewFilePath(path)} />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noDescription}</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                <PasteAwareMDEditor
                  value={description}
                  onChange={(val) => setDescription(val || "")}
                  preview="edit"
                  height={320}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>

          {/* References */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={t.taskDetails.section.references} />
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
                          <button
                            onClick={() => setPreviewFilePath(ref)}
                            className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            title={t.taskDetails.clickToPreview}
                          >
                            {ref}
                          </button>
                        )}
                      </span>
                      {!isFromOtherBranch && (
                        <button
                          onClick={() => {
                            const newRefs = references.filter((_, i) => i !== idx);
                            handleInlineMetaUpdate({ references: newRefs });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                          title={t.taskDetails.removeReference}
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
                <p className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noReferences}</p>
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
                  <PathAutocomplete
                    name="newRef"
                    placeholder={t.taskDetails.placeholderRefDoc}
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    {t.common.add}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Documentation (hidden in preview when empty) */}
          {(documentation.length > 0 || mode !== "preview") && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={t.taskDetails.section.documentation} />
            <div className="space-y-3">
              {documentation.length > 0 ? (
                <ul className="space-y-2">
                  {documentation.map((doc, idx) => (
                    <li key={idx} className="flex items-center gap-3 group">
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
                          <button
                            onClick={() => setPreviewFilePath(doc)}
                            className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            title={t.taskDetails.clickToPreview}
                          >
                            {doc}
                          </button>
                        )}
                      </span>
                      {!isFromOtherBranch && (
                        <button
                          onClick={() => {
                            const newDocs = documentation.filter((_, i) => i !== idx);
                            handleInlineMetaUpdate({ documentation: newDocs });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                          title={t.taskDetails.removeDocumentation}
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
                <p className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noDocumentation}</p>
              )}
              {!isFromOtherBranch && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem("newDoc") as HTMLInputElement;
                    const value = input.value.trim();
                    if (value && !documentation.includes(value)) {
                      handleInlineMetaUpdate({ documentation: [...documentation, value] });
                      input.value = "";
                    }
                  }}
                  className="flex gap-2"
                >
                  <PathAutocomplete
                    name="newDoc"
                    placeholder={t.taskDetails.placeholderRefDoc}
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    {t.common.add}
                  </button>
                </form>
              )}
            </div>
          </div>
          )}

          {/* Acceptance Criteria */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader
              title={`${t.taskDetails.section.acceptanceCriteria} ${totalCount ? `(${checkedCount}/${totalCount})` : ""}`}
              right={mode === "preview" ? (
                <span>{t.taskDetails.toggleToUpdate}</span>
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
                      className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="text-sm text-gray-800 dark:text-gray-100">{c.text}</div>
                  </li>
                ))}
                {totalCount === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noAcceptanceCriteria}</li>
                )}
              </ul>
            ) : (
              <AcceptanceCriteriaEditor criteria={criteria} onChange={setCriteria} />
            )}
          </div>

          {/* Definition of Done */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader
              title={`${t.taskDetails.section.definitionOfDone} ${definitionTotalCount ? `(${definitionCheckedCount}/${definitionTotalCount})` : ""}`}
              right={mode === "preview" ? (
                <span>{t.taskDetails.toggleToUpdate}</span>
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
                      className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="text-sm text-gray-800 dark:text-gray-100">{item.text}</div>
                  </li>
                ))}
                {definitionTotalCount === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noDefinitionOfDone}</li>
                )}
              </ul>
            ) : (
              <AcceptanceCriteriaEditor
                criteria={definitionOfDone}
                onChange={setDefinitionOfDone}
                label={t.taskDetails.section.definitionOfDone}
                preserveIndices
                disableToggle={isCreateMode}
              />
            )}
          </div>

          {/* Implementation Plan */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={t.taskDetails.section.implementationPlan} />
            {mode === "preview" ? (
              plan ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MermaidMarkdown source={plan} onFileClick={(path) => setPreviewFilePath(path)} />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noPlan}</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                <PasteAwareMDEditor
                  value={plan}
                  onChange={(val) => setPlan(val || "")}
                  preview="edit"
                  height={280}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>

          {/* Implementation Notes */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={t.taskDetails.section.implementationNotes} />
            {mode === "preview" ? (
              notes ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MermaidMarkdown source={notes} onFileClick={(path) => setPreviewFilePath(path)} />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noNotes}</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                <PasteAwareMDEditor
                  value={notes}
                  onChange={(val) => setNotes(val || "")}
                  preview="edit"
                  height={280}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>

          {/* Comments */}
          {!isCreateMode && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <SectionHeader title={`Comments${comments.length ? ` (${comments.length})` : ""}`} />
              {comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <article key={`${comment.index}-${comment.createdDate}`} className="border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">#{comment.index}</span>
                        {comment.author ? <span>{comment.author}</span> : null}
                        {comment.createdDate ? <span>{formatStoredUtcDateForDisplay(comment.createdDate)}</span> : null}
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
                  />
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={4}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleAddComment()}
                      disabled={commentSaving || commentBody.trim().length === 0}
                      className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
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
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <SectionHeader title={t.taskDetails.section.finalSummary} right={t.taskDetails.section.completionSummary} />
              {mode === "preview" ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MermaidMarkdown source={finalSummary} onFileClick={(path) => setPreviewFilePath(path)} />
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                  <PasteAwareMDEditor
                    value={finalSummary}
                    onChange={(val) => setFinalSummary(val || "")}
                    preview="edit"
                    height={220}
                    data-color-mode={theme}
                    textareaProps={{
                      placeholder: t.taskDetails.placeholderFinalSummary,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="md:col-span-1 space-y-4">
          {/* Dates */}
	          {task && (
	            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
	              <div><span className="font-semibold text-gray-800 dark:text-gray-100">{t.common.created}:</span> <span className="text-gray-700 dark:text-gray-200">{formatStoredUtcDateForDisplay(task.createdDate)}</span></div>
	              {task.updatedDate && (
	                <div><span className="font-semibold text-gray-800 dark:text-gray-100">{t.common.updated}:</span> <span className="text-gray-700 dark:text-gray-200">{formatStoredUtcDateForDisplay(task.updatedDate)}</span></div>
	              )}
	            </div>
	          )}
          {/* Title (editable for existing tasks) */}
          {task && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <SectionHeader title={t.taskDetails.section.title} />
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
                className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          )}

          {/* Status */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.status} />
            <StatusSelect current={status} onChange={(val) => handleInlineMetaUpdate({ status: val })} disabled={isFromOtherBranch} />
          </div>

          {/* Assignee */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.assignee} />
            <ChipInput
              name="assignee"
              label=""
              value={assignee}
              onChange={(value) => handleInlineMetaUpdate({ assignee: value })}
              placeholder={t.taskDetails.placeholderAssignee}
              disabled={isFromOtherBranch}
            />
          </div>

          {/* Labels */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.labels} />
            <ChipInput
              name="labels"
              label=""
              value={labels}
              onChange={(value) => handleInlineMetaUpdate({ labels: value })}
              placeholder={t.taskDetails.placeholderLabels}
              disabled={isFromOtherBranch}
            />
          </div>

          {/* Priority */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.priority} />
            <select
              className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={priority}
              onChange={(e) => handleInlineMetaUpdate({ priority: e.target.value as any })}
              disabled={isFromOtherBranch}
            >
              <option value="">{t.common.none}</option>
              <option value="low">{t.common.low}</option>
              <option value="medium">{t.common.medium}</option>
              <option value="high">{t.common.high}</option>
            </select>
          </div>

          {/* Milestone */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.milestone} />
            <select
              className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={milestoneSelectionValue}
				onChange={(e) => {
					const value = e.target.value;
					setMilestone(value);
					handleInlineMetaUpdate({ milestone: value.trim().length > 0 ? value : null });
				}}
              disabled={isFromOtherBranch}
            >
              <option value="">{t.taskDetails.noMilestone}</option>
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
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.dependencies} />
            <DependencyInput
              value={dependencies}
              onChange={(value) => handleInlineMetaUpdate({ dependencies: value })}
              availableTasks={availableTasks}
              currentTaskId={task?.id}
              label=""
              disabled={isFromOtherBranch}
            />
          </div>

          {/* Dates */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.dates} />
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.taskDetails.section.dueDate}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDueDate(value);
                    let updates: InlineMetaUpdatePayload = { dueDate: value || undefined };
                    if (value && !plannedStart) {
                      const today = new Date().toISOString().slice(0, 10);
                      if (value >= today) {
                        setPlannedStart(today);
                        setPlannedEnd(value);
                        updates.plannedStart = today;
                        updates.plannedEnd = value;
                      }
                    }
                    if (task && !isCreateMode) {
                      handleInlineMetaUpdate(updates);
                    }
                  }}
                  disabled={isFromOtherBranch}
                  className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.taskDetails.section.plannedStart}</label>
                <input
                  type="date"
                  value={plannedStart}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPlannedStart(value);
                    if (task && !isCreateMode) {
                      handleInlineMetaUpdate({ plannedStart: value || undefined });
                    }
                  }}
                  disabled={isFromOtherBranch}
                  className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.taskDetails.section.plannedEnd}</label>
                <input
                  type="date"
                  value={plannedEnd}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPlannedEnd(value);
                    if (task && !isCreateMode) {
                      handleInlineMetaUpdate({ plannedEnd: value || undefined });
                    }
                  }}
                  disabled={isFromOtherBranch}
                  className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isFromOtherBranch ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Archive button at bottom of sidebar */}
		          {task && onArchive && !isFromOtherBranch && (
		            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
		              <button
		                onClick={handleArchive}
		                className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-500 dark:bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-400 dark:focus:ring-red-500 transition-colors duration-200"
		              >
		                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {t.taskDetails.archiveTask}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
    {previewFilePath && (
      <FilePreviewModal
        path={previewFilePath}
        onClose={() => setPreviewFilePath(null)}
      />
    )}
    </>
  );
};

const StatusSelect: React.FC<{ current: string; onChange: (v: string) => void; disabled?: boolean }> = ({ current, onChange, disabled }) => {
  const [statuses, setStatuses] = useState<string[]>([]);
  useEffect(() => {
    apiClient.fetchStatuses().then(setStatuses).catch(() => setStatuses(["To Do", "In Progress", "Done"]));
  }, []);
  return (
    <select
      className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
};

export default TaskDetailsModal;
