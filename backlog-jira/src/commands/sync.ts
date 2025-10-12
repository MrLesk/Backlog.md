import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BacklogClient, type BacklogTask } from "../integrations/backlog.ts";
import { JiraClient, type JiraIssue } from "../integrations/jira.ts";
import { SyncStore } from "../state/store.ts";
import { logger } from "../utils/logger.ts";
import { computeHash, normalizeBacklogTask, normalizeJiraIssue } from "../utils/normalizer.ts";
import { type SyncState, classifySyncState } from "../utils/sync-state.ts";
import { pull } from "./pull.ts";
import { push } from "./push.ts";

export type ConflictStrategy = "prefer-backlog" | "prefer-jira" | "prompt" | "manual";

export interface SyncOptions {
	taskIds?: string[];
	all?: boolean;
	strategy?: ConflictStrategy;
	dryRun?: boolean;
}

export interface SyncResult {
	success: boolean;
	synced: string[];
	conflicts: Array<{
		taskId: string;
		resolution: string;
	}>;
	failed: Array<{ taskId: string; error: string }>;
	skipped: string[];
}

export interface Conflict {
	taskId: string;
	jiraKey: string;
	fields: FieldConflict[];
	backlogTask: BacklogTask;
	jiraIssue: JiraIssue;
	baseBacklog: unknown;
	baseJira: unknown;
}

export interface FieldConflict {
	field: string;
	backlogValue: unknown;
	jiraValue: unknown;
	baseValue: unknown;
}

/**
 * Bidirectional sync with 3-way merge and conflict resolution
 */
export async function sync(options: SyncOptions = {}): Promise<SyncResult> {
	logger.info({ options }, "Starting sync operation");

	const store = new SyncStore();
	const backlog = new BacklogClient();
	const jira = new JiraClient();

	const config = loadConfig();
	const defaultStrategy = (config.sync?.conflictStrategy as ConflictStrategy) || "prompt";
	const strategy = options.strategy || defaultStrategy;

	const result: SyncResult = {
		success: true,
		synced: [],
		conflicts: [],
		failed: [],
		skipped: [],
	};

	try {
		// Get list of tasks to sync
		const taskIds = await getTaskIds(options, store);

		logger.info({ count: taskIds.length, strategy }, "Tasks to process");

		for (const taskId of taskIds) {
			try {
				const outcome = await syncTask(taskId, {
					store,
					backlog,
					jira,
					strategy,
					dryRun: options.dryRun || false,
				});

				if (outcome.type === "synced") {
					result.synced.push(taskId);
				} else if (outcome.type === "conflict") {
					result.conflicts.push({
						taskId,
						resolution: outcome.resolution,
					});
				} else if (outcome.type === "skipped") {
					result.skipped.push(taskId);
				}

				logger.info({ taskId, outcome }, "Sync task completed");
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				result.failed.push({ taskId, error: errorMsg });
				logger.error({ taskId, error: errorMsg }, "Failed to sync task");
				result.success = false;
			}
		}

		store.logOperation("sync", null, null, result.success ? "success" : "partial", JSON.stringify(result));
	} finally {
		store.close();
	}

	logger.info({ result }, "Sync operation completed");
	return result;
}

/**
 * Get list of task IDs to sync
 */
async function getTaskIds(options: SyncOptions, store: SyncStore): Promise<string[]> {
	if (options.taskIds && options.taskIds.length > 0) {
		return options.taskIds;
	}

	if (options.all) {
		const mappings = store.getAllMappings();
		return Array.from(mappings.keys());
	}

	// Default: all mapped tasks
	const mappings = store.getAllMappings();
	return Array.from(mappings.keys());
}

/**
 * Sync a single task with 3-way merge
 */
async function syncTask(
	taskId: string,
	context: {
		store: SyncStore;
		backlog: BacklogClient;
		jira: JiraClient;
		strategy: ConflictStrategy;
		dryRun: boolean;
	},
): Promise<
	| { type: "synced"; direction: "push" | "pull" | "none" }
	| { type: "conflict"; resolution: string }
	| { type: "skipped"; reason: string }
> {
	const { store, backlog, jira, strategy, dryRun } = context;

	// Get mapping
	const mapping = store.getMapping(taskId);
	if (!mapping) {
		return { type: "skipped", reason: "No Jira mapping" };
	}

	// Get current state
	const task = await backlog.getTask(taskId);
	const issue = await jira.getIssue(mapping.jiraKey);

	const backlogHash = computeHash(normalizeBacklogTask(task));
	const jiraHash = computeHash(normalizeJiraIssue(issue));

	// Get snapshots and classify state
	const snapshots = store.getSnapshots(taskId);
	const state = classifySyncState(backlogHash, jiraHash, snapshots.backlog, snapshots.jira);

	logger.debug({ taskId, state: state.state }, "Sync state classified");

	// Handle based on state
	switch (state.state) {
		case "InSync":
			logger.info({ taskId }, "Already in sync");
			return { type: "skipped", reason: "Already in sync" };

		case "NeedsPush":
			// Backlog changed, push to Jira
			if (!dryRun) {
				await push({ taskIds: [taskId] });
			}
			return { type: "synced", direction: "push" };

		case "NeedsPull":
			// Jira changed, pull to Backlog
			if (!dryRun) {
				await pull({ taskIds: [taskId] });
			}
			return { type: "synced", direction: "pull" };

		case "Conflict":
			// Both changed - resolve conflict
			return await resolveConflict(
				{
					taskId,
					jiraKey: mapping.jiraKey,
					fields: detectFieldConflicts(task, issue, snapshots),
					backlogTask: task,
					jiraIssue: issue,
					baseBacklog: snapshots.backlog ? JSON.parse(snapshots.backlog.payload) : null,
					baseJira: snapshots.jira ? JSON.parse(snapshots.jira.payload) : null,
				},
				strategy,
				{ store, backlog, jira, dryRun },
			);

		case "Unknown":
			// No baseline - treat as first sync
			logger.info({ taskId }, "No baseline snapshot, creating initial sync");
			if (!dryRun) {
				// Store current state as baseline
				store.setSnapshot(taskId, "backlog", backlogHash, normalizeBacklogTask(task));
				store.setSnapshot(taskId, "jira", jiraHash, normalizeJiraIssue(issue));
				store.updateSyncState(taskId, {
					lastSyncAt: new Date().toISOString(),
				});
			}
			return { type: "synced", direction: "none" };
	}
}

