import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import type { Task } from "../types/index.ts";
import type { Core } from "./backlog.ts";

/**
 * Drift detection types
 */
export type DriftType = "dead-ref" | "dependency-state" | "stale-completion" | "orphaned-task";

export type DriftSeverity = "error" | "warning" | "info";

export interface DriftResult {
	taskId: string;
	taskTitle: string;
	type: DriftType;
	severity: DriftSeverity;
	message: string;
	ref?: string;
	dependencyId?: string;
}

export interface DriftSummary {
	total: number;
	errors: number;
	warnings: number;
	info: number;
	results: DriftResult[];
}

/**
 * Run all structural drift checks against the project.
 *
 * Checks performed:
 * 1. Dead refs — task references files that no longer exist
 * 2. Dependency state — task depends on a completed/archived task
 * 3. Stale completion — completed task's ref was modified after completion
 * 4. Orphaned task — all referenced files deleted, task still active
 */
export async function checkDrift(core: Core): Promise<DriftSummary> {
	const config = await core.filesystem.loadConfig();
	const projectRoot = core.filesystem.rootDir;

	// Load active tasks, completed tasks, and archived tasks
	const activeTasks = await core.filesystem.listTasks();
	const completedTasks = await core.filesystem.listCompletedTasks();
	const archivedTasks = await core.filesystem.listArchivedTasks();

	const allTasks = [...activeTasks, ...completedTasks, ...archivedTasks];
	const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id.toLowerCase(), t]));

	// Determine which statuses are "done"
	const statuses = config?.statuses ?? ["To Do", "In Progress", "Done"];
	const doneStatus = statuses[statuses.length - 1] ?? "Done";

	const results: DriftResult[] = [];

	for (const task of allTasks) {
		const refs = task.references ?? [];
		const isDone = task.status?.toLowerCase() === doneStatus.toLowerCase() || task.source === "completed";

		// Check 1: Dead refs
		const deadRefs = checkDeadRefs(task, refs, projectRoot);
		results.push(...deadRefs);

		// Check 2: Dependency state
		const depResults = checkDependencyState(task, taskMap, doneStatus);
		results.push(...depResults);

		// Check 3: Stale completion (only for completed tasks)
		if (isDone && refs.length > 0) {
			const staleResults = await checkStaleCompletion(task, refs, projectRoot, core);
			results.push(...staleResults);
		}

		// Check 4: Orphaned task (only for active tasks with refs)
		if (!isDone && refs.length > 0) {
			const allDead = refs.every((ref) => !existsSync(join(projectRoot, ref)));
			if (allDead) {
				results.push({
					taskId: task.id,
					taskTitle: task.title,
					type: "orphaned-task",
					severity: "warning",
					message: `All ${refs.length} referenced file(s) have been deleted`,
				});
			}
		}
	}

	const errors = results.filter((r) => r.severity === "error").length;
	const warnings = results.filter((r) => r.severity === "warning").length;
	const info = results.filter((r) => r.severity === "info").length;

	return { total: results.length, errors, warnings, info, results };
}

/**
 * Check for references to files that no longer exist.
 */
function checkDeadRefs(task: Task, refs: string[], projectRoot: string): DriftResult[] {
	const results: DriftResult[] = [];
	for (const ref of refs) {
		const fullPath = join(projectRoot, ref);
		if (!existsSync(fullPath)) {
			results.push({
				taskId: task.id,
				taskTitle: task.title,
				type: "dead-ref",
				severity: "error",
				message: `Referenced file "${ref}" no longer exists`,
				ref,
			});
		}
	}
	return results;
}

/**
 * Check if any dependencies have been completed or archived.
 */
function checkDependencyState(task: Task, taskMap: Map<string, Task>, doneStatus: string): DriftResult[] {
	const results: DriftResult[] = [];
	for (const depId of task.dependencies) {
		const dep = taskMap.get(depId.toLowerCase());
		if (!dep) continue;
		const depIsDone = dep.status?.toLowerCase() === doneStatus.toLowerCase() || dep.source === "completed";
		if (depIsDone) {
			results.push({
				taskId: task.id,
				taskTitle: task.title,
				type: "dependency-state",
				severity: "info",
				message: `Dependency "${dep.id}" has been completed`,
				dependencyId: dep.id,
			});
		}
	}
	return results;
}

/**
 * Check if a completed task's referenced files have been modified since completion.
 * Uses git log to compare file modification time against task completion time.
 */
async function checkStaleCompletion(
	task: Task,
	refs: string[],
	projectRoot: string,
	core: Core,
): Promise<DriftResult[]> {
	const results: DriftResult[] = [];

	// Use task's updatedDate or lastModified as the completion timestamp
	const completionDate = task.updatedDate
		? new Date(task.updatedDate)
		: task.lastModified
			? new Date(task.lastModified)
			: null;

	if (!completionDate) return results;

	for (const ref of refs) {
		const fullPath = join(projectRoot, ref);
		if (!existsSync(fullPath)) continue; // Dead ref handled separately

		try {
			// Get the last modification time of the referenced file from git
			const relativePath = relative(projectRoot, fullPath);
			const lastModified = await getFileLastModified(core, relativePath);

			if (lastModified && lastModified > completionDate) {
				results.push({
					taskId: task.id,
					taskTitle: task.title,
					type: "stale-completion",
					severity: "warning",
					message: `Referenced file "${ref}" was modified after task completion`,
					ref,
				});
			}
		} catch {
			// If we can't determine modification time, skip
		}
	}
	return results;
}

/**
 * Get last modification date of a file via git log.
 */
async function getFileLastModified(core: Core, relativePath: string): Promise<Date | null> {
	try {
		const map = await core.gitOps.getBranchLastModifiedMap("HEAD", ".", 365);
		const date = map.get(relativePath);
		return date ?? null;
	} catch {
		return null;
	}
}

/**
 * Format drift results for terminal output.
 */
export function formatDriftResults(summary: DriftSummary): string {
	const lines: string[] = [];

	if (summary.total === 0) {
		lines.push("No drift detected. All tasks are up to date.");
		return lines.join("\n");
	}

	// Group by task
	const byTask = new Map<string, DriftResult[]>();
	for (const result of summary.results) {
		const key = result.taskId;
		if (!byTask.has(key)) byTask.set(key, []);
		byTask.get(key)?.push(result);
	}

	for (const [taskId, results] of byTask) {
		const title = results[0]?.taskTitle ?? "";
		lines.push(`${taskId} "${title}"`);
		for (const r of results) {
			const icon = r.severity === "error" ? "✗" : r.severity === "warning" ? "⚠" : "ℹ";
			lines.push(`  ${icon} [${r.type}] ${r.message}`);
		}
		lines.push("");
	}

	lines.push(`Summary: ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.info} info`);

	return lines.join("\n");
}
