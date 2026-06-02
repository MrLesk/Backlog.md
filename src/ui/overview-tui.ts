import picocolors from "picocolors";
import type { TaskStatistics } from "../core/statistics.ts";
import type { Task } from "../types/index.ts";
import { getStatusIcon } from "./status-icon.ts";

function rule(char: string, width: number): string {
	return char.repeat(Math.max(0, width));
}

function formatDateForStats(dateStr: string): string {
	const hasTime = dateStr.includes(" ") || dateStr.includes("T");
	const normalized = `${dateStr.replace(" ", "T")}${hasTime ? ":00Z" : "T00:00:00Z"}`;
	const date = new Date(normalized);
	return date.toLocaleDateString();
}

function renderTaskItem(task: Task, terminalWidth: number): string {
	const maxLen = terminalWidth - 20;
	const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
	return `  ${task.id} - ${title}`;
}

// ─── Colored TUI ───────────────────────────────────────────────────────────

export async function renderOverviewTui(statistics: TaskStatistics, projectName: string): Promise<void> {
	const w = process.stdout.columns || 80;

	if (process.stdout.isTTY) {
		process.stdout.write("\x1b[2J\x1b[0;0H");
	}

	const lines: string[] = [];

	// Title
	const title = `${projectName} - Project Overview`;
	const pad = Math.max(0, Math.floor((w - title.length) / 2));
	lines.push(" ".repeat(pad) + picocolors.bold(title));
	lines.push(rule("=", w));

	// Section 1: Status Overview
	lines.push(picocolors.bold("Status Overview"));
	lines.push(rule("=", w));
	for (const [status, count] of statistics.statusCounts) {
		const icon = getStatusIcon(status);
		const percentage = statistics.totalTasks > 0 ? Math.round((count / statistics.totalTasks) * 100) : 0;
		lines.push(`  ${icon} ${picocolors.bold(status)}: ${count} tasks (${percentage}%)`);
	}
	lines.push("");
	lines.push(`  ${picocolors.cyan("Total Tasks:")} ${statistics.totalTasks}`);
	lines.push(`  ${picocolors.green("Completion:")} ${statistics.completionPercentage}%`);
	if (statistics.draftCount > 0) {
		lines.push(`  ${picocolors.yellow("Drafts:")} ${statistics.draftCount}`);
	}

	// Section 2: Priority Breakdown
	lines.push("");
	lines.push(picocolors.bold("Priority Breakdown"));
	lines.push(rule("=", w));
	const priorityColors: Record<string, (s: string) => string> = {
		high: picocolors.red,
		medium: picocolors.yellow,
		low: picocolors.green,
		none: picocolors.gray,
	};
	for (const [priority, count] of statistics.priorityCounts) {
		if (count > 0) {
			const colorFn = priorityColors[priority] || picocolors.white;
			const percentage = statistics.totalTasks > 0 ? Math.round((count / statistics.totalTasks) * 100) : 0;
			const displayPriority =
				priority === "none" ? "No Priority" : priority.charAt(0).toUpperCase() + priority.slice(1);
			lines.push(`  ${colorFn(displayPriority)}: ${count} tasks (${percentage}%)`);
		}
	}

	// Section 3: Recent Activity
	lines.push("");
	lines.push(picocolors.bold("Recent Activity"));
	lines.push(rule("=", w));
	lines.push(picocolors.bold("Recently Created"));
	lines.push(rule("-", w));
	if (statistics.recentActivity.created.length > 0) {
		for (const task of statistics.recentActivity.created) {
			lines.push(renderTaskItem(task, w));
		}
	} else {
		lines.push(`  ${picocolors.gray("No tasks created in the last 7 days")}`);
	}

	lines.push("");
	lines.push(picocolors.bold("Recently Updated"));
	lines.push(rule("-", w));
	if (statistics.recentActivity.updated.length > 0) {
		for (const task of statistics.recentActivity.updated) {
			lines.push(renderTaskItem(task, w));
		}
	} else {
		lines.push(`  ${picocolors.gray("No tasks updated in the last 7 days")}`);
	}

	// Section 4: Project Health
	lines.push("");
	lines.push(picocolors.bold("Project Health"));
	lines.push(rule("=", w));
	lines.push(`${picocolors.bold("Average Task Age:")} ${statistics.projectHealth.averageTaskAge} days`);

	const ar = statistics.projectHealth.atRiskTasks.length;
	const ov = statistics.projectHealth.overdueTasks.length;
	const st = statistics.projectHealth.staleTasks.length;
	const bl = statistics.projectHealth.blockedTasks.length;
	lines.push(
		`  ${picocolors.yellow("At Risk:")} ${ar}   ${picocolors.red("Overdue:")} ${ov}   ${picocolors.gray("Stale:")} ${st}   ${picocolors.red("Blocked:")} ${bl}`,
	);

	if (ar > 0) {
		lines.push("");
		lines.push(`${picocolors.bold("At Risk Tasks:")} ${picocolors.gray("(due soon, require immediate attention)")}`);
		lines.push(rule("-", w));
		for (const task of statistics.projectHealth.atRiskTasks) {
			const dateStr = task.dueDate ? ` | Due By ${formatDateForStats(task.dueDate)}` : "";
			const maxLen = Math.max(0, w - 20 - dateStr.length);
			const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
			lines.push(`  ${picocolors.yellow(task.id)} - ${title}${picocolors.gray(dateStr)}`);
		}
	}

	if (ov > 0) {
		lines.push("");
		lines.push(`${picocolors.bold("Overdue Tasks:")} ${picocolors.gray("(passed the due date)")}`);
		lines.push(rule("-", w));
		for (const task of statistics.projectHealth.overdueTasks) {
			const dateStr = task.dueDate ? ` | Due By ${formatDateForStats(task.dueDate)}` : "";
			const maxLen = Math.max(0, w - 20 - dateStr.length);
			const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
			lines.push(`  ${picocolors.red(task.id)} - ${title}${picocolors.gray(dateStr)}`);
		}
	}

	if (st > 0) {
		lines.push("");
		lines.push(`${picocolors.bold("Stale Tasks:")} ${picocolors.gray("(No updates for 30+ days, no due date set)")}`);
		lines.push(rule("-", w));
		for (const task of statistics.projectHealth.staleTasks) {
			const dateStr = ` | Updated: ${formatDateForStats(task.updatedDate || task.createdDate)}`;
			const maxLen = Math.max(0, w - 20 - dateStr.length);
			const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
			lines.push(`  ${picocolors.yellow(task.id)} - ${title}${picocolors.gray(dateStr)}`);
		}
	}

	if (bl > 0) {
		lines.push("");
		lines.push(`${picocolors.bold("Blocked Tasks:")} ${picocolors.gray("(waiting on dependencies)")}`);
		lines.push(rule("-", w));
		for (const task of statistics.projectHealth.blockedTasks) {
			const dateStr = task.dueDate
				? ` | Due By ${formatDateForStats(task.dueDate)}`
				: ` | Updated: ${formatDateForStats(task.updatedDate || task.createdDate)}`;
			const maxLen = Math.max(0, w - 20 - dateStr.length);
			const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
			lines.push(`  ${picocolors.red(task.id)} - ${title}${picocolors.gray(dateStr)}`);
		}
	}

	console.log(lines.join("\n"));
}

