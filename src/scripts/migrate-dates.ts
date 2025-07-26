#!/usr/bin/env bun

/**
 * Migration script to optionally add time components to existing dates
 * 
 * This script:
 * 1. Creates a backup of all markdown files
 * 2. Optionally adds time components to date fields
 * 3. Preserves exact dates for historical items
 * 4. Can be reversed by restoring from backup
 */

import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { parseMarkdown } from "../markdown/parser.ts";
import { confirm, select } from "@inquirer/prompts";
import matter from "gray-matter";

interface MigrationOptions {
	addTimeToRecent: boolean;
	recentDays: number;
	backupDir: string;
}

async function createBackup(core: Core, backupDir: string): Promise<void> {
	console.log("Creating backup...");
	
	// Create backup directory
	await Bun.write(join(backupDir, ".gitkeep"), "");
	
	// Backup all markdown files
	const tasks = await core.filesystem.listTasks();
	const drafts = await core.filesystem.listDrafts();
	const decisions = await core.filesystem.listDecisions();
	const docs = await core.filesystem.listDocuments();
	
	let backupCount = 0;
	
	// Backup tasks
	for (const task of tasks) {
		const sourcePath = join(core.projectRoot, "backlog", "tasks", `${task.id} - ${task.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`);
		const backupPath = join(backupDir, "tasks", `${task.id}.md`);
		const content = await Bun.file(sourcePath).text();
		await Bun.write(backupPath, content);
		backupCount++;
	}
	
	// Backup drafts
	for (const draft of drafts) {
		const sourcePath = join(core.projectRoot, "backlog", "drafts", `${draft.id} - ${draft.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`);
		const backupPath = join(backupDir, "drafts", `${draft.id}.md`);
		const content = await Bun.file(sourcePath).text();
		await Bun.write(backupPath, content);
		backupCount++;
	}
	
	// Backup decisions
	for (const decision of decisions) {
		const sourcePath = join(core.projectRoot, "backlog", "decisions", `${decision.id} - ${decision.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`);
		const backupPath = join(backupDir, "decisions", `${decision.id}.md`);
		const content = await Bun.file(sourcePath).text();
		await Bun.write(backupPath, content);
		backupCount++;
	}
	
	// Backup documents
	for (const doc of docs) {
		const sourcePath = join(core.projectRoot, "backlog", "documents", doc.path || "", `${doc.id} - ${doc.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`);
		const backupPath = join(backupDir, "documents", `${doc.id}.md`);
		const content = await Bun.file(sourcePath).text();
		await Bun.write(backupPath, content);
		backupCount++;
	}
	
	console.log(`✓ Backed up ${backupCount} files to ${backupDir}`);
}

function shouldAddTime(dateStr: string, options: MigrationOptions): boolean {
	if (!options.addTimeToRecent) return false;
	
	// Parse the date
	const date = new Date(dateStr + "T00:00:00Z");
	const now = new Date();
	const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
	
	return daysDiff <= options.recentDays;
}

function addTimeToDate(dateStr: string): string {
	// If already has time, return as-is
	if (dateStr.includes(" ") || dateStr.includes("T")) {
		return dateStr;
	}
	
	// Add a reasonable default time (09:00 for morning)
	return `${dateStr} 09:00`;
}

async function migrateFile(filePath: string, options: MigrationOptions): Promise<boolean> {
	try {
		const content = await Bun.file(filePath).text();
		const { data: frontmatter, content: body } = matter(content);
		
		let modified = false;
		
		// Check and update date fields
		const dateFields = ["created_date", "updated_date", "date"];
		
		for (const field of dateFields) {
			if (frontmatter[field] && typeof frontmatter[field] === "string") {
				const dateStr = frontmatter[field];
				
				// Skip if already has time
				if (dateStr.includes(" ") || dateStr.includes("T")) {
					continue;
				}
				
				if (shouldAddTime(dateStr, options)) {
					frontmatter[field] = addTimeToDate(dateStr);
					modified = true;
				}
			}
		}
		
		if (modified) {
			// Reconstruct the file
			const newContent = matter.stringify(body, frontmatter);
			await Bun.write(filePath, newContent);
			return true;
		}
		
		return false;
	} catch (error) {
		console.error(`Error migrating ${filePath}:`, error);
		return false;
	}
}

