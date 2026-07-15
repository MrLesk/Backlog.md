import { realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { $ } from "bun";
import type { BacklogConfig } from "../types/index.ts";

type GitPathContext = {
	repoRoot: string;
	relativePath: string;
};

type GitConfigLoader = () => Promise<BacklogConfig | null>;

export interface GitBranchTip {
	name: string;
	commit: string;
	current: boolean;
}

export interface GitTreeEntry {
	path: string;
	objectId: string;
}

export interface GitIndexEntry {
	mode: string;
	objectId: string;
	stage: number;
}

function indexEntriesEqual(left: readonly GitIndexEntry[], right: readonly GitIndexEntry[]): boolean {
	return (
		left.length === right.length &&
		left.every(
			(entry, index) =>
				entry.mode === right[index]?.mode &&
				entry.objectId === right[index]?.objectId &&
				entry.stage === right[index]?.stage,
		)
	);
}

export class GitOperations {
	private projectRoot: string;
	private config: BacklogConfig | null = null;
	private readonly configLoader?: GitConfigLoader;

	constructor(projectRoot: string, config: BacklogConfig | null = null, configLoader?: GitConfigLoader) {
		this.projectRoot = projectRoot;
		this.config = config;
		this.configLoader = configLoader;
	}

	setConfig(config: BacklogConfig | null): void {
		this.config = config;
	}

	private async loadConfigIfNeeded(): Promise<void> {
		if (this.config || !this.configLoader) {
			return;
		}
		try {
			this.config = await this.configLoader();
		} catch {
			this.config = null;
		}
	}

	async isRepository(cwd = this.projectRoot): Promise<boolean> {
		await this.loadConfigIfNeeded();
		if (this.config?.filesystemOnly) {
			return false;
		}
		return await isGitRepository(cwd);
	}

	async addFile(filePath: string): Promise<void> {
		const context = await this.getPathContext(filePath);
		if (context) {
			await this.execGit(["add", context.relativePath], { cwd: context.repoRoot });
			return;
		}
		if (!(await this.isRepository())) {
			return;
		}

		// Convert absolute paths to relative paths from project root to avoid Windows encoding issues
		const relativePath = relative(this.projectRoot, filePath).replace(/\\/g, "/");
		await this.execGit(["add", relativePath]);
	}

	async addFiles(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0 || !(await this.isRepository())) {
			return;
		}
		// Convert absolute paths to relative paths from project root to avoid Windows encoding issues
		const relativePaths = filePaths.map((filePath) => relative(this.projectRoot, filePath).replace(/\\/g, "/"));
		await this.execGit(["add", ...relativePaths]);
	}

	async commitTaskChange(taskId: string, message: string, filePath?: string): Promise<void> {
		const commitMessage = `${taskId} - ${message}`;
		if (filePath) {
			await this.commitFiles(commitMessage, [filePath]);
			return;
		}
		const args = ["commit", "-m", commitMessage];
		if (this.config?.bypassGitHooks) {
			args.push("--no-verify");
		}
		const repoRoot = filePath ? (await this.getPathContext(filePath))?.repoRoot : undefined;
		if (!(await this.isRepository(repoRoot ?? this.projectRoot))) {
			return;
		}
		await this.execGit(args, { cwd: repoRoot });
	}

	async commitChanges(message: string, repoRoot?: string | null): Promise<void> {
		if (!(await this.isRepository(repoRoot ?? this.projectRoot))) {
			return;
		}
		const args = ["commit", "-m", message];
		if (this.config?.bypassGitHooks) {
			args.push("--no-verify");
		}
		await this.execGit(args, { cwd: repoRoot ?? undefined });
	}

	async commitFiles(message: string, filePaths: string[], repoRoot?: string | null): Promise<void> {
		const uniqueFilePaths = Array.from(new Set(filePaths.map((path) => path.trim()).filter((path) => path.length > 0)));
		if (uniqueFilePaths.length === 0) {
			return;
		}

		const resolvedRepoRoot =
			repoRoot ?? (await this.getPathContext(uniqueFilePaths[0] ?? ""))?.repoRoot ?? this.projectRoot;
		if (!(await this.isRepository(resolvedRepoRoot))) {
			return;
		}
		const relativePaths: string[] = [];
		for (const filePath of uniqueFilePaths) {
			const relativePath = await this.getRelativePathForRepo(filePath, resolvedRepoRoot);
			relativePaths.push(relativePath ?? filePath);
		}
		const uniqueRelativePaths = Array.from(new Set(relativePaths.filter((path) => path.length > 0)));
		if (uniqueRelativePaths.length === 0) {
			return;
		}

		const { stdout: stagedForPaths } = await this.execGit(
			["diff", "--name-only", "--cached", "--", ...uniqueRelativePaths],
			{
				cwd: resolvedRepoRoot,
				readOnly: true,
			},
		);
		if (!stagedForPaths.trim()) {
			return;
		}

		const args = ["commit", "-m", message];
		if (this.config?.bypassGitHooks) {
			args.push("--no-verify");
		}
		args.push("--", ...uniqueRelativePaths);
		await this.execGit(args, { cwd: resolvedRepoRoot });
	}

	async resetIndex(repoRoot?: string | null): Promise<void> {
		if (!(await this.isRepository(repoRoot ?? this.projectRoot))) {
			return;
		}
		// Reset the staging area without affecting working directory
		await this.execGit(["reset", "HEAD"], { cwd: repoRoot ?? undefined });
	}

	async resetPaths(filePaths: string[], repoRoot?: string | null): Promise<void> {
		const uniqueFilePaths = Array.from(new Set(filePaths.map((path) => path.trim()).filter((path) => path.length > 0)));
		if (uniqueFilePaths.length === 0) {
			return;
		}

		const resolvedRepoRoot =
			repoRoot ?? (await this.getPathContext(uniqueFilePaths[0] ?? ""))?.repoRoot ?? this.projectRoot;
		if (!(await this.isRepository(resolvedRepoRoot))) {
			return;
		}
		const relativePaths: string[] = [];
		for (const filePath of uniqueFilePaths) {
			const relativePath = await this.getRelativePathForRepo(filePath, resolvedRepoRoot);
			relativePaths.push(relativePath ?? filePath);
		}
		const uniqueRelativePaths = Array.from(new Set(relativePaths.filter((path) => path.length > 0)));
		if (uniqueRelativePaths.length === 0) {
			return;
		}

		await this.execGit(["reset", "HEAD", "--", ...uniqueRelativePaths], { cwd: resolvedRepoRoot });
	}

	async getIndexEntries(filePath: string): Promise<GitIndexEntry[]> {
		const context = await this.getPathContext(filePath);
		if (!context || !(await this.isRepository(context.repoRoot))) {
			return [];
		}
		const { stdout } = await this.execGit(["ls-files", "-s", "-z", "--", context.relativePath], {
			cwd: context.repoRoot,
			readOnly: true,
		});
		return stdout
			.split("\0")
			.filter(Boolean)
			.flatMap((record) => {
				const tabIndex = record.indexOf("\t");
				if (tabIndex < 0) return [];
				const [mode, objectId, stageText] = record.slice(0, tabIndex).split(" ");
				const stage = Number(stageText);
				if (!mode || !objectId || !Number.isInteger(stage)) return [];
				return [{ mode, objectId, stage }];
			});
	}

	async restoreIndexEntriesIfMatches(
		filePath: string,
		expectedEntries: readonly GitIndexEntry[],
		restoreEntries: readonly GitIndexEntry[],
	): Promise<boolean> {
		const context = await this.getPathContext(filePath);
		if (!context || !(await this.isRepository(context.repoRoot))) {
			return false;
		}
		const currentEntries = await this.getIndexEntries(filePath);
		if (!indexEntriesEqual(currentEntries, expectedEntries)) {
			return false;
		}

		const objectIdLength = expectedEntries[0]?.objectId.length ?? restoreEntries[0]?.objectId.length ?? 40;
		const zeroObjectId = "0".repeat(objectIdLength);
		const records = [`0 ${zeroObjectId}\t${context.relativePath}\0`];
		for (const entry of restoreEntries) {
			records.push(`${entry.mode} ${entry.objectId} ${entry.stage}\t${context.relativePath}\0`);
		}
		await this.execGit(["update-index", "-z", "--index-info"], {
			cwd: context.repoRoot,
			input: records.join(""),
		});
		return true;
	}

	async commitStagedChanges(message: string, repoRoot?: string | null): Promise<void> {
		if (!(await this.isRepository(repoRoot ?? this.projectRoot))) {
			return;
		}
		// Check if there are any staged changes before committing
		const { stdout: status } = await this.execGit(["status", "--porcelain"], { cwd: repoRoot ?? undefined });
		const hasStagedChanges = status.split("\n").some((line) => line.match(/^[AMDRC]/));

		if (!hasStagedChanges) {
			throw new Error("No staged changes to commit");
		}

		const args = ["commit", "-m", message];
		if (this.config?.bypassGitHooks) {
			args.push("--no-verify");
		}
		await this.execGit(args, { cwd: repoRoot ?? undefined });
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
		if (!(await this.isRepository())) {
			return "";
		}
		const { stdout } = await this.execGit(["status", "--porcelain"], { readOnly: true });
		return stdout;
	}

	async isClean(): Promise<boolean> {
		const status = await this.getStatus();
		return status.trim() === "";
	}

	async getCurrentBranch(): Promise<string> {
		if (!(await this.isRepository())) {
			return "";
		}
		const { stdout } = await this.execGit(["branch", "--show-current"], { readOnly: true });
		return stdout.trim();
	}

	async getRepositoryRoot(cwd = this.projectRoot): Promise<string | null> {
		return await this.resolveRepoRoot(cwd);
	}

	async listWorktreePaths(): Promise<string[]> {
		if (!(await this.isRepository())) {
			return [];
		}
		try {
			const { stdout } = await this.execGit(["worktree", "list", "--porcelain"], { readOnly: true });
			return stdout
				.split("\n")
				.map((line) => line.trimEnd())
				.filter((line) => line.startsWith("worktree "))
				.map((line) => line.slice("worktree ".length))
				.filter(Boolean);
		} catch {
			return [];
		}
	}

	async hasUncommittedChanges(): Promise<boolean> {
		const status = await this.getStatus();
		return status.trim() !== "";
	}

	async getLastCommitMessage(): Promise<string> {
		if (!(await this.isRepository())) {
			return "";
		}
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
	async addAndCommitTaskFile(
		taskId: string,
		filePath: string,
		action: "create" | "update" | "archive",
		onStaged?: (entries: GitIndexEntry[]) => void,
	): Promise<void> {
		const actionMessages = {
			create: `Create task ${taskId}`,
			update: `Update task ${taskId}`,
			archive: `Archive task ${taskId}`,
		};

		const context = await this.getPathContext(filePath);
		const repoRoot = context?.repoRoot ?? this.projectRoot;
		if (!(await this.isRepository(repoRoot))) {
			return;
		}
		const pathForAdd = context?.relativePath ?? relative(this.projectRoot, filePath).replace(/\\/g, "/");
		const expectedWorkingHash = await this.hashFile(filePath);
		const initialIndexEntries = await this.getIndexEntries(filePath);
		let expectedIndexEntries = initialIndexEntries;
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= 3; attempt += 1) {
			if ((await this.hashFile(filePath)) !== expectedWorkingHash) {
				throw lastError ?? new Error(`Task file changed before it could be committed: ${filePath}`);
			}
			try {
				await this.execGit(["add", pathForAdd], { cwd: repoRoot });
				expectedIndexEntries = await this.getIndexEntries(filePath);
				onStaged?.(expectedIndexEntries);
				await this.commitFiles(actionMessages[action], [filePath], repoRoot);
				return;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				if (attempt === 3) break;
				const workingOwned = (await this.hashFile(filePath)) === expectedWorkingHash;
				const indexOwned = indexEntriesEqual(await this.getIndexEntries(filePath), expectedIndexEntries);
				if (!workingOwned || !indexOwned) throw lastError;
				await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 100));
			}
		}

		throw new Error(`Git operation 'commit task file ${filePath}' failed after 3 attempts: ${lastError?.message}`);
	}

	async stageBacklogDirectory(backlogDir = "backlog"): Promise<string | null> {
		const context = await this.getPathContext(backlogDir);
		if (context) {
			const pathForAdd = context.relativePath === "." ? "." : context.relativePath;
			await this.execGit(["add", pathForAdd], { cwd: context.repoRoot });
			return context.repoRoot;
		}
		if (!(await this.isRepository())) {
			return null;
		}

		await this.execGit(["add", `${backlogDir}/`]);
		return null;
	}
	async stageFileMove(fromPath: string, toPath: string): Promise<string | null> {
		const toContext = await this.getPathContext(toPath);
		const repoRoot = toContext?.repoRoot ?? this.projectRoot;
		if (!(await this.isRepository(repoRoot))) {
			return null;
		}
		const relativeFrom = await this.getRelativePathForRepo(fromPath, repoRoot);
		const relativeTo = toContext?.relativePath ?? (await this.getRelativePathForRepo(toPath, repoRoot));

		// Stage the deletion of the old file and addition of the new file
		// Git will automatically detect this as a rename if the content is similar enough
		try {
			// First try to stage the removal of the old file (if it still exists)
			await this.execGit(["add", "--all", relativeFrom ?? fromPath], { cwd: repoRoot });
		} catch {
			// If the old file doesn't exist, that's okay - it was already moved
		}

		// Always stage the new file location
		await this.execGit(["add", relativeTo ?? toPath], { cwd: repoRoot });
		return repoRoot === this.projectRoot ? null : repoRoot;
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
		return (await this.listRecentBranchTips(daysAgo)).map((tip) => tip.name);
	}

	/**
	 * List recent branch names and immutable tips in one Git process.
	 * The result is sorted so callers can use it as a stable ref fingerprint.
	 */
	async listRecentBranchTips(daysAgo: number): Promise<GitBranchTip[]> {
		await this.loadConfigIfNeeded();
		if (this.config?.filesystemOnly) {
			return [];
		}
		try {
			const since = Date.now() - daysAgo * 24 * 60 * 60 * 1000;

			// Build refs to check based on remoteOperations config
			const refs = ["refs/heads"];
			if (this.config?.remoteOperations !== false) {
				refs.push("refs/remotes/origin");
			}

			// Get local and remote branches with commit dates
			const { stdout } = await this.execGit(
				["for-each-ref", "--format=%(HEAD)%00%(refname:short)%00%(objectname)%00%(committerdate:unix)", ...refs],
				{ readOnly: true },
			);

			return stdout
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => {
					const [head, name, commit, timestamp] = line.split("\0");
					return { name, commit, current: head === "*", timestamp: Number(timestamp) * 1000 };
				})
				.filter(
					(entry): entry is GitBranchTip & { timestamp: number } =>
						Boolean(entry.name && entry.commit) &&
						entry.name !== "origin/HEAD" &&
						Number.isFinite(entry.timestamp) &&
						entry.timestamp >= since,
				)
				.map(({ name, commit, current }) => ({ name, commit, current }))
				.sort((left, right) => left.name.localeCompare(right.name));
		} catch {
			// Fallback to all branches if the command fails
			const branches = await this.listAllBranches();
			const currentBranch = await this.getCurrentBranch();
			const tips = await Promise.all(
				branches.map(async (name) => {
					const commit = await this.resolveCommit(name);
					return commit ? { name, commit, current: name === currentBranch } : null;
				}),
			);
			return tips
				.filter((tip): tip is GitBranchTip => tip !== null)
				.sort((left, right) => left.name.localeCompare(right.name));
		}
	}

	async listLocalBranches(): Promise<string[]> {
		if (!(await this.isRepository())) {
			return [];
		}
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
		if (!(await this.isRepository())) {
			return [];
		}
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
		if (!(await this.isRepository())) {
			return false;
		}
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
		if (!(await this.isRepository())) {
			return false;
		}
		try {
			const { stdout } = await this.execGit(["remote"], { readOnly: true });
			return stdout.split("\n").some((r) => r.trim() === remote);
		} catch {
			return false;
		}
	}

	async listFilesInTree(ref: string, path: string): Promise<string[]> {
		if (!(await this.isRepository())) {
			return [];
		}
		const { stdout } = await this.execGit(["ls-tree", "-r", "--name-only", "-z", ref, "--", path], { readOnly: true });
		return stdout.split("\0").filter(Boolean);
	}

	async listTreeEntries(ref: string, path: string): Promise<GitTreeEntry[]> {
		if (!(await this.isRepository())) {
			return [];
		}
		const { stdout } = await this.execGit(["ls-tree", "-r", "-z", ref, "--", path], { readOnly: true });
		const entries: GitTreeEntry[] = [];
		for (const record of stdout.split("\0")) {
			if (!record) continue;
			const separatorIndex = record.indexOf("\t");
			if (separatorIndex < 0) continue;
			const metadata = record.slice(0, separatorIndex).split(" ");
			const objectId = metadata[2];
			const entryPath = record.slice(separatorIndex + 1);
			if (!objectId || !entryPath) continue;
			entries.push({ path: entryPath, objectId });
		}
		return entries;
	}

	async hashFile(filePath: string): Promise<string | null> {
		await this.loadConfigIfNeeded();
		if (this.config?.filesystemOnly) {
			return null;
		}
		try {
			const context = await this.getPathContext(filePath);
			if (!context) return null;
			const { stdout } = await this.execGit(
				["hash-object", `--path=${context.relativePath}`, "--", context.relativePath],
				{ cwd: context.repoRoot, readOnly: true },
			);
			return stdout.trim() || null;
		} catch {
			return null;
		}
	}
	async showFile(ref: string, filePath: string): Promise<string> {
		if (!(await this.isRepository())) {
			return "";
		}
		const { stdout } = await this.execGit(["show", `${ref}:${filePath}`], { readOnly: true });
		return stdout;
	}

	/**
	 * Resolve a ref (branch name, tag, remote-tracking ref, ...) to its immutable
	 * commit SHA. Returns null when the ref cannot be resolved.
	 *
	 * Used to pin cross-branch task hydration to a fixed commit: the task index is
	 * built (ls-tree) and the content fetched (git show) in two separate steps that
	 * can be seconds apart on large repos. If the branch is deleted, renamed or moved
	 * in between, `git show <branch>:<path>` fails ("failed to stat ...") and the task
	 * is silently dropped. Resolving the SHA up front and hydrating via
	 * `git show <sha>:<path>` makes the second step immune to ref movement.
	 */
	async resolveCommit(ref: string): Promise<string | null> {
		if (!(await this.isRepository())) {
			return null;
		}
		try {
			const { stdout } = await this.execGit(
				["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`],
				{
					readOnly: true,
				},
			);
			const sha = stdout.trim();
			return sha || null;
		} catch {
			return null;
		}
	}
	/**
	 * Build a map of file -> last modified date for all files in a directory in one git log pass
	 * Much more efficient than individual getFileLastModifiedTime calls
	 * Returns a Map of filePath -> Date
	 */
	async getBranchLastModifiedMap(ref: string, dir: string, sinceDays?: number): Promise<Map<string, Date>> {
		const out = new Map<string, Date>();
		if (!(await this.isRepository())) {
			return out;
		}

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
				const timestampStr = parts[i]?.trim();
				if (timestampStr && /^\d+$/.test(timestampStr)) {
					// This is a timestamp, files follow until next timestamp
					const epoch = Number(timestampStr);
					const date = new Date(epoch * 1000);
					i++;

					// Process files until we hit another timestamp or end
					// Check if next part looks like a timestamp (digits only)
					while (i < parts.length && parts[i] && !/^\d+$/.test(parts[i]?.trim() || "")) {
						const file = parts[i]?.trim();
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
		if (!(await this.isRepository())) {
			return null;
		}
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

	private async execGit(
		args: string[],
		options?: { readOnly?: boolean; cwd?: string; input?: string },
	): Promise<{ stdout: string; stderr: string }> {
		// Use Bun.spawn so we can explicitly control stdio behaviour on Windows. When running
		// under the MCP stdio transport, delegating to git with inherited stdin can deadlock.
		const env = options?.readOnly
			? ({ ...process.env, GIT_OPTIONAL_LOCKS: "0" } as Record<string, string>)
			: (process.env as Record<string, string>);

		const subprocess = Bun.spawn(["git", ...args], {
			cwd: options?.cwd ?? this.projectRoot,
			stdin: options?.input === undefined ? "ignore" : "pipe",
			stdout: "pipe",
			stderr: "pipe",
			env,
		});
		if (options?.input !== undefined && subprocess.stdin) {
			subprocess.stdin.write(options.input);
			await subprocess.stdin.end();
		}

		const stdoutPromise = subprocess.stdout ? new Response(subprocess.stdout).text() : Promise.resolve("");
		const stderrPromise = subprocess.stderr ? new Response(subprocess.stderr).text() : Promise.resolve("");
		const [exitCode, stdout, stderr] = await Promise.all([subprocess.exited, stdoutPromise, stderrPromise]);

		if (exitCode !== 0) {
			throw new Error(`Git command failed (exit code ${exitCode}): git ${args.join(" ")}\n${stderr}`);
		}

		return { stdout, stderr };
	}

	private async getPathContext(targetPath: string): Promise<GitPathContext | null> {
		const absolutePath = isAbsolute(targetPath) ? targetPath : join(this.projectRoot, targetPath);
		const resolvedPath = await realpath(absolutePath).catch(() => null);
		if (resolvedPath) {
			return this.buildContext(resolvedPath);
		}

		const resolvedDir = await realpath(dirname(absolutePath)).catch(() => null);
		if (!resolvedDir) return null;
		const reconstructedPath = join(resolvedDir, basename(absolutePath));
		return this.buildContext(reconstructedPath, resolvedDir);
	}

	private async getRelativePathForRepo(targetPath: string, repoRoot: string): Promise<string | null> {
		const absolutePath = isAbsolute(targetPath) ? targetPath : join(this.projectRoot, targetPath);
		const resolvedPath = await realpath(absolutePath).catch(() => null);
		const pathForRelative = resolvedPath ?? (await this.resolveMissingPath(absolutePath));
		if (!pathForRelative) return null;

		const relativePath = this.normalizeGitPath(relative(repoRoot, pathForRelative));
		if (!relativePath || relativePath.startsWith("..")) return null;
		return relativePath === "" ? "." : relativePath;
	}

	private async resolveRepoRoot(startDir: string): Promise<string | null> {
		await this.loadConfigIfNeeded();
		if (this.config?.filesystemOnly) {
			return null;
		}
		try {
			const { stdout } = await this.execGit(["rev-parse", "--show-toplevel"], { readOnly: true, cwd: startDir });
			const root = stdout.trim();
			return root.length > 0 ? root : null;
		} catch {
			return null;
		}
	}

	private async resolveMissingPath(absolutePath: string): Promise<string | null> {
		const resolvedDir = await realpath(dirname(absolutePath)).catch(() => null);
		if (!resolvedDir) return null;
		return join(resolvedDir, basename(absolutePath));
	}

	private async buildContext(resolvedPath: string, resolvedDirHint?: string): Promise<GitPathContext | null> {
		let cwd = resolvedDirHint;
		if (!cwd) {
			const stats = await stat(resolvedPath).catch(() => null);
			if (!stats) {
				cwd = dirname(resolvedPath);
			} else {
				cwd = stats.isDirectory() ? resolvedPath : dirname(resolvedPath);
			}
		}

		const repoRoot = cwd ? await this.resolveRepoRoot(cwd) : null;
		if (!repoRoot) return null;

		const relativePath = this.normalizeGitPath(relative(repoRoot, resolvedPath));
		if (!relativePath || relativePath.startsWith("..")) return null;
		return { repoRoot, relativePath: relativePath === "" ? "." : relativePath };
	}

	private normalizeGitPath(pathValue: string): string {
		return pathValue.replace(/\\/g, "/");
	}
}

export async function isGitRepository(projectRoot: string): Promise<boolean> {
	try {
		const subprocess = Bun.spawn(["git", "rev-parse", "--git-dir"], {
			cwd: projectRoot,
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		});

		return (await subprocess.exited) === 0;
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
