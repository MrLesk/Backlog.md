/**
 * Test utilities for creating isolated test environments
 * Designed to handle Windows-specific file system quirks and prevent parallel test interference
 */

import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { Core } from "../core/backlog.ts";
import { initializeProject as initializeProjectShared } from "../core/init.ts";

/**
 * Creates a unique test directory name to avoid conflicts in parallel execution
 * All test directories are created under tmp/ to keep the root directory clean
 */
export function createUniqueTestDir(prefix: string): string {
	const uuid = randomUUID().slice(0, 8); // Short UUID for readability
	const timestamp = Date.now().toString(36); // Base36 timestamp
	const pid = process.pid.toString(36); // Process ID for additional uniqueness
	return join(process.cwd(), "tmp", `${prefix}-${timestamp}-${pid}-${uuid}`);
}

/**
 * Sleep utility for tests that need to wait
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry utility for operations that might fail intermittently
 * Particularly useful for Windows file operations
 */
export async function retry<T>(fn: () => Promise<T>, maxAttempts = 3, delay = 100): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;
			if (attempt < maxAttempts) {
				await sleep(delay * attempt); // Exponential backoff
			}
		}
	}

	throw lastError || new Error("Retry failed");
}

/**
 * Windows-safe directory cleanup with retry logic
 * Windows can have file locking issues that prevent immediate deletion
 */
export async function safeCleanup(dir: string): Promise<void> {
	await retry(
		async () => {
			await rm(dir, { recursive: true, force: true });
		},
		5,
		50,
	); // More attempts for cleanup
}

/**
 * Detects if we're running on Windows (useful for conditional test behavior)
 */
export function isWindows(): boolean {
	return process.platform === "win32";
}

/**
 * Gets appropriate timeout for the current platform
 * Windows operations tend to be slower due to file system overhead
 */
export function getPlatformTimeout(baseTimeout = 5000): number {
	return isWindows() ? baseTimeout * 2 : baseTimeout;
}

/**
 * Gets the exit code from a spawnSync result, handling Windows quirks
 * On Windows, result.status can be undefined even for successful processes
 */
export function getExitCode(result: { status: number | null; error?: Error }): number {
	return result.status ?? (result.error ? 1 : 0);
}

/**
 * Shared test helper for project initialization.
 * Uses the same init path as CLI/web and optionally mirrors the legacy auto-commit behavior
 * needed by tests that assert against the post-init commit state.
 */
export async function initializeTestProject(
	core: Core,
	projectName: string,
	autoCommit = false,
	backlogDirectory?: string,
): Promise<void> {
	const backlogDirectorySource = backlogDirectory
		? backlogDirectory === "backlog" || backlogDirectory === ".backlog"
			? (backlogDirectory as "backlog" | ".backlog")
			: "custom"
		: undefined;
	const configLocation = backlogDirectorySource === "custom" ? "root" : "folder";

	await initializeProjectShared(core, {
		projectName,
		backlogDirectory,
		backlogDirectorySource,
		configLocation,
		integrationMode: "none",
		advancedConfig: {
			autoCommit: false,
		},
	});

	if (autoCommit) {
		const repoRoot = await core.gitOps.stageBacklogDirectory(core.filesystem.backlogDirName);
		await core.gitOps.commitChanges(`backlog: Initialize backlog project: ${projectName}`, repoRoot);
	}
}
