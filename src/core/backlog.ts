import { join } from "node:path";
import { DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { FileSystem } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import type { BacklogConfig, Task } from "../types/index.ts";

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

	// File system operations
	get filesystem() {
		return this.fs;
	}

	// Git operations
	get gitOps() {
		return this.git;
	}

	// High-level operations that combine filesystem and git
	async createTask(task: Task, autoCommit = true): Promise<void> {
		if (!task.status) {
			const config = await this.fs.loadConfig();
			task.status = config?.defaultStatus || FALLBACK_STATUS;
		}

		task.description = ensureDescriptionHeader(task.description);
		await this.fs.saveTask(task);

		if (autoCommit) {
			const tasksDir = this.fs.tasksDir;
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: tasksDir }));
			const taskFile = files.find((file) => file.startsWith(`task-${task.id} -`));
			if (taskFile) {
				const filePath = join(tasksDir, taskFile);
				await this.git.addAndCommitTaskFile(task.id, filePath, "create");
			}
		}
	}

	async createDraft(task: Task, autoCommit = true): Promise<void> {
		if (!task.status) {
			const config = await this.fs.loadConfig();
			task.status = config?.defaultStatus || FALLBACK_STATUS;
		}

		task.description = ensureDescriptionHeader(task.description);
		await this.fs.saveDraft(task);

		if (autoCommit) {
			const draftsDir = this.fs.draftsDir;
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: draftsDir }));
			const taskFile = files.find((file) => file.startsWith(`task-${task.id} -`));
			if (taskFile) {
				const filePath = join(draftsDir, taskFile);
				await this.git.addFile(filePath);
				await this.git.commitTaskChange(task.id, `Create draft ${task.id}`);
			}
		}
	}

	async updateTask(task: Task, autoCommit = true): Promise<void> {
		task.description = ensureDescriptionHeader(task.description);
		await this.fs.saveTask(task);

		if (autoCommit) {
			const tasksDir = this.fs.tasksDir;
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: tasksDir }));
			const taskFile = files.find((file) => file.startsWith(`task-${task.id} -`));

			if (taskFile) {
				const filePath = join(tasksDir, taskFile);
				await this.git.addAndCommitTaskFile(task.id, filePath, "update");
			}
		}
	}

	async archiveTask(taskId: string, autoCommit = true): Promise<boolean> {
		const success = await this.fs.archiveTask(taskId);

		if (success && autoCommit) {
			await this.git.commitBacklogChanges(`Archive task ${taskId}`);
		}

		return success;
	}

	async initializeProject(projectName: string): Promise<void> {
		await this.fs.ensureBacklogStructure();

		const config: BacklogConfig = {
			projectName: projectName,
			statuses: [...DEFAULT_STATUSES],
			labels: [],
			milestones: [],
			defaultStatus: DEFAULT_STATUSES[0], // Use first status as default
		};

		await this.fs.saveConfig(config);
		await this.git.commitBacklogChanges(`Initialize backlog project: ${projectName}`);
	}
}
