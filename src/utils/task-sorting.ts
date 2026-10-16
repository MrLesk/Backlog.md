import { getPriorityRank } from "./priority-config.ts";

/**
 * Parse a task ID into its numeric components for proper sorting.
 * Handles both simple IDs (task-5) and decimal IDs (task-5.2.1).
 * Works with any prefix pattern (task-, draft-, JIRA-, etc.)
 */
export function parseTaskId(taskId: string): number[] {
	// Remove any prefix pattern (letters followed by dash) - handles task-, draft-, JIRA-, etc.
	const numericPart = taskId.replace(/^[a-zA-Z]+-/i, "");

	// Try to extract numeric parts from the ID
	// First check if it's a standard numeric ID (e.g., "1", "1.2", etc.)
	const dotParts = numericPart.split(".");
	const numericParts = dotParts.map((part) => {
		const num = Number.parseInt(part, 10);
		return Number.isNaN(num) ? null : num;
	});

	// If all parts are numeric, return them
	if (numericParts.every((n) => n !== null)) {
		return numericParts as number[];
	}

	// Otherwise, try to extract trailing number (e.g., "draft2" -> 2)
	const trailingNumberMatch = numericPart.match(/(\d+)$/);
	if (trailingNumberMatch) {
		const [, num] = trailingNumberMatch;
		return [Number.parseInt(num ?? "0", 10)];
	}

	// No numeric parts found, return 0 for consistent sorting
	return [0];
}

/**
 * Compare two task IDs numerically.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 *
 * Examples:
 * - task-2 comes before task-10
 * - task-2 comes before task-2.1
 * - task-2.1 comes before task-2.2
 * - task-2.2 comes before task-2.10
 */
export function compareTaskIds(a: string, b: string): number {
	const aParts = parseTaskId(a);
	const bParts = parseTaskId(b);

	// Compare each numeric part
	const maxLength = Math.max(aParts.length, bParts.length);

	for (let i = 0; i < maxLength; i++) {
		const aNum = aParts[i] ?? 0;
		const bNum = bParts[i] ?? 0;

		if (aNum !== bNum) {
			return aNum - bNum;
		}
	}

	// All numeric parts are equal; use the original ID as a deterministic fallback.
	return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function isAncestorTaskId(parentId: string, childId: string): boolean {
	const parentParts = parseTaskId(parentId);
	const childParts = parseTaskId(childId);

	if (parentParts.length >= childParts.length) {
		return false;
	}

	return parentParts.every((part, index) => part === childParts[index]);
}

/**
 * Compare two task IDs in descending order while keeping parents before children.
 */
export function compareTaskIdsDescending(a: string, b: string): number {
	if (isAncestorTaskId(a, b)) {
		return -1;
	}
	if (isAncestorTaskId(b, a)) {
		return 1;
	}
	return compareTaskIds(b, a);
}

/**
 * Sort an array of objects by their task ID property numerically.
 * Returns a new sorted array without mutating the original.
 */
export function sortByTaskId<T extends { id: string }>(items: T[]): T[] {
	return [...items].sort((a, b) => compareTaskIds(a.id, b.id));
}

/**
 * Sort an array of tasks by their priority property.
 * Priority order defaults to high > medium > low > undefined.
 * Tasks with the same priority are sorted by task ID.
 */
export function sortByPriority<T extends { id: string; priority?: string }>(
	items: T[],
	priorityOrder?: readonly string[],
): T[] {
	return [...items].sort((a, b) => {
		const aWeight = getPriorityRank(a.priority, priorityOrder);
		const bWeight = getPriorityRank(b.priority, priorityOrder);

		// First sort by priority (higher weight = higher priority)
		if (aWeight !== bWeight) {
			return bWeight - aWeight;
		}

		// If priorities are the same, sort by task ID
		return compareTaskIds(a.id, b.id);
	});
}

/**
 * Sort an array of tasks by their ordinal property, then by task ID.
 * Tasks with ordinal values come before tasks without.
 * Tasks with the same ordinal (or both undefined) are sorted by task ID.
 */
export function sortByOrdinal<T extends { id: string; ordinal?: number }>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		// Tasks with ordinal come before tasks without
		if (a.ordinal !== undefined && b.ordinal === undefined) {
			return -1;
		}
		if (a.ordinal === undefined && b.ordinal !== undefined) {
			return 1;
		}

		// Both have ordinals - sort by ordinal value
		if (a.ordinal !== undefined && b.ordinal !== undefined) {
			if (a.ordinal !== b.ordinal) {
				return a.ordinal - b.ordinal;
			}
		}

		// Same ordinal (or both undefined) - sort by task ID
		return compareTaskIds(a.id, b.id);
	});
}

