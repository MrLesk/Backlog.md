import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { $ } from "bun";

/**
 * Check if a path exists and is a directory
 */
async function isDirectory(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isDirectory();
	} catch {
		return false;
	}
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isFile();
	} catch {
		return false;
	}
}

/**
 * Finds the Backlog.md project root by walking up the directory tree.
 *
 * Search order:
 * 1. Walk up from startDir looking for `backlog/` directory or `backlog.json` file
 * 2. If not found, fall back to git repository root (via `git rev-parse --show-toplevel`)
 * 3. Return null if no Backlog.md project found
 *
 * @param startDir - The directory to start searching from (typically process.cwd())
 * @returns The project root path, or null if no Backlog.md project found
 */
export async function findBacklogRoot(startDir: string): Promise<string | null> {
	let current = startDir;

	// Walk up the directory tree looking for backlog/ or backlog.json
	while (current !== dirname(current)) {
		// Check for backlog/ directory
		const backlogDir = join(current, "backlog");
		if (await isDirectory(backlogDir)) {
			return current;
		}

		// Check for backlog.json file
		const backlogJson = join(current, "backlog.json");
		if (await fileExists(backlogJson)) {
			return current;
		}

		current = dirname(current);
	}

	// Fallback: try git repository root
	try {
		const result = await $`git rev-parse --show-toplevel`.cwd(startDir).quiet();
		const gitRoot = result.stdout.toString().trim();

		if (gitRoot) {
			// Verify the git root has a backlog setup
			const backlogDir = join(gitRoot, "backlog");
			const backlogJson = join(gitRoot, "backlog.json");

			if ((await isDirectory(backlogDir)) || (await fileExists(backlogJson))) {
				return gitRoot;
			}
		}
	} catch {
		// Not in a git repository or git not available
	}

	return null;
}

// Cache for the project root within a single CLI execution
let cachedProjectRoot: string | null | undefined;

/**
 * Gets the Backlog.md project root, with caching for performance.
 * Call clearProjectRootCache() to reset the cache if needed.
 */
export async function getProjectRoot(startDir: string): Promise<string | null> {
	if (cachedProjectRoot !== undefined) {
		return cachedProjectRoot;
	}

	cachedProjectRoot = await findBacklogRoot(startDir);
	return cachedProjectRoot;
}

/**
 * Clears the cached project root. Useful for testing.
 */
export function clearProjectRootCache(): void {
	cachedProjectRoot = undefined;
}
