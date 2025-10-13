import type { Command } from "commander";
import { BacklogClient } from "../integrations/backlog.ts";
import { JiraClient } from "../integrations/jira.ts";
import { SyncStore } from "../state/store.ts";
import { logger } from "../utils/logger.ts";
import { comparePayloads, computeHash, normalizeBacklogTask, normalizeJiraIssue } from "../utils/normalizer.ts";
import type { NormalizedPayload } from "../utils/normalizer.ts";
import { type SyncState, classifySyncState } from "../utils/sync-state.ts";

interface TaskStatus {
	taskId: string;
	taskTitle: string;
	jiraKey: string;
	syncState: SyncState;
	backlogHash: string;
	jiraHash: string;
	changedFields?: string[];
}

/**
 * Get sync status for all mapped tasks
 */
async function getStatus(options: { json?: boolean; grep?: string }): Promise<void> {
	const store = new SyncStore();
	const backlog = new BacklogClient();
	const jira = new JiraClient();

	try {
		// Get all mappings
		const mappings = store.getAllMappings();

		if (mappings.size === 0) {
			console.log("No task mappings found. Run 'backlog-jira map' first.");
			return;
		}

		console.log(`📊 Checking sync status for ${mappings.size} mapped tasks...\n`);

		const statuses: TaskStatus[] = [];

		// Check each mapped task
		for (const [taskId, jiraKey] of mappings.entries()) {
			try {
				// Get current state
				const task = await backlog.getTask(taskId);
				const issue = await jira.getIssue(jiraKey);

				// Normalize and compute hashes
				const backlogPayload = normalizeBacklogTask(task);
				const jiraPayload = normalizeJiraIssue(issue);
				const currentBacklogHash = computeHash(backlogPayload);
				const currentJiraHash = computeHash(jiraPayload);

				// Get snapshots
				const snapshots = store.getSnapshots(taskId);

				// Classify sync state
				const stateResult = classifySyncState(currentBacklogHash, currentJiraHash, snapshots.backlog, snapshots.jira);

				// Calculate changed fields if there are changes
				let changedFields: string[] | undefined;
				if (stateResult.state !== "InSync" && snapshots.backlog && snapshots.jira) {
					const baseBacklogPayload = JSON.parse(snapshots.backlog.payload) as NormalizedPayload;
					const baseJiraPayload = JSON.parse(snapshots.jira.payload) as NormalizedPayload;

					// Determine which payload changed
					if (stateResult.state === "NeedsPush") {
						changedFields = comparePayloads(baseBacklogPayload, backlogPayload);
					} else if (stateResult.state === "NeedsPull") {
						changedFields = comparePayloads(baseJiraPayload, jiraPayload);
					} else if (stateResult.state === "Conflict") {
						// Show both sides' changes
						const backlogChanges = comparePayloads(baseBacklogPayload, backlogPayload);
						const jiraChanges = comparePayloads(baseJiraPayload, jiraPayload);
						changedFields = [...new Set([...backlogChanges, ...jiraChanges])];
					}
				}

				statuses.push({
					taskId,
					taskTitle: task.title,
					jiraKey,
					syncState: stateResult.state,
					backlogHash: stateResult.backlogHash,
					jiraHash: stateResult.jiraHash,
					changedFields,
				});
			} catch (error) {
				logger.error({ error, taskId, jiraKey }, "Failed to get status");
				statuses.push({
					taskId,
					taskTitle: "Error",
					jiraKey,
					syncState: "Unknown",
					backlogHash: "",
					jiraHash: "",
				});
			}
		}

		// Filter by grep if provided
		let filteredStatuses = statuses;
		if (options.grep) {
			const grepLower = options.grep.toLowerCase();
			filteredStatuses = statuses.filter(
				(s) => s.syncState.toLowerCase().includes(grepLower) || s.taskId.toLowerCase().includes(grepLower),
			);
		}

		// Output results
		if (options.json) {
			console.log(JSON.stringify(filteredStatuses, null, 2));
		} else {
			displayStatusTable(filteredStatuses);
		}

		// Summary
		if (!options.json) {
			const counts = {
				InSync: statuses.filter((s) => s.syncState === "InSync").length,
				NeedsPush: statuses.filter((s) => s.syncState === "NeedsPush").length,
				NeedsPull: statuses.filter((s) => s.syncState === "NeedsPull").length,
				Conflict: statuses.filter((s) => s.syncState === "Conflict").length,
				Unknown: statuses.filter((s) => s.syncState === "Unknown").length,
			};

			console.log("\n📈 Summary:");
			console.log(`   ✅ InSync: ${counts.InSync}`);
			console.log(`   ⬆️  NeedsPush: ${counts.NeedsPush}`);
			console.log(`   ⬇️  NeedsPull: ${counts.NeedsPull}`);
			console.log(`   ⚠️  Conflict: ${counts.Conflict}`);
			console.log(`   ❓ Unknown: ${counts.Unknown}`);

			if (counts.Conflict > 0) {
				console.log("\n💡 Tip: Use 'backlog-jira resolve' to handle conflicts");
			}
		}
	} finally {
		store.close();
		await jira.close();
	}
}

/**
 * Display status in a formatted table
 */
function displayStatusTable(statuses: TaskStatus[]): void {
	// Header
	console.log("╔═══════════════╦════════════╦═══════════════╦════════════════════════════════╗");
	console.log("║ Task ID       ║ Jira Key   ║ Sync State    ║ Changed Fields                 ║");
	console.log("╠═══════════════╬════════════╬═══════════════╬════════════════════════════════╣");

	// Rows
	for (const status of statuses) {
		const stateIcon = getStateIcon(status.syncState);
		const stateStr = `${stateIcon} ${status.syncState}`.padEnd(13);
		const fieldsStr = (status.changedFields?.join(", ") || "").slice(0, 30).padEnd(30);

		console.log(`║ ${status.taskId.padEnd(13)} ║ ${status.jiraKey.padEnd(10)} ║ ${stateStr} ║ ${fieldsStr} ║`);
	}

	// Footer
	console.log("╚═══════════════╩════════════╩═══════════════╩════════════════════════════════╝");
}

/**
 * Get an icon for sync state
 */
function getStateIcon(state: SyncState): string {
	switch (state) {
		case "InSync":
			return "✅";
		case "NeedsPush":
			return "⬆️ ";
		case "NeedsPull":
			return "⬇️ ";
		case "Conflict":
			return "⚠️ ";
		case "Unknown":
			return "❓";
		default:
			return "  ";
	}
}

/**
 * Register status command with CLI
 */
export function registerStatusCommand(program: Command): void {
	program
		.command("status")
		.description("Show sync status of mapped tasks")
		.option("--json", "Output in JSON format")
		.option("--grep <pattern>", "Filter results by sync state or task ID")
		.action(async (options) => {
			try {
				await getStatus(options);
				process.exit(0);
			} catch (error) {
				logger.error({ error }, "Status command failed");
				console.error(`Error: ${error}`);
				process.exit(1);
			}
		});
}
