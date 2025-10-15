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
		const { stdout } = await this.execGit(["status", "--porcelain"], { readOnly: true });
		return stdout;
	}

	async isClean(): Promise<boolean> {
		const status = await this.getStatus();
		return status.trim() === "";
	}

	async getCurrentBranch(): Promise<string> {
		const { stdout } = await this.execGit(["branch", "--show-current"], { readOnly: true });
		return stdout.trim();
	}
	async hasUncommittedChanges(): Promise<boolean> {
		const status = await this.getStatus();
		return status.trim() !== "";
	}

	async getLastCommitMessage(): Promise<string> {
		const { stdout } = await this.execGit(["log", "-1", "--pretty=format:%s"], { readOnly: true });
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

		// Preflight: skip if repository has no remotes configured
		const hasRemotes = await this.hasAnyRemote();
		if (!hasRemotes) {
			// No remotes configured; silently skip fetch. A consolidated warning is shown during init if applicable.
			return;
		}

		try {
			// Use --prune to remove dead refs and reduce later scans
			await this.execGit(["fetch", remote, "--prune", "--quiet"]);
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
			// Fast-path: if no remotes, return empty
			if (!(await this.hasAnyRemote())) return [];
			const { stdout } = await this.execGit(["branch", "-r", "--format=%(refname:short)"], { readOnly: true });
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
			// Fast-path: if no remotes, return empty
			if (!(await this.hasAnyRemote())) return [];
			const { stdout } = await this.execGit(
				["for-each-ref", "--format=%(refname:short)|%(committerdate:iso8601)", `refs/remotes/${remote}`],
				{ readOnly: true },
			);
			const since = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
			return (
				stdout
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)
					.map((line) => {
						const [ref, iso] = line.split("|");
						return { ref, t: Date.parse(iso || "") };
					})
					.filter((x) => Number.isFinite(x.t) && x.t >= since && x.ref)
					.map((x) => x.ref?.replace(`${remote}/`, ""))
					// Filter out invalid/ambiguous entries that would normalize to empty or "origin"
					.filter((b): b is string => Boolean(b))
					.filter((b) => b !== "HEAD" && b !== remote && b !== `${remote}`)
			);
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
			const { stdout } = await this.execGit(
				["for-each-ref", "--format=%(refname:short)|%(committerdate:iso8601)", ...refs],
				{ readOnly: true },
			);

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
			const { stdout } = await this.execGit(["branch", "--format=%(refname:short)"], { readOnly: true });
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

			const { stdout } = await this.execGit(branchArgs, { readOnly: true });
			return stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.filter((b) => !b.includes("HEAD"));
		} catch {
			return [];
		}
	}

	/**
	 * Returns true if the current repository has any remotes configured
	 */
	async hasAnyRemote(): Promise<boolean> {
		try {
			const { stdout } = await this.execGit(["remote"], { readOnly: true });
			return (
				stdout
					.split("\n")
					.map((s) => s.trim())
					.filter(Boolean).length > 0
			);
		} catch {
			return false;
		}
	}

	/**
	 * Returns true if a specific remote exists (default: origin)
	 */
	async hasRemote(remote = "origin"): Promise<boolean> {
		try {
			const { stdout } = await this.execGit(["remote"], { readOnly: true });
			return stdout.split("\n").some((r) => r.trim() === remote);
		} catch {
			return false;
		}
	}

	async listFilesInTree(ref: string, path: string): Promise<string[]> {
		const { stdout } = await this.execGit(["ls-tree", "-r", "--name-only", "-z", ref, "--", path], { readOnly: true });
		return stdout.split("\0").filter(Boolean);
	}
	async showFile(ref: string, filePath: string): Promise<string> {
		const { stdout } = await this.execGit(["show", `${ref}:${filePath}`], { readOnly: true });
		return stdout;
	}
	/**
	 * Build a map of file -> last modified date for all files in a directory in one git log pass
	 * Much more efficient than individual getFileLastModifiedTime calls
	 * Returns a Map of filePath -> Date
	 */
	async getBranchLastModifiedMap(ref: string, dir: string, sinceDays?: number): Promise<Map<string, Date>> {
		const out = new Map<string, Date>();

		try {
			// Build args with optional --since filter
			const args = [
				"log",
				"--pretty=format:%ct%x00", // Unix timestamp + NUL for bulletproof parsing
				"--name-only",
				"-z", // Null-delimited for safety
			];

			if (sinceDays) {
				args.push(`--since=${sinceDays}.days`);
			}

			args.push(ref, "--", dir);

			// Null-delimited to be safe with filenames
			const { stdout } = await this.execGit(args, { readOnly: true });

			// Parse null-delimited output
			// Format is: timestamp\0 file1\0 file2\0 ... timestamp\0 file1\0 ...
			const parts = stdout.split("\0").filter(Boolean);
			let i = 0;

			while (i < parts.length) {
				const timestampStr = parts[i];
				if (timestampStr && /^\d+$/.test(timestampStr)) {
					// This is a timestamp, files follow until next timestamp
					const epoch = Number(timestampStr);
					const date = new Date(epoch * 1000);
					i++;

					// Process files until we hit another timestamp or end
					while (i < parts.length && parts[i] && !/^\d+$/.test(parts[i] || "")) {
						const file = parts[i];
						// First time we see a file is its last modification
						if (file && !out.has(file)) {
							out.set(file, date);
						}
						i++;
					}
				} else {
					// Skip unexpected content
					i++;
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
			const { stdout: commitHash } = await this.execGit(["log", "-1", "--format=%H", "--", filePath], {
				readOnly: true,
			});
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

	private async execGit(args: string[], options?: { readOnly?: boolean }): Promise<{ stdout: string; stderr: string }> {
		// Use Bun.spawn so we can explicitly control stdio behaviour on Windows. When running
		// under the MCP stdio transport, delegating to git with inherited stdin can deadlock.
		const env = options?.readOnly
			? ({ ...process.env, GIT_OPTIONAL_LOCKS: "0" } as Record<string, string>)
			: (process.env as Record<string, string>);

		const subprocess = Bun.spawn(["git", ...args], {
			cwd: this.projectRoot,
			stdin: "ignore", // avoid inheriting MCP stdio pipes which can block on Windows
			stdout: "pipe",
			stderr: "pipe",
			env,
		});

		const stdoutPromise = subprocess.stdout ? new Response(subprocess.stdout).text() : Promise.resolve("");
		const stderrPromise = subprocess.stderr ? new Response(subprocess.stderr).text() : Promise.resolve("");
		const [exitCode, stdout, stderr] = await Promise.all([subprocess.exited, stdoutPromise, stderrPromise]);

		if (exitCode !== 0) {
			throw new Error(`Git command failed (exit code ${exitCode}): git ${args.join(" ")}\n${stderr}`);
		}

		return { stdout, stderr };
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
