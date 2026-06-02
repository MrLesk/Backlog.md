import type { Core } from "../core/backlog.ts";
import { getTaskStatistics } from "../core/statistics.ts";
import { createLoadingScreen } from "../ui/loading.ts";
import { renderOverviewTui, renderStatsPlainText } from "../ui/overview-tui.ts";

function formatTime(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

export interface OverviewOptions {
	plain?: boolean;
}

export async function runOverviewCommand(core: Core, options: OverviewOptions = {}): Promise<void> {
	const startTime = performance.now();
	const useTui = !options.plain;

	// Load tasks with loading screen (only for TUI mode)
	const loadingScreen = useTui ? await createLoadingScreen("Loading project statistics") : null;

	try {
		// Use the shared task loading logic
		const loadStart = performance.now();
		const {
			tasks: activeTasks,
			drafts,
			statuses,
		} = await core.loadAllTasksForStatistics((msg) => {
			if (loadingScreen) {
				loadingScreen.update(`${msg} in ${formatTime(performance.now() - loadStart)}`);
			}
		});

		loadingScreen?.close();

		// Calculate statistics
		const statsStart = performance.now();
		const statistics = getTaskStatistics(activeTasks, drafts, statuses);
		const statsTime = Math.round(performance.now() - statsStart);

		const config = await core.fs.loadConfig();
		const projectName = config?.projectName || "Project";

		if (options.plain) {
			renderStatsPlainText(statistics, projectName);
		} else {
			// Display the TUI
			const totalTime = Math.round(performance.now() - startTime);
			console.log(`\nPerformance summary: Total time ${totalTime}ms (stats calculation: ${statsTime}ms)`);
			await renderOverviewTui(statistics, projectName);
		}
	} catch (error) {
		loadingScreen?.close();
		throw error;
	}
}
