/**
 * Migration for task ID casing.
 * Normalizes lowercase task IDs to uppercase to match the expected format.
 *
 * This handles legacy files created manually, imported, or by older versions
 * that may have lowercase IDs (e.g., `id: task-3` instead of `id: TASK-3`).
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { FileSystem } from "../file-system/operations.ts";

// Pattern to match lowercase task IDs (e.g., "id: task-3" or "id: back-123")
const LOWERCASE_ID_PATTERN = /^id:\s*([a-z]+-\d+(?:\.\d+)*)\s*$/m;

/**
 * Check if any task files need ID casing migration.
 * Returns true if any task has a lowercase ID.
 */
export async function needsIdCaseMigration(fs: FileSystem): Promise<boolean> {
	const dirsToCheck = [fs.tasksDir, fs.completedDir];

	for (const dir of dirsToCheck) {
		try {
			const files = await readdir(dir);
			for (const file of files) {
				if (!file.endsWith(".md")) continue;
				const content = await Bun.file(join(dir, file)).text();
				if (LOWERCASE_ID_PATTERN.test(content)) {
					return true;
				}
			}
		} catch {
			// Directory doesn't exist or other error - continue
		}
	}

	return false;
}

/**
 * Migrate task files with lowercase IDs to uppercase.
 * Scans tasks/ and completed/ directories.
 *
 * @param fs - FileSystem instance to use for directory paths
 * @returns Number of files migrated
 */
export async function migrateIdCasing(fs: FileSystem): Promise<number> {
	const dirsToCheck = [fs.tasksDir, fs.completedDir];
	let migratedCount = 0;

	for (const dir of dirsToCheck) {
		try {
			const files = await readdir(dir);

			for (const file of files) {
				if (!file.endsWith(".md")) continue;

				const filePath = join(dir, file);
				const content = await Bun.file(filePath).text();
				const match = content.match(LOWERCASE_ID_PATTERN);

				if (match?.[1]) {
					const oldId = match[1];
					const newId = oldId.toUpperCase();

					const newContent = content.replace(
						LOWERCASE_ID_PATTERN,
						`id: ${newId}`,
					);

					await Bun.write(filePath, newContent);
					migratedCount++;
				}
			}
		} catch {
			// Directory doesn't exist or other error - continue
		}
	}

	return migratedCount;
}
