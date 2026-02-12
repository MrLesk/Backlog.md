import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Milestone, Task } from "./types/index.ts";

export interface BoardOptions {
	statuses?: string[];
}

export type BoardLayout = "horizontal" | "vertical";
export type BoardFormat = "terminal" | "markdown";

export function buildKanbanStatusGroups(
	tasks: Task[],
	statuses: string[],
): { orderedStatuses: string[]; groupedTasks: Map<string, Task[]> } {
	const canonicalByLower = new Map<string, string>();
	const orderedConfiguredStatuses: string[] = [];
	const configuredSeen = new Set<string>();

	for (const status of statuses ?? []) {
		if (typeof status !== "string") continue;
		const trimmed = status.trim();
		if (!trimmed) continue;
		const lower = trimmed.toLowerCase();
		if (!canonicalByLower.has(lower)) {
			canonicalByLower.set(lower, trimmed);
		}
		if (!configuredSeen.has(trimmed)) {
			orderedConfiguredStatuses.push(trimmed);
			configuredSeen.add(trimmed);
		}
	}

	const groupedTasks = new Map<string, Task[]>();
	for (const status of orderedConfiguredStatuses) {
		groupedTasks.set(status, []);
	}

	for (const task of tasks) {
		const raw = (task.status ?? "").trim();
		if (!raw) continue;
		const canonical = canonicalByLower.get(raw.toLowerCase()) ?? raw;
		if (!groupedTasks.has(canonical)) {
			groupedTasks.set(canonical, []);
		}
		groupedTasks.get(canonical)?.push(task);
	}

	const orderedStatuses: string[] = [];
	const seen = new Set<string>();

	for (const status of orderedConfiguredStatuses) {
		if (seen.has(status)) continue;
		orderedStatuses.push(status);
		seen.add(status);
	}

	for (const status of groupedTasks.keys()) {
		if (seen.has(status)) continue;
		orderedStatuses.push(status);
		seen.add(status);
	}

	return { orderedStatuses, groupedTasks };
}

