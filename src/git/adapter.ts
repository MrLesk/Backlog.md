import type { BacklogConfig } from "../types/index.ts";
import { GitButlerOperations } from "./gitbutler.ts";
import { GitOperations } from "./operations.ts";

/**
 * Common interface for Git operations - both regular Git and GitButler
 * share similar operations, allowing runtime switching
 */
export interface GitAdapter {
	/**
	 * Check if this adapter is available in the current environment
	 */
	isAvailable(): Promise<boolean>;

	/**
	 * Add a file to staging
	 */
	addFile(filePath: string): Promise<void>;

	/**
	 * Add multiple files to staging
	 */
	addFiles(filePaths: string[]): Promise<void>;

	/**
	 * Add and commit a task file with a specific action
	 */
	addAndCommitTaskFile(taskId: string, filePath: string, action: "create" | "update" | "archive"): Promise<void>;

	/**
	 * Commit task change with a message
	 */
	commitTaskChange(taskId: string, message: string, filePath?: string): Promise<void>;

	/**
	 * Commit changes with a message
	 */
	commit(message: string): Promise<void>;

	/**
	 * Commit specific files
	 */
	commitFiles(message: string, filePaths: string[], repoRoot?: string | null): Promise<void>;

	/**
	 * Stage the entire backlog directory
	 */
	stageBacklogDirectory(backlogDir?: string): Promise<string | null>;

	/**
	 * Stage a file move (from -> to)
	 */
	stageFileMove(fromPath: string, toPath: string): Promise<string | null>;

	/**
	 * Reset specific paths
	 */
	resetPaths(filePaths: string[], repoRoot?: string | null): Promise<void>;

	/**
	 * Check if the working tree is clean
	 */
	isClean(): Promise<boolean>;

	/**
	 * Get the current branch name
	 */
	getCurrentBranch(): Promise<string>;

	/**
	 * Check if there are uncommitted changes
	 */
	hasUncommittedChanges(): Promise<boolean>;

	/**
	 * Get status output
	 */
	getStatus(): Promise<string>;

	/**
	 * List local branches
	 */
	listLocalBranches(): Promise<string[]>;

	/**
	 * Reset the staging area
	 */
	resetIndex(): Promise<void>;

	/**
	 * Get the branch for a file's last modification
	 */
	getFileLastModifiedBranch(filePath: string): Promise<string | null>;

	/**
	 * Set configuration (for hook bypass, etc)
	 */
	setConfig(config: BacklogConfig | null): void;

	/**
	 * Fetch from remote
	 */
	fetch(remote?: string): Promise<void>;

	/**
	 * List recent remote branches
	 */
	listRecentRemoteBranches(daysAgo: number, remote?: string): Promise<string[]>;

	/**
	 * List all branches (local and remote)
	 */
	listAllBranches(remote?: string): Promise<string[]>;

	/**
	 * Check if any remote exists
	 */
	hasAnyRemote(): Promise<boolean>;

	/**
	 * List files in a tree at a specific ref
	 */
	listFilesInTree(ref: string, path: string): Promise<string[]>;

	/**
	 * Show file content at a specific ref
	 */
	showFile(ref: string, filePath: string): Promise<string>;

	/**
	 * Get last commit message
	 */
	getLastCommitMessage(): Promise<string>;

	/**
	 * Commit changes with a message and optional repo root
	 */
	commitChanges(message: string, repoRoot?: string | null): Promise<void>;

	/**
	 * Get a map of branch names to their last modification dates
	 */
	getBranchLastModifiedMap(ref: string, dir: string, sinceDays?: number): Promise<Map<string, Date>>;

	/**
	 * List recent local branches
	 */
	listRecentBranches(daysAgo: number): Promise<string[]>;
}

/**
 * Adapter for regular Git operations
 */
export class GitAdapterImpl implements GitAdapter {
	private git: GitOperations;

	constructor(projectRoot: string, config: BacklogConfig | null = null) {
		this.git = new GitOperations(projectRoot, config);
	}

	async isAvailable(): Promise<boolean> {
		return true;
	}

	async addFile(filePath: string): Promise<void> {
		await this.git.addFile(filePath);
	}

	async addFiles(filePaths: string[]): Promise<void> {
		await this.git.addFiles(filePaths);
	}

	async addAndCommitTaskFile(taskId: string, filePath: string, action: "create" | "update" | "archive"): Promise<void> {
		await this.git.addAndCommitTaskFile(taskId, filePath, action);
	}

	async commitTaskChange(taskId: string, message: string, filePath?: string): Promise<void> {
		await this.git.commitTaskChange(taskId, message, filePath);
	}

