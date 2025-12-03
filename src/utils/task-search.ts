/**
 * In-memory task search using Fuse.js
 * Used when tasks are already loaded to avoid re-fetching via ContentStore
 */

import Fuse from "fuse.js";
import type { Task } from "../types/index.ts";

interface TaskSearchOptions {
	query?: string;
	status?: string;
	priority?: "high" | "medium" | "low";
}

interface TaskSearchIndex {
	search(options: TaskSearchOptions): Task[];
}

const TASK_ID_PREFIX = "task-";

function createTaskIdVariants(id: string): string[] {
	const segments = parseTaskIdSegments(id);
	if (!segments) {
		const normalized = id.startsWith(TASK_ID_PREFIX) ? id : `${TASK_ID_PREFIX}${id}`;
		return id === normalized ? [normalized] : [normalized, id];
	}
	const canonicalSuffix = segments.join(".");
	const variants = new Set<string>();
	const normalized = id.startsWith(TASK_ID_PREFIX) ? id : `${TASK_ID_PREFIX}${id}`;
	variants.add(normalized);
	variants.add(`${TASK_ID_PREFIX}${canonicalSuffix}`);
	variants.add(canonicalSuffix);
	if (id !== normalized) {
		variants.add(id);
	}
	return Array.from(variants);
}

function parseTaskIdSegments(value: string): number[] | null {
	const withoutPrefix = value.startsWith(TASK_ID_PREFIX) ? value.slice(TASK_ID_PREFIX.length) : value;
	if (!/^[0-9]+(?:\.[0-9]+)*$/.test(withoutPrefix)) {
		return null;
	}
	return withoutPrefix.split(".").map((segment) => Number.parseInt(segment, 10));
}

interface SearchableTask {
	task: Task;
	title: string;
	bodyText: string;
	id: string;
	idVariants: string[];
	statusLower: string;
	priorityLower?: string;
}

function buildSearchableTask(task: Task): SearchableTask {
	const bodyParts: string[] = [];
	if (task.description) bodyParts.push(task.description);
	if (task.implementationPlan) bodyParts.push(task.implementationPlan);
	if (task.implementationNotes) bodyParts.push(task.implementationNotes);
	if (task.labels?.length) bodyParts.push(task.labels.join(" "));
	if (task.assignee?.length) bodyParts.push(task.assignee.join(" "));

	return {
		task,
		title: task.title,
		bodyText: bodyParts.join(" "),
		id: task.id,
		idVariants: createTaskIdVariants(task.id),
		statusLower: (task.status || "").toLowerCase(),
		priorityLower: task.priority?.toLowerCase(),
	};
}

/**
 * Create an in-memory search index for tasks
 */
export function createTaskSearchIndex(tasks: Task[]): TaskSearchIndex {
	const searchableTasks = tasks.map(buildSearchableTask);

	const fuse = new Fuse(searchableTasks, {
		includeScore: true,
		threshold: 0.35,
		ignoreLocation: true,
		minMatchCharLength: 2,
		keys: [
			{ name: "title", weight: 0.35 },
			{ name: "bodyText", weight: 0.3 },
			{ name: "id", weight: 0.2 },
			{ name: "idVariants", weight: 0.1 },
		],
	});

	return {
		search(options: TaskSearchOptions): Task[] {
			let results: SearchableTask[];

			// If we have a query, use Fuse for fuzzy search
			if (options.query?.trim()) {
				const fuseResults = fuse.search(options.query.trim());
				results = fuseResults.map((r) => r.item);
			} else {
				// No query - start with all tasks
				results = [...searchableTasks];
			}

			// Apply status filter
			if (options.status) {
				const statusLower = options.status.toLowerCase();
				results = results.filter((t) => t.statusLower === statusLower);
			}

			// Apply priority filter
			if (options.priority) {
				const priorityLower = options.priority.toLowerCase();
				results = results.filter((t) => t.priorityLower === priorityLower);
			}

			return results.map((r) => r.task);
		},
	};
}