export function generateKanbanBoardWithMetadata(tasks: Task[], statuses: string[], projectName: string): string {
	// Generate timestamp
	const now = new Date();
	const timestamp = now.toISOString().replace("T", " ").substring(0, 19);

	const { orderedStatuses, groupedTasks } = buildKanbanStatusGroups(tasks, statuses);

	// Create header
	const header = `# Kanban Board Export (powered by Backlog.md)
Generated on: ${timestamp}
Project: ${projectName}

`;

	// Return early if there are no configured statuses and no tasks
	if (orderedStatuses.length === 0) {
		return `${header}No tasks found.`;
	}

	// Create table header
	const headerRow = `| ${orderedStatuses.map((status) => status || "No Status").join(" | ")} |`;
	const separatorRow = `| ${orderedStatuses.map(() => "---").join(" | ")} |`;

	// Map for quick lookup by id
	const byId = new Map<string, Task>(tasks.map((t) => [t.id, t]));

	// Group tasks by status and handle parent-child relationships
	const columns: Task[][] = orderedStatuses.map((status) => {
		const items = groupedTasks.get(status) || [];
		const top: Task[] = [];
		const children = new Map<string, Task[]>();

		// Sort items: All columns by updatedDate descending (fallback to createdDate), then by ID as secondary
		const sortedItems = items.sort((a, b) => {
			// Primary sort: updatedDate (newest first), fallback to createdDate if updatedDate is missing
			const dateA = a.updatedDate ? new Date(a.updatedDate).getTime() : new Date(a.createdDate).getTime();
			const dateB = b.updatedDate ? new Date(b.updatedDate).getTime() : new Date(b.createdDate).getTime();
			if (dateB !== dateA) {
				return dateB - dateA; // Newest first
			}
			// Secondary sort: ID descending when dates are equal
			const idA = Number.parseInt(a.id.replace("task-", ""), 10);
			const idB = Number.parseInt(b.id.replace("task-", ""), 10);
			return idB - idA; // Highest ID first (newest)
		});

		// Separate top-level tasks from subtasks
		for (const t of sortedItems) {
			const parent = t.parentTaskId ? byId.get(t.parentTaskId) : undefined;
			if (parent && parent.status === t.status) {
				// Subtask with same status as parent - group under parent
				const list = children.get(parent.id) || [];
				list.push(t);
				children.set(parent.id, list);
			} else {
				// Top-level task or subtask with different status
				top.push(t);
			}
		}

		// Build final list with subtasks nested under parents
		const result: Task[] = [];
		for (const t of top) {
			result.push(t);
			const subs = children.get(t.id) || [];
			subs.sort((a, b) => {
				const idA = Number.parseInt(a.id.replace("task-", ""), 10);
				const idB = Number.parseInt(b.id.replace("task-", ""), 10);
				return idA - idB; // Subtasks in ascending order
			});
			result.push(...subs);
		}

		return result;
	});

	const maxTasks = Math.max(...columns.map((c) => c.length), 0);
	const rows = [headerRow, separatorRow];

	for (let taskIdx = 0; taskIdx < maxTasks; taskIdx++) {
		const row = orderedStatuses.map((_, cIdx) => {
			const task = columns[cIdx]?.[taskIdx];
			if (!task || !task.id || !task.title) return "";

			// Check if this is a subtask
			const isSubtask = task.parentTaskId;
			const taskIdPrefix = isSubtask ? "└─ " : "";
			const taskIdUpper = task.id.toUpperCase();

			// Format assignees in brackets or empty string if none
			// Add @ prefix only if not already present
			const assigneesText =
				task.assignee && task.assignee.length > 0
					? ` [${task.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ")}]`
					: "";

			// Format labels with # prefix and italic or empty string if none
			const labelsText =
				task.labels && task.labels.length > 0 ? `<br>*${task.labels.map((label) => `#${label}`).join(" ")}*` : "";

			return `${taskIdPrefix}**${taskIdUpper}** - ${task.title}${assigneesText}${labelsText}`;
		});
		rows.push(`| ${row.join(" | ")} |`);
	}

	const table = `${rows.join("\n")}`;
	if (maxTasks === 0) {
		return `${header}${table}\n\nNo tasks found.\n`;
	}

	return `${header}${table}\n`;
}

