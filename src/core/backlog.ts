import { join } from "node:path";
import { DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { FileSystem } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import type { BacklogConfig, DecisionLog, Document, Task } from "../types/index.ts";

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

		// Normalize assignee to array if it's a string (YAML allows both string and array)
		// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
		if (typeof (task as any).assignee === "string") {
			// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
			(task as any).assignee = [(task as any).assignee];
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
		// Drafts always have status "Draft", regardless of config default
		task.status = "Draft";

		// Normalize assignee to array if it's a string (YAML allows both string and array)
		// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
		if (typeof (task as any).assignee === "string") {
			// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
			(task as any).assignee = [(task as any).assignee];
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
		// Normalize assignee to array if it's a string (YAML allows both string and array)
		// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
		if (typeof (task as any).assignee === "string") {
			// biome-ignore lint/suspicious/noExplicitAny: Required for YAML flexibility
			(task as any).assignee = [(task as any).assignee];
		}

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

	async archiveDraft(taskId: string, autoCommit = true): Promise<boolean> {
		const success = await this.fs.archiveDraft(taskId);

		if (success && autoCommit) {
			await this.git.commitBacklogChanges(`Archive draft ${taskId}`);
		}

		return success;
	}

	async promoteDraft(taskId: string, autoCommit = true): Promise<boolean> {
		const success = await this.fs.promoteDraft(taskId);

		if (success && autoCommit) {
			await this.git.commitBacklogChanges(`Promote draft ${taskId}`);
		}

		return success;
	}

	async demoteTask(taskId: string, autoCommit = true): Promise<boolean> {
		const success = await this.fs.demoteTask(taskId);

		if (success && autoCommit) {
			await this.git.commitBacklogChanges(`Demote task ${taskId}`);
		}

		return success;
	}

	async createDecisionLog(decision: DecisionLog, autoCommit = true): Promise<void> {
		await this.fs.saveDecisionLog(decision);

		if (autoCommit) {
			await this.git.commitBacklogChanges(`Add decision ${decision.id}`);
		}
	}

	async createDocument(doc: Document, autoCommit = true, subPath = ""): Promise<void> {
		await this.fs.saveDocument(doc, subPath);

		if (autoCommit) {
			await this.git.commitBacklogChanges(`Add document ${doc.id}`);
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
		};

		await this.fs.saveConfig(config);
		await this.git.commitBacklogChanges(`Initialize backlog project: ${projectName}`);
	}
}
