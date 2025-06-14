export class GitOperations {
	private projectRoot: string;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
	}

	async addFile(filePath: string): Promise<void> {
		await this.execGit(["add", filePath]);
	}

	async addFiles(filePaths: string[]): Promise<void> {
		await this.execGit(["add", ...filePaths]);
	}

	async commitTaskChange(taskId: string, message: string): Promise<void> {
		const commitMessage = `${taskId} - ${message}`;
		await this.execGit(["commit", "-m", commitMessage]);
	}

	async commitChanges(message: string): Promise<void> {
		await this.execGit(["commit", "-m", message]);
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
		await this.execGit(["fetch", remote]);
	}

	async listFilesInRemoteBranch(branch: string, path: string): Promise<string[]> {
		const { stdout } = await this.execGit(["ls-tree", "-r", `origin/${branch}`, "--name-only", "--", path]);
		return stdout
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean);
	}

	async addAndCommitTaskFile(taskId: string, filePath: string, action: "create" | "update" | "archive"): Promise<void> {
		await this.addFile(filePath);

		const actionMessages = {
			create: `Create task ${taskId}`,
			update: `Update task ${taskId}`,
			archive: `Archive task ${taskId}`,
		};

		await this.commitTaskChange(taskId, actionMessages[action]);
	}

	async stageBacklogDirectory(): Promise<void> {
		await this.execGit(["add", ".backlog/"]);
	}

	async commitBacklogChanges(message: string): Promise<void> {
		await this.stageBacklogDirectory();

		// Check if there are staged changes specifically
		const { stdout: status } = await this.execGit(["status", "--porcelain"]);
		const hasStagedChanges = status
			.split("\n")
			.some((line) => line.startsWith("A ") || line.startsWith("M ") || line.startsWith("D "));

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

	async listRemoteBranches(remote = "origin"): Promise<string[]> {
		const { stdout } = await this.execGit(["branch", "-r", "--format=%(refname:strip=2)"]);
		return stdout
			.split("\n")
			.map((l) => l.trim())
			.filter((b) => b.startsWith(`${remote}/`))
			.map((b) => b.replace(`${remote}/`, ""))
			.filter(Boolean);
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

	private async execGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
		try {
			const proc = Bun.spawn(["git", ...args], {
				cwd: this.projectRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);

			const exitCode = await proc.exited;

			if (exitCode !== 0) {
				throw new Error(`Git command failed (exit code ${exitCode}): git ${args.join(" ")}\n${stderr}`);
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
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`Failed to initialize git repository: ${stderr}`);
	}
}
