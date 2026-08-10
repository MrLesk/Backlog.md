/**
 * In-memory task search using Fuse.js
 * Used when tasks are already loaded to avoid re-fetching via ContentStore
 */

import Fuse from "fuse.js";
import type { Task } from "../types/index.ts";
import { labelsToLower } from "./label-filter.ts";
import {
	createMilestoneFilterMatcher,
	type MilestoneFilterValueResolver,
	NO_MILESTONE_FILTER_VALUE,
} from "./milestone-filter.ts";
import { matchesModifiedFileFilters, normalizeModifiedFileFilters } from "./modified-files.ts";
import { normalizePriorityValue } from "./priority-config.ts";
import { getTaskReadiness, type ReadinessGraph } from "./readiness.ts";
import { createTaskIdSearchVariants } from "./task-id-search.ts";
import { matchesTaskTypeFilter } from "./task-type-config.ts";

export type LabelMatchMode = "any" | "all";

export interface TaskSearchOptions {
	query?: string;
	status?: string;
	excludeStatus?: string | string[];
	type?: string | string[];
	priority?: string;
	labels?: string[];
	labelMatch?: LabelMatchMode;
	modifiedFiles?: string[];
}

export interface SharedTaskFilterOptions {
	query?: string;
	excludeStatus?: string | string[];
	type?: string | string[];
	priority?: string;
	labels?: string[];
	labelMatch?: LabelMatchMode;
	modifiedFiles?: string[];
	milestone?: string;
	resolveMilestoneLabel?: (milestone: string) => string;
}

export interface TaskFilterOptions extends SharedTaskFilterOptions {
	status?: string;
	excludeStatus?: string | string[];
	/**
	 * When set, keep only tasks that are ready according to this graph. The graph carries the full
	 * task corpus, so readiness never depends on which tasks survived the other filters.
	 */
	ready?: ReadinessGraph;
}

export interface TaskSearchIndex {
	search(options: TaskSearchOptions): Task[];
}

interface SearchableTask {
	task: Task;
	title: string;
	bodyText: string;
	id: string;
	idVariants: string[];
	dependencyIds: string[];
	statusLower: string;
	priorityLower?: string;
	labelsLower: string[];
	modifiedFiles: string[];
}

function buildSearchableTask(task: Task): SearchableTask {
	const bodyParts: string[] = [];
	if (task.description) bodyParts.push(task.description);
	if (Array.isArray(task.acceptanceCriteriaItems) && task.acceptanceCriteriaItems.length > 0) {
		const lines = [...task.acceptanceCriteriaItems]
			.sort((a, b) => a.index - b.index)
			.map((criterion) => `- [${criterion.checked ? "x" : " "}] ${criterion.text}`);
		bodyParts.push(lines.join("\n"));
	}
	if (task.implementationPlan) bodyParts.push(task.implementationPlan);
	if (task.implementationNotes) bodyParts.push(task.implementationNotes);
	if (Array.isArray(task.comments) && task.comments.length > 0) {
		bodyParts.push(task.comments.map((comment) => comment.body).join(" "));
	}
	if (task.labels?.length) bodyParts.push(task.labels.join(" "));
	if (task.assignee?.length) bodyParts.push(task.assignee.join(" "));
	if (task.modifiedFiles?.length) bodyParts.push(task.modifiedFiles.join(" "));

	return {
		task,
		title: task.title,
		bodyText: bodyParts.join(" "),
		id: task.id,
		idVariants: createTaskIdSearchVariants(task.id),
		dependencyIds: (task.dependencies ?? []).flatMap((dependency) => createTaskIdSearchVariants(dependency)),
		statusLower: (task.status || "").toLowerCase(),
		priorityLower: normalizePriorityValue(task.priority),
		labelsLower: (task.labels || []).map((label) => label.toLowerCase()),
		modifiedFiles: task.modifiedFiles ?? [],
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
			{ name: "dependencyIds", weight: 0.05 },
			{ name: "modifiedFiles", weight: 0.15 },
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
			if (options.excludeStatus) {
				const excludedStatuses = Array.isArray(options.excludeStatus) ? options.excludeStatus : [options.excludeStatus];
				const excluded = new Set(
					excludedStatuses.map((status) => status.trim().toLowerCase()).filter((status) => status.length > 0),
				);
				if (excluded.size > 0) {
					results = results.filter((t) => !excluded.has(t.statusLower));
				}
			}
			if (options.type) {
				results = results.filter((task) => matchesTaskTypeFilter(task.task.type, options.type));
			}

			// Apply priority filter
			if (options.priority) {
				const priorityLower = normalizePriorityValue(options.priority);
				results = results.filter((t) => t.priorityLower === priorityLower);
			}

			// Apply label filters. Interactive UI filters match any selected
			// label; CLI-seeded --labels filters request all-label matching.
			if (options.labels && options.labels.length > 0) {
				const required = labelsToLower(options.labels);
				const labelMatch = options.labelMatch ?? "any";
				results = results.filter((t) => {
					if (!t.labelsLower || t.labelsLower.length === 0) {
						return false;
					}
					const labelSet = new Set(t.labelsLower);
					return labelMatch === "all"
						? required.every((label) => labelSet.has(label))
						: required.some((label) => labelSet.has(label));
				});
			}

			const modifiedFiles = normalizeModifiedFileFilters(options.modifiedFiles);
			if (modifiedFiles) {
				results = results.filter((task) => matchesModifiedFileFilters(task.modifiedFiles, modifiedFiles));
			}

			return results.map((r) => r.task);
		},
	};
}

