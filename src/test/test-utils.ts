/**
 * Test utilities for creating isolated test environments
 * Designed to handle Windows-specific file system quirks and prevent parallel test interference
 */

import { randomUUID } from "node:crypto";
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

/**
 * Creates a unique test directory path to avoid conflicts in parallel execution.
 * All test directories are created under tmp/ to keep the root directory clean.
 * NOTE: This only generates the path, it doesn't create the directory.
 */
function createUniqueTestPath(prefix: string): string {
	const uuid = randomUUID().slice(0, 8); // Short UUID for readability
	const timestamp = Date.now().toString(36); // Base36 timestamp
	const pid = process.pid.toString(36); // Process ID for additional uniqueness
	return join(process.cwd(), "tmp", `${prefix}-${timestamp}-${pid}-${uuid}`);
}

// Singleton template directory for git repos - initialized once per test run
let gitTemplateDir: string | null = null;
let templateInitPromise: Promise<string> | null = null;

/**
 * Gets or creates a pre-initialized git template directory.
 * This is a MAJOR Windows optimization: instead of running `git init` + `git config`
 * for every test (~3 process spawns × ~80ms each on Windows = ~240ms/test),
 * we initialize once and copy the directory (~10ms on Windows).
 *
 * Performance impact: ~45 test files × 240ms savings = ~10+ seconds on Windows
 */
async function getGitTemplate(): Promise<string> {
	if (gitTemplateDir) return gitTemplateDir;

	// Use a promise to prevent race conditions during parallel test startup
	if (!templateInitPromise) {
		templateInitPromise = (async () => {
			const templatePath = join(process.cwd(), "tmp", ".git-template");
			await mkdir(templatePath, { recursive: true });

			// Check if already initialized (from a previous test run in same process)
			const gitDir = join(templatePath, ".git");
			try {
				const stat = await Bun.file(join(gitDir, "HEAD")).exists();
				if (stat) {
					gitTemplateDir = templatePath;
					return templatePath;
				}
			} catch {
				// Not initialized yet
			}

			// Initialize the template repo once
			await $`git init -b main`.cwd(templatePath).quiet();
			await $`git config user.name "Test User"`.cwd(templatePath).quiet();
			await $`git config user.email test@example.com`.cwd(templatePath).quiet();

			gitTemplateDir = templatePath;
			return templatePath;
		})();
	}

	return templateInitPromise;
}

/**
 * Creates a unique test directory with a pre-initialized git repository.
 * This is 20-30x faster than running git init in each test on Windows.
 *
 * @param prefix - Prefix for the directory name
 * @returns Path to the new test directory with git already initialized
 */
export async function createTestDir(prefix: string): Promise<string> {
	const testDir = createUniqueTestPath(prefix);

	// Get the template and copy it
	const template = await getGitTemplate();
	await cp(template, testDir, { recursive: true });

	return testDir;
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
