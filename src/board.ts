export interface BoardOptions {
	statuses?: string[];
}

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Task } from "./types/index.ts";
import { compareTaskIds } from "./utils/task-sorting.ts";

export type BoardLayout = "horizontal" | "vertical";
export type BoardFormat = "terminal" | "markdown";

interface DisplayTask {
	id: string;
	title: string;
	priority?: "high" | "medium" | "low";
}

function getPriorityIndicator(priority?: "high" | "medium" | "low"): string {
	switch (priority) {
		case "high":
			return "●";
		case "medium":
			return "●";
		case "low":
			return "●";
		default:
			return "";
	}
}

function wrapText(text: string, maxWidth: number): string[] {
	if (text.length <= maxWidth) return [text];

	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		if (currentLine.length + word.length + 1 <= maxWidth) {
			currentLine += (currentLine ? " " : "") + word;
		} else {
			if (currentLine) lines.push(currentLine);
			currentLine = word;
		}
	}

	if (currentLine) lines.push(currentLine);
	return lines;
}

export function generateKanbanBoard(
	tasks: Task[],
	statuses: string[] = [],
	layout: BoardLayout = "horizontal",
	maxColumnWidth = 20,
	format: BoardFormat = "terminal",
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

	// Only show statuses that have tasks (filter out empty groups)
	const ordered =
		tasks.length > 0
			? [
					...statuses.filter((s) => groups.has(s) && (groups.get(s)?.length ?? 0) > 0),
					...Array.from(groups.keys()).filter((s) => !statuses.includes(s) && (groups.get(s)?.length ?? 0) > 0),
				]
			: [];

	const columns: DisplayTask[][] = ordered.map((status) => {
		const items = groups.get(status) || [];
		const top: Task[] = [];
		const children = new Map<string, Task[]>();

		// Use compareTaskIds for sorting instead of localeCompare
		const sortedItems = items.sort((a, b) => {
			if (status === "Done") {
				return compareTaskIds(b.id, a.id); // Descending for Done
			}
			return compareTaskIds(a.id, b.id); // Ascending for others
		});

		for (const t of sortedItems) {
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
			const priorityIndicator = getPriorityIndicator(t.priority);
			const displayTitle = priorityIndicator ? `${priorityIndicator} ${t.title}` : t.title;
			result.push({ id: t.id, title: displayTitle, priority: t.priority });
			const subs = children.get(t.id) || [];
			subs.sort((a, b) => compareTaskIds(a.id, b.id));

			for (const [subIdx, s] of subs.entries()) {
				const isLastSub = subIdx === subs.length - 1;
				const prefix = isLastSub ? "  └─" : "  |—";
				const subPriorityIndicator = getPriorityIndicator(s.priority);
				const subDisplayTitle = subPriorityIndicator ? `     ${subPriorityIndicator} ${s.title}` : `     ${s.title}`;
				result.push({ id: `${prefix} ${s.id}`, title: subDisplayTitle, priority: s.priority });
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
			const tasksInStatus = columns[idx] || [];
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
		let width = Math.min(Math.max(header.length, 8), maxColumnWidth); // Minimum 8, max maxColumnWidth
		for (const t of columns[idx] || []) {
			// Check both task ID and title lengths separately
			const idLength = t.id.length;
			const titleLength = t.title.length;
			const maxTaskWidth = Math.max(idLength, titleLength);
			if (maxTaskWidth > width && width < maxColumnWidth) {
				width = Math.min(maxTaskWidth, maxColumnWidth);
			}
		}
		return width;
	});

	// For markdown format, we need simpler output without text wrapping
	if (format === "markdown") {
		const headerRow = `| ${ordered.map((status) => status || "No Status").join(" | ")} |`;
		const separatorRow = `| ${ordered.map(() => "---").join(" | ")} |`;

		const maxTasks = Math.max(...columns.map((c) => c.length), 0);
		const rows = [headerRow, separatorRow];

		for (let taskIdx = 0; taskIdx < maxTasks; taskIdx++) {
			const row = ordered.map((_, cIdx) => {
				const task = columns[cIdx]?.[taskIdx];
				if (!task) return "";
				// For markdown, combine ID and title in one cell
				return `${task.id}: ${task.title}`;
			});
			rows.push(`| ${row.join(" | ")} |`);
		}

		return rows.join("\n");
	}

	// Terminal format with text wrapping
	const pad = (text: string, width: number): string => text.padEnd(width, " ");

	const headerRow = ordered.map((status, i) => pad(status || "No Status", colWidths[i] || 0)).join(" | ");
	const separatorRow = ordered.map((_, i) => "-".repeat(colWidths[i] || 0)).join("-|-");

	// Prepare wrapped tasks for each column
	const wrappedTasks = ordered.map((_, cIdx) => {
		return (columns[cIdx] || []).map((task) => ({
			idLines: wrapText(task.id, colWidths[cIdx] || 0),
			titleLines: wrapText(task.title, colWidths[cIdx] || 0),
		}));
	});

	const maxTasks = Math.max(...columns.map((c) => c.length), 0);
	const rows = [headerRow, separatorRow];

	for (let taskIdx = 0; taskIdx < maxTasks; taskIdx++) {
		// Get the maximum number of lines needed for this task across all columns
		let maxTaskLines = 0;
		for (let cIdx = 0; cIdx < ordered.length; cIdx++) {
			const wrappedTask = wrappedTasks[cIdx]?.[taskIdx];
			if (wrappedTask) {
				const taskLines = wrappedTask.idLines.length + wrappedTask.titleLines.length;
				maxTaskLines = Math.max(maxTaskLines, taskLines);
			}
		}

		// Render each line for this task
		for (let lineIdx = 0; lineIdx < maxTaskLines; lineIdx++) {
			const lineRow = ordered
				.map((_, cIdx) => {
					const wrappedTask = wrappedTasks[cIdx]?.[taskIdx];
					if (!wrappedTask) return pad("", colWidths[cIdx] || 0);

					const idLineCount = wrappedTask.idLines.length;
					let text = "";

					if (lineIdx < idLineCount) {
						// Show ID lines first
						text = wrappedTask.idLines[lineIdx] || "";
					} else {
						// Then show title lines
						const titleLineIdx = lineIdx - idLineCount;
						if (titleLineIdx < wrappedTask.titleLines.length) {
							text = wrappedTask.titleLines[titleLineIdx] || "";
						}
					}

					return pad(text, colWidths[cIdx] || 0);
				})
				.join(" | ");
			rows.push(lineRow);
		}

		// Add empty row between tasks for better separation (except after last task)
		// Skip empty row if next task is a subtask (to keep parent and child together)
		if (taskIdx < maxTasks - 1) {
			const emptyRow = ordered.map((_, cIdx) => pad("", colWidths[cIdx] || 0)).join(" | ");
			rows.push(emptyRow);
		}
	}

	return rows.join("\n");
}

export async function exportKanbanBoardToFile(
	tasks: Task[],
	statuses: string[],
	filePath: string,
	maxColumnWidth = 20,
	addTitle = false,
): Promise<void> {
	const board = generateKanbanBoard(tasks, statuses, "horizontal", maxColumnWidth, "markdown");

	let existing = "";
	try {
		existing = await Bun.file(filePath).text();
	} catch {
		await mkdir(dirname(filePath), { recursive: true });
	}

	// Add proper spacing and title for readme export
	let boardContent = board;
	if (addTitle && filePath.toLowerCase().includes("readme")) {
		boardContent = `\n\n## Project Board\n\n${board}`;
	}

	const needsNewline = existing && !existing.endsWith("\n");
	const content = `${existing}${needsNewline ? "\n" : ""}${boardContent}\n`;
	await Bun.write(filePath, content);
}
