import { BacklogClient, type BacklogTask } from "../integrations/backlog.ts";
import { JiraClient, type JiraIssue } from "../integrations/jira.ts";
import { SyncStore } from "../state/store.ts";
import { logger } from "../utils/logger.ts";
import { computeHash, normalizeBacklogTask, normalizeJiraIssue } from "../utils/normalizer.ts";
import { classifySyncState } from "../utils/sync-state.ts";

export interface PullOptions {
	taskIds?: string[];
	all?: boolean;
	force?: boolean;
	dryRun?: boolean;
}

export interface PullResult {
	success: boolean;
	pulled: string[];
	failed: Array<{ taskId: string; error: string }>;
	skipped: string[];
}

/**
 * Pull Jira issues to Backlog tasks
 * Updates existing mapped tasks via CLI only (no direct file writes)
 */
export async function pull(options: PullOptions = {}): Promise<PullResult> {
	logger.info({ options }, "Starting pull operation");

	const store = new SyncStore();
	const backlog = new BacklogClient();
	const jira = new JiraClient();

	const result: PullResult = {
		success: true,
		pulled: [],
		failed: [],
		skipped: [],
	};

	try {
		// Get list of tasks to pull
		const taskIds = await getTaskIds(options, backlog, jira, store);

		logger.info({ count: taskIds.length }, "Tasks to process");

		for (const taskId of taskIds) {
			try {
				await pullTask(taskId, {
					store,
					backlog,
					jira,
					force: options.force || false,
					dryRun: options.dryRun || false,
				});

				result.pulled.push(taskId);
				logger.info({ taskId }, "Successfully pulled task");
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				result.failed.push({ taskId, error: errorMsg });
				logger.error({ taskId, error: errorMsg }, "Failed to pull task");
				result.success = false;
			}
		}

		store.logOperation("pull", null, null, result.success ? "success" : "partial", JSON.stringify(result));
	} finally {
		store.close();
	}

	logger.info({ result }, "Pull operation completed");
	return result;
}

/**
 * Get list of task IDs to pull
 */
async function getTaskIds(
	options: PullOptions,
	backlog: BacklogClient,
	jira: JiraClient,
	store: SyncStore,
): Promise<string[]> {
	if (options.taskIds && options.taskIds.length > 0) {
		return options.taskIds;
	}

	if (options.all) {
		// Get all tasks that have mappings
		const mappings = store.getAllMappings();
		return Array.from(mappings.keys());
	}

	// Default: get tasks that need pull (changed on Jira side)
	const mappings = store.getAllMappings();
	const needsPull: string[] = [];

	for (const [taskId, jiraKey] of mappings) {
		try {
			const task = await backlog.getTask(taskId);
			const issue = await jira.getIssue(jiraKey);

			const backlogHash = computeHash(normalizeBacklogTask(task));
			const jiraHash = computeHash(normalizeJiraIssue(issue));

			const snapshots = store.getSnapshots(taskId);
			const state = classifySyncState(backlogHash, jiraHash, snapshots.backlog, snapshots.jira);

			if (state.state === "NeedsPull") {
				needsPull.push(taskId);
			}
		} catch (error) {
			logger.warn({ taskId, jiraKey, error }, "Failed to check sync state");
		}
	}

	return needsPull;
}

/**
 * Pull a single Jira issue to Backlog task
 */
async function pullTask(
	taskId: string,
	context: {
		store: SyncStore;
		backlog: BacklogClient;
		jira: JiraClient;
		force: boolean;
		dryRun: boolean;
	},
): Promise<void> {
	const { store, backlog, jira, force, dryRun } = context;

	// Get mapping
	const mapping = store.getMapping(taskId);
	if (!mapping) {
		throw new Error(`No Jira mapping found for task ${taskId}`);
	}

	// Get current state
	const task = await backlog.getTask(taskId);
	const issue = await jira.getIssue(mapping.jiraKey);

	const backlogHash = computeHash(normalizeBacklogTask(task));
	const jiraHash = computeHash(normalizeJiraIssue(issue));

	// Check sync state unless force is enabled
	if (!force) {
		const snapshots = store.getSnapshots(taskId);
		const state = classifySyncState(backlogHash, jiraHash, snapshots.backlog, snapshots.jira);

		if (state.state === "Conflict") {
			throw new Error(`Conflict detected. Use --force to override or run 'backlog-jira sync' to resolve`);
		}

		if (state.state === "InSync") {
			logger.info({ taskId }, "Task already in sync, skipping");
			return;
		}
	}

	// Build CLI updates from Jira issue
	const updates = buildBacklogUpdates(issue, task);

	if (dryRun) {
		logger.info({ taskId, updates }, "DRY RUN: Would update Backlog task");
	} else {
		// Apply updates via Backlog CLI
		if (Object.keys(updates).length > 0) {
			await backlog.updateTask(taskId, updates);
		}

		// Update snapshots with freshly updated data
		const updatedTask = await backlog.getTask(taskId);
		const syncedHash = computeHash(normalizeJiraIssue(issue));
		store.setSnapshot(taskId, "backlog", syncedHash, normalizeBacklogTask(updatedTask));
		store.setSnapshot(taskId, "jira", syncedHash, normalizeJiraIssue(issue));

		store.updateSyncState(taskId, {
			lastSyncAt: new Date().toISOString(),
		});

		logger.info({ taskId, jiraKey: mapping.jiraKey }, "Updated Backlog task from Jira");
	}
}

/**
 * Build Backlog CLI updates from Jira issue
 * Returns updates compatible with BacklogClient.updateTask()
 */
function buildBacklogUpdates(
	issue: JiraIssue,
	currentTask: BacklogTask,
): {
	title?: string;
	description?: string;
	status?: string;
	assignee?: string;
	labels?: string[];
	priority?: string;
} {
	const updates: Record<string, unknown> = {};

	// Summary -> Title
	if (issue.summary !== currentTask.title) {
		updates.title = issue.summary;
	}

	// Description
	if (issue.description && issue.description !== currentTask.description) {
		updates.description = issue.description;
	}

	// Status (needs mapping from Jira status to Backlog status)
	// For now, we'll do a simple direct mapping
	if (issue.status !== currentTask.status) {
		updates.status = mapJiraStatusToBacklog(issue.status);
	}

	// Assignee
	if (issue.assignee && issue.assignee !== currentTask.assignee) {
		updates.assignee = issue.assignee;
	}

	// Labels
	if (issue.labels && JSON.stringify(issue.labels) !== JSON.stringify(currentTask.labels)) {
		updates.labels = issue.labels;
	}

	// Priority
	if (issue.priority && issue.priority !== currentTask.priority) {
		updates.priority = issue.priority;
	}

	return updates;
}

/**
 * Map Jira status to Backlog status
 * This should use configuration, but for now uses simple defaults
 */
function mapJiraStatusToBacklog(jiraStatus: string): string {
	// Simple default mapping
	const mappings: Record<string, string> = {
		"To Do": "To Do",
		Open: "To Do",
		Backlog: "To Do",
		"In Progress": "In Progress",
		Done: "Done",
		Closed: "Done",
		Resolved: "Done",
	};

	return mappings[jiraStatus] || jiraStatus;
}
