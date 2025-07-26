import type { Core } from "../core/backlog.ts";
import { filterTasksByLatestState, getLatestTaskStatesForIds } from "../core/cross-branch-tasks.ts";
import { loadRemoteTasks, resolveTaskConflict } from "../core/remote-tasks.ts";
import { getTaskStatistics } from "../core/statistics.ts";
import type { Task } from "../types/index.ts";
import { createLoadingScreen } from "../ui/loading.ts";
import { renderOverviewTui } from "../ui/overview-tui.ts";

function formatTime(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

export async function runOverviewCommand(core: Core): Promise<void> {
	const startTime = performance.now();
	const config = await core.filesystem.loadConfig();
	const statuses = config?.statuses || [];
	const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";

	// Load tasks with loading screen
	const loadingScreen = await createLoadingScreen("Loading project statistics");

	try {
		// Load local, completed, and remote tasks in parallel
		loadingScreen?.update("Loading local tasks...");
		const loadStart = performance.now();
		const [localTasks, completedTasks, remoteTasks] = await Promise.all([
			core.listTasksWithMetadata(),
			core.filesystem.listCompletedTasks(),
			loadRemoteTasks(core.gitOps, core.filesystem, config),
		]);
		loadingScreen?.update(`Loaded tasks in ${formatTime(performance.now() - loadStart)}`);

		// Create map with local tasks
		const tasksById = new Map<string, Task>(localTasks.map((t) => [t.id, { ...t, source: "local" }]));

		// Add completed tasks to the map
		for (const completedTask of completedTasks) {
			if (!tasksById.has(completedTask.id)) {
				tasksById.set(completedTask.id, { ...completedTask, source: "completed" });
			}
		}

		// Merge remote tasks with local tasks
		const mergeStart = performance.now();
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
		loadingScreen?.update(`Merged tasks in ${formatTime(performance.now() - mergeStart)}`);

		// Get all tasks as array
		const tasks = Array.from(tasksById.values());
		let activeTasks: Task[];

		if (config?.checkActiveBranches === false) {
			// Skip cross-branch checking for maximum performance
			loadingScreen?.update("Skipping cross-branch check (disabled in config)...");
			activeTasks = tasks;
		} else {
			// Get the latest state of each task across all branches
			const crossBranchStart = performance.now();
			loadingScreen?.update("Checking task states across branches...");
			const taskIds = tasks.map((t) => t.id);
			const latestTaskDirectories = await getLatestTaskStatesForIds(
				core.gitOps,
				core.filesystem,
				taskIds,
				(msg) => loadingScreen?.update(msg),
				{
					recentBranchesOnly: true,
					daysAgo: config?.activeBranchDays ?? 30,
				},
			);
			loadingScreen?.update(`Checked branches in ${formatTime(performance.now() - crossBranchStart)}`);

			// Filter tasks based on their latest directory location
			activeTasks = filterTasksByLatestState(tasks, latestTaskDirectories);
		}

		// Also load drafts for statistics
		const draftStart = performance.now();
		loadingScreen?.update("Loading drafts...");
		const drafts = await core.filesystem.listDrafts();
		loadingScreen?.update(`Loaded drafts in ${formatTime(performance.now() - draftStart)}`);

		loadingScreen?.close();

		// Calculate statistics
		const statsStart = performance.now();
		const statistics = getTaskStatistics(activeTasks, drafts, statuses);
		const statsTime = Math.round(performance.now() - statsStart);

		// Display the TUI
		const totalTime = Math.round(performance.now() - startTime);
		console.log(`\nPerformance summary: Total time ${totalTime}ms (stats calculation: ${statsTime}ms)`);

		await renderOverviewTui(statistics, config?.projectName || "Project");
	} catch (error) {
		loadingScreen?.close();
		throw error;
	}
}