// ─── Plain text renderer ───────────────────────────────────────────────────

function renderPlainDistribution(
	title: string,
	counts: Map<string, number> | Record<string, number>,
	total: number,
): string {
	const entries = counts instanceof Map ? Array.from(counts.entries()) : Object.entries(counts);
	const filtered = entries.filter(([, count]) => count > 0);
	if (filtered.length === 0) return "";

	const maxLabelWidth = Math.max(...filtered.map(([label]) => label.length));
	const maxCountWidth = Math.max(...filtered.map(([, count]) => String(count).length));

	const lines: string[] = [];
	for (const [label, count] of filtered) {
		const pct = total > 0 ? Math.round((count / total) * 100) : 0;
		const paddedLabel = label.padEnd(maxLabelWidth, " ");
		const paddedCount = String(count).padStart(maxCountWidth, " ");
		lines.push(`  ${paddedLabel}  ${paddedCount}  ${pct}%`);
	}
	return `${title}\n${rule("-", title.length)}\n${lines.join("\n")}`;
}

function renderPlainTaskList(title: string, tasks: Task[]): string {
	if (tasks.length === 0) return "";
	const lines: string[] = [];
	for (const task of tasks) {
		const dateStr = task.updatedDate
			? `updated ${formatDateForStats(task.updatedDate)}`
			: task.createdDate
				? `created ${formatDateForStats(task.createdDate)}`
				: "";
		lines.push(`  ${task.id}: ${task.title}${dateStr ? ` (${dateStr})` : ""}`);
	}
	return `${title}\n${rule("-", title.length)}\n${lines.join("\n")}`;
}

