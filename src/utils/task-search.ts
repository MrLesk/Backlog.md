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
	labels?: string[];
}

interface TaskSearchIndex {
	search(options: TaskSearchOptions): Task[];
}

// Regex pattern to match any prefix (letters followed by dash)
const PREFIX_PATTERN = /^[a-zA-Z]+-/i;

/**
 * Extract prefix from an ID if present (e.g., "task-" from "task-123")
 */
function extractPrefix(id: string): string | null {
	const match = id.match(PREFIX_PATTERN);
	return match ? match[0] : null;
}

/**
 * Strip any prefix from an ID (e.g., "task-123" -> "123", "JIRA-456" -> "456")
 */
function stripPrefix(id: string): string {
	return id.replace(PREFIX_PATTERN, "");
}

function createTaskIdVariants(id: string): string[] {
	const segments = parseTaskIdSegments(id);
	const prefix = extractPrefix(id) ?? "task-"; // Default to task- if no prefix
	const lowerId = id.toLowerCase();

	if (!segments) {
		// Non-numeric ID - just return the ID and its lowercase variant
		return id === lowerId ? [id] : [id, lowerId];
	}

	const canonicalSuffix = segments.join(".");
	const variants = new Set<string>();

	// Add original ID and lowercase variant
	variants.add(id);
	variants.add(lowerId);

	// Add with extracted/default prefix
	variants.add(`${prefix}${canonicalSuffix}`);
	variants.add(`${prefix.toLowerCase()}${canonicalSuffix}`);

	// Add just the numeric part
	variants.add(canonicalSuffix);

	return Array.from(variants);
}

function parseTaskIdSegments(value: string): number[] | null {
	const withoutPrefix = stripPrefix(value);
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
	labelsLower: string[];
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
		labelsLower: (task.labels || []).map((label) => label.toLowerCase()),
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

			// Apply label filters (task must include any selected label)
			if (options.labels && options.labels.length > 0) {
				const required = options.labels.map((label) => label.toLowerCase());
				results = results.filter((t) => {
					if (!t.labelsLower || t.labelsLower.length === 0) {
						return false;
					}
					const labelSet = new Set(t.labelsLower);
					return required.some((label) => labelSet.has(label));
				});
			}

			return results.map((r) => r.task);
		},
	};
}
