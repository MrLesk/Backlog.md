import { join } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { FileSystem } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import type { BacklogConfig, Decision, Document, Task } from "../types/index.ts";
import { getTaskFilename, getTaskPath } from "../utils/task-path.ts";
import { migrateConfig, needsMigration } from "./config-migration.ts";

function ensureDescriptionHeader(body: string): string {
	const trimmed = (body || "").trim();
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

	async ensureConfigLoaded(): Promise<void> {
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
		// Always use "backlog" as the directory name
		return DEFAULT_DIRECTORIES.BACKLOG;
	}

	async shouldAutoCommit(overrideValue?: boolean): Promise<boolean> {
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

	// ID generation
	async generateNextId(parent?: string): Promise<string> {
		// Ensure git operations have access to the config
		await this.ensureConfigLoaded();

		const config = await this.fs.loadConfig();
		// Load local tasks and drafts in parallel
		const [tasks, drafts] = await Promise.all([this.fs.listTasks(), this.fs.listDrafts()]);

		const allIds: string[] = [];

		// Add local task and draft IDs first
		for (const t of tasks) {
			allIds.push(t.id);
		}
		for (const d of drafts) {
			allIds.push(d.id);
		}

		try {
			const backlogDir = DEFAULT_DIRECTORIES.BACKLOG;

			// Skip remote operations if disabled
			if (config?.remoteOperations === false) {
				if (process.env.DEBUG) {
					console.log("Remote operations disabled - generating ID from local tasks only");
				}
			} else {
				await this.git.fetch();
			}

			const branches = await this.git.listAllBranches();

			// Filter and normalize branch names - handle both local and remote branches
			const normalizedBranches = branches
				.flatMap((branch) => {
					// For remote branches like "origin/feature", extract just "feature"
					// But also try the full remote ref in case it's needed
					if (branch.startsWith("origin/")) {
						return [branch, branch.replace("origin/", "")];
					}
					return [branch];
				})
				// Remove duplicates and filter out HEAD
				.filter((branch, index, arr) => arr.indexOf(branch) === index && branch !== "HEAD" && !branch.includes("HEAD"));

			// Load files from all branches in parallel with better error handling
			const branchFilePromises = normalizedBranches.map(async (branch) => {
				try {
					const files = await this.git.listFilesInTree(branch, `${backlogDir}/tasks`);
					return files
						.map((file) => {
							const match = file.match(/task-(\d+)/);
							return match ? `task-${match[1]}` : null;
						})
						.filter((id): id is string => id !== null);
				} catch (error) {
					// Silently ignore errors for individual branches (they might not exist or be accessible)
					if (process.env.DEBUG) {
						console.log(`Could not access branch ${branch}:`, error);
					}
					return [];
				}
			});

			const branchResults = await Promise.all(branchFilePromises);
			for (const branchIds of branchResults) {
				allIds.push(...branchIds);
			}
		} catch (error) {
			// Suppress errors for offline mode or other git issues
			if (process.env.DEBUG) {
				console.error("Could not fetch remote task IDs:", error);
			}
		}

		if (parent) {
			const prefix = parent.startsWith("task-") ? parent : `task-${parent}`;
			let max = 0;
			// Iterate over allIds (which now includes both local and remote)
			for (const id of allIds) {
				if (id.startsWith(`${prefix}.`)) {
					const rest = id.slice(prefix.length + 1);
					const num = Number.parseInt(rest.split(".")[0] || "0", 10);
					if (num > max) max = num;
				}
			}
			const nextSubIdNumber = max + 1;
			const padding = config?.zeroPaddedIds;

			if (padding && typeof padding === "number" && padding > 0) {
				// Pad sub-tasks to 2 digits. This supports up to 99 sub-tasks,
				// which is a reasonable limit and keeps IDs from getting too long.
				const paddedSubId = String(nextSubIdNumber).padStart(2, "0");
				return `${prefix}.${paddedSubId}`;
			}

			return `${prefix}.${nextSubIdNumber}`;
		}

		let max = 0;
		// Iterate over allIds (which now includes both local and remote)
		for (const id of allIds) {
			const match = id.match(/^task-(\d+)/);
			if (match) {
				const num = Number.parseInt(match[1] || "0", 10);
				if (num > max) max = num;
			}
		}
		const nextIdNumber = max + 1;
		const padding = config?.zeroPaddedIds;

		if (padding && typeof padding === "number" && padding > 0) {
			const paddedId = String(nextIdNumber).padStart(padding, "0");
			return `task-${paddedId}`;
		}

		return `task-${nextIdNumber}`;
	}

	// High-level operations that combine filesystem and git
	async createTaskFromData(
		taskData: {
			title: string;
			body?: string;
			status?: string;
			assignee?: string[];
			labels?: string[];
			dependencies?: string[];
			parentTaskId?: string;
			priority?: "high" | "medium" | "low";
		},
		autoCommit?: boolean,
	): Promise<Task> {
		const id = await this.generateNextId();

		const task: Task = {
			id,
			title: taskData.title,
			body: taskData.body || "",
			status: taskData.status || "",
			assignee: taskData.assignee || [],
			labels: taskData.labels || [],
			dependencies: taskData.dependencies || [],
			createdDate: new Date().toISOString().slice(0, 16).replace("T", " "),
			...(taskData.parentTaskId && { parentTaskId: taskData.parentTaskId }),
			...(taskData.priority && { priority: taskData.priority }),
		};

		// Check if this should be a draft based on status
		if (task.status && task.status.toLowerCase() === "draft") {
			await this.createDraft(task, autoCommit);
		} else {
			await this.createTask(task, autoCommit);
		}

		return task;
	}

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

		task.body = ensureDescriptionHeader(task.body);
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

		task.body = ensureDescriptionHeader(task.body);
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
		task.updatedDate = new Date().toISOString().slice(0, 16).replace("T", " ");

		task.body = ensureDescriptionHeader(task.body);
		await this.fs.saveTask(task);

		if (await this.shouldAutoCommit(autoCommit)) {
			const filePath = await getTaskPath(task.id, this);
			if (filePath) {
				await this.git.addAndCommitTaskFile(task.id, filePath, "update");
			}
		}
	}

	async updateTasksBulk(tasks: Task[], commitMessage?: string, autoCommit?: boolean): Promise<void> {
		// Update all tasks without committing individually
		for (const task of tasks) {
			await this.updateTask(task, false); // Don't auto-commit each one
		}

		// Commit all changes at once if auto-commit is enabled
		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(commitMessage || `Update ${tasks.length} tasks`);
		}
	}

	async archiveTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		// Get paths before moving the file
		const taskPath = await getTaskPath(taskId, this);
		const taskFilename = await getTaskFilename(taskId, this);

		if (!taskPath || !taskFilename) return false;

		const fromPath = taskPath;
		const toPath = join(await this.fs.getArchiveTasksDir(), taskFilename);

		const success = await this.fs.archiveTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			// Stage the file move for proper Git tracking
			await this.git.stageFileMove(fromPath, toPath);
			await this.git.commitChanges(`backlog: Archive task ${taskId}`);
		}

		return success;
	}

	async completeTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		// Get paths before moving the file
		const completedDir = this.fs.completedDir;
		const taskPath = await getTaskPath(taskId, this);
		const taskFilename = await getTaskFilename(taskId, this);

		if (!taskPath || !taskFilename) return false;

		const fromPath = taskPath;
		const toPath = join(completedDir, taskFilename);

		const success = await this.fs.completeTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			// Stage the file move for proper Git tracking
			await this.git.stageFileMove(fromPath, toPath);
			await this.git.commitChanges(`backlog: Complete task ${taskId}`);
		}

		return success;
	}

	async getDoneTasksByAge(olderThanDays: number): Promise<Task[]> {
		const tasks = await this.fs.listTasks();
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

		return tasks.filter((task) => {
			if (task.status !== "Done") return false;

			// Check updatedDate first, then createdDate as fallback
			const taskDate = task.updatedDate || task.createdDate;
			if (!taskDate) return false;

			const date = new Date(taskDate);
			return date < cutoffDate;
		});
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

	async createDecision(decision: Decision, autoCommit?: boolean): Promise<void> {
		await this.fs.saveDecision(decision);

		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Add decision ${decision.id}`);
		}
	}

	async updateDecisionFromContent(decisionId: string, content: string, autoCommit?: boolean): Promise<void> {
		const existingDecision = await this.fs.loadDecision(decisionId);
		if (!existingDecision) {
			throw new Error(`Decision ${decisionId} not found`);
		}

		// Parse the markdown content to extract the decision data
		const matter = await import("gray-matter");
		const { data } = matter.default(content);

		const extractSection = (content: string, sectionName: string): string | undefined => {
			const regex = new RegExp(`## ${sectionName}\\s*([\\s\\S]*?)(?=## |$)`, "i");
			const match = content.match(regex);
			return match ? match[1]?.trim() : undefined;
		};

		const updatedDecision = {
			...existingDecision,
			title: data.title || existingDecision.title,
			status: data.status || existingDecision.status,
			date: data.date || existingDecision.date,
			context: extractSection(content, "Context") || existingDecision.context,
			decision: extractSection(content, "Decision") || existingDecision.decision,
			consequences: extractSection(content, "Consequences") || existingDecision.consequences,
			alternatives: extractSection(content, "Alternatives") || existingDecision.alternatives,
		};

		await this.createDecision(updatedDecision, autoCommit);
	}

	async createDecisionWithTitle(title: string, autoCommit?: boolean): Promise<Decision> {
		// Import the generateNextDecisionId function from CLI
		const { generateNextDecisionId } = await import("../cli.js");
		const id = await generateNextDecisionId(this);

		const decision: Decision = {
			id,
			title,
			date: new Date().toISOString().slice(0, 16).replace("T", " "),
			status: "proposed",
			context: "[Describe the context and problem that needs to be addressed]",
			decision: "[Describe the decision that was made]",
			consequences: "[Describe the consequences of this decision]",
		};

		await this.createDecision(decision, autoCommit);
		return decision;
	}

	async createDocument(doc: Document, autoCommit?: boolean, subPath = ""): Promise<void> {
		await this.fs.saveDocument(doc, subPath);

		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Add document ${doc.id}`);
		}
	}

	async updateDocument(existingDoc: Document, content: string, autoCommit?: boolean): Promise<void> {
		const updatedDoc = {
			...existingDoc,
			body: content,
			updatedDate: new Date().toISOString().slice(0, 16).replace("T", " "),
		};

		await this.createDocument(updatedDoc, autoCommit);
	}

	async createDocumentWithId(title: string, content: string, autoCommit?: boolean): Promise<Document> {
		// Import the generateNextDocId function from CLI
		const { generateNextDocId } = await import("../cli.js");
		const id = await generateNextDocId(this);

		const document: Document = {
			id,
			title,
			type: "other" as const,
			createdDate: new Date().toISOString().slice(0, 16).replace("T", " "),
			body: content,
		};

		await this.createDocument(document, autoCommit);
		return document;
	}

	async initializeProject(projectName: string, autoCommit = false): Promise<void> {
		await this.fs.ensureBacklogStructure();

		const config: BacklogConfig = {
			projectName: projectName,
			statuses: [...DEFAULT_STATUSES],
			labels: [],
			milestones: [],
			defaultStatus: DEFAULT_STATUSES[0], // Use first status as default
			dateFormat: "yyyy-mm-dd",
			maxColumnWidth: 20, // Default for terminal display
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
