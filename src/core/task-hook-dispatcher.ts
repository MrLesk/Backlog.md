import type { BacklogConfig, Task } from "../types/index.ts";
import { executeStatusCallback, type StatusCallbackOptions, type StatusCallbackResult } from "../utils/status-callback.ts";

/**
 * Owns the previous-status snapshot for every task and decides when to fire
 * the onStatusChange hook. This is the single point of hook firing — both
 * `Core.updateTaskFromInput` and the file watcher route through here, so the
 * suppression contract in {@link TaskWriteCoordinator} guarantees no
 * double-fires regardless of code path.
 *
 * Lifecycle:
 *
 *  1. The owner constructs the dispatcher and calls {@link TaskHookDispatcher.seedSnapshot}
 *     once with the initial set of tasks (typically from the ContentStore's
 *     first load). This populates the previous-status map without firing any
 *     hooks — initial state is not a transition.
 *  2. On every subsequent task write that the watcher observes, the watcher
 *     calls {@link TaskHookDispatcher.onTaskWrite}. The dispatcher compares
 *     the new status against its snapshot, updates the snapshot, and fires
 *     the hook iff (a) the status genuinely transitioned, AND (b) the
 *     coordinator reports the write was NOT in-process. In-process writes
 *     already fired the hook through `Core.updateTaskFromInput` via the
 *     direct dispatch path.
 *  3. On deletion, the owner calls {@link TaskHookDispatcher.forgetTask} so a
 *     subsequent re-creation with the same id is treated as a new task, not
 *     a transition from the long-dead previous status.
 */
export interface TaskHookDispatcher {
	seedSnapshot(tasks: Iterable<Task>): void;
	/**
	 * Always updates the snapshot. Fires the hook only when (a) the caller
	 * did not request suppression AND (b) the task's status actually
	 * transitioned since the snapshot. The caller (the file watcher)
	 * decides suppression based on content-hash matching against the
	 * coordinator — see content-store.ts.
	 */
	onTaskWrite(task: Task, opts?: { suppress?: boolean }): Promise<void>;
	/**
	 * Dispatch the hook directly from an in-process update. Always updates
	 * the snapshot. Fires the hook only when (a) the caller did not request
	 * suppression AND (b) the old and new statuses differ. Callers gate
	 * `suppress` on hook-dispatch authority: in a multi-process deployment,
	 * only the watcher-lock holder should fire — other processes still
	 * update their local snapshot so future watcher events are accurately
	 * compared, but skip the actual fire and let the lock holder's watcher
	 * dispatch for everyone.
	 */
	dispatchInProcess(args: { task: Task; oldStatus: string }, opts?: { suppress?: boolean }): Promise<void>;
	forgetTask(taskId: string): void;
	/**
	 * Clear all snapshot state. Used by Core when re-pointing to a different
	 * project root so the next observation isn't compared against a stale
	 * previous-project status.
	 */
	reset(): void;
}

export interface TaskHookDispatcherOptions {
	/**
	 * Working directory passed to hook subprocesses. Either a static string or
	 * a thunk; the thunk form is required when the underlying project root
	 * can change at runtime (`Core.reinitializeProjectRoot`) so hooks always
	 * execute against the current project.
	 */
	cwd: string | (() => string);
	loadConfig(): Promise<BacklogConfig | null>;
	/** Override for tests; defaults to the production executeStatusCallback. */
	exec?: (options: StatusCallbackOptions) => Promise<StatusCallbackResult>;
	/**
	 * Reports errors from a hook execution. Defaults to `console.error`.
	 * Hook failures must never crash the watcher — they're logged and
	 * dropped.
	 */
	onError?: (taskId: string, message: string, output?: string) => void;
	/**
	 * Called every time the dispatcher fires the hook (success or failure).
	 * Used by `backlog watch` to print a visible line for each dispatch.
	 * The watcher / browser server pass nothing and stay silent.
	 */
	onDispatch?: (event: { taskId: string; taskTitle: string; oldStatus: string; newStatus: string; success: boolean }) => void;
}

export function createTaskHookDispatcher(options: TaskHookDispatcherOptions): TaskHookDispatcher {
	const exec = options.exec ?? executeStatusCallback;
	const onError =
		options.onError ??
		((taskId, message, output) => {
			console.error(`Status change callback failed for ${taskId}: ${message}`);
			if (output) {
				console.error(`Callback output: ${output}`);
			}
		});

	const resolveCwd: () => string = typeof options.cwd === "function" ? options.cwd : () => options.cwd as string;

	const previousStatus = new Map<string, string>();

	const fire = async (task: Task, oldStatus: string): Promise<void> => {
		const config = await options.loadConfig();
		const callbackCommand = task.onStatusChange ?? config?.onStatusChange;
		if (!callbackCommand) return;
		let success = false;
		try {
			const result = await exec({
				command: callbackCommand,
				taskId: task.id,
				oldStatus,
				newStatus: task.status,
				taskTitle: task.title,
				cwd: resolveCwd(),
				shell: config?.shell,
			});
			success = result.success;
			if (!result.success) {
				onError(task.id, result.error ?? "Unknown error", result.output);
			}
		} catch (error) {
			onError(task.id, error instanceof Error ? error.message : String(error));
		} finally {
			options.onDispatch?.({
				taskId: task.id,
				taskTitle: task.title,
				oldStatus,
				newStatus: task.status,
				success,
			});
		}
	};

	return {
		seedSnapshot(tasks: Iterable<Task>): void {
			for (const task of tasks) {
				previousStatus.set(task.id, task.status);
			}
		},

		async onTaskWrite(task: Task, opts: { suppress?: boolean } = {}): Promise<void> {
			const prev = previousStatus.get(task.id);
			// Always refresh the snapshot — even when suppressed — so the next
			// non-suppressed observation has an accurate baseline. Without
			// this, the first hand edit after a CLI-created task would be
			// treated as a brand-new task (no transition) and silently
			// dropped.
			previousStatus.set(task.id, task.status);

			if (opts.suppress) {
				// The caller (the file watcher) matched this read against a
				// pending in-process write. The hook was — or will be —
				// fired by the in-process code path; we must not fire it
				// again here.
				return;
			}
			if (prev === undefined) {
				// First time we've seen this task. Creation is not a status
				// transition — do not fire.
				return;
			}
			if (prev === task.status) {
				// Body, labels, or some other field changed — not a status
				// transition.
				return;
			}
			await fire(task, prev);
		},

		async dispatchInProcess(
			{ task, oldStatus }: { task: Task; oldStatus: string },
			opts: { suppress?: boolean } = {},
		): Promise<void> {
			previousStatus.set(task.id, task.status);
			if (opts.suppress) return;
			if (oldStatus === task.status) return;
			await fire(task, oldStatus);
		},

		forgetTask(taskId: string): void {
			previousStatus.delete(taskId);
		},

		reset(): void {
			previousStatus.clear();
		},
	};
}