export function generateMilestoneGroupedBoard(
	tasks: Task[],
	statuses: string[],
	milestoneEntities: Milestone[],
	projectName: string,
): string {
	const now = new Date();
	const timestamp = now.toISOString().replace("T", " ").substring(0, 19);

	// Collect canonical milestone identifiers from milestone files and tasks.
	// Task values can be either IDs or titles, so normalize aliases to one key.
	const milestoneSeen = new Set<string>();
	const allMilestones: string[] = [];
	const aliasToMilestone = new Map<string, string>();
	const milestoneLabelsByKey = new Map<string, string>();
	const titleCounts = new Map<string, number>();
	for (const milestone of milestoneEntities) {
		const titleKey = milestone.title.trim().toLowerCase();
		if (!titleKey) continue;
		titleCounts.set(titleKey, (titleCounts.get(titleKey) ?? 0) + 1);
	}

	for (const milestone of milestoneEntities) {
		const normalizedId = milestone.id.trim();
		const normalizedTitle = milestone.title.trim();
		const idKey = normalizedId.toLowerCase();
		if (normalizedId && !milestoneSeen.has(idKey)) {
			milestoneSeen.add(idKey);
			allMilestones.push(normalizedId);
		}

		if (normalizedId) {
			aliasToMilestone.set(idKey, normalizedId);
			const idAliasMatch = normalizedId.match(/^m-(\d+)$/i);
			if (idAliasMatch?.[1]) {
				const numericAlias = String(Number.parseInt(idAliasMatch[1], 10));
				aliasToMilestone.set(`m-${numericAlias}`, normalizedId);
				if (!aliasToMilestone.has(numericAlias)) {
					aliasToMilestone.set(numericAlias, normalizedId);
				}
			}
		}
		if (normalizedTitle) {
			const titleKey = normalizedTitle.toLowerCase();
			if (titleCounts.get(titleKey) === 1 && !aliasToMilestone.has(titleKey)) {
				aliasToMilestone.set(titleKey, normalizedId || normalizedTitle);
			}
			milestoneLabelsByKey.set(idKey, normalizedTitle);
			if (titleCounts.get(titleKey) === 1 && !milestoneLabelsByKey.has(titleKey)) {
				milestoneLabelsByKey.set(titleKey, normalizedTitle);
			}
		}
	}

	const canonicalizeMilestone = (value?: string | null): string => {
		const normalized = value?.trim();
		if (!normalized) return "";
		const direct = aliasToMilestone.get(normalized.toLowerCase());
		if (direct) {
			return direct;
		}
		const idMatch = normalized.match(/^m-(\d+)$/i);
		if (idMatch?.[1]) {
			const numericAlias = String(Number.parseInt(idMatch[1], 10));
			return aliasToMilestone.get(`m-${numericAlias}`) ?? aliasToMilestone.get(numericAlias) ?? normalized;
		}
		if (/^\d+$/.test(normalized)) {
			const numericAlias = String(Number.parseInt(normalized, 10));
			return aliasToMilestone.get(`m-${numericAlias}`) ?? aliasToMilestone.get(numericAlias) ?? normalized;
		}
		return normalized;
	};

	for (const task of tasks) {
		const canonicalMilestone = canonicalizeMilestone(task.milestone);
		if (canonicalMilestone && !milestoneSeen.has(canonicalMilestone.toLowerCase())) {
			milestoneSeen.add(canonicalMilestone.toLowerCase());
			allMilestones.push(canonicalMilestone);
		}
	}

	const header = `# Kanban Board by Milestone (powered by Backlog.md)
Generated on: ${timestamp}
Project: ${projectName}

`;

	const sections: string[] = [];

	// No milestone section
	const noMilestoneTasks = tasks.filter((t) => !t.milestone?.trim());
	if (noMilestoneTasks.length > 0) {
		sections.push(generateMilestoneSection("No Milestone", noMilestoneTasks, statuses));
	}

	// Each milestone section
	for (const milestone of allMilestones) {
		const milestoneTasks = tasks.filter(
			(task) => canonicalizeMilestone(task.milestone).toLowerCase() === milestone.toLowerCase(),
		);
		if (milestoneTasks.length > 0) {
			const milestoneLabel = milestoneLabelsByKey.get(milestone.toLowerCase()) ?? milestone;
			sections.push(generateMilestoneSection(milestoneLabel, milestoneTasks, statuses));
		}
	}

	if (sections.length === 0) {
		return `${header}No tasks found.\n`;
	}

	return `${header}${sections.join("\n\n")}\n`;
}

function generateMilestoneSection(milestone: string, tasks: Task[], statuses: string[]): string {
	const { orderedStatuses, groupedTasks } = buildKanbanStatusGroups(tasks, statuses);

	const sectionHeader = `## ${milestone} (${tasks.length} tasks)\n`;

	if (orderedStatuses.length === 0) {
		return `${sectionHeader}\nNo tasks.\n`;
	}

	const statusLines = orderedStatuses.map((status) => {
		const statusTasks = groupedTasks.get(status) || [];
		const taskLines = statusTasks.map((t) => {
			const id = t.id.toUpperCase();
			const assignees = t.assignee?.length ? ` [@${t.assignee.join(", @")}]` : "";
			return `  - **${id}** - ${t.title}${assignees}`;
		});
		return `### ${status} (${statusTasks.length})\n${taskLines.length > 0 ? taskLines.join("\n") : "  (empty)"}`;
	});

	return `${sectionHeader}\n${statusLines.join("\n\n")}`;
}

export async function exportKanbanBoardToFile(
	tasks: Task[],
	statuses: string[],
	filePath: string,
	projectName: string,
	_overwrite = false,
): Promise<void> {
	const board = generateKanbanBoardWithMetadata(tasks, statuses, projectName);

	// Ensure directory exists
	try {
		await mkdir(dirname(filePath), { recursive: true });
	} catch {
		// Directory might already exist
	}

	// Write the content (overwrite mode)
	await Bun.write(filePath, board);
}
