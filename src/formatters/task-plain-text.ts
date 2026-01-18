import type { Task } from "../types/index.ts";
import type { ChecklistItem } from "../ui/checklist.ts";
import { transformCodePathsPlain } from "../ui/code-path.ts";
import { formatStatusWithIcon } from "../ui/status-icon.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

export type TaskPlainTextOptions = {
	filePathOverride?: string;
};

export function formatDateForDisplay(dateStr: string): string {
	if (!dateStr) return "";
	const hasTime = dateStr.includes(" ") || dateStr.includes("T");
	return hasTime ? dateStr : dateStr;
}

function buildChecklistItems(items: Task["acceptanceCriteriaItems"]): ChecklistItem[] {
	const criteria = items ?? [];
	return criteria
		.slice()
		.sort((a, b) => a.index - b.index)
		.map((criterion, index) => ({
			text: `#${index + 1} ${criterion.text}`,
			checked: criterion.checked,
		}));
}

export function buildAcceptanceCriteriaItems(task: Task): ChecklistItem[] {
	return buildChecklistItems(task.acceptanceCriteriaItems);
}

export function buildDefinitionOfDoneItems(task: Task): ChecklistItem[] {
	return buildChecklistItems(task.definitionOfDoneItems);
}

export function formatAcceptanceCriteriaLines(items: ChecklistItem[]): string[] {
	if (items.length === 0) return [];
	return items.map((item) => {
		const prefix = item.checked ? "- [x]" : "- [ ]";
		return `${prefix} ${transformCodePathsPlain(item.text)}`;
	});
}

function formatPriority(priority?: "high" | "medium" | "low"): string | null {
	if (!priority) return null;
	const label = priority.charAt(0).toUpperCase() + priority.slice(1);
	return label;
}

function formatAssignees(assignee?: string[]): string | null {
	if (!assignee || assignee.length === 0) return null;
	return assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ");
}

function formatSubtaskLines(subtasks: Array<{ id: string; title: string }>): string[] {
	if (subtasks.length === 0) return [];
	const sorted = sortByTaskId(subtasks);
	return sorted.map((subtask) => `- ${subtask.id} - ${subtask.title}`);
}

export function formatTaskPlainText(task: Task, options: TaskPlainTextOptions = {}): string {
	const lines: string[] = [];
	const filePath = options.filePathOverride ?? task.filePath;

	if (filePath) {
		lines.push(`File: ${filePath}`);
		lines.push("");
	}

	lines.push(`Task ${task.id} - ${task.title}`);
	lines.push("=".repeat(50));
	lines.push("");
	lines.push(`Status: ${formatStatusWithIcon(task.status)}`);

	const priorityLabel = formatPriority(task.priority);
	if (priorityLabel) {
		lines.push(`Priority: ${priorityLabel}`);
	}

	const assigneeText = formatAssignees(task.assignee);
	if (assigneeText) {
		lines.push(`Assignee: ${assigneeText}`);
	}

	if (task.reporter) {
		const reporter = task.reporter.startsWith("@") ? task.reporter : `@${task.reporter}`;
		lines.push(`Reporter: ${reporter}`);
	}

	lines.push(`Created: ${formatDateForDisplay(task.createdDate)}`);
	if (task.updatedDate) {
		lines.push(`Updated: ${formatDateForDisplay(task.updatedDate)}`);
	}

	if (task.labels?.length) {
		lines.push(`Labels: ${task.labels.join(", ")}`);
	}

	if (task.milestone) {
		lines.push(`Milestone: ${task.milestone}`);
	}

	if (task.parentTaskId) {
		const parentLabel = task.parentTaskTitle ? `${task.parentTaskId} - ${task.parentTaskTitle}` : task.parentTaskId;
		lines.push(`Parent: ${parentLabel}`);
	}

	const subtaskSummaries = task.subtaskSummaries ?? [];
	const subtaskCount = subtaskSummaries.length > 0 ? subtaskSummaries.length : (task.subtasks?.length ?? 0);
	if (subtaskCount > 0) {
		const subtaskLines = formatSubtaskLines(subtaskSummaries);
		if (subtaskLines.length > 0) {
			lines.push(`Subtasks (${subtaskCount}):`);
			lines.push(...subtaskLines);
		} else {
			lines.push(`Subtasks: ${subtaskCount}`);
		}
	}

	if (task.dependencies?.length) {
		lines.push(`Dependencies: ${task.dependencies.join(", ")}`);
	}

	if (task.references?.length) {
		lines.push(`References: ${task.references.join(", ")}`);
	}

	if (task.documentation?.length) {
		lines.push(`Documentation: ${task.documentation.join(", ")}`);
	}

	lines.push("");
	lines.push("Description:");
	lines.push("-".repeat(50));
	const description = task.description?.trim();
	lines.push(transformCodePathsPlain(description && description.length > 0 ? description : "No description provided"));
	lines.push("");

	lines.push("Acceptance Criteria:");
	lines.push("-".repeat(50));
	const criteriaItems = buildAcceptanceCriteriaItems(task);
	if (criteriaItems.length > 0) {
		lines.push(...formatAcceptanceCriteriaLines(criteriaItems));
	} else {
		lines.push("No acceptance criteria defined");
	}
	lines.push("");

	lines.push("Definition of Done:");
	lines.push("-".repeat(50));
	const definitionItems = buildDefinitionOfDoneItems(task);
	if (definitionItems.length > 0) {
		lines.push(...formatAcceptanceCriteriaLines(definitionItems));
	} else {
		lines.push("No Definition of Done items defined");
	}
	lines.push("");

	const implementationPlan = task.implementationPlan?.trim();
	if (implementationPlan) {
		lines.push("Implementation Plan:");
		lines.push("-".repeat(50));
		lines.push(transformCodePathsPlain(implementationPlan));
		lines.push("");
	}

	const implementationNotes = task.implementationNotes?.trim();
	if (implementationNotes) {
		lines.push("Implementation Notes:");
		lines.push("-".repeat(50));
		lines.push(transformCodePathsPlain(implementationNotes));
		lines.push("");
	}

	return lines.join("\n");
}
