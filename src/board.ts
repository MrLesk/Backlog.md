export interface BoardOptions {
	statuses?: string[];
}

import type { Task } from "./types/index.ts";

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

export function generateKanbanBoard(tasks: Task[], statuses: string[] = []): string {
	const groups = new Map<string, Task[]>();
	for (const task of tasks) {
		const status = task.status || "";
		const list = groups.get(status) || [];
		list.push(task);
		groups.set(status, list);
	}

	// If no tasks, still show the configured statuses
	const ordered =
		tasks.length > 0
			? [...statuses.filter((s) => groups.has(s)), ...Array.from(groups.keys()).filter((s) => !statuses.includes(s))]
			: statuses;

	const columns = ordered.map((status) => {
		const list = groups.get(status) || [];
		return list.slice().sort(compareIds);
	});

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
