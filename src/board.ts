export interface BoardOptions {
	statuses?: string[];
}

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Task } from "./types/index.ts";

export type BoardLayout = "horizontal" | "vertical";

interface DisplayTask {
	id: string;
	title: string;
}

function idSegments(id: string): number[] {
	const normalized = id.startsWith("task-") ? id.slice(5) : id;
	return normalized.split(".").map((part) => Number.parseInt(part, 10));
}

function compareIds(a: Task, b: Task): number {
	const segA = idSegments(a.id);
	const segB = idSegments(b.id);
	const len = Math.max(segA.length, segB.length);
	for (let i = 0; i < len; i++) {
		const diff = (segA[i] ?? 0) - (segB[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

export function generateKanbanBoard(
	tasks: Task[],
	statuses: string[] = [],
	layout: BoardLayout = "horizontal",
): string {
	const groups = new Map<string, Task[]>();
	for (const task of tasks) {
		const status = task.status || "";
		const list = groups.get(status) || [];
		list.push(task);
		groups.set(status, list);
	}

	// Map for quick lookup by id
	const byId = new Map<string, Task>(tasks.map((t) => [t.id, t]));

	// Only show statuses that have tasks
	const ordered =
		tasks.length > 0
			? [...statuses.filter((s) => groups.has(s)), ...Array.from(groups.keys()).filter((s) => !statuses.includes(s))]
			: [];

	const columns: DisplayTask[][] = ordered.map((status) => {
		const items = groups.get(status) || [];
		const top: Task[] = [];
		const children = new Map<string, Task[]>();

		// Use compareIds for sorting instead of localeCompare
		for (const t of items.sort(compareIds)) {
			const parent = t.parentTaskId ? byId.get(t.parentTaskId) : undefined;
			if (parent && parent.status === t.status) {
				const list = children.get(parent.id) || [];
				list.push(t);
				children.set(parent.id, list);
			} else {
				top.push(t);
			}
		}

		const result: DisplayTask[] = [];
		for (const t of top) {
			result.push({ id: t.id, title: t.title });
			const subs = children.get(t.id) || [];
			subs.sort(compareIds);
			for (const s of subs) {
				result.push({ id: `  |— ${s.id}`, title: `  ${s.title}` });
			}
		}

		return result;
	});

	if (layout === "vertical") {
		const rows: string[] = [];
		for (const [idx, status] of ordered.entries()) {
			const header = status || "No Status";
			rows.push(header);
			rows.push("-".repeat(header.length));
			const tasksInStatus = columns[idx];
			for (const task of tasksInStatus) {
				rows.push(task.id);
				rows.push(task.title);
				rows.push("");
			}
			if (tasksInStatus.length === 0) {
				rows.push("");
			}
		}
		return rows.join("\n").trimEnd();
	}

	// Return empty string if no columns to show
	if (ordered.length === 0) {
		return "";
	}

	const colWidths = ordered.map((status, idx) => {
		const header = status || "No Status";
		let width = header.length;
		for (const t of columns[idx]) {
			// Check both task ID and title lengths separately
			const idLength = t.id.length;
			const titleLength = t.title.length;
			const maxTaskWidth = Math.max(idLength, titleLength);
			if (maxTaskWidth > width) width = maxTaskWidth;
		}
		return width;
	});

	const pad = (text: string, width: number): string => text.padEnd(width, " ");

	const headerRow = ordered.map((status, i) => pad(status || "No Status", colWidths[i])).join(" | ");
	const separatorRow = ordered.map((_, i) => "-".repeat(colWidths[i])).join("-|-");

	// Each task takes 2 rows (ID + title), plus 1 empty row between tasks
	const maxTasks = Math.max(...columns.map((c) => c.length), 0);
	const rows = [headerRow, separatorRow];

	for (let taskIdx = 0; taskIdx < maxTasks; taskIdx++) {
		// First row: task IDs
		const idRow = ordered
			.map((_, cIdx) => {
				const task = columns[cIdx][taskIdx];
				const text = task ? task.id : "";
				return pad(text, colWidths[cIdx]);
			})
			.join(" | ");
		rows.push(idRow);

		// Second row: task titles
		const titleRow = ordered
			.map((_, cIdx) => {
				const task = columns[cIdx][taskIdx];
				const text = task ? task.title : "";
				return pad(text, colWidths[cIdx]);
			})
			.join(" | ");
		rows.push(titleRow);

		// Add empty row between tasks for better separation (except after last task)
		if (taskIdx < maxTasks - 1) {
			const emptyRow = ordered.map((_, cIdx) => pad("", colWidths[cIdx])).join(" | ");
			rows.push(emptyRow);
		}
	}

	return rows.join("\n");
}

export async function exportKanbanBoardToFile(tasks: Task[], statuses: string[], filePath: string): Promise<void> {
	const board = generateKanbanBoard(tasks, statuses);

	let existing = "";
	try {
		existing = await Bun.file(filePath).text();
	} catch {
		await mkdir(dirname(filePath), { recursive: true });
	}

	const needsNewline = existing && !existing.endsWith("\n");
	const content = `${existing}${needsNewline ? "\n" : ""}${board}\n`;
	await Bun.write(filePath, content);
}
