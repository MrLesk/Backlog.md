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
		await this.execGit(["commit", "-m", commitMessage]);
	}

	async commitChanges(message: string): Promise<void> {
		await this.execGit(["commit", "-m", message]);
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

		await this.execGit(["commit", "-m", message]);
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
			const { stdout } = await this.execGit(["branch", "-a", "--format=%(refname:short)"]);
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
		try {
			// Ensure all args are properly encoded strings to avoid Windows encoding issues
			const sanitizedArgs = args.map((arg) => String(arg).trim()).filter(Boolean);

			const proc = Bun.spawn(["git", ...sanitizedArgs], {
				cwd: this.projectRoot,
				stdout: "pipe",
				stderr: "pipe",
				env: {
					...process.env,
					// Force UTF-8 encoding on Windows to prevent corruption
					LC_ALL: "C.UTF-8",
					LANG: "C.UTF-8",
				},
			});

			const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);

			const exitCode = await proc.exited;

			if (exitCode !== 0) {
				throw new Error(`Git command failed (exit code ${exitCode}): git ${sanitizedArgs.join(" ")}\n${stderr}`);
			}

			return { stdout, stderr };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Git command failed: git ${args.join(" ")}\n${message}`);
		}
	}
}

export async function isGitRepository(projectRoot: string): Promise<boolean> {
	try {
		const proc = Bun.spawn(["git", "rev-parse", "--git-dir"], {
			cwd: projectRoot,
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				LC_ALL: "C.UTF-8",
				LANG: "C.UTF-8",
			},
		});
		const exitCode = await proc.exited;
		return exitCode === 0;
	} catch {
		return false;
	}
}

export async function initializeGitRepository(projectRoot: string): Promise<void> {
	const proc = Bun.spawn(["git", "init"], {
		cwd: projectRoot,
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			LC_ALL: "C.UTF-8",
			LANG: "C.UTF-8",
		},
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`Failed to initialize git repository: ${stderr}`);
	}
}
