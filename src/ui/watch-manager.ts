import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import type { TaskWatcherCallbacks } from "../utils/task-watcher.ts";
import { watchTasks } from "../utils/task-watcher.ts";

export interface WatchManagerOptions {
	enabled: boolean;
	showIndicator: boolean;
	onTaskAdded?: (task: Task) => void | Promise<void>;
	onTaskChanged?: (task: Task) => void | Promise<void>;
	onTaskRemoved?: (taskId: string) => void | Promise<void>;
	onWatchStatusChange?: (enabled: boolean, available: boolean) => void;
}

export interface WatchState {
	enabled: boolean;
	available: boolean;
	watcherActive: boolean;
}

/**
 * Manages file watching for TUI views with toggling support
 * and graceful fallback when watching is unavailable.
 */
export class WatchManager {
	private core: Core;
	private options: WatchManagerOptions;
	private watcher: { stop: () => void } | null = null;
	private watchState: WatchState;

	constructor(core: Core, options: WatchManagerOptions) {
		this.core = core;
		this.options = options;
		this.watchState = {
			enabled: options.enabled,
			available: false,
			watcherActive: false,
		};
	}

	/**
	 * Initialize the watch manager and test if watching is available
	 */
	async initialize(): Promise<void> {
		// Test if file watching is available
		try {
			const callbacks: TaskWatcherCallbacks = {
				onTaskAdded: async (task) => {
					if (this.options.onTaskAdded) {
						await this.options.onTaskAdded(task);
					}
				},
				onTaskChanged: async (task) => {
					if (this.options.onTaskChanged) {
						await this.options.onTaskChanged(task);
					}
				},
				onTaskRemoved: async (taskId) => {
					if (this.options.onTaskRemoved) {
						await this.options.onTaskRemoved(taskId);
					}
				},
			};

			// Try to start watching
			const testWatcher = watchTasks(this.core, callbacks);
			this.watchState.available = true;

			if (this.watchState.enabled) {
				this.watcher = testWatcher;
				this.watchState.watcherActive = true;
			} else {
				testWatcher.stop();
			}
		} catch (error) {
			this.watchState.available = false;
			this.watchState.enabled = false;
			this.watchState.watcherActive = false;
		}

		// Notify status change
		if (this.options.onWatchStatusChange) {
			this.options.onWatchStatusChange(this.watchState.enabled, this.watchState.available);
		}
	}

	/**
	 * Toggle watching on/off
	 */
	async toggle(): Promise<boolean> {
		if (!this.watchState.available) {
			return false; // Can't toggle if not available
		}

		this.watchState.enabled = !this.watchState.enabled;

		if (this.watchState.enabled && !this.watchState.watcherActive) {
			// Start watching
			try {
				const callbacks: TaskWatcherCallbacks = {
					onTaskAdded: async (task) => {
						if (this.options.onTaskAdded) {
							await this.options.onTaskAdded(task);
						}
					},
					onTaskChanged: async (task) => {
						if (this.options.onTaskChanged) {
							await this.options.onTaskChanged(task);
						}
					},
					onTaskRemoved: async (taskId) => {
						if (this.options.onTaskRemoved) {
							await this.options.onTaskRemoved(taskId);
						}
					},
				};

				this.watcher = watchTasks(this.core, callbacks);
				this.watchState.watcherActive = true;
			} catch (error) {
				this.watchState.enabled = false;
				this.watchState.available = false;
				this.watchState.watcherActive = false;
			}
		} else if (!this.watchState.enabled && this.watchState.watcherActive) {
			// Stop watching
			if (this.watcher) {
				this.watcher.stop();
				this.watcher = null;
			}
			this.watchState.watcherActive = false;
		}

		// Notify status change
		if (this.options.onWatchStatusChange) {
			this.options.onWatchStatusChange(this.watchState.enabled, this.watchState.available);
		}

		return this.watchState.enabled;
	}

	/**
	 * Get current watch state
	 */
	getState(): WatchState {
		return { ...this.watchState };
	}

	/**
	 * Get footer text for watch status indicator
	 */
	getFooterIndicator(): string {
		if (!this.options.showIndicator) {
			return "";
		}

		if (!this.watchState.available) {
			return "Live: UNAVAILABLE";
		}

		return this.watchState.enabled ? "Live: ON" : "Live: OFF";
	}

	/**
	 * Stop watching and cleanup
	 */
	destroy(): void {
		if (this.watcher) {
			this.watcher.stop();
			this.watcher = null;
		}
		this.watchState.watcherActive = false;
	}
}
