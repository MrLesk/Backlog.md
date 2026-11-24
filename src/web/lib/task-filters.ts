/**
 * The filters of the Tasks page and their place in the URL.
 *
 * The query string is the only place these filters live. TasksPage reads them with readTaskFilters, the toolbar
 * changes them through writeTaskFilters, and toTaskFilterOptions hands them to the shared task search
 * (src/utils/task-search.ts), so a filter means on both layouts what it means in `backlog task list`, the TUI
 * and MCP. A filter that is not set is not written, so a plain /tasks or /board link shows every task.
 */

import type { Milestone } from "../../types/index.ts";
import { createMilestoneFilterValueResolver, NO_MILESTONE_FILTER_VALUE } from "../../utils/milestone-filter.ts";
import { resolvePriorityValue } from "../../utils/priority-config.ts";
import { resolveProjectValue } from "../../utils/project-config.ts";
import type { TaskFilterOptions } from "../../utils/task-search.ts";
import { resolveTaskTypeValue } from "../../utils/task-type-config.ts";
import { createStatusResolver } from "../../utils/terminal-status.ts";

/** The Assignee choice for tasks without an assignee, as it appears in the URL. */
export const UNASSIGNED = "__unassigned__";
/** The Milestone choice for tasks without a milestone, as it appears in the URL. */
export const NO_MILESTONE = "__none";

export interface TaskPageFilters {
	/** The text of the search field, kept as typed. */
	search: string;
	statuses: string[];
	excludedStatuses: string[];
	/** An assignee, UNASSIGNED, or "" for every assignee. */
	assignee: string;
	labels: string[];
	type: string;
	project: string;
	/** The normalized priority value, as `backlog task list --priority` takes it. */
	priority: string;
	/** A milestone ID, NO_MILESTONE, or "" for every milestone. */
	milestone: string;
}

export const NO_TASK_FILTERS: TaskPageFilters = {
	search: "",
	statuses: [],
	excludedStatuses: [],
	assignee: "",
	labels: [],
	type: "",
	project: "",
	priority: "",
	milestone: "",
};

/** The configured values that status, type, project and priority filters are matched against. */
interface TaskFilterChoices {
	statuses: readonly string[];
	types?: readonly string[];
	projects?: readonly string[];
	priorities?: readonly string[];
}

// Older links still carry these comma-separated forms. They are read, and the canonical URL replaces them with the
// key on the right.
const LEGACY_LABELS_KEY = "labels";
const LEGACY_EXCLUDED_STATUSES_KEY = "excludeStatuses";
const CANONICAL_KEY_OF_LEGACY_KEY = new Map([
	[LEGACY_LABELS_KEY, "label"],
	[LEGACY_EXCLUDED_STATUSES_KEY, "excludeStatus"],
]);

function trimmedValues(values: string[]): string[] {
	return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function splitCommaSeparated(values: string[]): string[] {
	return values.flatMap((value) => value.split(","));
}

/** Configured statuses in their configured spelling, other names as typed, each name once. */
function canonicalStatuses(values: string[], statuses: readonly string[]): string[] {
	const toConfiguredSpelling = createStatusResolver(statuses);
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of trimmedValues(values)) {
		const status = toConfiguredSpelling(value);
		const key = status.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(status);
	}
	return result;
}

/** Reads the filters of a Tasks page URL in their canonical form. Values that are not configured are dropped. */
export function readTaskFilters(params: URLSearchParams, choices: TaskFilterChoices): TaskPageFilters {
	const excludedStatuses = [
		...params.getAll("excludeStatus"),
		...splitCommaSeparated(params.getAll(LEGACY_EXCLUDED_STATUSES_KEY)),
	];
	const labels = [...params.getAll("label"), ...splitCommaSeparated(params.getAll(LEGACY_LABELS_KEY))];
	return {
		search: params.get("search") ?? "",
		statuses: canonicalStatuses(params.getAll("status"), choices.statuses),
		excludedStatuses: canonicalStatuses(excludedStatuses, choices.statuses),
		assignee: params.get("assignee")?.trim() ?? "",
		labels: [...new Set(trimmedValues(labels))],
		type: resolveTaskTypeValue(params.get("type"), choices.types) ?? "",
		project: resolveProjectValue(params.get("project"), choices.projects) ?? "",
		priority: resolvePriorityValue(params.get("priority"), choices.priorities) ?? "",
		milestone: params.get("milestone")?.trim() ?? "",
	};
}

/**
 * Returns a copy of `params` that holds `filters` and nothing else of the filters. A filter keeps the place it had
 * in the query, a new one goes at the end, and every parameter that is not a filter, such as the board's `lane`,
 * stays as it was. So a URL that is already canonical comes back unchanged, and TasksPage rewrites a URL only
 * when reading it changed a value.
 */
export function writeTaskFilters(params: URLSearchParams, filters: TaskPageFilters): URLSearchParams {
	const valuesByKey = new Map<string, string[]>([
		["search", filters.search ? [filters.search] : []],
		["status", filters.statuses],
		["excludeStatus", filters.excludedStatuses],
		["assignee", filters.assignee ? [filters.assignee] : []],
		["label", filters.labels],
		["type", filters.type ? [filters.type] : []],
		["project", filters.project ? [filters.project] : []],
		["priority", filters.priority ? [filters.priority] : []],
		["milestone", filters.milestone ? [filters.milestone] : []],
	]);
	const next = new URLSearchParams();
	const writtenKeys = new Set<string>();
	const writeFilter = (key: string) => {
		if (writtenKeys.has(key)) return;
		writtenKeys.add(key);
		for (const value of valuesByKey.get(key) ?? []) next.append(key, value);
	};
	for (const [key, value] of params) {
		const filterKey = valuesByKey.has(key) ? key : CANONICAL_KEY_OF_LEGACY_KEY.get(key);
		if (filterKey) writeFilter(filterKey);
		else next.append(key, value);
	}
	for (const key of valuesByKey.keys()) writeFilter(key);
	return next;
}

/** How many of the Filter panel's filters are set. The search field has its own control and is not counted. */
export function countActiveFilters(filters: TaskPageFilters): number {
	return [
		filters.statuses.length > 0,
		filters.excludedStatuses.length > 0,
		filters.assignee !== "",
		filters.labels.length > 0,
		filters.type !== "",
		filters.project !== "",
		filters.priority !== "",
		filters.milestone !== "",
	].filter(Boolean).length;
}

/** True while the search or any filter can hide a task. */
export function isFiltered(filters: TaskPageFilters): boolean {
	return filters.search.trim() !== "" || countActiveFilters(filters) > 0;
}

/**
 * The options of the shared task search for these filters. `milestones` lists active and archived milestones, so
 * a milestone filter resolves an ID or a title the way the CLI does.
 */
export function toTaskFilterOptions(filters: TaskPageFilters, milestones: Milestone[]): TaskFilterOptions {
	return {
		query: filters.search,
		status: filters.statuses,
		excludeStatus: filters.excludedStatuses,
		assignee: filters.assignee === UNASSIGNED ? undefined : filters.assignee,
		unassigned: filters.assignee === UNASSIGNED,
		labels: filters.labels,
		type: filters.type,
		project: filters.project,
		priority: filters.priority,
		milestone: filters.milestone === NO_MILESTONE ? NO_MILESTONE_FILTER_VALUE : filters.milestone,
		resolveMilestoneLabel: createMilestoneFilterValueResolver(milestones),
	};
}