/**
 * Sort an array of tasks considering ordinal first, then priority, then ID.
 * This is the default order of a task list.
 */
function sortByOrdinalAndPriority<T extends { id: string; ordinal?: number; priority?: string }>(
	items: T[],
	priorityOrder?: readonly string[],
): T[] {
	return [...items].sort((a, b) => {
		// Tasks with ordinal come before tasks without
		if (a.ordinal !== undefined && b.ordinal === undefined) {
			return -1;
		}
		if (a.ordinal === undefined && b.ordinal !== undefined) {
			return 1;
		}

		// Both have ordinals - sort by ordinal value
		if (a.ordinal !== undefined && b.ordinal !== undefined) {
			if (a.ordinal !== b.ordinal) {
				return a.ordinal - b.ordinal;
			}
		}

		// Same ordinal (or both undefined) - sort by priority
		const aWeight = getPriorityRank(a.priority, priorityOrder);
		const bWeight = getPriorityRank(b.priority, priorityOrder);

		if (aWeight !== bWeight) {
			return bWeight - aWeight;
		}

		// Same priority - sort by task ID
		return compareTaskIds(a.id, b.id);
	});
}

type SortableTask = { id: string; priority?: string; ordinal?: number };
type TaskSorter = <T extends SortableTask>(items: T[], priorityOrder?: readonly string[]) => T[];

/**
 * The named orders of a task list. Their names are the values `--sort` accepts, so adding an
 * entry here is all a new `--sort` value needs.
 */
const TASK_SORTERS = new Map<string, TaskSorter>([
	["priority", sortByPriority],
	["id", sortByTaskId],
	["ordinal", sortByOrdinal],
]);

export const TASK_SORT_FIELDS = [...TASK_SORTERS.keys()];

/**
 * Orders a task list for the plain, JSON, MCP and TUI lists. The browser's All Tasks table calls
 * it for the three sorts it shares with `--sort`; its other column sorts, and the column order of
 * both boards, are decided where they are drawn.
 *
 * `sortField` is one of TASK_SORT_FIELDS in any letter case. Without one the list is in its
 * default order: ordinal, then priority, then ID. A name that is not in TASK_SORT_FIELDS also
 * gives the default order; the CLI rejects such a name before it reads any task.
 */
export function sortTasks<T extends SortableTask>(
	items: T[],
	sortField?: string,
	priorityOrder?: readonly string[],
): T[] {
	const sorter = TASK_SORTERS.get(sortField?.toLowerCase() ?? "") ?? sortByOrdinalAndPriority;
	return sorter(items, priorityOrder);
}

/**
 * Splits an ordered task list into the sections the plain, MCP and TUI lists show it in.
 *
 * A list with an explicit `priority` sort is flat: one section whose status is null. Every other
 * order, the default included, has one section per status: configured statuses first, then any
 * other status, each section keeping the order of `tasks`.
 */
export function sectionTasks<T extends { status: string }>(
	tasks: T[],
	sortField: string | undefined,
	statuses: string[],
): Array<{ status: string | null; tasks: T[] }> {
	if (sortField?.toLowerCase() === "priority") {
		return [{ status: null, tasks }];
	}

	const canonicalByLower = new Map<string, string>();
	for (const status of statuses) {
		canonicalByLower.set(status.toLowerCase(), status);
	}

	const groups = new Map<string, T[]>();
	for (const task of tasks) {
		const rawStatus = (task.status || "").trim();
		const canonicalStatus = canonicalByLower.get(rawStatus.toLowerCase()) || rawStatus;
		const list = groups.get(canonicalStatus) || [];
		list.push(task);
		groups.set(canonicalStatus, list);
	}

	const orderedStatuses = [
		...statuses.filter((status) => groups.has(status)),
		...Array.from(groups.keys()).filter((status) => !statuses.includes(status)),
	];
	return orderedStatuses.map((status) => ({ status, tasks: groups.get(status) ?? [] }));
}