function applyMilestoneFilter(
	tasks: Task[],
	milestone: string,
	resolveMilestoneLabel?: (milestone: string) => string,
	milestoneCandidates: Task[] = tasks,
): Task[] {
	const normalizedMilestone = milestone.trim().toLowerCase();
	if (!normalizedMilestone) {
		return tasks;
	}
	if (normalizedMilestone === NO_MILESTONE_FILTER_VALUE) {
		return tasks.filter((task) => !task.milestone?.trim());
	}
	if (resolveMilestoneLabel && "resolveExactId" in resolveMilestoneLabel) {
		const milestoneValues = milestoneCandidates.map((task) => task.milestone ?? "");
		const matchesMilestone = createMilestoneFilterMatcher(
			milestone,
			milestoneValues,
			resolveMilestoneLabel as MilestoneFilterValueResolver,
		);
		return tasks.filter((task) => matchesMilestone(task.milestone ?? ""));
	}

	return tasks.filter((task) => {
		if (!task.milestone) {
			return false;
		}
		const value = resolveMilestoneLabel ? resolveMilestoneLabel(task.milestone) : task.milestone;
		return value.trim().toLowerCase() === normalizedMilestone;
	});
}

export function applyTaskFilters(tasks: Task[], options: TaskFilterOptions, index?: TaskSearchIndex): Task[] {
	const query = options.query?.trim() ?? "";
	const hasBaseFilters = Boolean(
		query ||
			options.status ||
			options.excludeStatus ||
			options.type ||
			options.priority ||
			(options.labels && options.labels.length > 0) ||
			(options.modifiedFiles && options.modifiedFiles.length > 0),
	);

	let results = hasBaseFilters
		? (index ?? createTaskSearchIndex(tasks)).search({
				query,
				status: options.status,
				excludeStatus: options.excludeStatus,
				type: options.type,
				priority: options.priority,
				labels: options.labels,
				labelMatch: options.labelMatch,
				modifiedFiles: options.modifiedFiles,
			})
		: [...tasks];

	if (options.milestone) {
		results = applyMilestoneFilter(results, options.milestone, options.resolveMilestoneLabel, tasks);
	}

	if (options.ready) {
		const graph = options.ready;
		results = results.filter((task) => getTaskReadiness(task, graph).isReady);
	}

	return results;
}

export function applySharedTaskFilters(
	tasks: Task[],
	options: SharedTaskFilterOptions,
	index?: TaskSearchIndex,
): Task[] {
	return applyTaskFilters(
		tasks,
		{
			query: options.query,
			excludeStatus: options.excludeStatus,
			type: options.type,
			priority: options.priority,
			labels: options.labels,
			labelMatch: options.labelMatch,
			modifiedFiles: options.modifiedFiles,
			milestone: options.milestone,
			resolveMilestoneLabel: options.resolveMilestoneLabel,
		},
		index,
	);
}
