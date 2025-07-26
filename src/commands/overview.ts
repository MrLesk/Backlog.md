import type { Core } from "../core/backlog.ts";
import { filterTasksByLatestState, getLatestTaskStatesForIds } from "../core/cross-branch-tasks.ts";
import { loadRemoteTasks, resolveTaskConflict } from "../core/remote-tasks.ts";
import { getTaskStatistics } from "../core/statistics.ts";
import type { Task } from "../types/index.ts";
import { createLoadingScreen } from "../ui/loading.ts";
import { renderOverviewTui } from "../ui/overview-tui.ts";

export async function runOverviewCommand(core: Core): Promise<void> {
	const config = await core.filesystem.loadConfig();
	const statuses = config?.statuses || [];
	const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";

	// Load tasks with loading screen
	const loadingScreen = await createLoadingScreen("Loading project statistics");

	try {
		// Load local and remote tasks in parallel
		loadingScreen?.update("Loading local tasks...");
		const [localTasks, remoteTasks] = await Promise.all([
			core.listTasksWithMetadata(),
			loadRemoteTasks(core.gitOps, core.filesystem, config),
		]);

		// Create map with local tasks
		const tasksById = new Map<string, Task>(localTasks.map((t) => [t.id, { ...t, source: "local" }]));

		// Merge remote tasks with local tasks
		loadingScreen?.update("Merging tasks...");
		for (const remoteTask of remoteTasks) {
			const existing = tasksById.get(remoteTask.id);
			if (!existing) {
				tasksById.set(remoteTask.id, remoteTask);
			} else {
				const resolved = resolveTaskConflict(existing, remoteTask, statuses, resolutionStrategy);
				tasksById.set(remoteTask.id, resolved);
			}
		}

		// Get the latest state of each task across all branches
		loadingScreen?.update("Checking task states across branches...");
		const tasks = Array.from(tasksById.values());
		const taskIds = tasks.map((t) => t.id);
		const latestTaskDirectories = await getLatestTaskStatesForIds(core.gitOps, core.filesystem, taskIds, (msg) =>
			loadingScreen?.update(msg),
		);

		// Filter tasks based on their latest directory location
		const activeTasks = filterTasksByLatestState(tasks, latestTaskDirectories);

		// Also load drafts for statistics
		loadingScreen?.update("Loading drafts...");
		const drafts = await core.filesystem.listDrafts();

		loadingScreen?.close();

		// Calculate statistics
		const statistics = getTaskStatistics(activeTasks, drafts, statuses);

		// Display the TUI
		await renderOverviewTui(statistics, config?.projectName || "Project");
	} catch (error) {
		loadingScreen?.close();
		throw error;
	}
}
