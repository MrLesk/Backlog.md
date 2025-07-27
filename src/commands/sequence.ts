import type { Core } from "../core/backlog.ts";
import { computeSequences } from "../core/sequences.ts";
import type { Task } from "../types/index.ts";

export interface SequenceListOptions {
	plain?: boolean;
}

/**
 * Display sequences in plain text format
 */
export function displaySequencesPlain(sequences: ReturnType<typeof computeSequences>): void {
	if (sequences.length === 0) {
		console.log("No tasks found to compute sequences.");
		return;
	}

	console.log("Task Sequences:");
	console.log();

	for (const sequence of sequences) {
		console.log(`Sequence ${sequence.number}:`);

		if (sequence.tasks.length === 0) {
			console.log("  (No tasks)");
		} else {
			for (const task of sequence.tasks) {
				const priorityIndicator = task.priority ? `[${task.priority.toUpperCase()}] ` : "";
				console.log(`  ${priorityIndicator}${task.id} - ${task.title}`);
			}
		}

		console.log();
	}
}

/**
 * List sequences command handler
 */
export async function listSequences(core: Core, options: SequenceListOptions): Promise<void> {
	// Load all tasks
	const tasks = await core.filesystem.listTasks();

	if (tasks.length === 0) {
		console.log("No tasks found.");
		return;
	}

	// Compute sequences
	const sequences = computeSequences(tasks);

	// Handle plain output
	if (options.plain) {
		displaySequencesPlain(sequences);
		return;
	}

	// For interactive TUI, we'll implement this in the next step
	// For now, we'll import and use a TUI viewer
	const { viewSequencesTUI } = await import("../ui/sequences-tui.ts");
	await viewSequencesTUI(sequences);
}
