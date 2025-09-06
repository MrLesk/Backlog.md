import React, { useEffect, useMemo, useState } from "react";
import type { AcceptanceCriterion, Task } from "../../types";
import Modal from "./Modal";
import { apiClient } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import MDEditor from "@uiw/react-md-editor";
import AcceptanceCriteriaEditor from "./AcceptanceCriteriaEditor";
import ChipInput from "./ChipInput";
import DependencyInput from "./DependencyInput";

interface Props {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void; // refresh callback
}

type Mode = "preview" | "edit";

const SectionHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight transition-colors duration-200">
      {title}
    </h3>
    {right ? <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">{right}</div> : null}
  </div>
);

export const TaskDetailsModal: React.FC<Props> = ({ task, isOpen, onClose, onSaved }) => {
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>("preview");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields (edit mode)
  const [description, setDescription] = useState(task.description || "");
  const [plan, setPlan] = useState(task.implementationPlan || "");
  const [notes, setNotes] = useState(task.implementationNotes || "");
  const [criteria, setCriteria] = useState<AcceptanceCriterion[]>(task.acceptanceCriteriaItems || []);

  // Sidebar metadata (inline edit)
  const [status, setStatus] = useState(task.status);
  const [assignee, setAssignee] = useState<string[]>(task.assignee || []);
  const [labels, setLabels] = useState<string[]>(task.labels || []);
  const [labelsText, setLabelsText] = useState<string>((task.labels || []).join("\n"));
  const [priority, setPriority] = useState<string>(task.priority || "");
  const [dependencies, setDependencies] = useState<string[]>(task.dependencies || []);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);

  // Keep a baseline for dirty-check
  const baseline = useMemo(() => ({
    description: task.description || "",
    plan: task.implementationPlan || "",
    notes: task.implementationNotes || "",
    criteria: JSON.stringify(task.acceptanceCriteriaItems || []),
  }), [task]);

  const isDirty = useMemo(() => {
    return (
      description !== baseline.description ||
      plan !== baseline.plan ||
      notes !== baseline.notes ||
      JSON.stringify(criteria) !== baseline.criteria
    );
  }, [description, plan, notes, criteria, baseline]);

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
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [mode, description, plan, notes, criteria]);

  // Reset local state when task changes or modal opens
  useEffect(() => {
    setDescription(task.description || "");
    setPlan(task.implementationPlan || "");
    setNotes(task.implementationNotes || "");
    setCriteria(task.acceptanceCriteriaItems || []);
    setStatus(task.status);
    setAssignee(task.assignee || []);
    setLabels(task.labels || []);
    setLabelsText((task.labels || []).join("\n"));
    setPriority(task.priority || "");
    setDependencies(task.dependencies || []);
    setMode("preview");
    setError(null);
    // Preload tasks for dependency picker
    apiClient.fetchTasks().then(setAvailableTasks).catch(() => setAvailableTasks([]));
  }, [task, isOpen]);

  const handleCancelEdit = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm("Discard unsaved changes?");
      if (!confirmDiscard) return;
    }
    setDescription(task.description || "");
    setPlan(task.implementationPlan || "");
    setNotes(task.implementationNotes || "");
    setCriteria(task.acceptanceCriteriaItems || []);
    setMode("preview");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates: Partial<Task> = {
        description,
        implementationPlan: plan,
        implementationNotes: notes,
        acceptanceCriteriaItems: criteria,
      };
      await apiClient.updateTask(task.id, updates);
      setMode("preview");
      if (onSaved) await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCriterion = async (index: number, checked: boolean) => {
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

  const handleInlineMetaUpdate = async (updates: Partial<Task>) => {
    try {
      // Optimistic UI
      if (updates.status !== undefined) setStatus(String(updates.status));
      if (updates.assignee !== undefined) setAssignee(updates.assignee as string[]);
      if (updates.labels !== undefined) {
        setLabels(updates.labels as string[]);
        setLabelsText(((updates.labels as string[]) || []).join("\n"));
      }
      if (updates.priority !== undefined) setPriority(String(updates.priority));
      if (updates.dependencies !== undefined) setDependencies(updates.dependencies as string[]);

      await apiClient.updateTask(task.id, updates);
      if (onSaved) await onSaved();
    } catch (err) {
      console.error("Failed to update task metadata", err);
      // No rollback for simplicity; caller can refresh
    }
  };

  const parseLabels = (text: string): string[] => {
    return Array.from(new Set(text
      .split(/\n|,/)
      .map(s => s.trim())
      .filter(Boolean)));
  };

  const handleLabelsBlur = async () => {
    const next = parseLabels(labelsText);
    await handleInlineMetaUpdate({ labels: next });
  };

  const handleComplete = async () => {
    if (!window.confirm("Complete this task? It will be moved to the completed archive.")) return;
    try {
      await apiClient.completeTask(task.id);
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const checkedCount = (criteria || []).filter((c) => c.checked).length;
  const totalCount = (criteria || []).length;
  const isDoneStatus = (status || "").toLowerCase().includes("done");

  const displayId = useMemo(() => task.id.replace(/^task-/i, "TASK-"), [task.id]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // When in edit mode, confirm closing if dirty
        if (mode === "edit" && isDirty) {
          if (!window.confirm("Discard unsaved changes and close?")) return;
        }
        onClose();
      }}
      title={`${displayId} — ${task.title}`}
      maxWidthClass="max-w-4xl"
      disableEscapeClose={mode === "edit"}
      actions={
        <div className="flex items-center gap-2">
          {isDoneStatus && mode === "preview" && (
            <button
              onClick={handleComplete}
              className="inline-flex items-center px-2.5 py-1 text-xs bg-emerald-600 dark:bg-emerald-700 text-white font-medium rounded-md hover:bg-emerald-700 dark:hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-400 dark:focus:ring-emerald-500 transition-colors duration-200 cursor-pointer"
              title="Complete (archive from board)"
            >
              Complete
            </button>
          )}
          {mode === "preview" ? (
            <button
              onClick={() => setMode("edit")}
              className="inline-flex items-center px-2.5 py-1 text-xs bg-blue-600 dark:bg-blue-700 text-white font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors duration-200 cursor-pointer"
            >
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEdit}
                className="inline-flex items-center px-2.5 py-1 text-xs bg-gray-500 dark:bg-gray-600 text-white font-medium rounded-md hover:bg-gray-600 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center px-2.5 py-1 text-xs bg-blue-600 dark:bg-blue-700 text-white font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
      }
    >
      {error && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title="Description" />
            {mode === "preview" ? (
              description ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MDEditor.Markdown source={description} />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">No description</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <MDEditor
                  value={description}
                  onChange={(val) => setDescription(val || "")}
                  preview="edit"
                  height={240}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>

          {/* Acceptance Criteria */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
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
                      className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="text-sm text-gray-800 dark:text-gray-100">{c.text}</div>
                  </li>
                ))}
                {totalCount === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">No acceptance criteria</li>
                )}
              </ul>
            ) : (
              <AcceptanceCriteriaEditor criteria={criteria} onChange={setCriteria} />
            )}
          </div>

          {/* Implementation Plan */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title="Implementation Plan" />
            {mode === "preview" ? (
              plan ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MDEditor.Markdown source={plan} />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">No plan</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <MDEditor
                  value={plan}
                  onChange={(val) => setPlan(val || "")}
                  preview="edit"
                  height={220}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>

          {/* Implementation Notes */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title="Implementation Notes" />
            {mode === "preview" ? (
              notes ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MDEditor.Markdown source={notes} />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">No notes</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <MDEditor
                  value={notes}
                  onChange={(val) => setNotes(val || "")}
                  preview="edit"
                  height={220}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="md:col-span-1 space-y-4">
          {/* Dates */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <div className="font-semibold text-gray-800 dark:text-gray-100">Created: {task.createdDate}</div>
            {task.updatedDate && <div className="font-semibold text-gray-800 dark:text-gray-100">Updated: {task.updatedDate}</div>}
          </div>
          {/* Status */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title="Status" />
            <StatusSelect current={status} onChange={(val) => handleInlineMetaUpdate({ status: val })} />
          </div>

          {/* Assignee */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title="Assignee" />
            <ChipInput
              name="assignee"
              label=""
              value={assignee}
              onChange={(value) => handleInlineMetaUpdate({ assignee: value })}
              placeholder="Type name and press Enter"
            />
          </div>

          {/* Labels */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title="Labels" />
            <AutoResizeTextarea
              value={labelsText}
              onChange={setLabelsText}
              onBlur={handleLabelsBlur}
              placeholder="Comma or newline separated"
            />
          </div>

          {/* Priority */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title="Priority" />
            <select
              className="w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200"
              value={priority}
              onChange={(e) => handleInlineMetaUpdate({ priority: e.target.value as any })}
            >
              <option value="">No Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Dependencies */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title="Dependencies" />
            <DependencyInput
              value={dependencies}
              onChange={(value) => handleInlineMetaUpdate({ dependencies: value })}
              availableTasks={availableTasks}
              currentTaskId={task.id}
              label=""
            />
          </div>

          {/* Metadata */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            {task.milestone && <div>Milestone: {task.milestone}</div>}
            <div>Created: {task.createdDate}</div>
            {task.updatedDate && <div>Updated: {task.updatedDate}</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const StatusSelect: React.FC<{ current: string; onChange: (v: string) => void }> = ({ current, onChange }) => {
  const [statuses, setStatuses] = useState<string[]>([]);
  useEffect(() => {
    apiClient.fetchStatuses().then(setStatuses).catch(() => setStatuses(["To Do", "In Progress", "Done"]));
  }, []);
  return (
    <select
      className="w-full px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200"
      value={current}
      onChange={(e) => onChange(e.target.value)}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
};

const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}> = ({ value, onChange, onBlur, placeholder }) => {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      rows={1}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 resize-none"
      placeholder={placeholder}
    />
  );
};

export default TaskDetailsModal;
