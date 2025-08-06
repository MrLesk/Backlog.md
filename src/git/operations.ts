import { $ } from "bun";
import type { BacklogConfig } from "../types/index.ts";

export class GitOperations {
	private projectRoot: string;
	private config: BacklogConfig | null = null;

	constructor(projectRoot: string, config: BacklogConfig | null = null) {
		this.projectRoot = projectRoot;
		this.config = config;
	}

	setConfig(config: BacklogConfig | null): void {
		this.config = config;
	}

	async addFile(filePath: string): Promise<void> {
		// Convert absolute paths to relative paths from project root to avoid Windows encoding issues
		const { relative } = await import("node:path");
		const relativePath = relative(this.projectRoot, filePath).replace(/\\/g, "/");
		await this.execGit(["add", relativePath]);
	}

	async addFiles(filePaths: string[]): Promise<void> {
		// Convert absolute paths to relative paths from project root to avoid Windows encoding issues
		const { relative } = await import("node:path");
		const relativePaths = filePaths.map((filePath) => relative(this.projectRoot, filePath).replace(/\\/g, "/"));
		await this.execGit(["add", ...relativePaths]);
	}

	async commitTaskChange(taskId: string, message: string): Promise<void> {
		const commitMessage = `${taskId} - ${message}`;
		const args = ["commit", "-m", commitMessage];
		if (this.config?.bypassGitHooks) {
			args.push("--no-verify");
		}
		await this.execGit(args);
	}

	async commitChanges(message: string): Promise<void> {
		const args = ["commit", "-m", message];
		if (this.config?.bypassGitHooks) {
			args.push("--no-verify");
		}
		await this.execGit(args);
	}

	async resetIndex(): Promise<void> {
		// Reset the staging area without affecting working directory
		await this.execGit(["reset", "HEAD"]);
	}

	async commitStagedChanges(message: string): Promise<void> {
		// Check if there are any staged changes before committing
		const { stdout: status } = await this.execGit(["status", "--porcelain"]);
		const hasStagedChanges = status.split("\n").some((line) => line.match(/^[AMDRC]/));

		if (!hasStagedChanges) {
			throw new Error("No staged changes to commit");
		}

		const args = ["commit", "-m", message];
		if (this.config?.bypassGitHooks) {
			args.push("--no-verify");
		}
		await this.execGit(args);
	}

