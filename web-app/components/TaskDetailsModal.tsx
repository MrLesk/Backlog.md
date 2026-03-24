"use client";

import MDEditor from "@uiw/react-md-editor";
import React, { useEffect, useMemo, useState } from "react";
import type { AcceptanceCriterion, Task } from "@/types";
import { apiClient } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import AcceptanceCriteriaEditor from "./AcceptanceCriteriaEditor";
import ChipInput from "./ChipInput";
import DependencyInput from "./DependencyInput";
import MermaidMarkdown from "./MermaidMarkdown";
import Modal from "./Modal";

interface Props {
	task?: Task;
	isOpen: boolean;
	onClose: () => void;
	onSaved?: () => Promise<void> | void;
	onSubmit?: (taskData: Partial<Task>) => Promise<void>;
	onArchive?: () => void;
	availableStatuses?: string[];
	isDraftMode?: boolean;
}

type Mode = "preview" | "edit" | "create";

const SectionHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
	<div className="flex items-center justify-between mb-3">
		<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h3>
		{right ? <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">{right}</div> : null}
	</div>
);

const StatusSelect: React.FC<{
	current: string;
	onChange: (v: string) => void;
	disabled?: boolean;
	statuses?: string[];
}> = ({ current, onChange, disabled, statuses: externalStatuses }) => {
	const [statuses, setStatuses] = useState<string[]>(externalStatuses ?? []);
	useEffect(() => {
		if (!externalStatuses) {
			apiClient
				.fetchStatuses()
				.then(setStatuses)
				.catch(() => setStatuses(["To Do", "In Progress", "Done"]));
		}
	}, [externalStatuses]);
	return (
		<select
			className={`w-full px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 transition-colors duration-200 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
			value={current}
			onChange={(e) => onChange(e.target.value)}
			disabled={disabled}
		>
			{statuses.map((s) => (
				<option key={s} value={s}>
					{s}
				</option>
			))}
		</select>
	);
};

export const TaskDetailsModal: React.FC<Props> = ({
	task,
	isOpen,
	onClose,
	onSaved,
	onSubmit,
	onArchive,
	availableStatuses,
	isDraftMode,
}) => {
	const { theme } = useTheme();
	const isCreateMode = !task;
	const [mode, setMode] = useState<Mode>(isCreateMode ? "create" : "preview");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [title, setTitle] = useState(task?.title || "");
	const [description, setDescription] = useState(task?.description || "");
	const [plan, setPlan] = useState(task?.implementationPlan || "");
	const [notes, setNotes] = useState(task?.implementationNotes || "");
	const [criteria, setCriteria] = useState<AcceptanceCriterion[]>(task?.acceptanceCriteriaItems || []);

	const [status, setStatus] = useState(
		task?.status || (isDraftMode ? "Draft" : availableStatuses?.[0] || "To Do"),
	);
	const [assignee, setAssignee] = useState<string[]>(task?.assignee || []);
	const [labels, setLabels] = useState<string[]>(task?.labels || []);
	const [priority, setPriority] = useState<string>(task?.priority || "");
	const [dependencies, setDependencies] = useState<string[]>(task?.dependencies || []);
	const [availableTasks, setAvailableTasks] = useState<Task[]>([]);

	const baseline = useMemo(
		() => ({
			title: task?.title || "",
			description: task?.description || "",
			plan: task?.implementationPlan || "",
			notes: task?.implementationNotes || "",
			criteria: JSON.stringify(task?.acceptanceCriteriaItems || []),
		}),
		[task],
	);

	const isDirty = useMemo(
		() =>
			title !== baseline.title ||
			description !== baseline.description ||
			plan !== baseline.plan ||
			notes !== baseline.notes ||
			JSON.stringify(criteria) !== baseline.criteria,
		[title, description, plan, notes, criteria, baseline],
	);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (mode === "edit" && e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				handleCancelEdit();
			}
			if (mode === "edit" && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				e.stopPropagation();
				void handleSave();
			}
			if (
				mode === "preview" &&
				e.key.toLowerCase() === "e" &&
				!e.metaKey &&
				!e.ctrlKey &&
				!e.altKey
			) {
				e.preventDefault();
				e.stopPropagation();
				setMode("edit");
			}
		};
		window.addEventListener("keydown", onKey, { capture: true });
		return () => window.removeEventListener("keydown", onKey, { capture: true } as EventListenerOptions);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode, isDirty]);

	useEffect(() => {
		setTitle(task?.title || "");
		setDescription(task?.description || "");
		setPlan(task?.implementationPlan || "");
		setNotes(task?.implementationNotes || "");
		setCriteria(task?.acceptanceCriteriaItems || []);
		setStatus(task?.status || (isDraftMode ? "Draft" : availableStatuses?.[0] || "To Do"));
		setAssignee(task?.assignee || []);
		setLabels(task?.labels || []);
		setPriority(task?.priority || "");
		setDependencies(task?.dependencies || []);
		setMode(isCreateMode ? "create" : "preview");
		setError(null);
		apiClient
			.fetchTasks()
			.then(setAvailableTasks)
			.catch(() => setAvailableTasks([]));
	}, [task, isOpen, isCreateMode, isDraftMode, availableStatuses]);

	const handleCancelEdit = () => {
		if (isDirty && !window.confirm("Discard unsaved changes?")) return;
		if (isCreateMode) {
			onClose();
		} else {
			setTitle(task?.title || "");
			setDescription(task?.description || "");
			setPlan(task?.implementationPlan || "");
			setNotes(task?.implementationNotes || "");
			setCriteria(task?.acceptanceCriteriaItems || []);
			setMode("preview");
		}
	};

	const handleSave = async () => {
		setSaving(true);
		setError(null);
		if (isCreateMode && !title.trim()) {
			setError("Title is required");
			setSaving(false);
			return;
		}
		try {
			const taskData: Partial<Task> = {
				title: title.trim(),
				description,
				implementationPlan: plan,
				implementationNotes: notes,
				acceptanceCriteriaItems: criteria,
				status,
				assignee,
				labels,
				priority: (priority === "" ? undefined : priority) as Task["priority"],
				dependencies,
			};
			if (isCreateMode && onSubmit) {
				await onSubmit(taskData);
				onClose();
			} else if (task) {
				await apiClient.updateTask(task.id, taskData);
				setMode("preview");
				if (onSaved) await onSaved();
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save task");
		} finally {
			setSaving(false);
		}
	};

	const handleToggleCriterion = async (index: number, checked: boolean) => {
		if (!task) return;
		const next = (criteria || []).map((c) => (c.index === index ? { ...c, checked } : c));
		setCriteria(next);
		try {
			await apiClient.updateTask(task.id, { acceptanceCriteriaItems: next });
			if (onSaved) await onSaved();
		} catch {
			setCriteria(criteria);
		}
	};

	const handleInlineMetaUpdate = async (updates: Partial<Task>) => {
		if (updates.status !== undefined) setStatus(String(updates.status));
		if (updates.assignee !== undefined) setAssignee(updates.assignee as string[]);
		if (updates.labels !== undefined) setLabels(updates.labels as string[]);
		if (updates.priority !== undefined) setPriority(String(updates.priority ?? ""));
		if (updates.dependencies !== undefined) setDependencies(updates.dependencies as string[]);
		if (task) {
			try {
				await apiClient.updateTask(task.id, updates);
				if (onSaved) await onSaved();
			} catch (err) {
				console.error("Failed to update task metadata", err);
			}
		}
	};

	const handleComplete = async () => {
		if (!task) return;
		if (!window.confirm("Mark task as completed? It will be removed from the board.")) return;
		try {
			await apiClient.completeTask(task.id);
			if (onSaved) await onSaved();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const handleArchive = async () => {
		if (!task || !onArchive) return;
		if (!window.confirm(`Archive "${task.title}"?`)) return;
		onArchive();
		onClose();
	};

	const checkedCount = (criteria || []).filter((c) => c.checked).length;
	const totalCount = (criteria || []).length;
	const isDoneStatus = (status || "").toLowerCase().includes("done");
	const displayId = useMemo(() => task?.id?.replace(/^task-/i, "TASK-") || "", [task?.id]);

	return (
		<Modal
			isOpen={isOpen}
			onClose={() => {
				if (mode === "edit" && isDirty) {
					if (!window.confirm("Discard unsaved changes and close?")) return;
				}
				onClose();
			}}
			title={
				isCreateMode
					? isDraftMode
						? "Create New Draft"
						: "Create New Task"
					: `${displayId} — ${task.title}`
			}
			maxWidthClass="max-w-5xl"
			disableEscapeClose={mode === "edit" || mode === "create"}
			actions={
				<div className="flex items-center gap-2">
					{isDoneStatus && mode === "preview" && !isCreateMode && (
						<button
							onClick={handleComplete}
							className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors cursor-pointer"
						>
							Mark as completed
						</button>
					)}
					{mode === "preview" && !isCreateMode ? (
						<button
							onClick={() => setMode("edit")}
							className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
						>
							<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
								/>
							</svg>
							Edit
						</button>
					) : mode === "edit" || mode === "create" ? (
						<div className="flex items-center gap-2">
							<button
								onClick={handleCancelEdit}
								className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button
								onClick={() => void handleSave()}
								disabled={saving}
								className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
							>
								{saving ? "Saving…" : isCreateMode ? "Create" : "Save"}
							</button>
						</div>
					) : null}
				</div>
			}
		>
			{error && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* Main content */}
				<div className="md:col-span-2 space-y-6">
					{isCreateMode && (
						<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
							<SectionHeader title="Title" />
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Enter task title"
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
							/>
						</div>
					)}

					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
						<SectionHeader title="Description" />
						{mode === "preview" ? (
							description ? (
								<div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
									<MermaidMarkdown source={description} />
								</div>
							) : (
								<div className="text-sm text-gray-500 dark:text-gray-400">No description</div>
							)
						) : (
							<div className="border border-gray-200 dark:border-gray-700 rounded-md">
								<MDEditor
									value={description}
									onChange={(val) => setDescription(val || "")}
									preview="edit"
									height={320}
									data-color-mode={theme}
								/>
							</div>
						)}
					</div>

					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
						<SectionHeader
							title={`Acceptance Criteria${totalCount ? ` (${checkedCount}/${totalCount})` : ""}`}
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
									<li className="text-sm text-gray-500 dark:text-gray-400">
										No acceptance criteria
									</li>
								)}
							</ul>
						) : (
							<AcceptanceCriteriaEditor criteria={criteria} onChange={setCriteria} />
						)}
					</div>

					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
						<SectionHeader title="Implementation Plan" />
						{mode === "preview" ? (
							plan ? (
								<div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
									<MermaidMarkdown source={plan} />
								</div>
							) : (
								<div className="text-sm text-gray-500 dark:text-gray-400">No plan</div>
							)
						) : (
							<div className="border border-gray-200 dark:border-gray-700 rounded-md">
								<MDEditor
									value={plan}
									onChange={(val) => setPlan(val || "")}
									preview="edit"
									height={280}
									data-color-mode={theme}
								/>
							</div>
						)}
					</div>

					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
						<SectionHeader title="Implementation Notes" />
						{mode === "preview" ? (
							notes ? (
								<div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
									<MermaidMarkdown source={notes} />
								</div>
							) : (
								<div className="text-sm text-gray-500 dark:text-gray-400">No notes</div>
							)
						) : (
							<div className="border border-gray-200 dark:border-gray-700 rounded-md">
								<MDEditor
									value={notes}
									onChange={(val) => setNotes(val || "")}
									preview="edit"
									height={280}
									data-color-mode={theme}
								/>
							</div>
						)}
					</div>
				</div>

				{/* Sidebar */}
				<div className="md:col-span-1 space-y-4">
					{task && (
						<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
							<div>
								<span className="font-semibold text-gray-800 dark:text-gray-100">Created:</span>{" "}
								{task.createdDate}
							</div>
							{task.updatedDate && (
								<div>
									<span className="font-semibold text-gray-800 dark:text-gray-100">Updated:</span>{" "}
									{task.updatedDate}
								</div>
							)}
						</div>
					)}

					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
						<SectionHeader title="Status" />
						<StatusSelect
							current={status}
							onChange={(val) => handleInlineMetaUpdate({ status: val })}
							statuses={availableStatuses}
						/>
					</div>

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

					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
						<SectionHeader title="Labels" />
						<ChipInput
							name="labels"
							label=""
							value={labels}
							onChange={(value) => handleInlineMetaUpdate({ labels: value })}
							placeholder="Type label and press Enter"
						/>
					</div>

					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
						<SectionHeader title="Priority" />
						<select
							className="w-full px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 transition-colors"
							value={priority}
							onChange={(e) =>
								handleInlineMetaUpdate({ priority: e.target.value as Task["priority"] })
							}
						>
							<option value="">No Priority</option>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>

					<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
						<SectionHeader title="Dependencies" />
						<DependencyInput
							value={dependencies}
							onChange={(value) => handleInlineMetaUpdate({ dependencies: value })}
							availableTasks={availableTasks}
							currentTaskId={task?.id}
							label=""
						/>
					</div>

					{task && onArchive && (
						<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
							<button
								onClick={handleArchive}
								className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-500 dark:bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-600 dark:hover:bg-red-700 transition-colors cursor-pointer"
							>
								Archive Task
							</button>
						</div>
					)}
				</div>
			</div>
		</Modal>
	);
};

export default TaskDetailsModal;