/**
 * Detect field-level conflicts
 */
function detectFieldConflicts(
	task: BacklogTask,
	issue: JiraIssue,
	snapshots: ReturnType<typeof SyncStore.prototype.getSnapshots>,
): FieldConflict[] {
	const conflicts: FieldConflict[] = [];

	if (!snapshots.backlog || !snapshots.jira) {
		return conflicts;
	}

	const baseBacklog = JSON.parse(snapshots.backlog.payload);
	const baseJira = JSON.parse(snapshots.jira.payload);

	// Check title/summary
	if (task.title !== baseBacklog.title && issue.summary !== baseJira.summary) {
		conflicts.push({
			field: "title/summary",
			backlogValue: task.title,
			jiraValue: issue.summary,
			baseValue: baseBacklog.title,
		});
	}

	// Check description
	if (task.description !== baseBacklog.description && issue.description !== baseJira.description) {
		conflicts.push({
			field: "description",
			backlogValue: task.description,
			jiraValue: issue.description,
			baseValue: baseBacklog.description,
		});
	}

	// Check status
	if (task.status !== baseBacklog.status && issue.status !== baseJira.status) {
		conflicts.push({
			field: "status",
			backlogValue: task.status,
			jiraValue: issue.status,
			baseValue: baseBacklog.status,
		});
	}

	// Check assignee
	if (task.assignee !== baseBacklog.assignee && issue.assignee !== baseJira.assignee) {
		conflicts.push({
			field: "assignee",
			backlogValue: task.assignee,
			jiraValue: issue.assignee,
			baseValue: baseBacklog.assignee,
		});
	}

	// Check priority
	if (task.priority !== baseBacklog.priority && issue.priority !== baseJira.priority) {
		conflicts.push({
			field: "priority",
			backlogValue: task.priority,
			jiraValue: issue.priority,
			baseValue: baseBacklog.priority,
		});
	}

	// Check labels
	const taskLabelsStr = JSON.stringify(task.labels || []);
	const baseLabelsStr = JSON.stringify(baseBacklog.labels);
	const issueLabelsStr = JSON.stringify(issue.labels || []);
	const baseJiraLabelsStr = JSON.stringify(baseJira.labels);

	if (taskLabelsStr !== baseLabelsStr && issueLabelsStr !== baseJiraLabelsStr) {
		conflicts.push({
			field: "labels",
			backlogValue: task.labels,
			jiraValue: issue.labels,
			baseValue: baseBacklog.labels,
		});
	}

	return conflicts;
}

/**
 * Resolve a conflict using the specified strategy
 */
async function resolveConflict(
	conflict: Conflict,
	strategy: ConflictStrategy,
	context: {
		store: SyncStore;
		backlog: BacklogClient;
		jira: JiraClient;
		dryRun: boolean;
	},
): Promise<{ type: "conflict"; resolution: string }> {
	const { store, backlog, jira, dryRun } = context;

	logger.info({ taskId: conflict.taskId, strategy, fieldCount: conflict.fields.length }, "Resolving conflict");

	switch (strategy) {
		case "prefer-backlog":
			// Push Backlog changes to Jira
			if (!dryRun) {
				await push({ taskIds: [conflict.taskId], force: true });
			}
			return { type: "conflict", resolution: "preferred-backlog" };

		case "prefer-jira":
			// Pull Jira changes to Backlog
			if (!dryRun) {
				await pull({ taskIds: [conflict.taskId], force: true });
			}
			return { type: "conflict", resolution: "preferred-jira" };

		case "prompt":
			// Interactive resolution (not implemented in CLI, requires UI)
			logger.warn({ taskId: conflict.taskId }, "Prompt strategy requires interactive mode, marking as manual");
			store.updateSyncState(conflict.taskId, {
				conflictState: "manual-resolution-required",
			});
			return { type: "conflict", resolution: "manual-required" };

		case "manual":
			// Mark for manual resolution
			store.updateSyncState(conflict.taskId, {
				conflictState: "manual-resolution-required",
			});
			return { type: "conflict", resolution: "manual-marked" };

		default:
			throw new Error(`Unknown conflict strategy: ${strategy}`);
	}
}

/**
 * Load configuration
 */
function loadConfig(): {
	sync?: {
		conflictStrategy?: string;
	};
} {
	try {
		const configPath = join(process.cwd(), ".backlog-jira", "config.json");
		const content = readFileSync(configPath, "utf-8");
		return JSON.parse(content);
	} catch (error) {
		logger.warn({ error }, "Failed to load config, using defaults");
		return {};
	}
}
