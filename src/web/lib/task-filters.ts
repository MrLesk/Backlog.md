/**
 * The filters of the Tasks page and their place in the URL.
 *
 * The query string is the only place these filters live. TasksPage reads them with readTaskFilters, changes them
 * with writeTaskFilters, and toTaskFilterOptions hands them to the shared task search (src/utils/task-search.ts)
 * that `backlog task list`, the TUI and MCP also use, so a value matches the same tasks on both layouts as there.
 * One difference: with several labels chosen, a task needs any one of them, as in the TUI by default, while
 * `backlog task list --labels` needs every one. A filter that is not set is not written, so a plain /tasks or
 * /board link shows every task.
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

/** The URL key of each filter. A filter with several values repeats its key. */
const URL_KEYS: Record<keyof TaskPageFilters, string> = {
	search: "search",
	statuses: "status",
	excludedStatuses: "excludeStatus",
	assignee: "assignee",
	labels: "label",
	type: "type",
	project: "project",
	priority: "priority",
	milestone: "milestone",
};
const FILTER_FIELDS = Object.keys(URL_KEYS) as Array<keyof TaskPageFilters>;

// Older links still carry these comma-separated forms. They are read, and writing the filter replaces them with
// its current key.
const LEGACY_LABELS_KEY = "labels";
const LEGACY_EXCLUDED_STATUSES_KEY = "excludeStatuses";
const CANONICAL_KEY_OF_LEGACY_KEY = new Map([
	[LEGACY_LABELS_KEY, URL_KEYS.labels],
	[LEGACY_EXCLUDED_STATUSES_KEY, URL_KEYS.excludedStatuses],
]);

function trimmedValues(values: string[]): string[] {
	return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function splitCommaSeparated(values: string[]): string[] {
	return values.flatMap((value) => value.split(","));
}

/** The URL values of one filter: every value of a list, or the value of a single filter that is set. */
function urlValues(value: string | string[]): string[] {
	if (Array.isArray(value)) return value;
	return value ? [value] : [];
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

/**
 * Reads the filters of a Tasks page URL. Statuses take their configured spelling, others are kept as typed; type,
 * project and priority values that are not configured are dropped.
 */
export function readTaskFilters(params: URLSearchParams, choices: TaskFilterChoices): TaskPageFilters {
	const excludedStatuses = [
		...params.getAll(URL_KEYS.excludedStatuses),
		...splitCommaSeparated(params.getAll(LEGACY_EXCLUDED_STATUSES_KEY)),
	];
	const labels = [...params.getAll(URL_KEYS.labels), ...splitCommaSeparated(params.getAll(LEGACY_LABELS_KEY))];
	return {
		search: params.get(URL_KEYS.search) ?? "",
		statuses: canonicalStatuses(params.getAll(URL_KEYS.statuses), choices.statuses),
		excludedStatuses: canonicalStatuses(excludedStatuses, choices.statuses),
		assignee: params.get(URL_KEYS.assignee)?.trim() ?? "",
		labels: [...new Set(trimmedValues(labels))],
		type: resolveTaskTypeValue(params.get(URL_KEYS.type), choices.types) ?? "",
		project: resolveProjectValue(params.get(URL_KEYS.project), choices.projects) ?? "",
		priority: resolvePriorityValue(params.get(URL_KEYS.priority), choices.priorities) ?? "",
		milestone: params.get(URL_KEYS.milestone)?.trim() ?? "",
	};
}

/**
 * Returns a copy of `params` with the filters named in `changes` set to their new values. Every other parameter
 * stays as it was: the filters left out, their older forms, and parameters that are not filters, such as the
 * board's `lane`. So an edit made before the configuration has loaded cannot drop a value that is not resolved
 * yet. Pass NO_TASK_FILTERS to clear every filter, or the filters readTaskFilters returned to write their canonical
 * form. A written filter keeps the place it had in the query and a new one goes at the end, so a URL that is
 * already canonical comes back unchanged.
 */
export function writeTaskFilters(params: URLSearchParams, changes: Partial<TaskPageFilters>): URLSearchParams {
	const valuesByKey = new Map<string, string[]>();
	for (const field of FILTER_FIELDS) {
		const value = changes[field];
		if (value !== undefined) valuesByKey.set(URL_KEYS[field], urlValues(value));
	}
	const next = new URLSearchParams();
	const writtenKeys = new Set<string>();
	const writeFilter = (key: string) => {
		if (writtenKeys.has(key)) return;
		writtenKeys.add(key);
		for (const value of valuesByKey.get(key) ?? []) next.append(key, value);
	};
	for (const [key, value] of params) {
		const filterKey = CANONICAL_KEY_OF_LEGACY_KEY.get(key) ?? key;
		if (valuesByKey.has(filterKey)) writeFilter(filterKey);
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