	async commit(message: string): Promise<void> {
		await this.git.commitChanges(message);
	}

	async commitFiles(message: string, filePaths: string[], repoRoot?: string | null): Promise<void> {
		await this.git.commitFiles(message, filePaths, repoRoot);
	}

	async stageBacklogDirectory(backlogDir = "backlog"): Promise<string | null> {
		return await this.git.stageBacklogDirectory(backlogDir);
	}

	async stageFileMove(fromPath: string, toPath: string): Promise<string | null> {
		return await this.git.stageFileMove(fromPath, toPath);
	}

	async resetPaths(filePaths: string[], repoRoot?: string | null): Promise<void> {
		await this.git.resetPaths(filePaths, repoRoot);
	}

	async isClean(): Promise<boolean> {
		return await this.git.isClean();
	}

	async getCurrentBranch(): Promise<string> {
		return await this.git.getCurrentBranch();
	}

	async hasUncommittedChanges(): Promise<boolean> {
		return await this.git.hasUncommittedChanges();
	}

	async getStatus(): Promise<string> {
		return await this.git.getStatus();
	}

	async listLocalBranches(): Promise<string[]> {
		return await this.git.listLocalBranches();
	}

	async resetIndex(): Promise<void> {
		await this.git.resetIndex();
	}

	async getFileLastModifiedBranch(filePath: string): Promise<string | null> {
		return await this.git.getFileLastModifiedBranch(filePath);
	}

	setConfig(config: BacklogConfig | null): void {
		this.git.setConfig(config);
	}

	async fetch(remote = "origin"): Promise<void> {
		return await this.git.fetch(remote);
	}

	async listRecentRemoteBranches(daysAgo: number, remote = "origin"): Promise<string[]> {
		return await this.git.listRecentRemoteBranches(daysAgo, remote);
	}

	async listAllBranches(remote = "origin"): Promise<string[]> {
		return await this.git.listAllBranches(remote);
	}

	async hasAnyRemote(): Promise<boolean> {
		return await this.git.hasAnyRemote();
	}

	async listFilesInTree(ref: string, path: string): Promise<string[]> {
		return await this.git.listFilesInTree(ref, path);
	}

	async showFile(ref: string, filePath: string): Promise<string> {
		return await this.git.showFile(ref, filePath);
	}

	async getLastCommitMessage(): Promise<string> {
		return await this.git.getLastCommitMessage();
	}

	async commitChanges(message: string, repoRoot?: string | null): Promise<void> {
		await this.git.commitChanges(message, repoRoot);
	}

	async getBranchLastModifiedMap(ref: string, dir: string, sinceDays?: number): Promise<Map<string, Date>> {
		return await this.git.getBranchLastModifiedMap(ref, dir, sinceDays);
	}

	async listRecentBranches(daysAgo: number): Promise<string[]> {
		return await this.git.listRecentBranches(daysAgo);
	}
}

/**
 * Adapter for GitButler virtual branch operations
 * Uses GitButlerOperations for staging and commits (but stage, but commit)
 */
export class GitButlerAdapterImpl implements GitAdapter {
	private git: GitOperations;
	private gitbutler: GitButlerOperations;

	constructor(projectRoot: string, config: BacklogConfig | null = null) {
		this.git = new GitOperations(projectRoot, config);
		this.gitbutler = new GitButlerOperations(projectRoot, config);
	}

	async isAvailable(): Promise<boolean> {
		return await GitButlerOperations.isAvailable(this.git["projectRoot"]);
	}

	async addFile(filePath: string): Promise<void> {
		// Use GitButler's staging
		await this.gitbutler.stageFiles([filePath]);
	}

	async addFiles(filePaths: string[]): Promise<void> {
		// Use GitButler's staging
		await this.gitbutler.stageFiles(filePaths);
	}

	async addAndCommitTaskFile(taskId: string, filePath: string, action: "create" | "update" | "archive"): Promise<void> {
		// Stage the file with GitButler, then commit with GitButler
		await this.gitbutler.stageFiles([filePath]);
		const actionMessages = {
			create: `Create task ${taskId}`,
			update: `Update task ${taskId}`,
			archive: `Archive task ${taskId}`,
		};
		await this.gitbutler.commit(actionMessages[action]);
	}

	async commitTaskChange(taskId: string, message: string, _filePath?: string): Promise<void> {
		// Use GitButler commit
		await this.gitbutler.commit(`${taskId} - ${message}`);
	}

	async commit(message: string): Promise<void> {
		// Use GitButler commit
		await this.gitbutler.commit(message);
	}

