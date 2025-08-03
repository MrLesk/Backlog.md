export interface BoardOptions {
	statuses?: string[];
}

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Task } from "./types/index.ts";

export type BoardLayout = "horizontal" | "vertical";
export type BoardFormat = "terminal" | "markdown";

export function generateKanbanBoardWithMetadata(tasks: Task[], statuses: string[], projectName: string): string {
	// Generate timestamp
	const now = new Date();
	const timestamp = now.toISOString().replace("T", " ").substring(0, 19);

	// Group tasks by status, filtering out tasks without status
	const groups = new Map<string, Task[]>();
	for (const task of tasks) {
		const status = task.status?.trim();
		if (status) {
			// Only include tasks with a valid status
			const list = groups.get(status) || [];
			list.push(task);
			groups.set(status, list);
		}
	}

	// Only show statuses that have tasks (filter out empty groups and exclude empty/no status)
	const ordered = [
		...statuses.filter((s) => s?.trim() && groups.has(s) && (groups.get(s)?.length ?? 0) > 0),
		...Array.from(groups.keys()).filter((s) => s?.trim() && !statuses.includes(s) && (groups.get(s)?.length ?? 0) > 0),
	];

	// Create header
	const header = `# Kanban Board Export (powered by Backlog.md)
Generated on: ${timestamp}
Project: ${projectName}

`;

	// Return early if no tasks
	if (ordered.length === 0) {
		return `${header}No tasks found.`;
	}

	// Create table header
	const headerRow = `| ${ordered.map((status) => status || "No Status").join(" | ")} |`;
	const separatorRow = `| ${ordered.map(() => "---").join(" | ")} |`;

	// Map for quick lookup by id
	const byId = new Map<string, Task>(tasks.map((t) => [t.id, t]));

	// Group tasks by status and handle parent-child relationships
	const columns: Task[][] = ordered.map((status) => {
		const items = groups.get(status) || [];
		const top: Task[] = [];
		const children = new Map<string, Task[]>();

		// Sort items: Done column by updatedDate, others by ID descending
		const sortedItems = items.sort((a, b) => {
			if (status === "Done") {
				// For Done column: sort by updatedDate (newest first), then by ID as secondary
				const dateA = a.updatedDate ? new Date(a.updatedDate).getTime() : 0;
				const dateB = b.updatedDate ? new Date(b.updatedDate).getTime() : 0;
				if (dateB !== dateA) {
					return dateB - dateA; // Newest first
				}
				// If dates are equal or missing, fall back to ID comparison
			}
			// For all other columns or as secondary sort for Done: sort by ID descending
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
		const row = ordered.map((_, cIdx) => {
			const task = columns[cIdx]?.[taskIdx];
			if (!task || !task.id || !task.title) return "";

			// Check if this is a subtask
			const isSubtask = task.parentTaskId;
			const taskIdPrefix = isSubtask ? "└─ " : "";
			const taskIdUpper = task.id.toUpperCase();

			// Format assignees in brackets or empty string if none
			const assigneesText = task.assignee && task.assignee.length > 0 ? ` [@${task.assignee.join(", @")}]` : "";

			// Format labels with # prefix and italic or empty string if none
			const labelsText =
				task.labels && task.labels.length > 0 ? `<br>*${task.labels.map((label) => `#${label}`).join(" ")}*` : "";

			return `${taskIdPrefix}**${taskIdUpper}** - ${task.title}${assigneesText}${labelsText}`;
		});
		rows.push(`| ${row.join(" | ")} |`);
	}

	return `${header + rows.join("\n")}\n`;
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