export function renderStatsPlainText(stats: TaskStatistics, projectName: string): void {
	const w = process.stdout.columns || 80;

	// Title
	console.log(`${projectName} - Project Overview`);
	console.log(rule("=", `${projectName} - Project Overview`.length));

	// Status Overview
	console.log("Status Overview");
	console.log(rule("=", "Status Overview".length));
	for (const [status, count] of stats.statusCounts) {
		const percentage = stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
		console.log(`  ${status}: ${count} tasks (${percentage}%)`);
	}
	console.log("");
	console.log(`  Total Tasks: ${stats.totalTasks}`);
	console.log(`  Completion: ${stats.completionPercentage}%`);
	if (stats.draftCount > 0) {
		console.log(`  Drafts: ${stats.draftCount}`);
	}

	// Priority Breakdown
	console.log("");
	console.log(renderPlainDistribution("Priority Breakdown", stats.priorityCounts, stats.totalTasks));

	// Recent Activity
	console.log("");
	console.log("Recent Activity");
	console.log(rule("=", "Recent Activity".length));
	console.log(renderPlainTaskList("Recently Created", stats.recentActivity.created));
	if (stats.recentActivity.created.length > 0) console.log("");
	console.log(renderPlainTaskList("Recently Updated", stats.recentActivity.updated));

	// Project Health (last)
	console.log("");
	console.log("Project Health");
	console.log(rule("=", "Project Health".length));
	console.log(`  Average Task Age: ${stats.projectHealth.averageTaskAge} days`);
	console.log(`  At Risk: ${stats.projectHealth.atRiskTasks.length}`);
	console.log(`  Overdue: ${stats.projectHealth.overdueTasks.length}`);
	console.log(`  Stale: ${stats.projectHealth.staleTasks.length}`);
	console.log(`  Blocked: ${stats.projectHealth.blockedTasks.length}`);

	if (stats.projectHealth.atRiskTasks.length > 0) {
		console.log("");
		console.log("At Risk Tasks: (due soon, require immediate attention)");
		console.log(rule("-", "At Risk Tasks: (due soon, require immediate attention)".length));
		for (const task of stats.projectHealth.atRiskTasks) {
			const dateStr = task.dueDate ? ` | Due By ${formatDateForStats(task.dueDate)}` : "";
			const maxLen = Math.max(0, w - 20 - dateStr.length);
			const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
			console.log(`  ${task.id} - ${title}${dateStr}`);
		}
	}
	if (stats.projectHealth.overdueTasks.length > 0) {
		console.log("");
		console.log("Overdue Tasks: (passed the due date)");
		console.log(rule("-", "Overdue Tasks: (passed the due date)".length));
		for (const task of stats.projectHealth.overdueTasks) {
			const dateStr = task.dueDate ? ` | Due By ${formatDateForStats(task.dueDate)}` : "";
			const maxLen = Math.max(0, w - 20 - dateStr.length);
			const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
			console.log(`  ${task.id} - ${title}${dateStr}`);
		}
	}
	if (stats.projectHealth.staleTasks.length > 0) {
		console.log("");
		console.log("Stale Tasks: (No updates for 30+ days, no due date set)");
		console.log(rule("-", "Stale Tasks: (No updates for 30+ days, no due date set)".length));
		for (const task of stats.projectHealth.staleTasks) {
			const dateStr = ` | Updated: ${formatDateForStats(task.updatedDate || task.createdDate)}`;
			const maxLen = Math.max(0, w - 20 - dateStr.length);
			const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
			console.log(`  ${task.id} - ${title}${dateStr}`);
		}
	}
	if (stats.projectHealth.blockedTasks.length > 0) {
		console.log("");
		console.log("Blocked Tasks: (waiting on dependencies)");
		console.log(rule("-", "Blocked Tasks: (waiting on dependencies)".length));
		for (const task of stats.projectHealth.blockedTasks) {
			const dateStr = task.dueDate
				? ` | Due By ${formatDateForStats(task.dueDate)}`
				: ` | Updated: ${formatDateForStats(task.updatedDate || task.createdDate)}`;
			const maxLen = Math.max(0, w - 20 - dateStr.length);
			const title = task.title.length > maxLen ? `${task.title.substring(0, maxLen)}...` : task.title;
			console.log(`  ${task.id} - ${title}${dateStr}`);
		}
	}
}
