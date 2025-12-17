import { mkdir, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES, DEFAULT_STATUSES } from "../constants/index.ts";
import { parseDecision, parseDocument, parseMilestone, parseTask } from "../markdown/parser.ts";
import { serializeDecision, serializeDocument, serializeTask } from "../markdown/serializer.ts";
import type { BacklogConfig, Decision, Document, Milestone, Task, TaskListFilter } from "../types/index.ts";
import { documentIdsEqual, normalizeDocumentId } from "../utils/document-id.ts";
import { getTaskFilename, getTaskPath, normalizeTaskId } from "../utils/task-path.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
	};
}

export class FileSystem {
	private readonly backlogDir: string;
	private readonly projectRoot: string;
	private cachedConfig: BacklogConfig | null = null;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
		this.backlogDir = join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
	}

	private async getBacklogDir(): Promise<string> {
		// Ensure migration is checked if needed
		if (!this.cachedConfig) {
			this.cachedConfig = await this.loadConfigDirect();
		}
		// Always use "backlog" as the directory name - no configuration needed
		return join(this.projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
	}

	private async loadConfigDirect(): Promise<BacklogConfig | null> {
		try {
			// First try the standard "backlog" directory
			let configPath = join(this.projectRoot, DEFAULT_DIRECTORIES.BACKLOG, DEFAULT_FILES.CONFIG);
			let file = Bun.file(configPath);
			let exists = await file.exists();

			// If not found, check for legacy ".backlog" directory and migrate it
			if (!exists) {
				const legacyBacklogDir = join(this.projectRoot, ".backlog");
				const legacyConfigPath = join(legacyBacklogDir, DEFAULT_FILES.CONFIG);
				const legacyFile = Bun.file(legacyConfigPath);
				const legacyExists = await legacyFile.exists();

				if (legacyExists) {
					// Migrate legacy .backlog directory to backlog
					const newBacklogDir = join(this.projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
					await rename(legacyBacklogDir, newBacklogDir);

					// Update paths to use the new location
					configPath = join(this.projectRoot, DEFAULT_DIRECTORIES.BACKLOG, DEFAULT_FILES.CONFIG);
					file = Bun.file(configPath);
					exists = true;
				}
			}

			if (!exists) {
				return null;
			}

			const content = await file.text();
			return this.parseConfig(content);
		} catch (_error) {
			if (process.env.DEBUG) {
				console.error("Error loading config:", _error);
			}
			return null;
		}
	}

	// Public accessors for directory paths
	get tasksDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.TASKS);
	}
	get completedDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.COMPLETED);
	}

	get archiveTasksDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_TASKS);
	}
	get decisionsDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.DECISIONS);
	}

	get docsDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.DOCS);
	}

	get milestonesDir(): string {
		return join(this.backlogDir, DEFAULT_DIRECTORIES.MILESTONES);
	}

	get configFilePath(): string {
		return join(this.backlogDir, DEFAULT_FILES.CONFIG);
	}

	/** Get the project root directory */
	get rootDir(): string {
		return this.projectRoot;
	}

	invalidateConfigCache(): void {
		this.cachedConfig = null;
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

	private async getMilestonesDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.MILESTONES);
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
		const taskId = normalizeTaskId(task.id);
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
			const task = parseTask(content);
			return { ...task, filePath: filepath };
		} catch (_error) {
			return null;
		}
	}

	async listTasks(filter?: TaskListFilter): Promise<Task[]> {
		let tasksDir: string;
		try {
			tasksDir = await this.getTasksDir();
		} catch (_error) {
			return [];
		}

		let taskFiles: string[];
		try {
			taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: tasksDir }));
		} catch (_error) {
			return [];
		}

		let tasks: Task[] = [];
		for (const file of taskFiles) {
			const filepath = join(tasksDir, file);
			try {
				const content = await Bun.file(filepath).text();
				const task = parseTask(content);
				tasks.push({ ...task, filePath: filepath });
			} catch (error) {
				if (process.env.DEBUG) {
					console.error(`Failed to parse task file ${filepath}`, error);
				}
			}
		}

		if (filter?.status) {
			const statusLower = filter.status.toLowerCase();
			tasks = tasks.filter((t) => t.status.toLowerCase() === statusLower);
		}

		if (filter?.assignee) {
			const assignee = filter.assignee;
			tasks = tasks.filter((t) => t.assignee.includes(assignee));
		}

		return sortByTaskId(tasks);
	}

	async listCompletedTasks(): Promise<Task[]> {
		let completedDir: string;
		try {
			completedDir = await this.getCompletedDir();
		} catch (_error) {
			return [];
		}

		let taskFiles: string[];
		try {
			taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: completedDir }));
		} catch (_error) {
			return [];
		}

		const tasks: Task[] = [];
		for (const file of taskFiles) {
			const filepath = join(completedDir, file);
			try {
				const content = await Bun.file(filepath).text();
				const task = parseTask(content);
				tasks.push({ ...task, filePath: filepath });
			} catch (error) {
				if (process.env.DEBUG) {
					console.error(`Failed to parse completed task file ${filepath}`, error);
				}
			}
		}

		return sortByTaskId(tasks);
	}

	async listArchivedTasks(): Promise<Task[]> {
		let archiveTasksDir: string;
		try {
			archiveTasksDir = await this.getArchiveTasksDir();
		} catch (_error) {
			return [];
		}

		let taskFiles: string[];
		try {
			taskFiles = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: archiveTasksDir }));
		} catch (_error) {
			return [];
		}

		const tasks: Task[] = [];
		for (const file of taskFiles) {
			const filepath = join(archiveTasksDir, file);
			try {
				const content = await Bun.file(filepath).text();
				const task = parseTask(content);
				tasks.push({ ...task, filePath: filepath });
			} catch (error) {
				if (process.env.DEBUG) {
					console.error(`Failed to parse archived task file ${filepath}`, error);
				}
			}
		}

		return sortByTaskId(tasks);
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
		const taskId = normalizeTaskId(task.id);
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
			const task = parseTask(content);
			return { ...task, filePath: filepath };
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
				const task = parseTask(content);
				tasks.push({ ...task, filePath: filepath });
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

		const matches = await Array.fromAsync(new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir }));
		for (const match of matches) {
			if (match === filename) continue;
			if (!match.startsWith(`decision-${normalizedId} -`)) continue;
			try {
				await unlink(join(decisionsDir, match));
			} catch {
				// Ignore cleanup errors
			}
		}

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
	}

	async loadDecision(decisionId: string): Promise<Decision | null> {
		try {
			const decisionsDir = await this.getDecisionsDir();
			const files = await Array.fromAsync(new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir }));

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
	async saveDocument(document: Document, subPath = ""): Promise<string> {
		const docsDir = await this.getDocsDir();
		const canonicalId = normalizeDocumentId(document.id);
		document.id = canonicalId;
		const filename = `${canonicalId} - ${this.sanitizeFilename(document.title)}.md`;
		const subPathSegments = subPath
			.split(/[\\/]+/)
			.map((segment) => segment.trim())
			.filter((segment) => segment.length > 0 && segment !== "." && segment !== "..");
		const relativePath = subPathSegments.length > 0 ? join(...subPathSegments, filename) : filename;
		const filepath = join(docsDir, relativePath);
		const content = serializeDocument(document);

		await this.ensureDirectoryExists(dirname(filepath));

		const glob = new Bun.Glob("**/doc-*.md");
		const existingMatches = await Array.fromAsync(glob.scan({ cwd: docsDir }));
		const matchesForId = existingMatches.filter((relative) => {
			const base = relative.split("/").pop() || relative;
			const [candidateId] = base.split(" - ");
			if (!candidateId) return false;
			return documentIdsEqual(canonicalId, candidateId);
		});

		let sourceRelativePath = document.path;
		if (!sourceRelativePath && matchesForId.length > 0) {
			sourceRelativePath = matchesForId[0];
		}

		if (sourceRelativePath && sourceRelativePath !== relativePath) {
			const sourcePath = join(docsDir, sourceRelativePath);
			try {
				await this.ensureDirectoryExists(dirname(filepath));
				await rename(sourcePath, filepath);
			} catch (error) {
				const code = (error as NodeJS.ErrnoException | undefined)?.code;
				if (code !== "ENOENT") {
					throw error;
				}
			}
		}

		for (const match of matchesForId) {
			const matchPath = join(docsDir, match);
			if (matchPath === filepath) {
				continue;
			}
			try {
				await unlink(matchPath);
			} catch {
				// Ignore cleanup errors - file may have been removed already
			}
		}

		await Bun.write(filepath, content);

		document.path = relativePath;
		return relativePath;
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
			// Recursively include all markdown files under docs, excluding README.md variants
			const glob = new Bun.Glob("**/*.md");
			const docFiles = await Array.fromAsync(glob.scan({ cwd: docsDir }));
			const docs: Document[] = [];
			for (const file of docFiles) {
				const base = file.split("/").pop() || file;
				if (base.toLowerCase() === "readme.md") continue;
				const filepath = join(docsDir, file);
				const content = await Bun.file(filepath).text();
				const parsed = parseDocument(content);
				docs.push({
					...parsed,
					path: file,
				});
			}

			// Stable sort by title for UI/CLI listing
			return docs.sort((a, b) => a.title.localeCompare(b.title));
		} catch {
			return [];
		}
	}

	async loadDocument(id: string): Promise<Document> {
		const documents = await this.listDocuments();
		const document = documents.find((doc) => documentIdsEqual(id, doc.id));
		if (!document) {
			throw new Error(`Document not found: ${id}`);
		}
		return document;
	}

	// Milestone operations
	async listMilestones(): Promise<Milestone[]> {
		try {
			const milestonesDir = await this.getMilestonesDir();
			const milestoneFiles = await Array.fromAsync(new Bun.Glob("m-*.md").scan({ cwd: milestonesDir }));
			const milestones: Milestone[] = [];
			for (const file of milestoneFiles) {
				// Filter out README files
				if (file.toLowerCase() === "readme.md") {
					continue;
				}
				const filepath = join(milestonesDir, file);
				const content = await Bun.file(filepath).text();
				milestones.push(parseMilestone(content));
			}
			// Sort by ID for consistent ordering
			return milestones.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
		} catch {
			return [];
		}
	}

	async loadMilestone(id: string): Promise<Milestone | null> {
		try {
			const milestonesDir = await this.getMilestonesDir();
			const files = await Array.fromAsync(new Bun.Glob("m-*.md").scan({ cwd: milestonesDir }));

			// Normalize ID - remove "m-" prefix if present
			const normalizedId = id.replace(/^m-/, "");
			const milestoneFile = files.find(
				(file) => file.startsWith(`m-${normalizedId} -`) || file === `m-${normalizedId}.md`,
			);

			if (!milestoneFile) return null;

			const filepath = join(milestonesDir, milestoneFile);
			const content = await Bun.file(filepath).text();
			return parseMilestone(content);
		} catch (_error) {
			return null;
		}
	}

	async createMilestone(title: string, description?: string): Promise<Milestone> {
		const milestonesDir = await this.getMilestonesDir();

		// Ensure milestones directory exists
		await mkdir(milestonesDir, { recursive: true });

		// Find next available milestone ID
		const existingFiles = await Array.fromAsync(new Bun.Glob("m-*.md").scan({ cwd: milestonesDir }));
		const existingIds = existingFiles
			.map((f) => {
				const match = f.match(/^m-(\d+)/);
				return match?.[1] ? Number.parseInt(match[1], 10) : -1;
			})
			.filter((id) => id >= 0);

		const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;
		const id = `m-${nextId}`;

		// Create safe filename from title
		const safeTitle = title
			.replace(/[<>:"/\\|?*]/g, "")
			.replace(/\s+/g, "-")
			.toLowerCase()
			.slice(0, 50);
		const filename = `${id} - ${safeTitle}.md`;

		// Build milestone content
		const content = `---
id: ${id}
title: "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"
---

## Description

${description || `Milestone: ${title}`}
`;

		const filepath = join(milestonesDir, filename);
		await Bun.write(filepath, content);

		return {
			id,
			title,
			description: description || `Milestone: ${title}`,
			rawContent: content,
		};
	}

	// Config operations
	async loadConfig(): Promise<BacklogConfig | null> {
		// Return cached config if available
		if (this.cachedConfig !== null) {
			return this.cachedConfig;
		}

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
			const config = this.parseConfig(content);

			// Cache the loaded config
			this.cachedConfig = config;
			return config;
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
		const primaryPath = global
			? join(homedir(), "backlog", DEFAULT_FILES.USER)
			: join(this.projectRoot, DEFAULT_FILES.USER);
		const fallbackPath = global ? join(this.projectRoot, "backlog", DEFAULT_FILES.USER) : undefined;
		const tryPaths = fallbackPath ? [primaryPath, fallbackPath] : [primaryPath];
		for (const filePath of tryPaths) {
			try {
				const content = await Bun.file(filePath).text();
				const result: Record<string, string> = {};
				for (const line of content.split(/\r?\n/)) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith("#")) continue;
					const idx = trimmed.indexOf(":");
					if (idx === -1) continue;
					const k = trimmed.substring(0, idx).trim();
					result[k] = trimmed
						.substring(idx + 1)
						.trim()
						.replace(/^['"]|['"]$/g, "");
				}
				return result;
			} catch {
				// Try next path (if any)
			}
		}
		return null;
	}

	private async saveUserSettings(settings: Record<string, string>, global = false): Promise<void> {
		const primaryPath = global
			? join(homedir(), "backlog", DEFAULT_FILES.USER)
			: join(this.projectRoot, DEFAULT_FILES.USER);
		const fallbackPath = global ? join(this.projectRoot, "backlog", DEFAULT_FILES.USER) : undefined;

		const lines = Object.entries(settings).map(([k, v]) => `${k}: ${v}`);
		const data = `${lines.join("\n")}\n`;

		try {
			await this.ensureDirectoryExists(dirname(primaryPath));
			await Bun.write(primaryPath, data);
			return;
		} catch {
			// Fall through to fallback when global write fails (e.g., sandboxed env)
		}

		if (fallbackPath) {
			await this.ensureDirectoryExists(dirname(fallbackPath));
			await Bun.write(fallbackPath, data);
		}
	}

	// Utility methods
	private sanitizeFilename(filename: string): string {
		// Remove path-unsafe characters, then strip noisy punctuation before normalizing whitespace
		return (
			filename
				.replace(/[<>:"/\\|?*]/g, "-")
				// biome-ignore lint/complexity/noUselessEscapeInRegex: we need explicit escapes inside the character class
				.replace(/['(),!@#$%^&+=\[\]{};]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "")
		);
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
				case "bypass_git_hooks":
					config.bypassGitHooks = value.toLowerCase() === "true";
					break;
				case "check_active_branches":
					config.checkActiveBranches = value.toLowerCase() === "true";
					break;
				case "active_branch_days":
					config.activeBranchDays = Number.parseInt(value, 10);
					break;
				case "onStatusChange":
				case "on_status_change":
					// Remove surrounding quotes if present, but preserve inner content
					config.onStatusChange = value.replace(/^['"]|['"]$/g, "");
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
			defaultEditor: config.defaultEditor,
			autoOpenBrowser: config.autoOpenBrowser,
			defaultPort: config.defaultPort,
			remoteOperations: config.remoteOperations,
			autoCommit: config.autoCommit,
			zeroPaddedIds: config.zeroPaddedIds,
			bypassGitHooks: config.bypassGitHooks,
			checkActiveBranches: config.checkActiveBranches,
			activeBranchDays: config.activeBranchDays,
			onStatusChange: config.onStatusChange,
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
			...(config.defaultEditor ? [`default_editor: "${config.defaultEditor}"`] : []),
			...(typeof config.autoOpenBrowser === "boolean" ? [`auto_open_browser: ${config.autoOpenBrowser}`] : []),
			...(config.defaultPort ? [`default_port: ${config.defaultPort}`] : []),
			...(typeof config.remoteOperations === "boolean" ? [`remote_operations: ${config.remoteOperations}`] : []),
			...(typeof config.autoCommit === "boolean" ? [`auto_commit: ${config.autoCommit}`] : []),
			...(typeof config.zeroPaddedIds === "number" ? [`zero_padded_ids: ${config.zeroPaddedIds}`] : []),
			...(typeof config.bypassGitHooks === "boolean" ? [`bypass_git_hooks: ${config.bypassGitHooks}`] : []),
			...(typeof config.checkActiveBranches === "boolean"
				? [`check_active_branches: ${config.checkActiveBranches}`]
				: []),
			...(typeof config.activeBranchDays === "number" ? [`active_branch_days: ${config.activeBranchDays}`] : []),
			...(config.onStatusChange ? [`onStatusChange: '${config.onStatusChange}'`] : []),
		];

		return `${lines.join("\n")}\n`;
	}
}
