import { DEFAULT_DIRECTORIES, DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { FileSystem } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import type { BacklogConfig, DecisionLog, Document, Task } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";

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
	}

	private async getBacklogDirectoryName(): Promise<string> {
		const config = await this.fs.loadConfig();
		return config?.backlogDirectory || "backlog";
	}

	// File system operations
	get filesystem() {
		return this.fs;
	}

	// Git operations
	get gitOps() {
		return this.git;
	}

	// High-level operations that combine filesystem and git
	async createTask(task: Task, autoCommit = true): Promise<string> {
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

		if (autoCommit) {
			await this.git.addAndCommitTaskFile(task.id, filepath, "create");
		}

		return filepath;
	}

	async createDraft(task: Task, autoCommit = true): Promise<string> {
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

		if (autoCommit) {
			await this.git.addFile(filepath);
			await this.git.commitTaskChange(task.id, `Create draft ${task.id}`);
		}

		return filepath;
	}

	async updateTask(task: Task, autoCommit = true): Promise<void> {
		// Normalize assignee to array if it's a string (YAML allows both string and array)
		// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
		if (typeof (task as any).assignee === "string") {
			// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
			(task as any).assignee = [(task as any).assignee];
		}

		task.description = ensureDescriptionHeader(task.description);
		await this.fs.saveTask(task);

		if (autoCommit) {
			const filePath = await getTaskPath(task.id, this);
			if (filePath) {
				await this.git.addAndCommitTaskFile(task.id, filePath, "update");
			}
		}
	}

	async archiveTask(taskId: string, autoCommit = true): Promise<boolean> {
		const success = await this.fs.archiveTask(taskId);

		if (success && autoCommit) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Archive task ${taskId}`);
		}

		return success;
	}

	async archiveDraft(taskId: string, autoCommit = true): Promise<boolean> {
		const success = await this.fs.archiveDraft(taskId);

		if (success && autoCommit) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Archive draft ${taskId}`);
		}

		return success;
	}

	async promoteDraft(taskId: string, autoCommit = true): Promise<boolean> {
		const success = await this.fs.promoteDraft(taskId);

		if (success && autoCommit) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Promote draft ${taskId}`);
		}

		return success;
	}

	async demoteTask(taskId: string, autoCommit = true): Promise<boolean> {
		const success = await this.fs.demoteTask(taskId);

		if (success && autoCommit) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Demote task ${taskId}`);
		}

		return success;
	}

	async createDecisionLog(decision: DecisionLog, autoCommit = true): Promise<void> {
		await this.fs.saveDecisionLog(decision);

		if (autoCommit) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Add decision ${decision.id}`);
		}
	}

	async createDocument(doc: Document, autoCommit = true, subPath = ""): Promise<void> {
		await this.fs.saveDocument(doc, subPath);

		if (autoCommit) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Add document ${doc.id}`);
		}
	}

	async initializeProject(projectName: string): Promise<void> {
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
		};

		await this.fs.saveConfig(config);
		const backlogDir = await this.getBacklogDirectoryName();
		await this.git.stageBacklogDirectory(backlogDir);
		await this.git.commitChanges(`backlog: Initialize backlog project: ${projectName}`);
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
