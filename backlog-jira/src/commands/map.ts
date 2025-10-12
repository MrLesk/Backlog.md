import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import type { Command } from "commander";
import { BacklogClient } from "../integrations/backlog.ts";
import { JiraClient } from "../integrations/jira.ts";
import { SyncStore } from "../state/store.ts";
import { getTaskFilePath, updateJiraMetadata } from "../utils/frontmatter.ts";
import { logger } from "../utils/logger.ts";
import { computeHash, normalizeBacklogTask, normalizeJiraIssue } from "../utils/normalizer.ts";

/**
 * Calculate similarity between two strings (simple fuzzy matching)
 * Returns a score between 0 and 1
 */
function calculateSimilarity(a: string, b: string): number {
	const aLower = a.toLowerCase().trim();
	const bLower = b.toLowerCase().trim();

	// Exact match
	if (aLower === bLower) return 1.0;

	// Contains match
	if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;

	// Word-based similarity
	const aWords = new Set(aLower.split(/\s+/));
	const bWords = new Set(bLower.split(/\s+/));
	const intersection = [...aWords].filter((w) => bWords.has(w)).length;
	const union = new Set([...aWords, ...bWords]).size;

	if (union === 0) return 0;
	return intersection / union;
}

/**
 * Auto-map command: discover tasks and issues with matching titles
 */
async function autoMap(options: { dryRun?: boolean; minScore?: number }): Promise<void> {
	const store = new SyncStore();
	const backlog = new BacklogClient();
	const jira = new JiraClient();

	const minScore = options.minScore || 0.7;
	logger.info({ minScore }, "Starting auto-mapping");

	try {
		// Get all Backlog tasks
		console.log("🔍 Fetching Backlog tasks...");
		const tasks = await backlog.listTasks();
		console.log(`Found ${tasks.length} Backlog tasks`);

		// Get existing mappings to avoid duplicates
		const existingMappings = store.getAllMappings();

		// For each unmapped task, search for matching Jira issues
		let mappedCount = 0;
		let skippedCount = 0;

		for (const task of tasks) {
			// Skip if already mapped
			if (existingMappings.has(task.id)) {
				skippedCount++;
				continue;
			}

			console.log(`\n🔎 Searching for: ${task.id} - ${task.title}`);

			// Search Jira with title as query
			const jql = `text ~ "${task.title.replace(/"/g, '\\"')}" ORDER BY created DESC`;

			try {
				const result = await jira.searchIssues(jql, { maxResults: 5 });

				if (result.issues.length === 0) {
					console.log("   No matches found");
					continue;
				}

				// Calculate similarity scores
				const candidates = result.issues
					.map((issue) => ({
						issue,
						score: calculateSimilarity(task.title, issue.summary),
					}))
					.filter((c) => c.score >= minScore)
					.sort((a, b) => b.score - a.score);

				if (candidates.length === 0) {
					console.log(`   No matches above threshold (${minScore})`);
					continue;
				}

				// Take best match
				const best = candidates[0];
				console.log(`   ✓ Match found: ${best.issue.key} (score: ${best.score.toFixed(2)})`);
				console.log(`     "${best.issue.summary}"`);

				if (!options.dryRun) {
					// Create mapping
					store.addMapping(task.id, best.issue.key);

					// Get full task and issue data for snapshots
					const fullTask = await backlog.getTask(task.id);
					const fullIssue = await jira.getIssue(best.issue.key);

					// Create initial snapshots
					const backlogPayload = normalizeBacklogTask(fullTask);
					const jiraPayload = normalizeJiraIssue(fullIssue);
					const backlogHash = computeHash(backlogPayload);
					const jiraHash = computeHash(jiraPayload);

					store.setSnapshot(task.id, "backlog", backlogHash, backlogPayload);
					store.setSnapshot(task.id, "jira", jiraHash, jiraPayload);

					// Update task file frontmatter
					const filePath = getTaskFilePath(task.id);
					updateJiraMetadata(filePath, {
						jiraKey: best.issue.key,
						jiraLastSync: new Date().toISOString(),
						jiraSyncState: "InSync",
					});

					// Log operation
					store.logOperation("auto_map", task.id, best.issue.key, "success");
					mappedCount++;
				}
			} catch (error) {
				logger.error({ error, taskId: task.id }, "Failed to search for matches");
				console.log(`   ⚠️  Error searching: ${error}`);
			}
		}

		console.log("\n✅ Auto-mapping complete:");
		console.log(`   Mapped: ${mappedCount}`);
		console.log(`   Skipped (already mapped): ${skippedCount}`);
		console.log(`   No matches: ${tasks.length - mappedCount - skippedCount}`);

		if (options.dryRun) {
			console.log("\n(Dry run - no changes made)");
		}
	} finally {
		store.close();
	}
}

/**
 * Interactive map command: manually select Jira issues for tasks
 */
