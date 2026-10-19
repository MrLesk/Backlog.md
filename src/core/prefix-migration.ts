/**
 * Migration for draft file prefixes.
 * When a project config doesn't have a `prefixes` section, this migration:
 * 1. Renames any task-*.md files in the drafts folder to draft-*.md
 * 2. Updates the IDs inside those files to use draft- prefix
 * 3. Adds the prefixes section to config
 */

import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type { FileSystem } from "../file-system/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { generateNextId } from "../utils/prefix-config.ts";

/**
 * Check if the config needs draft prefix migration.
 * Migration is needed when the prefixes section is missing.
 */
export function needsDraftPrefixMigration(config: BacklogConfig | null): boolean {
	if (!config) return false;
	return config.prefixes === undefined;
}

/**
 * Migrate draft files from task-*.md to draft-*.md format.
 * This is a one-time migration that runs when prefixes section is missing.
 *
 * The prefixes section is added only when every file was converted. If a file could not be
 * converted it stays where it is, the config is left unchanged so the migration runs again, and
 * the error thrown names each such file with the reason.
 *
 * @param fs - FileSystem instance to use for file operations
 */
export async function migrateDraftPrefixes(fs: FileSystem): Promise<void> {
	const draftsDir = await fs.getDraftsDir();

	// Find all task-*.md files in drafts folder
	let taskFiles: string[];
	try {
		taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: draftsDir, followSymlinks: true }));
	} catch {
		// Drafts directory doesn't exist or other error - nothing to migrate
		taskFiles = [];
	}

	if (taskFiles.length === 0) {
		// No files to migrate, just update config
		await addPrefixesToConfig(fs);
		return;
	}

	// Get existing draft IDs to generate unique new IDs
	const existingDraftIds = await fs.listOccupiedDraftIds();

	// Migrate each task-*.md file
	const failures: string[] = [];
	for (const file of taskFiles) {
		const filePath = join(draftsDir, file);

		try {
			// Read and parse the file
			const content = await Bun.file(filePath).text();
			const task = parseTask(content);

			// Generate new draft ID
			const newDraftId = generateNextId(existingDraftIds, "draft");
			existingDraftIds.push(newDraftId); // Track for next iteration

			// Update task with new ID
			const migratedTask: Task = {
				...task,
				id: newDraftId,
			};

			// Save with new draft- filename
			const savedPath = await fs.saveDraft(migratedTask, content);

			// Delete old task- file. If that fails, remove the new draft: the next run converts this
			// file again and must not find an earlier copy of it.
			try {
				await unlink(filePath);
			} catch (error) {
				await unlink(savedPath);
				throw error;
			}
		} catch (error) {
			failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// The migration is complete only when every file was converted. Until then the config is left
	// as it was, so the next run tries the remaining files again instead of leaving them behind.
	if (failures.length > 0) {
		throw new Error(
			[
				"The draft prefix migration could not convert every file in the drafts folder. Left as they were:",
				...failures.map((failure) => `  - ${failure}`),
				"The migration runs again the next time Backlog starts.",
			].join("\n"),
		);
	}

	// Update config with prefixes section
	await addPrefixesToConfig(fs);
}

/**
 * Add the prefixes section to config.yml
 */
async function addPrefixesToConfig(fs: FileSystem): Promise<void> {
	const config = await fs.loadConfig();
	if (!config) return;

	// Add default prefixes section (draft prefix is not configurable)
	const updatedConfig: BacklogConfig = {
		...config,
		prefixes: {
			task: "task",
		},
	};

	await fs.saveConfig(updatedConfig);
}
