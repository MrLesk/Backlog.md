import { type FSWatcher, watch } from "node:fs";
import { join } from "node:path";
import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";

export interface TaskWatcherCallbacks {
	/** Called when a new task file is created */
	onTaskAdded?: (task: Task) => void | Promise<void>;
	/** Called when an existing task file is modified */
	onTaskChanged?: (task: Task) => void | Promise<void>;
	/** Called when a task file is removed */
	onTaskRemoved?: (taskId: string) => void | Promise<void>;
}

/**
 * Watch the backlog/tasks directory for changes and emit incremental updates.
 * Uses node:fs.watch as implemented by Bun runtime.
 */
export function watchTasks(core: Core, callbacks: TaskWatcherCallbacks): { stop: () => void } {
	const tasksDir = core.filesystem.tasksDir;

	let watcher: FSWatcher | null = null;
	
	try {
		watcher = watch(tasksDir, { recursive: false }, async (eventType, filename) => {
		// Normalize filename to a string when available
		let fileName: string | undefined;
		if (typeof filename === "string") {
			fileName = filename;
		} else if (filename != null) {
			fileName = String(filename);
		}
		if (!fileName || !fileName.startsWith("task-") || !fileName.endsWith(".md")) {
			return;
		}

		const [firstPart] = fileName.split(" ");
		if (!firstPart) return; // defensive, satisfies noUncheckedIndexedAccess
		const taskId: string = firstPart;

		if (eventType === "change") {
			const task = await core.filesystem.loadTask(taskId);
			if (task) {
				await callbacks.onTaskChanged?.(task);
			}
			return;
		}

		if (eventType === "rename") {
			// "rename" can be create, delete, or rename. Check if file exists.
			try {
				const fullPath = join(tasksDir, fileName);
				const exists = await Bun.file(fullPath).exists();

				if (!exists) {
					await callbacks.onTaskRemoved?.(taskId);
					return;
				}

				const task = await core.filesystem.loadTask(taskId);
				if (task) {
					// Treat as a change; handlers may add if not present
					await callbacks.onTaskChanged?.(task);
				}
			} catch {
				// Ignore transient errors
			}
		}
		});
	} catch (error) {
		// File watching not available or directory doesn't exist
		console.warn(`File watching unavailable: ${error instanceof Error ? error.message : String(error)}`);
	}

	return {
		stop() {
			if (watcher) {
				try {
					watcher.close();
				} catch {}
			}
		},
	};
}
