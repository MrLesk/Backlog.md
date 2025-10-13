import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BacklogClient, type BacklogTask } from "../integrations/backlog.ts";
import { JiraClient, type JiraIssue } from "../integrations/jira.ts";
import { SyncStore } from "../state/store.ts";
import { logger } from "../utils/logger.ts";
import {
	computeHash,
	mergeDescriptionWithAc,
	normalizeBacklogTask,
	normalizeJiraIssue,
	stripAcceptanceCriteriaFromDescription,
} from "../utils/normalizer.ts";
import { classifySyncState } from "../utils/sync-state.ts";
import { findTransitionForStatus } from "../utils/status-mapping.ts";
import { getTaskFilePath, updateJiraMetadata } from "../utils/frontmatter.ts";

export interface PushOptions {
	taskIds?: string[];
	all?: boolean;
	force?: boolean;
	dryRun?: boolean;
}

export interface PushResult {
	success: boolean;
	pushed: string[];
	failed: Array<{ taskId: string; error: string }>;
	skipped: string[];
}

/**
 * Push Backlog tasks to Jira
 * Updates existing mapped issues or creates new ones
 */
export async function push(options: PushOptions = {}): Promise<PushResult> {
	logger.info({ options }, "Starting push operation");

	const store = new SyncStore();
	const backlog = new BacklogClient();
	const jira = new JiraClient();

	// Load configuration
	const config = loadConfig();
	const projectKey = config.jira?.projectKey;
	const issueType = config.jira?.issueType || "Task";

	if (!projectKey) {
		throw new Error(
			"Jira project key not configured in .backlog-jira/config.json",
		);
	}

	const result: PushResult = {
		success: true,
		pushed: [],
		failed: [],
		skipped: [],
	};

	try {
		// Get list of tasks to push
		const taskIds = await getTaskIds(options, backlog, jira, store);

		logger.info({ count: taskIds.length }, "Tasks to process");

		// Process in parallel batches for better performance (max 10 concurrent)
		const batchSize = 10;
		for (let i = 0; i < taskIds.length; i += batchSize) {
			const batch = taskIds.slice(i, i + batchSize);
			const promises = batch.map(async (taskId) => {
				try {
					await pushTask(taskId, {
						store,
						backlog,
						jira,
						projectKey,
						issueType,
						force: options.force || false,
						dryRun: options.dryRun || false,
					});

					result.pushed.push(taskId);
					logger.info({ taskId }, "Successfully pushed task");
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					result.failed.push({ taskId, error: errorMsg });
					logger.error({ taskId, error: errorMsg }, "Failed to push task");
					result.success = false;
				}
			});

			await Promise.all(promises);
		}

		store.logOperation(
			"push",
			null,
			null,
			result.success ? "success" : "partial",
			JSON.stringify(result),
		);
	} finally {
		store.close();
	}

	logger.info({ result }, "Push operation completed");
	return result;
}

/**
 * Get list of task IDs to push
 */
async function getTaskIds(
	options: PushOptions,
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

	// Default: get tasks that need push (changed on Backlog side)
	const mappings = store.getAllMappings();
	const needsPush: string[] = [];

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

			if (state.state === "NeedsPush") {
				needsPush.push(taskId);
			}
		} catch (error) {
			logger.warn({ taskId, jiraKey, error }, "Failed to check sync state");
		}
	}

	return needsPush;
}

/**
 * Push a single task to Jira
 */