	async commitFiles(message: string, filePaths: string[], _repoRoot?: string | null): Promise<void> {
		// Stage files with GitButler, then commit
		await this.gitbutler.stageFiles(filePaths);
		await this.gitbutler.commit(message);
	}

	async stageBacklogDirectory(backlogDir = "backlog"): Promise<string | null> {
		// Stage all files in backlog directory with GitButler
		const files = await this.git.listFilesInTree("HEAD", backlogDir);
		if (files.length > 0) {
			await this.gitbutler.stageFiles(files);
			return this.git["projectRoot"];
		}
		return null;
	}

	async stageFileMove(fromPath: string, toPath: string): Promise<string | null> {
		// GitButler handles moves automatically in the working directory
		// Just return the project root
		return this.git["projectRoot"];
	}

	async resetPaths(filePaths: string[], _repoRoot?: string | null): Promise<void> {
		// GitButler doesn't have reset - this is a no-op for virtual branches
		// Files in virtual branches are automatically tracked
	}

	async isClean(): Promise<boolean> {
		// Use GitButler's status
		return await this.gitbutler.isClean();
	}

	async getCurrentBranch(): Promise<string> {
		// Use GitButler's current branch (virtual branch name)
		return await this.gitbutler.getCurrentBranch();
	}

	async hasUncommittedChanges(): Promise<boolean> {
		const clean = await this.gitbutler.isClean();
		return !clean;
	}

	async getStatus(): Promise<string> {
		// Use GitButler's status
		return await this.gitbutler.getStatus();
	}

	async listLocalBranches(): Promise<string[]> {
		// Return virtual branches
		const vb = await this.gitbutler.listBranches();
		return vb.map((b) => b.name);
	}

	async resetIndex(): Promise<void> {
		// GitButler doesn't have equivalent - no-op
	}

	async getFileLastModifiedBranch(filePath: string): Promise<string | null> {
		// For virtual branches, return the current virtual branch name
		const current = await this.gitbutler.getCurrentBranch();
		return current || null;
	}

	setConfig(config: BacklogConfig | null): void {
		this.git.setConfig(config);
		this.gitbutler.setConfig(config);
	}

	async fetch(remote = "origin"): Promise<void> {
		return await this.git.fetch(remote);
	}

	async listRecentRemoteBranches(daysAgo: number, remote = "origin"): Promise<string[]> {
		return await this.git.listRecentRemoteBranches(daysAgo, remote);
	}

	async listAllBranches(remote = "origin"): Promise<string[]> {
		return await this.git.listAllBranches(remote);
	}

	async hasAnyRemote(): Promise<boolean> {
		return await this.git.hasAnyRemote();
	}

	async listFilesInTree(ref: string, path: string): Promise<string[]> {
		return await this.git.listFilesInTree(ref, path);
	}

	async showFile(ref: string, filePath: string): Promise<string> {
		return await this.git.showFile(ref, filePath);
	}

	async getLastCommitMessage(): Promise<string> {
		return await this.git.getLastCommitMessage();
	}

	async commitChanges(message: string, _repoRoot?: string | null): Promise<void> {
		// Stage all changes using GitButler - stageFiles uses "but add ." to stage all changes
		await this.gitbutler.stageFiles([]);
		// Commit with GitButler
		await this.gitbutler.commit(message);
	}

	async getBranchLastModifiedMap(ref: string, dir: string, sinceDays?: number): Promise<Map<string, Date>> {
		// Delegate to regular git for branch history analysis
		return await this.git.getBranchLastModifiedMap(ref, dir, sinceDays);
	}

	async listRecentBranches(daysAgo: number): Promise<string[]> {
		// Delegate to regular git for branch listing
		return await this.git.listRecentBranches(daysAgo);
	}
}

/**
 * Factory to create the appropriate Git adapter based on configuration
 */
export function createGitAdapter(projectRoot: string, config: BacklogConfig | null): GitAdapter {
	console.log("[createGitAdapter] Called with config.gitbutler:", config?.gitbutler);
	const useGitButler = config?.gitbutler === true;
	if (useGitButler) {
		// Only use GitButler adapter if it's actually available
		// Note: This is an async check, so for synchronous factory we check availability at runtime
		// The adapter itself will handle the case where GitButler isn't installed
		console.log("[createGitAdapter] Returning:", useGitButler ? "GitButlerAdapterImpl" : "GitAdapterImpl");
		return new GitButlerAdapterImpl(projectRoot, config);
	}
	console.log("[createGitAdapter] Returning:", useGitButler ? "GitButlerAdapterImpl" : "GitAdapterImpl");
	return new GitAdapterImpl(projectRoot, config);
}