	async retryGitOperation<T>(operation: () => Promise<T>, operationName: string, maxRetries = 3): Promise<T> {
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (process.env.DEBUG) {
					console.warn(
						`Git operation '${operationName}' failed on attempt ${attempt}/${maxRetries}:`,
						lastError.message,
					);
				}

				// Don't retry on the last attempt
				if (attempt === maxRetries) {
					break;
				}

				// Wait briefly before retrying (exponential backoff)
				await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 100));
			}
		}

		throw new Error(`Git operation '${operationName}' failed after ${maxRetries} attempts: ${lastError?.message}`);
	}

	async getStatus(): Promise<string> {
		const { stdout } = await this.execGit(["status", "--porcelain"]);
		return stdout;
	}

	async isClean(): Promise<boolean> {
		const status = await this.getStatus();
		return status.trim() === "";
	}

	async getCurrentBranch(): Promise<string> {
		const { stdout } = await this.execGit(["branch", "--show-current"]);
		return stdout.trim();
	}

	async createBranch(branchName: string): Promise<void> {
		await this.execGit(["checkout", "-b", branchName]);
	}

	async switchBranch(branchName: string): Promise<void> {
		await this.execGit(["checkout", branchName]);
	}

	async hasUncommittedChanges(): Promise<boolean> {
		const status = await this.getStatus();
		return status.trim() !== "";
	}

	async getLastCommitMessage(): Promise<string> {
		const { stdout } = await this.execGit(["log", "-1", "--pretty=format:%s"]);
		return stdout.trim();
	}

	async fetch(remote = "origin"): Promise<void> {
		// Check if remote operations are disabled
		if (this.config?.remoteOperations === false) {
			if (process.env.DEBUG) {
				console.warn("Remote operations are disabled in config. Skipping fetch.");
			}
			return;
		}

		try {
			await this.execGit(["fetch", remote]);
		} catch (error) {
			// Check if this is a network-related error
			if (this.isNetworkError(error)) {
				// Don't show console warnings - let the calling code handle user messaging
				if (process.env.DEBUG) {
					console.warn(`Network error details: ${error}`);
				}
				return;
			}
			// Re-throw non-network errors
			throw error;
		}
	}

	private isNetworkError(error: unknown): boolean {
		if (typeof error === "string") {
			return this.containsNetworkErrorPattern(error);
		}
		if (error instanceof Error) {
			return this.containsNetworkErrorPattern(error.message);
		}
		return false;
	}

	private containsNetworkErrorPattern(message: string): boolean {
		const networkErrorPatterns = [
			"could not resolve host",
			"connection refused",
			"network is unreachable",
			"timeout",
			"no route to host",
			"connection timed out",
			"temporary failure in name resolution",
			"operation timed out",
		];

		const lowerMessage = message.toLowerCase();
		return networkErrorPatterns.some((pattern) => lowerMessage.includes(pattern));
	}

	async listFilesInRemoteBranch(branch: string, path: string): Promise<string[]> {
		const { stdout } = await this.execGit(["ls-tree", "-r", `origin/${branch}`, "--name-only", "--", path]);
		return stdout
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean);
	}

	async addAndCommitTaskFile(taskId: string, filePath: string, action: "create" | "update" | "archive"): Promise<void> {
		const actionMessages = {
			create: `Create task ${taskId}`,
			update: `Update task ${taskId}`,
			archive: `Archive task ${taskId}`,
		};

		// Retry git operations to handle transient failures
		await this.retryGitOperation(async () => {
			// Reset index to ensure only the specific file is staged
			await this.resetIndex();

			// Stage only the specific task file
			await this.addFile(filePath);

			// Commit only the staged file
			await this.commitStagedChanges(actionMessages[action]);
		}, `commit task file ${filePath}`);
	}

	async stageBacklogDirectory(backlogDir = "backlog"): Promise<void> {
		await this.execGit(["add", `${backlogDir}/`]);
	}

	async commitBacklogChanges(message: string): Promise<void> {
		await this.stageBacklogDirectory();

		// Check if there are staged changes specifically
		const { stdout: status } = await this.execGit(["status", "--porcelain"]);
		const hasStagedChanges = status.split("\n").some((line) => line.match(/^[AMDRC]/));

		if (hasStagedChanges) {
			try {
				await this.commitChanges(`backlog: ${message}`);
			} catch (error) {
				// Check if the error is due to missing git config
				if (error instanceof Error && error.message.includes("Please tell me who you are")) {
					throw new Error(
						"Git user configuration is missing. Please configure git with:\n" +
							'  git config --global user.name "Your Name"\n' +
							'  git config --global user.email "your.email@example.com"\n' +
							"Then try again.",
					);
				}
				throw error;
			}
		}
	}

	async stageFileMove(fromPath: string, toPath: string): Promise<void> {
		// Stage the deletion of the old file and addition of the new file
		// Git will automatically detect this as a rename if the content is similar enough
		try {
			// First try to stage the removal of the old file (if it still exists)
			await this.execGit(["add", "--all", fromPath]);
		} catch {
			// If the old file doesn't exist, that's okay - it was already moved
		}

		// Always stage the new file location
		await this.execGit(["add", toPath]);
	}

	async listRemoteBranches(remote = "origin"): Promise<string[]> {
		try {
			const { stdout } = await this.execGit(["branch", "-r", "--format=%(refname:short)"]);
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.filter((branch) => branch.startsWith(`${remote}/`))
				.map((branch) => branch.substring(`${remote}/`.length));
		} catch {
			// If remote doesn't exist or other error, return empty array
			return [];
		}
	}

	/**
	 * List remote branches that have been active within the specified days
	 * Much faster than listRemoteBranches for filtering old branches
	 */
	async listRecentRemoteBranches(daysAgo: number, remote = "origin"): Promise<string[]> {
		try {
			const { stdout } = await this.execGit([
				"for-each-ref",
				"--format=%(refname:short)|%(committerdate:iso8601)",
				`refs/remotes/${remote}`,
			]);
			const since = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.map((line) => {
					const [ref, iso] = line.split("|");
					return { ref, t: Date.parse(iso || "") };
				})
				.filter((x) => Number.isFinite(x.t) && x.t >= since && x.ref)
				.map((x) => x.ref!.replace(`${remote}/`, "")); // return short like "feature-foo"
		} catch {
			return [];
		}
	}

	async listRecentBranches(daysAgo: number): Promise<string[]> {
		try {
			// Get all branches with their last commit date
			// Using for-each-ref which is more efficient than multiple branch commands
			const since = new Date();
			since.setDate(since.getDate() - daysAgo);

			// Build refs to check based on remoteOperations config
			const refs = ["refs/heads"];
			if (this.config?.remoteOperations !== false) {
				refs.push("refs/remotes/origin");
			}

			// Get local and remote branches with commit dates
			const { stdout } = await this.execGit([
				"for-each-ref",
				"--format=%(refname:short)|%(committerdate:iso8601)",
				...refs,
			]);

			const recentBranches: string[] = [];
			const lines = stdout.split("\n").filter(Boolean);

			for (const line of lines) {
				const [branch, dateStr] = line.split("|");
				if (!branch || !dateStr) continue;

				const commitDate = new Date(dateStr);
				if (commitDate >= since) {
					// Keep the full branch name including origin/ prefix
					// This allows cross-branch checking to distinguish local vs remote
					if (!recentBranches.includes(branch)) {
						recentBranches.push(branch);
					}
				}
			}

			return recentBranches;
		} catch {
			// Fallback to all branches if the command fails
			return this.listAllBranches();
		}
	}

	async listLocalBranches(): Promise<string[]> {
		try {
			const { stdout } = await this.execGit(["branch", "--format=%(refname:short)"]);
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
		} catch {
			return [];
		}
	}

	async listAllBranches(_remote = "origin"): Promise<string[]> {
		try {
			// Use -a flag only if remote operations are enabled
			const branchArgs =
				this.config?.remoteOperations === false
					? ["branch", "--format=%(refname:short)"]
					: ["branch", "-a", "--format=%(refname:short)"];

			const { stdout } = await this.execGit(branchArgs);
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
		} catch {
			return [];
		}
	}

	async listFilesInTree(ref: string, path: string): Promise<string[]> {
		const { stdout } = await this.execGit(["ls-tree", "-r", "--name-only", ref, "--", path]);
		return stdout
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
	}

	/**
	 * Check which files exist from a list of paths in a single git command
	 * Returns a Set of paths that exist in the given ref
	 */
	async checkFilesExist(ref: string, paths: string[]): Promise<Set<string>> {
		if (paths.length === 0) return new Set();

		try {
			// Use ls-tree to check multiple paths at once
			const { stdout } = await this.execGit(["ls-tree", "-r", "--name-only", ref, "--", ...paths]);

			const existingFiles = new Set(
				stdout
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean),
			);

			return existingFiles;
		} catch {
			return new Set();
		}
	}

	async showFile(ref: string, filePath: string): Promise<string> {
		const { stdout } = await this.execGit(["show", `${ref}:${filePath}`]);
		return stdout;
	}

	async getFileLastModifiedTime(ref: string, filePath: string): Promise<Date | null> {
		try {
			// Get the last commit that modified this file in the given ref
			const { stdout } = await this.execGit([
				"log",
				"-1",
				"--format=%aI", // Author date in ISO 8601 format
				ref,
				"--",
				filePath,
			]);
			const timestamp = stdout.trim();
			if (timestamp) {
				return new Date(timestamp);
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Get last modified times for multiple files in a single git command for better performance
	 * Returns a Map of filePath -> Date
	 */
	async getBatchFileLastModifiedTimes(ref: string, filePaths: string[]): Promise<Map<string, Date>> {
		const result = new Map<string, Date>();

		if (filePaths.length === 0) return result;

		// For large batches, fall back to individual queries as git log can be slow
		if (filePaths.length > 10) {
			// Process in parallel for better performance
			const promises = filePaths.map(async (filePath) => {
				const date = await this.getFileLastModifiedTime(ref, filePath);
				return { filePath, date };
			});

			const results = await Promise.all(promises);
			for (const { filePath, date } of results) {
				if (date) {
					result.set(filePath, date);
				}
			}
			return result;
		}

		try {
			// Use git log with all files at once for small batches
			const { stdout } = await this.execGit([
				"log",
				"--format=%aI %s", // ISO date and subject
				"--name-only", // Show file names
				ref,
				"--",
				...filePaths,
			]);

			// Parse the output to extract dates for each file
			const lines = stdout.split("\n");
			let currentDate: Date | null = null;

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				// Check if line is a date (ISO 8601 format)
				if (trimmed.match(/^\d{4}-\d{2}-\d{2}T/)) {
					const dateStr = trimmed.split(" ")[0];
					currentDate = dateStr ? new Date(dateStr) : null;
				} else if (currentDate) {
					// This is a file path
					for (const filePath of filePaths) {
						if (trimmed.endsWith(filePath) || filePath.endsWith(trimmed)) {
							if (!result.has(filePath)) {
								result.set(filePath, currentDate);
							}
						}
					}
				}
			}
		} catch (error) {
			// Fallback to individual queries if batch fails
			for (const filePath of filePaths) {
				const date = await this.getFileLastModifiedTime(ref, filePath);
				if (date) {
					result.set(filePath, date);
				}
			}
		}

		return result;
	}

	/**
	 * Build a map of file -> last modified date for all files in a directory in one git log pass
	 * Much more efficient than individual getFileLastModifiedTime calls
	 * Returns a Map of filePath -> Date
	 */
	async getBranchLastModifiedMap(ref: string, dir: string): Promise<Map<string, Date>> {
		const out = new Map<string, Date>();

		try {
			// Null-delimited to be safe with filenames
			const { stdout } = await this.execGit([
				"log",
				"--format=%ct", // Unix timestamp for easier parsing
				"--name-only",
				"-z", // Null-delimited for safety
				ref,
				"--",
				dir,
			]);

			// Parse null-delimited output
			const parts = stdout.split("\0").filter(Boolean);
			let currentEpoch: number | null = null;

			for (const p of parts) {
				if (/^\d+$/.test(p)) {
					// This is a timestamp
					currentEpoch = Number(p);
				} else if (currentEpoch !== null) {
					// This is a file path - first time we see it is its last modification
					if (!out.has(p)) {
						out.set(p, new Date(currentEpoch * 1000));
					}
				}
			}
		} catch (error) {
			// If the command fails, return empty map
			console.error(`Failed to get branch last modified map for ${ref}:${dir}`, error);
		}

		return out;
	}

	async getFileLastModifiedBranch(filePath: string): Promise<string | null> {
		try {
			// Get the hash of the last commit that touched the file
			const { stdout: commitHash } = await this.execGit(["log", "-1", "--format=%H", "--", filePath]);
			if (!commitHash) return null;

			// Find all branches that contain this commit
			const { stdout: branches } = await this.execGit([
				"branch",
				"-a",
				"--contains",
				commitHash.trim(),
				"--format=%(refname:short)",
			]);

			if (!branches) return "main"; // Default to main if no specific branch found

			// Prefer non-remote branches and 'main' or 'master'
			const branchList = branches
				.split("\n")
				.map((b) => b.trim())
				.filter(Boolean);
			const mainBranch = branchList.find((b) => b === "main" || b === "master");
			if (mainBranch) return mainBranch;

			const nonRemote = branchList.find((b) => !b.startsWith("remotes/"));
			return nonRemote || branchList[0] || "main";
		} catch {
			return null;
		}
	}

	private async execGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
		// Use the new Bun shell API
		try {
			const { stdout, stderr } = await $`git ${args}`.cwd(this.projectRoot).quiet();
			return { stdout: stdout.toString(), stderr: stderr.toString() };
		} catch (error: any) {
			if (error.exitCode !== undefined) {
				throw new Error(`Git command failed (exit code ${error.exitCode}): git ${args.join(" ")}\n${error.stderr}`);
			}
			throw error;
		}
	}
}

export async function isGitRepository(projectRoot: string): Promise<boolean> {
	try {
		await $`git rev-parse --git-dir`.cwd(projectRoot).quiet();
		return true;
	} catch {
		return false;
	}
}

export async function initializeGitRepository(projectRoot: string): Promise<void> {
	try {
		await $`git init`.cwd(projectRoot).quiet();
	} catch (error) {
		throw new Error(`Failed to initialize git repository: ${error}`);
	}
}