async function pushTask(
	taskId: string,
	context: {
		store: SyncStore;
		backlog: BacklogClient;
		jira: JiraClient;
		projectKey: string;
		issueType: string;
		force: boolean;
		dryRun: boolean;
	},
): Promise<void> {
	const { store, backlog, jira, projectKey, issueType, force, dryRun } = context;

	// Get current task
	const task = await backlog.getTask(taskId);
	const backlogHash = computeHash(normalizeBacklogTask(task));

	// Check if task is already mapped
	const mapping = store.getMapping(taskId);

	if (mapping) {
		// Update existing issue
		const issue = await jira.getIssue(mapping.jiraKey);
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
		}

		// Build updates
		const updates = await buildJiraUpdates(task, issue, jira, projectKey);

		if (dryRun) {
			logger.info(
				{ taskId, jiraKey: mapping.jiraKey, updates },
				"DRY RUN: Would update Jira issue",
			);
		} else {
			// Update issue fields
			if (Object.keys(updates.fields).length > 0) {
				await jira.updateIssue(mapping.jiraKey, updates.fields);
			}

			// Handle status transitions
			if (updates.transition) {
				await jira.transitionIssue(mapping.jiraKey, updates.transition.id, {
					comment: updates.transition.comment,
				});
			}

			// Update snapshots with re-fetched data
			const updatedIssue = await jira.getIssue(mapping.jiraKey);
			const syncedHash = computeHash(normalizeBacklogTask(task));
			store.setSnapshot(taskId, "backlog", syncedHash, normalizeBacklogTask(task));
			store.setSnapshot(
				taskId,
				"jira",
				syncedHash,
				normalizeJiraIssue(updatedIssue),
			);

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
					"Failed to update frontmatter, but push was successful",
				);
			}
		}
	} else {
		// Create new issue
		if (dryRun) {
			logger.info(
				{ taskId, projectKey, issueType },
				"DRY RUN: Would create new Jira issue",
			);
		} else {
			// Merge description with AC for new issue creation
			const descriptionWithAc = task.acceptanceCriteria
				? mergeDescriptionWithAc(task.description || "", task.acceptanceCriteria)
				: task.description;

			const issue = await jira.createIssue(projectKey, issueType, task.title, {
				description: descriptionWithAc,
				assignee: task.assignee,
				priority: task.priority,
				labels: task.labels,
			});

			// Create mapping
			store.addMapping(taskId, issue.key);

			// Store initial snapshots
			store.setSnapshot(
				taskId,
				"backlog",
				backlogHash,
				normalizeBacklogTask(task),
			);
			store.setSnapshot(taskId, "jira", backlogHash, normalizeJiraIssue(issue));

			store.updateSyncState(taskId, {
				lastSyncAt: new Date().toISOString(),
			});

			// Update frontmatter with Jira metadata for new issue
			try {
				const filePath = getTaskFilePath(taskId);
				const jiraUrl = process.env.JIRA_URL
					? `${process.env.JIRA_URL}/browse/${issue.key}`
					: undefined;

				updateJiraMetadata(filePath, {
					jiraKey: issue.key,
					jiraUrl,
					jiraLastSync: new Date().toISOString(),
					jiraSyncState: "InSync",
				});

				logger.debug(
					{ taskId, jiraKey: issue.key },
					"Updated frontmatter with Jira metadata for new issue",
				);
			} catch (error) {
				logger.error(
					{ taskId, error },
					"Failed to update frontmatter, but push was successful",
				);
			}

			logger.info({ taskId, jiraKey: issue.key }, "Created new Jira issue");
		}
	}
}

/**
 * Build Jira updates from Backlog task
 */
async function buildJiraUpdates(
	task: BacklogTask,
	currentIssue: JiraIssue,
	jiraClient: JiraClient,
	projectKey: string,
): Promise<{
	fields: {
		summary?: string;
		description?: string;
		assignee?: string;
		priority?: string;
		labels?: string[];
	};
	transition?: {
		id: string;
		comment?: string;
	};
}> {
	const fields: Record<string, unknown> = {};

	// Title -> Summary
	if (task.title !== currentIssue.summary) {
		fields.summary = task.title;
	}

	// Description with AC
	// Always merge description with AC when task has AC
	const taskDescriptionWithAc = task.acceptanceCriteria
		? mergeDescriptionWithAc(task.description || "", task.acceptanceCriteria)
		: task.description || "";

	// Compare with current Jira description (also strip AC for fair comparison)
	const currentJiraDescClean = stripAcceptanceCriteriaFromDescription(
		currentIssue.description || "",
	);
	const taskDescClean = stripAcceptanceCriteriaFromDescription(
		task.description || "",
	);

	// Update description if either the base description changed OR the AC changed
	if (
		taskDescClean !== currentJiraDescClean ||
		JSON.stringify(task.acceptanceCriteria) !==
			JSON.stringify(normalizeBacklogTask(task).acceptanceCriteria)
	) {
		fields.description = taskDescriptionWithAc;
		logger.debug({ taskId: task.id }, "Updating Jira description with AC");
	}

	// Assignee
	if (task.assignee && task.assignee !== currentIssue.assignee) {
		fields.assignee = task.assignee;
	}

	// Priority
	if (task.priority && task.priority !== currentIssue.priority) {
		fields.priority = task.priority;
	}

	// Labels
	if (
		task.labels &&
		JSON.stringify(task.labels) !== JSON.stringify(currentIssue.labels)
	) {
		fields.labels = task.labels;
	}

	// Status transition (query available transitions and map)
	let transition: { id: string; comment?: string } | undefined;

	// Handle status changes by querying available transitions
	if (task.status && task.status !== currentIssue.status) {
		const transitionResult = await findTransitionForStatus(
			jiraClient,
			currentIssue.key,
			task.status,
			projectKey,
		);

		if (transitionResult.success && transitionResult.transitionId) {
			transition = {
				id: transitionResult.transitionId,
				comment: `Status updated from Backlog: ${currentIssue.status} → ${task.status}`,
			};
			logger.info(
				{
					taskId: task.id,
					from: currentIssue.status,
					to: task.status,
					transitionId: transitionResult.transitionId,
					transitionName: transitionResult.transitionName,
				},
				"Status transition found",
			);
		} else {
			logger.warn(
				{
					taskId: task.id,
					from: currentIssue.status,
					to: task.status,
					error: transitionResult.error,
				},
				"Failed to find status transition",
			);
			// Don't throw - log the warning and continue with other field updates
		}
	}

	return { fields, transition };
}

/**
 * Load configuration from .backlog-jira/config.json
 */
function loadConfig(): {
	jira?: {
		baseUrl?: string;
		projectKey?: string;
		issueType?: string;
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
