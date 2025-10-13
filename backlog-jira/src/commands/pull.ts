import { BacklogClient, type BacklogTask } from "../integrations/backlog.ts";
import { JiraClient, type JiraIssue } from "../integrations/jira.ts";
import { SyncStore } from "../state/store.ts";
import { logger } from "../utils/logger.ts";
import {
	computeHash,
	normalizeBacklogTask,
	normalizeJiraIssue,
	stripAcceptanceCriteriaFromDescription,
} from "../utils/normalizer.ts";
import { classifySyncState } from "../utils/sync-state.ts";
import { mapJiraStatusToBacklog } from "../utils/status-mapping.ts";
import { getTaskFilePath, updateJiraMetadata } from "../utils/frontmatter.ts";

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

		// Process in parallel batches for better performance (max 10 concurrent)
		const batchSize = 10;
		for (let i = 0; i < taskIds.length; i += batchSize) {
			const batch = taskIds.slice(i, i + batchSize);
			const promises = batch.map(async (taskId) => {
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
			});

			await Promise.all(promises);
		}

		store.logOperation(
			"pull",
			null,
			null,
			result.success ? "success" : "partial",
			JSON.stringify(result),
		);
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
			const state = classifySyncState(
				backlogHash,
				jiraHash,
				snapshots.backlog,
				snapshots.jira,
			);

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
	logger.info({ taskId, mapping }, "Retrieved mapping from store");
	if (!mapping) {
		throw new Error(`No Jira mapping found for task ${taskId}`);
	}

	// Get current state
	const task = await backlog.getTask(taskId);
	logger.info(
		{ mappingJiraKey: mapping.jiraKey, mappingKeys: Object.keys(mapping) },
		"Accessing mapping.jiraKey",
	);
	const issue = await jira.getIssue(mapping.jiraKey);

	const backlogHash = computeHash(normalizeBacklogTask(task));
	const jiraHash = computeHash(normalizeJiraIssue(issue));

	// Check sync state unless force is enabled
	if (!force) {
		const snapshots = store.getSnapshots(taskId);
		const state = classifySyncState(
			backlogHash,
			jiraHash,
			snapshots.backlog,
			snapshots.jira,
		);

		if (state.state === "Conflict") {
			throw new Error(
				`Conflict detected. Use --force to override or run 'backlog-jira sync' to resolve`,
			);
		}

		if (state.state === "InSync") {
			logger.info({ taskId }, "Task already in sync, skipping");
			return;
		}
	}

	// Build CLI updates from Jira issue
	// Extract project key from Jira issue key (format: PROJECT-123)
	const projectKey = issue.key.split("-")[0];
	const updates = buildBacklogUpdates(issue, task, projectKey);

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
		store.setSnapshot(
			taskId,
			"backlog",
			syncedHash,
			normalizeBacklogTask(updatedTask),
		);
		store.setSnapshot(taskId, "jira", syncedHash, normalizeJiraIssue(issue));

		store.updateSyncState(taskId, {
			lastSyncAt: new Date().toISOString(),
		});

		// Update frontmatter with Jira metadata
		try {
			const filePath = getTaskFilePath(taskId);
			const jiraUrl = process.env.JIRA_URL
				? `${process.env.JIRA_URL}/browse/${mapping.jiraKey}`
				: undefined;

			updateJiraMetadata(filePath, {
				jiraKey: mapping.jiraKey,
				jiraUrl,
				jiraLastSync: new Date().toISOString(),
				jiraSyncState: "InSync",
			});

			logger.debug(
				{ taskId, jiraKey: mapping.jiraKey },
				"Updated frontmatter with Jira metadata",
			);
		} catch (error) {
			logger.error(
				{ taskId, error },
				"Failed to update frontmatter, but pull was successful",
			);
		}

		logger.info(
			{ taskId, jiraKey: mapping.jiraKey },
			"Updated Backlog task from Jira",
		);
	}
}

/**
 * Build Backlog CLI updates from Jira issue
 * Returns updates compatible with BacklogClient.updateTask()
 */