async function interactiveMap(): Promise<void> {
	const store = new SyncStore();
	const backlog = new BacklogClient();
	const jira = new JiraClient();
	const rl = readline.createInterface({ input, output });

	try {
		// Get unmapped tasks
		const tasks = await backlog.listTasks();
		const existingMappings = store.getAllMappings();
		const unmappedTasks = tasks.filter((t) => !existingMappings.has(t.id));

		if (unmappedTasks.length === 0) {
			console.log("✓ All tasks are already mapped");
			return;
		}

		console.log(`Found ${unmappedTasks.length} unmapped tasks\n`);

		for (const task of unmappedTasks) {
			console.log(`\n${"=".repeat(60)}`);
			console.log(`Task: ${task.id} - ${task.title}`);
			console.log(`Status: ${task.status}`);
			console.log(`${"=".repeat(60)}\n`);

			// Search for candidates
			const jql = `text ~ "${task.title.replace(/"/g, '\\"')}" ORDER BY created DESC`;
			const result = await jira.searchIssues(jql, { maxResults: 10 });

			if (result.issues.length === 0) {
				console.log("No Jira issues found for this task");
				const skip = await rl.question("Skip this task? [Y/n]: ");
				if (!skip || skip.toLowerCase() !== "n") {
					continue;
				}
			}

			// Show candidates
			console.log("Candidate Jira issues:\n");
			result.issues.forEach((issue, idx) => {
				const score = calculateSimilarity(task.title, issue.summary);
				console.log(`[${idx + 1}] ${issue.key} (score: ${score.toFixed(2)})`);
				console.log(`    ${issue.summary}`);
				console.log(`    Status: ${issue.status}`);
				console.log();
			});

			console.log("[0] Skip");
			console.log("[s] Search with custom JQL");

			const choice = await rl.question("\nSelect option: ");

			if (choice === "0" || !choice) {
				continue;
			}

			if (choice.toLowerCase() === "s") {
				const customJql = await rl.question("Enter JQL query: ");
				const customResult = await jira.searchIssues(customJql, { maxResults: 10 });

				if (customResult.issues.length === 0) {
					console.log("No issues found");
					continue;
				}

				// Show custom results
				customResult.issues.forEach((issue, idx) => {
					console.log(`[${idx + 1}] ${issue.key} - ${issue.summary}`);
				});

				const customChoice = await rl.question("\nSelect issue number (0 to skip): ");
				const customIdx = Number.parseInt(customChoice, 10);

				if (customIdx > 0 && customIdx <= customResult.issues.length) {
					const selectedIssue = customResult.issues[customIdx - 1];
					await createMapping(store, backlog, jira, task.id, selectedIssue.key);
					console.log(`✓ Mapped ${task.id} → ${selectedIssue.key}`);
				}

				continue;
			}

			const idx = Number.parseInt(choice, 10);
			if (idx > 0 && idx <= result.issues.length) {
				const selectedIssue = result.issues[idx - 1];
				await createMapping(store, backlog, jira, task.id, selectedIssue.key);
				console.log(`✓ Mapped ${task.id} → ${selectedIssue.key}`);
			}
		}

		console.log("\n✅ Interactive mapping complete");
	} finally {
		rl.close();
		store.close();
	}
}

/**
 * Helper to create a mapping with snapshots and frontmatter
 */
async function createMapping(
	store: SyncStore,
	backlog: BacklogClient,
	jira: JiraClient,
	taskId: string,
	jiraKey: string,
): Promise<void> {
	// Create mapping
	store.addMapping(taskId, jiraKey);

	// Get full data
	const task = await backlog.getTask(taskId);
	const issue = await jira.getIssue(jiraKey);

	// Create snapshots
	const backlogPayload = normalizeBacklogTask(task);
	const jiraPayload = normalizeJiraIssue(issue);
	const backlogHash = computeHash(backlogPayload);
	const jiraHash = computeHash(jiraPayload);

	store.setSnapshot(taskId, "backlog", backlogHash, backlogPayload);
	store.setSnapshot(taskId, "jira", jiraHash, jiraPayload);

	// Update frontmatter
	const filePath = getTaskFilePath(taskId);
	updateJiraMetadata(filePath, {
		jiraKey,
		jiraLastSync: new Date().toISOString(),
		jiraSyncState: "InSync",
	});

	// Log
	store.logOperation("manual_map", taskId, jiraKey, "success");
}

/**
 * Register map command with CLI
 */
export function registerMapCommand(program: Command): void {
	const mapCmd = program.command("map").description("Map Backlog tasks to Jira issues");

	mapCmd
		.command("auto")
		.description("Automatically discover and map tasks to issues by title matching")
		.option("--dry-run", "Show what would be mapped without making changes")
		.option("--min-score <score>", "Minimum similarity score (0-1)", "0.7")
		.action(async (options) => {
			try {
				await autoMap(options);
			} catch (error) {
				logger.error({ error }, "Auto-map command failed");
				console.error(`Error: ${error}`);
				process.exit(1);
			}
		});

	mapCmd
		.command("interactive")
		.alias("i")
		.description("Interactively select Jira issues for Backlog tasks")
		.action(async () => {
			try {
				await interactiveMap();
			} catch (error) {
				logger.error({ error }, "Interactive map command failed");
				console.error(`Error: ${error}`);
				process.exit(1);
			}
		});
}
