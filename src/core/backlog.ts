import { DEFAULT_DIRECTORIES, DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { FileSystem } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import type { BacklogConfig, DecisionLog, Document, Task } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { migrateConfig, needsMigration } from "./config-migration.ts";

function ensureDescriptionHeader(description: string): string {
	const trimmed = description.trim();
	if (trimmed === "") {
		return "## Description";
	}
	return /^##\s+Description/i.test(trimmed) ? trimmed : `## Description\n\n${trimmed}`;
}

export class Core {
	private fs: FileSystem;
	private git: GitOperations;

	constructor(projectRoot: string) {
		this.fs = new FileSystem(projectRoot);
		this.git = new GitOperations(projectRoot);
		// Note: Config is loaded lazily when needed since constructor can't be async
	}

	private async ensureConfigLoaded(): Promise<void> {
		try {
			const config = await this.fs.loadConfig();
			this.git.setConfig(config);
		} catch (error) {
			// Config loading failed, git operations will work with null config
			if (process.env.DEBUG) {
				console.warn("Failed to load config for git operations:", error);
			}
		}
	}

	private async getBacklogDirectoryName(): Promise<string> {
		const config = await this.fs.loadConfig();
		return config?.backlogDirectory || "backlog";
	}

	private async shouldAutoCommit(overrideValue?: boolean): Promise<boolean> {
		// If override is explicitly provided, use it
		if (overrideValue !== undefined) {
			return overrideValue;
		}
		// Otherwise, check config (default to false for safety)
		const config = await this.fs.loadConfig();
		return config?.autoCommit ?? false;
	}

	get filesystem(): FileSystem {
		return this.fs;
	}

	// File system operations

	// Git operations
	get gitOps() {
		return this.git;
	}

	async getGitOps() {
		await this.ensureConfigLoaded();
		return this.git;
	}

	// Config migration
	async ensureConfigMigrated(): Promise<void> {
		await this.ensureConfigLoaded();
		let config = await this.fs.loadConfig();

		if (!config || needsMigration(config)) {
			config = migrateConfig(config || {});
			await this.fs.saveConfig(config);
		}
	}

	// High-level operations that combine filesystem and git
	async createTask(task: Task, autoCommit?: boolean): Promise<string> {
		if (!task.status) {
			const config = await this.fs.loadConfig();
			task.status = config?.defaultStatus || FALLBACK_STATUS;
		}

		// Normalize assignee to array if it's a string (YAML allows both string and array)
		// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
		if (typeof (task as any).assignee === "string") {
			// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
			(task as any).assignee = [(task as any).assignee];
		}

		task.description = ensureDescriptionHeader(task.description);
		const filepath = await this.fs.saveTask(task);

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.git.addAndCommitTaskFile(task.id, filepath, "create");
		}

		return filepath;
	}

	async createDraft(task: Task, autoCommit?: boolean): Promise<string> {
		// Drafts always have status "Draft", regardless of config default
		task.status = "Draft";

		// Normalize assignee to array if it's a string (YAML allows both string and array)
		// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
		if (typeof (task as any).assignee === "string") {
			// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
			(task as any).assignee = [(task as any).assignee];
		}

		task.description = ensureDescriptionHeader(task.description);
		const filepath = await this.fs.saveDraft(task);

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.git.addFile(filepath);
			await this.git.commitTaskChange(task.id, `Create draft ${task.id}`);
		}

		return filepath;
	}

	async updateTask(task: Task, autoCommit?: boolean): Promise<void> {
		// Normalize assignee to array if it's a string (YAML allows both string and array)
		// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
		if (typeof (task as any).assignee === "string") {
			// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
			(task as any).assignee = [(task as any).assignee];
		}

		// Always set updatedDate when updating a task
		task.updatedDate = new Date().toISOString().split("T")[0];

		task.description = ensureDescriptionHeader(task.description);
		await this.fs.saveTask(task);

		if (await this.shouldAutoCommit(autoCommit)) {
			const filePath = await getTaskPath(task.id, this);
			if (filePath) {
				await this.git.addAndCommitTaskFile(task.id, filePath, "update");
			}
		}
	}

	async archiveTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.archiveTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Archive task ${taskId}`);
		}

		return success;
	}

	async archiveDraft(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.archiveDraft(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Archive draft ${taskId}`);
		}

		return success;
	}

	async promoteDraft(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.promoteDraft(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Promote draft ${taskId}`);
		}

		return success;
	}

	async demoteTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.demoteTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Demote task ${taskId}`);
		}

		return success;
	}

	async createDecisionLog(decision: DecisionLog, autoCommit?: boolean): Promise<void> {
		await this.fs.saveDecisionLog(decision);

		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Add decision ${decision.id}`);
		}
	}

	async createDocument(doc: Document, autoCommit?: boolean, subPath = ""): Promise<void> {
		await this.fs.saveDocument(doc, subPath);

		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Add document ${doc.id}`);
		}
	}

	async initializeProject(projectName: string, autoCommit = true): Promise<void> {
		await this.fs.ensureBacklogStructure();

		const config: BacklogConfig = {
			projectName: projectName,
			statuses: [...DEFAULT_STATUSES],
			labels: [],
			milestones: [],
			defaultStatus: DEFAULT_STATUSES[0], // Use first status as default
			dateFormat: "yyyy-mm-dd",
			maxColumnWidth: 20, // Default for terminal display
			backlogDirectory: DEFAULT_DIRECTORIES.BACKLOG, // Use new default
			autoCommit: false, // Default to false for user control
		};

		await this.fs.saveConfig(config);
		// Update git operations with the new config
		await this.ensureConfigLoaded();

		if (autoCommit) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Initialize backlog project: ${projectName}`);
		}
	}

	async listTasksWithMetadata(): Promise<Array<Task & { lastModified?: Date; branch?: string }>> {
		const tasks = await this.fs.listTasks();
		const tasksWithMeta = await Promise.all(
			tasks.map(async (task) => {
				const filePath = await getTaskPath(task.id, this);

				if (filePath) {
					const bunFile = Bun.file(filePath);
					const stats = await bunFile.stat();
					const branch = await this.git.getFileLastModifiedBranch(filePath);
					return {
						...task,
						lastModified: new Date(stats.mtime),
						branch: branch || undefined,
					};
				}
				return task;
			}),
		);

		return tasksWithMeta;
	}
}
