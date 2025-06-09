export interface BoardOptions {
	statuses?: string[];
}

import type { Task } from "./types/index.ts";

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

	const columns = ordered.map((status) => groups.get(status) || []);

	const colWidths = ordered.map((status, idx) => {
		const header = status || "No Status";
		let width = header.length;
		for (const t of columns[idx]) {
			const item = `${t.id} - ${t.title}`;
			if (item.length > width) width = item.length;
		}
		return width;
	});

	const pad = (text: string, width: number): string => text.padEnd(width, " ");

	const headerRow = ordered.map((status, i) => pad(status || "No Status", colWidths[i])).join(" | ");
	const separatorRow = ordered.map((_, i) => "-".repeat(colWidths[i])).join("-|-");

	const maxRows = Math.max(...columns.map((c) => c.length));
	const rows = [headerRow, separatorRow];

	for (let r = 0; r < maxRows; r++) {
		const row = ordered
			.map((_, cIdx) => {
				const task = columns[cIdx][r];
				const text = task ? `${task.id} - ${task.title}` : "";
				return pad(text, colWidths[cIdx]);
			})
			.join(" | ");
		rows.push(row);
	}

	return rows.join("\n");
}
