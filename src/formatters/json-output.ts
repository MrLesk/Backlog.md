import { isAbsolute, join, relative } from "node:path";
import type { TaskDetail, TaskListItem } from "../core/task-detail.ts";
import type {
	Decision,
	DecisionSearchResult,
	Document,
	DocumentSearchResult,
	Task,
	TaskSearchResult,
} from "../types/index.ts";
import { isLocalEditableTask } from "../types/index.ts";
import type { DependencyGraph } from "../utils/dependency-graph.ts";
import type { TaskReadiness } from "../utils/readiness.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

type TaskSummaryJson = {
	id: string;
	title: string;
	status: string;
	type: string | null;
	priority: string | null;
	project: string | null;
	assignees: string[];
	reporter: string | null;
	labels: string[];
	milestone: string | null;
	parentTaskId: string | null;
	acceptanceCriteriaCompleted: number;
	acceptanceCriteriaCount: number;
	references: string[];
	modifiedFiles: string[];
	ordinal: number | null;
	createdAt: string | null;
	updatedAt: string | null;
	dueDate: string | null;
	/**
	 * Derived from the whole visible corpus at read time, never stored: work can start now because
	 * the task is unfinished and every dependency it names resolved to a completed task.
	 */
	isReady: boolean;
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

/** The normalized dependency context: an explicit root, every reached node, and directed edges. */
type DependencyGraphJson = {
	root: string;
	nodes: DependencyGraph["nodes"];
	edges: DependencyGraph["edges"];
};

type TaskDetailsJson = TaskSummaryJson & {
	path: string | null;
	description: string | null;
	dependencies: string[];
	/**
	 * Derived from the whole visible corpus at read time. `dependencies` above it stays the task's
	 * own list of direct dependency IDs, unchanged.
	 */
	dependencyGraph: DependencyGraphJson;
	/** Why `isReady` above reads the way it does, from the same derivation. */
	readiness: TaskReadiness;
	documentation: string[];
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

function toTaskSummaryJson(task: TaskListItem): TaskSummaryJson {
	const acceptanceCriteria = task.acceptanceCriteriaItems ?? [];
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		type: nullable(task.type),
		priority: nullable(task.priority),
		project: nullable(task.project),
		assignees: task.assignee ?? [],
		reporter: nullable(task.reporter),
		labels: task.labels ?? [],
		milestone: nullable(task.milestone),
		parentTaskId: nullable(task.parentTaskId),
		acceptanceCriteriaCompleted: acceptanceCriteria.filter((criterion) => criterion.checked).length,
		acceptanceCriteriaCount: acceptanceCriteria.length,
		references: task.references ?? [],
		modifiedFiles: task.modifiedFiles ?? [],
		ordinal: task.ordinal ?? null,
		createdAt: normalizePublicDate(task.createdDate),
		updatedAt: normalizePublicDate(task.updatedDate),
		dueDate: normalizePublicDate(task.dueDate),
		isReady: task.isReady,
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

function toDependencyGraphJson(graph: DependencyGraph): DependencyGraphJson {
	return { root: graph.rootId, nodes: graph.nodes, edges: graph.edges };
}

function toTaskDetailsJson(task: TaskDetail, projectRoot: string): TaskDetailsJson {
	return {
		...toTaskSummaryJson({ ...task, isReady: task.readiness.isReady }),
		path: toProjectRelativePath(projectRoot, task.filePath),
		description: nullableDescription(task.description),
		dependencies: task.dependencies ?? [],
		dependencyGraph: toDependencyGraphJson(task.dependencyGraph),
		readiness: task.readiness,
		documentation: task.documentation ?? [],
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

function toDocumentSummaryJson(document: Document, projectRoot: string, docsDir: string): DocumentSummaryJson {
	return {
		id: document.id,
		title: document.title,
		type: document.type,
		path: document.path ? toProjectRelativePath(projectRoot, join(docsDir, document.path)) : null,
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

export function taskListJson(tasks: TaskListItem[]) {
	return { schemaVersion: 1, kind: "task-list" as const, tasks: tasks.map(toTaskSummaryJson) };
}

export function taskViewJson(task: TaskDetail, projectRoot: string) {
	return {
		schemaVersion: 1,
		kind: "task-view" as const,
		task: toTaskDetailsJson(task, projectRoot),
	};
}

export function decisionListJson(decisions: Decision[]) {
	return { schemaVersion: 1, kind: "decision-list" as const, decisions: decisions.map(toDecisionSummaryJson) };
}

/**
 * A search result set whose task records already carry readiness.
 *
 * The verdict travels on the record inside each result rather than being looked up by ID: two files
 * can claim one ID with different dependencies, and each claimant has to keep its own answer.
 */
export type SearchResultInput =
	| DocumentSearchResult
	| DecisionSearchResult
	| (Omit<TaskSearchResult, "task"> & {
			task: TaskListItem;
	  });

export function searchJson(results: SearchResultInput[], projectRoot: string, docsDir: string) {
	const publicResults: SearchResultJson[] = [];
	for (const result of results) {
		if (result.type === "task") {
			if (isLocalEditableTask(result.task)) {
				publicResults.push({ type: "task", data: toTaskSummaryJson(result.task) });
			}
			continue;
		}
		if (result.type === "document") {
			publicResults.push({ type: "document", data: toDocumentSummaryJson(result.document, projectRoot, docsDir) });
			continue;
		}
		publicResults.push({ type: "decision", data: toDecisionSummaryJson(result.decision) });
	}
	return { schemaVersion: 1, kind: "search" as const, results: publicResults };
}

export function printJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
