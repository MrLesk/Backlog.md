import { mkdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES, DEFAULT_STATUSES } from "../constants/index.ts";
import { parseDecisionLog, parseDocument, parseTask } from "../markdown/parser.ts";
import { serializeDecisionLog, serializeDocument, serializeTask } from "../markdown/serializer.ts";
import type { BacklogConfig, DecisionLog, Document, Task } from "../types/index.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

export class FileSystem {
	private backlogDir: string;
	private projectRoot: string;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
		this.backlogDir = join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
	}

	// Public accessors for directory paths
	get tasksDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.TASKS);
	}

	get draftsDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.DRAFTS);
	}

	get archiveTasksDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_TASKS);
	}

	get archiveDraftsDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_DRAFTS);
	}

	get decisionsDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.DECISIONS);
	}

	get docsDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.DOCS);
	}

	async ensureBacklogStructure(): Promise<void> {
		const directories = [
			this.backlogDir,
			join(this.backlogDir, DEFAULT_DIRECTORIES.TASKS),
			join(this.backlogDir, DEFAULT_DIRECTORIES.DRAFTS),
			join(this.backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_TASKS),
			join(this.backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_DRAFTS),
			join(this.backlogDir, DEFAULT_DIRECTORIES.DOCS),
			join(this.backlogDir, DEFAULT_DIRECTORIES.DECISIONS),
		];

		for (const dir of directories) {
			await mkdir(dir, { recursive: true });
		}
	}

	// Task operations
	async saveTask(task: Task): Promise<void> {
		const taskId = task.id.startsWith("task-") ? task.id : `task-${task.id}`;
		const filename = `${taskId} - ${this.sanitizeFilename(task.title)}.md`;
		const filepath = join(this.tasksDir, filename);
		const content = serializeTask(task);

		// Delete any existing task files with the same ID but different filenames
		try {
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.tasksDir }));
			const normalizedTaskId = taskId;
			const existingFiles = files.filter((file) => file.startsWith(`${normalizedTaskId} -`) && file !== filename);

			for (const existingFile of existingFiles) {
				const existingPath = join(this.tasksDir, existingFile);
				await unlink(existingPath);
			}
		} catch {
			// Ignore errors if no existing files found
		}

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
	}

	async loadTask(taskId: string): Promise<Task | null> {
		try {
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.tasksDir }));
			const normalizedTaskId = taskId.startsWith("task-") ? taskId : `task-${taskId}`;
			const taskFile = files.find((file) => file.startsWith(`${normalizedTaskId} -`));

			if (!taskFile) return null;

			const filepath = join(this.tasksDir, taskFile);
			const content = await Bun.file(filepath).text();
			return parseTask(content);
		} catch (error) {
			return null;
		}
	}

	async listTasks(): Promise<Task[]> {
		try {
			const taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: this.tasksDir }));

			const tasks: Task[] = [];
			for (const file of taskFiles) {
				const filepath = join(this.tasksDir, file);
				const content = await Bun.file(filepath).text();
				tasks.push(parseTask(content));
			}

			return sortByTaskId(tasks);
		} catch (error) {
			return [];
		}
	}

	async listTasksWithMetadata(): Promise<Array<Task & { lastModified?: Date }>> {
		try {
			const taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: this.tasksDir }));

			const tasks: Array<Task & { lastModified?: Date }> = [];
			for (const file of taskFiles) {
				const filepath = join(this.tasksDir, file);
				const bunFile = Bun.file(filepath);
				const content = await bunFile.text();
				const task = parseTask(content);

				// Get file stats for modification time
				const stats = await bunFile.stat();
				tasks.push({
					...task,
					lastModified: new Date(stats.mtime),
				});
			}

			return sortByTaskId(tasks);
		} catch (error) {
			return [];
		}
	}

	async archiveTask(taskId: string): Promise<boolean> {
		try {
			const sourceFiles = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.tasksDir }));
			const normalizedTaskId = taskId.startsWith("task-") ? taskId : `task-${taskId}`;
			const taskFile = sourceFiles.find((file) => file.startsWith(`${normalizedTaskId} -`));

			if (!taskFile) return false;

			const sourcePath = join(this.tasksDir, taskFile);
			const targetPath = join(this.archiveTasksDir, taskFile);

			// Read source file
			const content = await Bun.file(sourcePath).text();

			// Write to target and ensure directory exists
			await this.ensureDirectoryExists(dirname(targetPath));
			await Bun.write(targetPath, content);

			// Remove source file
			await unlink(sourcePath);

			return true;
		} catch (error) {
			return false;
		}
	}

	async archiveDraft(taskId: string): Promise<boolean> {
		try {
			const sourceFiles = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.draftsDir }));
			const normalizedTaskId = taskId.startsWith("task-") ? taskId : `task-${taskId}`;
			const taskFile = sourceFiles.find((file) => file.startsWith(`${normalizedTaskId} -`));

			if (!taskFile) return false;

			const sourcePath = join(this.draftsDir, taskFile);
			const targetPath = join(this.archiveDraftsDir, taskFile);

			const content = await Bun.file(sourcePath).text();
			await this.ensureDirectoryExists(dirname(targetPath));
			await Bun.write(targetPath, content);

			await unlink(sourcePath);

			return true;
		} catch {
			return false;
		}
	}

	async promoteDraft(taskId: string): Promise<boolean> {
		try {
			const sourceFiles = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.draftsDir }));
			const normalizedTaskId = taskId.startsWith("task-") ? taskId : `task-${taskId}`;
			const taskFile = sourceFiles.find((file) => file.startsWith(`${normalizedTaskId} -`));

			if (!taskFile) return false;

			const sourcePath = join(this.draftsDir, taskFile);
			const targetPath = join(this.tasksDir, taskFile);

			const content = await Bun.file(sourcePath).text();
			await this.ensureDirectoryExists(dirname(targetPath));
			await Bun.write(targetPath, content);

			await unlink(sourcePath);

			return true;
		} catch {
			return false;
		}
	}

	async demoteTask(taskId: string): Promise<boolean> {
		try {
			const sourceFiles = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.tasksDir }));
			const normalizedTaskId = taskId.startsWith("task-") ? taskId : `task-${taskId}`;
			const taskFile = sourceFiles.find((file) => file.startsWith(`${normalizedTaskId} -`));

			if (!taskFile) return false;

			const sourcePath = join(this.tasksDir, taskFile);
			const targetPath = join(this.draftsDir, taskFile);

			const content = await Bun.file(sourcePath).text();
			await this.ensureDirectoryExists(dirname(targetPath));
			await Bun.write(targetPath, content);

			await unlink(sourcePath);

			return true;
		} catch {
			return false;
		}
	}

	// Draft operations
	async saveDraft(task: Task): Promise<void> {
		const taskId = task.id.startsWith("task-") ? task.id : `task-${task.id}`;
		const filename = `${taskId} - ${this.sanitizeFilename(task.title)}.md`;
		const filepath = join(this.draftsDir, filename);
		const content = serializeTask(task);

		try {
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.draftsDir }));
			const existingFiles = files.filter((file) => file.startsWith(`${taskId} -`) && file !== filename);

			for (const existingFile of existingFiles) {
				const existingPath = join(this.draftsDir, existingFile);
				await unlink(existingPath);
			}
		} catch {
			// Ignore errors if no existing files found
		}

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
	}

	async loadDraft(taskId: string): Promise<Task | null> {
		try {
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.draftsDir }));
			const normalizedTaskId = taskId.startsWith("task-") ? taskId : `task-${taskId}`;
			const taskFile = files.find((file) => file.startsWith(`${normalizedTaskId} -`));

			if (!taskFile) return null;

			const filepath = join(this.draftsDir, taskFile);
			const content = await Bun.file(filepath).text();
			return parseTask(content);
		} catch {
			return null;
		}
	}

	async listDrafts(): Promise<Task[]> {
		try {
			const taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: this.draftsDir }));

			const tasks: Task[] = [];
			for (const file of taskFiles) {
				const filepath = join(this.draftsDir, file);
				const content = await Bun.file(filepath).text();
				tasks.push(parseTask(content));
			}

			return sortByTaskId(tasks);
		} catch {
			return [];
		}
	}

	// Decision log operations
	async saveDecisionLog(decision: DecisionLog): Promise<void> {
		const filename = `decision-${decision.id} - ${this.sanitizeFilename(decision.title)}.md`;
		const filepath = join(this.decisionsDir, filename);
		const content = serializeDecisionLog(decision);

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
	}

	async loadDecisionLog(decisionId: string): Promise<DecisionLog | null> {
		try {
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.decisionsDir }));
			const decisionFile = files.find((file) => file.startsWith(`decision-${decisionId} -`));

			if (!decisionFile) return null;

			const filepath = join(this.decisionsDir, decisionFile);
			const content = await Bun.file(filepath).text();
			return parseDecisionLog(content);
		} catch (error) {
			return null;
		}
	}

	// Document operations
	async saveDocument(document: Document, subPath = ""): Promise<void> {
		const dir = join(this.docsDir, subPath);
		const filename = `${this.sanitizeFilename(document.title)}.md`;
		const filepath = join(dir, filename);
		const content = serializeDocument(document);

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
	}

	async listDecisionLogs(): Promise<DecisionLog[]> {
		try {
			const decisionFiles = await Array.fromAsync(new Bun.Glob("decision-*.md").scan({ cwd: this.decisionsDir }));
			const decisions: DecisionLog[] = [];
			for (const file of decisionFiles) {
				const filepath = join(this.decisionsDir, file);
				const content = await Bun.file(filepath).text();
				decisions.push(parseDecisionLog(content));
			}
			return sortByTaskId(decisions);
		} catch {
			return [];
		}
	}

	async listDocuments(): Promise<Document[]> {
		try {
			const docFiles = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: this.docsDir }));
			const docs: Document[] = [];
			for (const file of docFiles) {
				const filepath = join(this.docsDir, file);
				const content = await Bun.file(filepath).text();
				docs.push(parseDocument(content));
			}
			return docs.sort((a, b) => a.title.localeCompare(b.title));
		} catch {
			return [];
		}
	}

	// Config operations
	async loadConfig(): Promise<BacklogConfig | null> {
		try {
			const configPath = join(this.backlogDir, DEFAULT_FILES.CONFIG);
			const content = await Bun.file(configPath).text();
			return this.parseConfig(content);
		} catch (error) {
			return null;
		}
	}

	async saveConfig(config: BacklogConfig): Promise<void> {
		const configPath = join(this.backlogDir, DEFAULT_FILES.CONFIG);
		const content = this.serializeConfig(config);
		await Bun.write(configPath, content);
	}

	async getUserSetting(key: string, global = false): Promise<string | undefined> {
		const settings = await this.loadUserSettings(global);
		return settings ? settings[key] : undefined;
	}

	async setUserSetting(key: string, value: string, global = false): Promise<void> {
		const settings = (await this.loadUserSettings(global)) || {};
		settings[key] = value;
		await this.saveUserSettings(settings, global);
	}

	private async loadUserSettings(global = false): Promise<Record<string, string> | null> {
		const filePath = global
			? join(homedir(), ".backlog", DEFAULT_FILES.USER)
			: join(this.projectRoot, DEFAULT_FILES.USER);
		try {
			const content = await Bun.file(filePath).text();
			const result: Record<string, string> = {};
			for (const line of content.split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) continue;
				const idx = trimmed.indexOf(":");
				if (idx === -1) continue;
				const k = trimmed.substring(0, idx).trim();
				const v = trimmed
					.substring(idx + 1)
					.trim()
					.replace(/^['"]|['"]$/g, "");
				result[k] = v;
			}
			return result;
		} catch {
			return null;
		}
	}

	private async saveUserSettings(settings: Record<string, string>, global = false): Promise<void> {
		const filePath = global
			? join(homedir(), ".backlog", DEFAULT_FILES.USER)
			: join(this.projectRoot, DEFAULT_FILES.USER);
		await this.ensureDirectoryExists(dirname(filePath));
		const lines = Object.entries(settings).map(([k, v]) => `${k}: ${v}`);
		await Bun.write(filePath, `${lines.join("\n")}\n`);
	}

	// Utility methods
	private sanitizeFilename(filename: string): string {
		return filename
			.replace(/[<>:"/\\|?*]/g, "-")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.toLowerCase();
	}

	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		try {
			await mkdir(dirPath, { recursive: true });
		} catch (error) {
			// Directory creation failed, ignore
		}
	}

	private parseConfig(content: string): BacklogConfig {
		const config: Partial<BacklogConfig> = {};
		const lines = content.split("\n");

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			const colonIndex = trimmed.indexOf(":");
			if (colonIndex === -1) continue;

			const key = trimmed.substring(0, colonIndex).trim();
			const value = trimmed.substring(colonIndex + 1).trim();

			switch (key) {
				case "project_name":
					config.projectName = value.replace(/['"]/g, "");
					break;
				case "default_assignee":
					config.defaultAssignee = value.replace(/['"]/g, "");
					break;
				case "default_reporter":
					config.defaultReporter = value.replace(/['"]/g, "");
					break;
				case "default_status":
					config.defaultStatus = value.replace(/['"]/g, "");
					break;
				case "statuses":
				case "labels":
				case "milestones":
					if (value.startsWith("[") && value.endsWith("]")) {
						const arrayContent = value.slice(1, -1);
						config[key] = arrayContent
							.split(",")
							.map((item) => item.trim().replace(/['"]/g, ""))
							.filter(Boolean);
					}
					break;
				case "date_format":
					config.dateFormat = value.replace(/['"]/g, "");
					break;
				case "max_column_width":
					config.maxColumnWidth = Number.parseInt(value, 10);
					break;
			}
		}

		return {
			projectName: config.projectName || "",
			defaultAssignee: config.defaultAssignee,
			defaultReporter: config.defaultReporter,
			statuses: config.statuses || [...DEFAULT_STATUSES],
			labels: config.labels || [],
			milestones: config.milestones || [],
			defaultStatus: config.defaultStatus,
			dateFormat: config.dateFormat || "yyyy-mm-dd",
			maxColumnWidth: config.maxColumnWidth,
		};
	}

	private serializeConfig(config: BacklogConfig): string {
		const lines = [
			`project_name: "${config.projectName}"`,
			...(config.defaultAssignee ? [`default_assignee: "${config.defaultAssignee}"`] : []),
			...(config.defaultReporter ? [`default_reporter: "${config.defaultReporter}"`] : []),
			...(config.defaultStatus ? [`default_status: "${config.defaultStatus}"`] : []),
			`statuses: [${config.statuses.map((s) => `"${s}"`).join(", ")}]`,
			`labels: [${config.labels.map((l) => `"${l}"`).join(", ")}]`,
			`milestones: [${config.milestones.map((m) => `"${m}"`).join(", ")}]`,
			`date_format: ${config.dateFormat}`,
			...(config.maxColumnWidth ? [`max_column_width: ${config.maxColumnWidth}`] : []),
		];

		return `${lines.join("\n")}\n`;
	}
}
