import { isAbsolute, relative } from "node:path";
import type { Decision, Document, SearchResult, Task } from "../types/index.ts";
import { isLocalEditableTask } from "../types/index.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

type TaskSummaryJson = {
	id: string;
	title: string;
	status: string;
	type: string | null;
	priority: string | null;
	assignees: string[];
	reporter: string | null;
	labels: string[];
	milestone: string | null;
	parentTaskId: string | null;
	ordinal: number | null;
	createdAt: string | null;
	updatedAt: string | null;
};

type ChecklistItemJson = {
	index: number;
	text: string;
	checked: boolean;
};

type TaskCommentJson = {
	index: number;
	body: string;
	createdAt: string | null;
	author: string | null;
};

type TaskDetailsJson = TaskSummaryJson & {
	path: string | null;
	description: string | null;
	dependencies: string[];
	references: string[];
	documentation: string[];
	modifiedFiles: string[];
	subtasks: Array<{ id: string; title: string }>;
	acceptanceCriteria: ChecklistItemJson[];
	definitionOfDone: ChecklistItemJson[];
	implementationPlan: string | null;
	implementationNotes: string | null;
	comments: TaskCommentJson[];
	finalSummary: string | null;
};

type DocumentSummaryJson = {
	id: string;
	title: string;
	type: Document["type"];
	path: string | null;
	tags: string[];
	createdAt: string | null;
	updatedAt: string | null;
};

type DecisionSummaryJson = {
	id: string;
	title: string;
	status: Decision["status"];
	date: string | null;
};

type SearchResultJson =
	| { type: "task"; data: TaskSummaryJson }
	| { type: "document"; data: DocumentSummaryJson }
	| { type: "decision"; data: DecisionSummaryJson };

function nullable(value: string | undefined): string | null {
	return value ?? null;
}

function nullableDescription(value: string | undefined): string | null {
	return value === undefined || value === "" ? null : value;
}

function normalizePublicDate(value: string | undefined): string | null {
	if (!value) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

	const minutePrecision = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?Z?$/);
	if (minutePrecision) {
		const [, date, time, seconds = "00"] = minutePrecision;
		return `${date}T${time}:${seconds}Z`;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function toTaskSummaryJson(task: Task): TaskSummaryJson {
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		type: nullable(task.type),
		priority: nullable(task.priority),
		assignees: task.assignee ?? [],
		reporter: nullable(task.reporter),
		labels: task.labels ?? [],
		milestone: nullable(task.milestone),
		parentTaskId: nullable(task.parentTaskId),
		ordinal: task.ordinal ?? null,
		createdAt: normalizePublicDate(task.createdDate),
		updatedAt: normalizePublicDate(task.updatedDate),
	};
}

function toProjectRelativePath(projectRoot: string, filePath: string | undefined): string | null {
	if (!filePath) return null;
	const projectRelative = isAbsolute(filePath) ? relative(projectRoot, filePath) : filePath;
	return projectRelative.replaceAll("\\", "/");
}

function toChecklistJson(items: Task["acceptanceCriteriaItems"]): ChecklistItemJson[] {
	return (items ?? [])
		.slice()
		.sort((a, b) => a.index - b.index)
		.map(({ index, text, checked }) => ({ index, text, checked }));
}

function toTaskDetailsJson(task: Task, projectRoot: string): TaskDetailsJson {
	return {
		...toTaskSummaryJson(task),
		path: toProjectRelativePath(projectRoot, task.filePath),
		description: nullableDescription(task.description),
		dependencies: task.dependencies ?? [],
		references: task.references ?? [],
		documentation: task.documentation ?? [],
		modifiedFiles: task.modifiedFiles ?? [],
		subtasks: sortByTaskId(task.subtaskSummaries ?? []),
		acceptanceCriteria: toChecklistJson(task.acceptanceCriteriaItems),
		definitionOfDone: toChecklistJson(task.definitionOfDoneItems),
		implementationPlan: nullable(task.implementationPlan),
		implementationNotes: nullable(task.implementationNotes),
		comments: (task.comments ?? [])
			.slice()
			.sort((a, b) => a.index - b.index)
			.map((comment) => ({
				index: comment.index,
				body: comment.body,
				createdAt: normalizePublicDate(comment.createdDate),
				author: nullable(comment.author),
			})),
		finalSummary: nullable(task.finalSummary),
	};
}

function toDocumentSummaryJson(document: Document): DocumentSummaryJson {
	return {
		id: document.id,
		title: document.title,
		type: document.type,
		path: nullable(document.path),
		tags: document.tags ?? [],
		createdAt: normalizePublicDate(document.createdDate),
		updatedAt: normalizePublicDate(document.updatedDate),
	};
}

function toDecisionSummaryJson(decision: Decision): DecisionSummaryJson {
	return {
		id: decision.id,
		title: decision.title,
		status: decision.status,
		date: normalizePublicDate(decision.date),
	};
}

export function taskListJson(tasks: Task[]) {
	return { schemaVersion: 1, kind: "task-list" as const, tasks: tasks.map(toTaskSummaryJson) };
}

export function taskViewJson(task: Task, projectRoot: string) {
	return { schemaVersion: 1, kind: "task-view" as const, task: toTaskDetailsJson(task, projectRoot) };
}

export function searchJson(results: SearchResult[]) {
	const publicResults: SearchResultJson[] = [];
	for (const result of results) {
		if (result.type === "task") {
			if (isLocalEditableTask(result.task)) {
				publicResults.push({ type: "task", data: toTaskSummaryJson(result.task) });
			}
			continue;
		}
		if (result.type === "document") {
			publicResults.push({ type: "document", data: toDocumentSummaryJson(result.document) });
			continue;
		}
		publicResults.push({ type: "decision", data: toDecisionSummaryJson(result.decision) });
	}
	return { schemaVersion: 1, kind: "search" as const, results: publicResults };
}

export function printJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
