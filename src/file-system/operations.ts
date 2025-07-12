import { mkdir, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES, DEFAULT_STATUSES } from "../constants/index.ts";
import { parseDecision, parseDocument, parseTask } from "../markdown/parser.ts";
import { serializeDecision, serializeDocument, serializeTask } from "../markdown/serializer.ts";
import type { BacklogConfig, Decision, Document, Task } from "../types/index.ts";
import { getTaskFilename, getTaskPath } from "../utils/task-path.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
	};
}

export class FileSystem {
	private backlogDir: string;
	private projectRoot: string;
	private cachedConfig: BacklogConfig | null = null;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
		this.backlogDir = join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
	}

	private async getBacklogDir(): Promise<string> {
		if (!this.cachedConfig) {
			this.cachedConfig = await this.loadConfigDirect();
		}
		const configuredDir = this.cachedConfig?.backlogDirectory || DEFAULT_DIRECTORIES.BACKLOG;
		return join(this.projectRoot, configuredDir);
	}

	private async loadConfigDirect(): Promise<BacklogConfig | null> {
		try {
			const configPath = join(this.projectRoot, DEFAULT_DIRECTORIES.BACKLOG, DEFAULT_FILES.CONFIG);

			// Check if file exists first to avoid hanging on Windows
			const file = Bun.file(configPath);
			const exists = await file.exists();

			if (!exists) {
				return null;
			}

			const content = await file.text();
			const config = this.parseConfig(content);

			// If config exists but has no backlogDirectory field, this is a legacy config
			// Set it to .backlog for backward compatibility and save it
			if (config && config.backlogDirectory === undefined) {
				config.backlogDirectory = ".backlog";
				await this.saveConfig(config);
			}

			return config;
		} catch (_error) {
			return null;
		}
	}

	// Public accessors for directory paths
	get tasksDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.TASKS);
	}

	get draftsDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.DRAFTS);
	}

	get completedDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.COMPLETED);
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

	private async getTasksDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.TASKS);
	}

	async getDraftsDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.DRAFTS);
	}

	async getArchiveTasksDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_TASKS);
	}

	private async getArchiveDraftsDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_DRAFTS);
	}

	private async getDecisionsDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.DECISIONS);
	}

	private async getDocsDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.DOCS);
	}

	private async getCompletedDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.COMPLETED);
	}

	async ensureBacklogStructure(): Promise<void> {
		const backlogDir = await this.getBacklogDir();
		const directories = [
			backlogDir,
			join(backlogDir, DEFAULT_DIRECTORIES.TASKS),
			join(backlogDir, DEFAULT_DIRECTORIES.DRAFTS),
			join(backlogDir, DEFAULT_DIRECTORIES.COMPLETED),
			join(backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_TASKS),
			join(backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_DRAFTS),
			join(backlogDir, DEFAULT_DIRECTORIES.DOCS),
			join(backlogDir, DEFAULT_DIRECTORIES.DECISIONS),
		];

		for (const dir of directories) {
			await mkdir(dir, { recursive: true });
		}
	}

	// Task operations
	async saveTask(task: Task): Promise<string> {
		const taskId = task.id.startsWith("task-") ? task.id : `task-${task.id}`;
		const filename = `${taskId} - ${this.sanitizeFilename(task.title)}.md`;
		const tasksDir = await this.getTasksDir();
		const filepath = join(tasksDir, filename);
		const content = serializeTask(task);

		// Delete any existing task files with the same ID but different filenames
		try {
			const core = { filesystem: { tasksDir } };
			const existingPath = await getTaskPath(taskId, core as TaskPathContext);
			if (existingPath && !existingPath.endsWith(filename)) {
				await unlink(existingPath);
			}
		} catch {
			// Ignore errors if no existing files found
		}

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
		return filepath;
	}

	async loadTask(taskId: string): Promise<Task | null> {
		try {
			const tasksDir = await this.getTasksDir();
			const core = { filesystem: { tasksDir } };
			const filepath = await getTaskPath(taskId, core as TaskPathContext);

			if (!filepath) return null;

			const content = await Bun.file(filepath).text();
			return parseTask(content);
		} catch (_error) {
			return null;
		}
	}

	async listTasks(): Promise<Task[]> {
		try {
			const tasksDir = await this.getTasksDir();
			const taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: tasksDir }));

			const tasks: Task[] = [];
			for (const file of taskFiles) {
				const filepath = join(tasksDir, file);
				const content = await Bun.file(filepath).text();
				tasks.push(parseTask(content));
			}

			return sortByTaskId(tasks);
		} catch (_error) {
			return [];
		}
	}

	async listCompletedTasks(): Promise<Task[]> {
		try {
			const completedDir = await this.getCompletedDir();
			const taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: completedDir }));

			const tasks: Task[] = [];
			for (const file of taskFiles) {
				const filepath = join(completedDir, file);
				const content = await Bun.file(filepath).text();
				tasks.push(parseTask(content));
			}

			return sortByTaskId(tasks);
		} catch (_error) {
			return [];
		}
	}

	async archiveTask(taskId: string): Promise<boolean> {
		try {
			const tasksDir = await this.getTasksDir();
			const archiveTasksDir = await this.getArchiveTasksDir();
			const core = { filesystem: { tasksDir } };
			const sourcePath = await getTaskPath(taskId, core as TaskPathContext);
			const taskFile = await getTaskFilename(taskId, core as TaskPathContext);

			if (!sourcePath || !taskFile) return false;

			const targetPath = join(archiveTasksDir, taskFile);

			// Ensure target directory exists
			await this.ensureDirectoryExists(dirname(targetPath));

			// Use rename for proper Git move detection
			await rename(sourcePath, targetPath);

			return true;
		} catch (_error) {
			return false;
		}
	}

	async completeTask(taskId: string): Promise<boolean> {
		try {
			const tasksDir = await this.getTasksDir();
			const completedDir = await this.getCompletedDir();
			const core = { filesystem: { tasksDir } };
			const sourcePath = await getTaskPath(taskId, core as TaskPathContext);
			const taskFile = await getTaskFilename(taskId, core as TaskPathContext);

			if (!sourcePath || !taskFile) return false;

			const targetPath = join(completedDir, taskFile);

			// Ensure target directory exists
			await this.ensureDirectoryExists(dirname(targetPath));

			// Use rename for proper Git move detection
			await rename(sourcePath, targetPath);

			return true;
		} catch (_error) {
			return false;
		}
	}

	async archiveDraft(taskId: string): Promise<boolean> {
		try {
			const draftsDir = await this.getDraftsDir();
			const archiveDraftsDir = await this.getArchiveDraftsDir();
			const core = { filesystem: { tasksDir: draftsDir } };
			const sourcePath = await getTaskPath(taskId, core as TaskPathContext);
			const taskFile = await getTaskFilename(taskId, core as TaskPathContext);

			if (!sourcePath || !taskFile) return false;

			const targetPath = join(archiveDraftsDir, taskFile);

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
			const draftsDir = await this.getDraftsDir();
			const tasksDir = await this.getTasksDir();
			const core = { filesystem: { tasksDir: draftsDir } };
			const sourcePath = await getTaskPath(taskId, core as TaskPathContext);
			const taskFile = await getTaskFilename(taskId, core as TaskPathContext);

			if (!sourcePath || !taskFile) return false;

			const targetPath = join(tasksDir, taskFile);

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
			const tasksDir = await this.getTasksDir();
			const draftsDir = await this.getDraftsDir();
			const core = { filesystem: { tasksDir } };
			const sourcePath = await getTaskPath(taskId, core as TaskPathContext);
			const taskFile = await getTaskFilename(taskId, core as TaskPathContext);

			if (!sourcePath || !taskFile) return false;

			const targetPath = join(draftsDir, taskFile);

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
	async saveDraft(task: Task): Promise<string> {
		const taskId = task.id.startsWith("task-") ? task.id : `task-${task.id}`;
		const filename = `${taskId} - ${this.sanitizeFilename(task.title)}.md`;
		const draftsDir = await this.getDraftsDir();
		const filepath = join(draftsDir, filename);
		const content = serializeTask(task);

		try {
			const core = { filesystem: { tasksDir: draftsDir } };
			const existingPath = await getTaskPath(taskId, core as TaskPathContext);
			if (existingPath && !existingPath.endsWith(filename)) {
				await unlink(existingPath);
			}
		} catch {
			// Ignore errors if no existing files found
		}

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
		return filepath;
	}

	async loadDraft(taskId: string): Promise<Task | null> {
		try {
			const draftsDir = await this.getDraftsDir();
			const core = { filesystem: { tasksDir: draftsDir } };
			const filepath = await getTaskPath(taskId, core as TaskPathContext);

			if (!filepath) return null;

			const content = await Bun.file(filepath).text();
			return parseTask(content);
		} catch {
			return null;
		}
	}

	async listDrafts(): Promise<Task[]> {
		try {
			const draftsDir = await this.getDraftsDir();
			const taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: draftsDir }));

			const tasks: Task[] = [];
			for (const file of taskFiles) {
				const filepath = join(draftsDir, file);
				const content = await Bun.file(filepath).text();
				tasks.push(parseTask(content));
			}

			return sortByTaskId(tasks);
		} catch {
			return [];
		}
	}

	// Decision log operations
	async saveDecision(decision: Decision): Promise<void> {
		// Normalize ID - remove "decision-" prefix if present
		const normalizedId = decision.id.replace(/^decision-/, "");
		const filename = `decision-${normalizedId} - ${this.sanitizeFilename(decision.title)}.md`;
		const decisionsDir = await this.getDecisionsDir();
		const filepath = join(decisionsDir, filename);
		const content = serializeDecision(decision);

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
	}

	async loadDecision(decisionId: string): Promise<Decision | null> {
		try {
			const decisionsDir = await this.getDecisionsDir();
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: decisionsDir }));

			// Normalize ID - remove "decision-" prefix if present
			const normalizedId = decisionId.replace(/^decision-/, "");
			const decisionFile = files.find((file) => file.startsWith(`decision-${normalizedId} -`));

			if (!decisionFile) return null;

			const filepath = join(decisionsDir, decisionFile);
			const content = await Bun.file(filepath).text();
			return parseDecision(content);
		} catch (_error) {
			return null;
		}
	}

	// Document operations
	async saveDocument(document: Document, subPath = ""): Promise<void> {
		const docsDir = await this.getDocsDir();
		const dir = join(docsDir, subPath);
		// Normalize ID - remove "doc-" prefix if present
		const normalizedId = document.id.replace(/^doc-/, "");
		const filename = `doc-${normalizedId} - ${this.sanitizeFilename(document.title)}.md`;
		const filepath = join(dir, filename);
		const content = serializeDocument(document);

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
	}

	async listDecisions(): Promise<Decision[]> {
		try {
			const decisionsDir = await this.getDecisionsDir();
			const decisionFiles = await Array.fromAsync(new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir }));
			const decisions: Decision[] = [];
			for (const file of decisionFiles) {
				// Filter out README files as they're just instruction files
				if (file.toLowerCase().match(/^readme\.md$/i)) {
					continue;
				}
				const filepath = join(decisionsDir, file);
				const content = await Bun.file(filepath).text();
				decisions.push(parseDecision(content));
			}
			return sortByTaskId(decisions);
		} catch {
			return [];
		}
	}

	async listDocuments(): Promise<Document[]> {
		try {
			const docsDir = await this.getDocsDir();
			const docFiles = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: docsDir }));
			const docs: Document[] = [];
			for (const file of docFiles) {
				// Filter out README files as they're just instruction files
				if (file.toLowerCase().match(/^readme\.md$/i)) {
					continue;
				}
				const filepath = join(docsDir, file);
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
			const backlogDir = await this.getBacklogDir();
			const configPath = join(backlogDir, DEFAULT_FILES.CONFIG);

			// Check if file exists first to avoid hanging on Windows
			const file = Bun.file(configPath);
			const exists = await file.exists();

			if (!exists) {
				return null;
			}

			const content = await file.text();
			return this.parseConfig(content);
		} catch (_error) {
			return null;
		}
	}

	async saveConfig(config: BacklogConfig): Promise<void> {
		const backlogDir = await this.getBacklogDir();
		const configPath = join(backlogDir, DEFAULT_FILES.CONFIG);
		const content = this.serializeConfig(config);
		await Bun.write(configPath, content);
		this.cachedConfig = config;
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
			? join(homedir(), "backlog", DEFAULT_FILES.USER)
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
			? join(homedir(), "backlog", DEFAULT_FILES.USER)
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
			.replace(/^-|-$/g, "");
	}

	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		try {
			await mkdir(dirPath, { recursive: true });
		} catch (_error) {
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
				case "backlog_directory":
					config.backlogDirectory = value.replace(/["']/g, "");
					break;
				case "default_editor":
					config.defaultEditor = value.replace(/["']/g, "");
					break;
				case "auto_open_browser":
					config.autoOpenBrowser = value.toLowerCase() === "true";
					break;
				case "default_port":
					config.defaultPort = Number.parseInt(value, 10);
					break;
				case "remote_operations":
					config.remoteOperations = value.toLowerCase() === "true";
					break;
				case "auto_commit":
					config.autoCommit = value.toLowerCase() === "true";
					break;
				case "zero_padded_ids":
					config.zeroPaddedIds = Number.parseInt(value, 10);
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
			backlogDirectory: config.backlogDirectory,
			defaultEditor: config.defaultEditor,
			autoOpenBrowser: config.autoOpenBrowser,
			defaultPort: config.defaultPort,
			remoteOperations: config.remoteOperations,
			autoCommit: config.autoCommit,
			zeroPaddedIds: config.zeroPaddedIds,
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
			...(config.backlogDirectory ? [`backlog_directory: "${config.backlogDirectory}"`] : []),
			...(config.defaultEditor ? [`default_editor: "${config.defaultEditor}"`] : []),
			...(typeof config.autoOpenBrowser === "boolean" ? [`auto_open_browser: ${config.autoOpenBrowser}`] : []),
			...(config.defaultPort ? [`default_port: ${config.defaultPort}`] : []),
			...(typeof config.remoteOperations === "boolean" ? [`remote_operations: ${config.remoteOperations}`] : []),
			...(typeof config.autoCommit === "boolean" ? [`auto_commit: ${config.autoCommit}`] : []),
			...(config.zeroPaddedIds ? [`zero_padded_ids: ${config.zeroPaddedIds}`] : []),
		];

		return `${lines.join("\n")}\n`;
	}

	async listArchivedTasks(): Promise<Task[]> {
		try {
			const archiveTasksDir = await this.getArchiveTasksDir();
			const taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: archiveTasksDir }));

			const tasks: Task[] = [];
			for (const file of taskFiles) {
				const filepath = join(archiveTasksDir, file);
				const content = await Bun.file(filepath).text();
				tasks.push(parseTask(content));
			}

			return sortByTaskId(tasks);
		} catch (_error) {
			return [];
		}
	}
}