async function main() {
	console.log("Backlog.md Date Migration Script");
	console.log("================================\n");
	
	const cwd = process.cwd();
	const core = new Core(cwd);
	
	// Check if we're in a backlog project
	try {
		await core.filesystem.loadConfig();
	} catch {
		console.error("Error: Not in a Backlog.md project directory");
		process.exit(1);
	}
	
	// Get migration options
	const migrationMode = await select({
		message: "Select migration mode:",
		choices: [
			{
				name: "Add time to recent items only (recommended)",
				value: "recent",
				description: "Adds time component to items created/updated in the last N days",
			},
			{
				name: "Keep all dates as-is (no migration)",
				value: "none",
				description: "Preserves existing date-only format, new items will have time",
			},
		],
	});
	
	let options: MigrationOptions = {
		addTimeToRecent: false,
		recentDays: 30,
		backupDir: join(cwd, ".backlog-date-backup", new Date().toISOString().slice(0, 10)),
	};
	
	if (migrationMode === "recent") {
		options.addTimeToRecent = true;
		
		const days = await select({
			message: "Add time to items from the last how many days?",
			choices: [
				{ name: "7 days", value: 7 },
				{ name: "30 days", value: 30 },
				{ name: "90 days", value: 90 },
				{ name: "365 days", value: 365 },
			],
		});
		
		options.recentDays = days;
	}
	
	// Confirm before proceeding
	const proceed = await confirm({
		message: `This will:\n` +
			`  1. Create a backup in ${options.backupDir}\n` +
			`  2. ${options.addTimeToRecent ? `Add time to dates from the last ${options.recentDays} days` : "Keep all existing dates as-is"}\n` +
			`  3. New items will automatically include time\n\n` +
			`Continue?`,
		default: false,
	});
	
	if (!proceed) {
		console.log("Migration cancelled");
		return;
	}
	
	// Create backup
	await createBackup(core, options.backupDir);
	
	if (options.addTimeToRecent) {
		console.log("\nMigrating files...");
		
		let migratedCount = 0;
		const allFiles: string[] = [];
		
		// Collect all file paths
		const tasks = await core.filesystem.listTasks();
		for (const task of tasks) {
			allFiles.push(join(core.projectRoot, "backlog", "tasks", `${task.id} - ${task.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`));
		}
		
		const drafts = await core.filesystem.listDrafts();
		for (const draft of drafts) {
			allFiles.push(join(core.projectRoot, "backlog", "drafts", `${draft.id} - ${draft.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`));
		}
		
		const decisions = await core.filesystem.listDecisions();
		for (const decision of decisions) {
			allFiles.push(join(core.projectRoot, "backlog", "decisions", `${decision.id} - ${decision.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`));
		}
		
		const docs = await core.filesystem.listDocuments();
		for (const doc of docs) {
			allFiles.push(join(core.projectRoot, "backlog", "documents", doc.path || "", `${doc.id} - ${doc.title.replace(/[/\\?%*:|"<>]/g, "-")}.md`));
		}
		
		// Migrate each file
		for (const filePath of allFiles) {
			if (await migrateFile(filePath, options)) {
				migratedCount++;
			}
		}
		
		console.log(`✓ Migrated ${migratedCount} files`);
	}
	
	console.log("\n✅ Migration complete!");
	console.log("\nNext steps:");
	console.log("1. Test your application with the new date format");
	console.log("2. If issues arise, restore from backup:", options.backupDir);
	console.log("3. Commit the changes when satisfied");
}

main().catch(console.error);