function buildBacklogUpdates(
	issue: JiraIssue,
	currentTask: BacklogTask,
	projectKey?: string,
): {
	title?: string;
	description?: string;
	status?: string;
	assignee?: string;
	labels?: string[];
	priority?: string;
	addAc?: string[];
	removeAc?: number[];
	checkAc?: number[];
	uncheckAc?: number[];
} {
	const updates: Record<string, unknown> = {};

	// Summary -> Title
	if (issue.summary !== currentTask.title) {
		updates.title = issue.summary;
	}

	// Description (without AC section - AC synced separately)
	const cleanJiraDesc = stripAcceptanceCriteriaFromDescription(
		issue.description || "",
	);
	const cleanTaskDesc = stripAcceptanceCriteriaFromDescription(
		currentTask.description || "",
	);

	if (cleanJiraDesc !== cleanTaskDesc) {
		updates.description = cleanJiraDesc;
	}

	// Status (needs mapping from Jira status to Backlog status)
	if (issue.status !== currentTask.status) {
		updates.status = mapJiraStatusToBacklog(issue.status, projectKey);
		logger.debug(
			{
				taskId: currentTask.id,
				from: currentTask.status,
				to: updates.status,
				jiraStatus: issue.status,
			},
			"Mapped Jira status to Backlog status",
		);
	}

	// Assignee
	if (issue.assignee && issue.assignee !== currentTask.assignee) {
		updates.assignee = issue.assignee;
	}

	// Labels
	if (
		issue.labels &&
		JSON.stringify(issue.labels) !== JSON.stringify(currentTask.labels)
	) {
		updates.labels = issue.labels;
	}

	// Priority
	if (issue.priority && issue.priority !== currentTask.priority) {
		updates.priority = issue.priority;
	}

	// Acceptance Criteria synchronization
	const acUpdates = syncAcceptanceCriteria(issue, currentTask);
	if (acUpdates.addAc && acUpdates.addAc.length > 0) {
		updates.addAc = acUpdates.addAc;
	}
	if (acUpdates.removeAc && acUpdates.removeAc.length > 0) {
		updates.removeAc = acUpdates.removeAc;
	}
	if (acUpdates.checkAc && acUpdates.checkAc.length > 0) {
		updates.checkAc = acUpdates.checkAc;
	}
	if (acUpdates.uncheckAc && acUpdates.uncheckAc.length > 0) {
		updates.uncheckAc = acUpdates.uncheckAc;
	}

	return updates;
}

/**
 * Sync acceptance criteria from Jira to Backlog
 * Returns operations needed to align Backlog AC with Jira AC
 */
function syncAcceptanceCriteria(
	issue: JiraIssue,
	currentTask: BacklogTask,
): {
	addAc?: string[];
	removeAc?: number[];
	checkAc?: number[];
	uncheckAc?: number[];
} {
	// Extract AC from Jira description
	const jiraAc = normalizeJiraIssue(issue).acceptanceCriteria;
	const backlogAc = currentTask.acceptanceCriteria || [];

	// If AC are identical, no sync needed
	if (JSON.stringify(jiraAc) === JSON.stringify(backlogAc)) {
		return {};
	}

	const addAc: string[] = [];
	const removeAc: number[] = [];
	const checkAc: number[] = [];
	const uncheckAc: number[] = [];

	// Simple approach: If AC lists are different, replace entirely
	// Remove all existing AC and add new ones
	if (
		jiraAc.length !== backlogAc.length ||
		JSON.stringify(jiraAc) !== JSON.stringify(backlogAc)
	) {
		// Remove all existing AC (in reverse order to avoid index issues)
		for (let i = backlogAc.length; i > 0; i--) {
			removeAc.push(i);
		}

		// Add all Jira AC
		for (const ac of jiraAc) {
			addAc.push(ac.text);
		}

		// Note: The checked state will be handled after AC are added
		// We'll need to check the ones that should be checked
		for (let i = 0; i < jiraAc.length; i++) {
			if (jiraAc[i].checked) {
				// AC indices are 1-based, and they'll be added in order
				checkAc.push(i + 1);
			}
		}
	}

	logger.debug(
		{
			taskId: currentTask.id,
			jiraAcCount: jiraAc.length,
			backlogAcCount: backlogAc.length,
			operations: {
				addAc: addAc.length,
				removeAc: removeAc.length,
				checkAc: checkAc.length,
			},
		},
		"Syncing acceptance criteria from Jira",
	);

	return { addAc, removeAc, checkAc, uncheckAc };
}
