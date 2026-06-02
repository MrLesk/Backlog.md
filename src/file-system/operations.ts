import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import matter from "gray-matter";
import lockfile from "proper-lockfile";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES, DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { parseDecision, parseDocument, parseMarkdown, parseMilestone, parseTask } from "../markdown/parser.ts";
import { serializeDecision, serializeDocument, serializeMilestone, serializeTask } from "../markdown/serializer.ts";
import type {
	BacklogConfig,
	Decision,
	DocsTreeNode,
	Document,
	Milestone,
	Task,
	TaskListFilter,
	WikiPage,
	WikiTreeNode,
} from "../types/index.ts";
import type { BacklogConfigSource } from "../utils/backlog-directory.ts";
import { normalizeProjectBacklogDirectory, resolveBacklogDirectory } from "../utils/backlog-directory.ts";
import { documentIdsEqual, normalizeDocumentId } from "../utils/document-id.ts";
import { normalizeDocumentRelativePath, normalizeDocumentSubPath } from "../utils/document-path.ts";
import {
	buildGlobPattern,
	extractAnyPrefix,
	generateNextId,
	idForFilename,
	normalizeId,
} from "../utils/prefix-config.ts";
import { getTaskFilename, getTaskPath, normalizeTaskIdentity, taskIdsEqual } from "../utils/task-path.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
	};
}

interface CreateLockOptions {
	timeoutMs?: number;
	retryDelayMs?: number;
	staleMs?: number;
}

const DEFAULT_CREATE_LOCK_TIMEOUT_MS = 30_000;
const DEFAULT_CREATE_LOCK_RETRY_DELAY_MS = 100;
const DEFAULT_CREATE_LOCK_STALE_MS = 10_000;

export const CREATE_LOCK_ERROR_CODE = "ECREATELOCK";
export const CREATE_LOCK_ERROR_MESSAGE =
	"Another task create/promote/demote operation is already in progress. Please try again.";

function createLockError(message: string, cause?: unknown): Error {
	const error = new Error(message, cause === undefined ? undefined : { cause }) as Error & { code?: string };
	error.name = "CreateLockError";
	error.code = CREATE_LOCK_ERROR_CODE;
	return error;
}

export function isCreateLockError(error: unknown): error is Error {
	return (
		error instanceof Error &&
		(error as Error & { code?: string }).code === CREATE_LOCK_ERROR_CODE &&
		error.name === "CreateLockError"
	);
}

export class FileSystem {
	private resolvedBacklogDir: string;
	private resolvedBacklogDirName: string;
	private resolvedConfigPath: string;
	private configSource: BacklogConfigSource;
	private readonly projectRoot: string;
	private cachedConfig: BacklogConfig | null = null;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
		const resolution = resolveBacklogDirectory(projectRoot);
		this.resolvedBacklogDirName = resolution.backlogDir ?? DEFAULT_DIRECTORIES.BACKLOG;
		this.resolvedBacklogDir = resolution.backlogPath ?? join(projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
		this.resolvedConfigPath = resolution.configPath ?? join(this.resolvedBacklogDir, DEFAULT_FILES.CONFIG);
		this.configSource = resolution.configSource ?? "folder";
	}

	private async getBacklogDir(): Promise<string> {
		return this.resolvedBacklogDir;
	}

	// Public accessors for directory paths
	get backlogDir(): string {
		return this.resolvedBacklogDir;
	}
	get backlogDirName(): string {
		return this.resolvedBacklogDirName;
	}
	get tasksDir(): string {
		return join(this.resolvedBacklogDir, DEFAULT_DIRECTORIES.TASKS);
	}
	get completedDir(): string {
		return join(this.resolvedBacklogDir, DEFAULT_DIRECTORIES.COMPLETED);
	}

	get archiveTasksDir(): string {
		return join(this.resolvedBacklogDir, DEFAULT_DIRECTORIES.ARCHIVE_TASKS);
	}
	get archiveMilestonesDir(): string {
		return join(this.resolvedBacklogDir, DEFAULT_DIRECTORIES.ARCHIVE_MILESTONES);
	}
	get decisionsDir(): string {
		return join(this.resolvedBacklogDir, DEFAULT_DIRECTORIES.DECISIONS);
	}

	get docsDir(): string {
		return join(this.resolvedBacklogDir, DEFAULT_DIRECTORIES.DOCS);
	}

	get milestonesDir(): string {
		return join(this.resolvedBacklogDir, DEFAULT_DIRECTORIES.MILESTONES);
	}

	get configFilePath(): string {
		return this.resolvedConfigPath;
	}

	/** Get the project root directory */
	get rootDir(): string {
		return this.projectRoot;
	}

	invalidateConfigCache(): void {
		this.cachedConfig = null;
		const resolution = resolveBacklogDirectory(this.projectRoot);
		this.resolvedBacklogDirName = resolution.backlogDir ?? DEFAULT_DIRECTORIES.BACKLOG;
		this.resolvedBacklogDir = resolution.backlogPath ?? join(this.projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
		this.resolvedConfigPath = resolution.configPath ?? join(this.resolvedBacklogDir, DEFAULT_FILES.CONFIG);
		this.configSource = resolution.configSource ?? "folder";
	}

	setBacklogDirectory(backlogDir: string): void {
		const normalized = normalizeProjectBacklogDirectory(backlogDir);
		if (!normalized) {
			throw new Error("Backlog directory must be a project-relative path.");
		}
		this.resolvedBacklogDirName = normalized;
		this.resolvedBacklogDir = join(this.projectRoot, normalized);
		if (this.configSource === "folder") {
			this.resolvedConfigPath = join(this.resolvedBacklogDir, DEFAULT_FILES.CONFIG);
		}
	}

	setConfigLocation(configSource: BacklogConfigSource): void {
		this.configSource = configSource;
		this.resolvedConfigPath =
			configSource === "root"
				? join(this.projectRoot, DEFAULT_FILES.ROOT_CONFIG)
				: join(this.resolvedBacklogDir, DEFAULT_FILES.CONFIG);
	}

	resolveBacklogDirectoryInfo() {
		return resolveBacklogDirectory(this.projectRoot);
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

	private async getArchiveMilestonesDir(): Promise<string> {
		const backlogDir = await this.getBacklogDir();
		return join(backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_MILESTONES);
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
			join(backlogDir, DEFAULT_DIRECTORIES.MILESTONES),
			join(backlogDir, DEFAULT_DIRECTORIES.ARCHIVE_MILESTONES),
			join(backlogDir, DEFAULT_DIRECTORIES.DOCS),
			join(backlogDir, DEFAULT_DIRECTORIES.DECISIONS),
		];

		for (const dir of directories) {
			await mkdir(dir, { recursive: true });
		}
	}

	private toCreateLockError(error: unknown): Error {
		if (isCreateLockError(error)) {
			return error;
		}

		const code = (error as NodeJS.ErrnoException | undefined)?.code;
		if (code === "ELOCKED") {
			return createLockError(CREATE_LOCK_ERROR_MESSAGE, error);
		}
		if (code === "ECOMPROMISED") {
			return createLockError("Task creation lock was interrupted. Please try again.", error);
		}
		return error instanceof Error ? error : new Error(String(error));
	}

	// Uses a maintained lockfile with stale-lock recovery; USE_GLOBAL_TASK_ID_LOCK=false restores legacy behavior.
	async withCreateLock<T>(fn: () => Promise<T>, options: CreateLockOptions = {}): Promise<T> {
		if (process.env.USE_GLOBAL_TASK_ID_LOCK?.toLowerCase() === "false") {
			return await fn();
		}

		const backlogDir = await this.getBacklogDir();
		const locksDir = join(backlogDir, ".locks");
		const lockDir = join(locksDir, "create");
		const timeoutMs = options.timeoutMs ?? DEFAULT_CREATE_LOCK_TIMEOUT_MS;
		const retryDelayMs = options.retryDelayMs ?? DEFAULT_CREATE_LOCK_RETRY_DELAY_MS;
		const staleMs = Math.max(options.staleMs ?? DEFAULT_CREATE_LOCK_STALE_MS, 2_000);
		const retries = Math.max(Math.ceil(timeoutMs / retryDelayMs) - 1, 0);

		await mkdir(locksDir, { recursive: true });

		let release: (() => Promise<void>) | undefined;
		try {
			release = await lockfile.lock(backlogDir, {
				lockfilePath: lockDir,
				realpath: true,
				stale: staleMs,
				retries: {
					retries,
					factor: 1,
					minTimeout: retryDelayMs,
					maxTimeout: retryDelayMs,
					randomize: false,
				},
			});
		} catch (error) {
			throw this.toCreateLockError(error);
		}

		try {
			const result = await fn();
			try {
				await release?.();
			} catch (error) {
				throw this.toCreateLockError(error);
			}
			return result;
		} catch (error) {
			if (release) {
				try {
					await release();
				} catch {
					// Preserve the original operation error if lock cleanup also fails.
				}
			}
			throw error;
		}
	}

	// Task operations
	async saveTask(task: Task): Promise<string> {
		// Extract prefix from task ID, or use configured prefix, or fall back to default "task"
		let prefix = extractAnyPrefix(task.id);
		if (!prefix) {
			const config = await this.loadConfig();
			prefix = config?.prefixes?.task ?? "task";
		}
		const taskId = normalizeId(task.id, prefix);
		const filename = `${idForFilename(taskId)} - ${this.sanitizeFilename(task.title)}.md`;
		const tasksDir = await this.getTasksDir();
		const shouldPreservePath = typeof task.filePath === "string" && task.filePath.trim().length > 0;
		const filepath = shouldPreservePath ? (task.filePath as string) : join(tasksDir, filename);
		let existingTask: Task | null = null;

		if (shouldPreservePath) {
			try {
				existingTask = parseTask(await Bun.file(filepath).text());
			} catch {
				existingTask = null;
			}
		}

		const persistedTaskId = existingTask?.id && taskIdsEqual(existingTask.id, task.id) ? existingTask.id : taskId;
		const normalizedParentTaskId = task.parentTaskId
			? normalizeId(task.parentTaskId, extractAnyPrefix(task.parentTaskId) ?? prefix)
			: undefined;
		const persistedParentTaskId =
			existingTask?.parentTaskId && task.parentTaskId && taskIdsEqual(existingTask.parentTaskId, task.parentTaskId)
				? existingTask.parentTaskId
				: normalizedParentTaskId;

		// Normalize new task IDs before serialization, but preserve existing file identity on updates.
		const normalizedTask = {
			...task,
			id: persistedTaskId,
			parentTaskId: persistedParentTaskId,
		};
		const content = serializeTask(normalizedTask);

		if (!shouldPreservePath) {
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
			const task = normalizeTaskIdentity(parseTask(content));
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

		// Get configured task prefix
		const config = await this.loadConfig();
		const taskPrefix = (config?.prefixes?.task ?? "task").toLowerCase();
		const globPattern = buildGlobPattern(taskPrefix);

		let taskFiles: string[];
		try {
			taskFiles = await Array.fromAsync(new Bun.Glob(globPattern).scan({ cwd: tasksDir, followSymlinks: true }));
		} catch (_error) {
			return [];
		}

		let tasks: Task[] = [];
		for (const file of taskFiles) {
			const filepath = join(tasksDir, file);
			try {
				const content = await Bun.file(filepath).text();
				const task = normalizeTaskIdentity(parseTask(content));
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

		// Get configured task prefix
		const config = await this.loadConfig();
		const taskPrefix = (config?.prefixes?.task ?? "task").toLowerCase();
		const globPattern = buildGlobPattern(taskPrefix);

		let taskFiles: string[];
		try {
			taskFiles = await Array.fromAsync(new Bun.Glob(globPattern).scan({ cwd: completedDir, followSymlinks: true }));
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

		// Get configured task prefix
		const config = await this.loadConfig();
		const taskPrefix = (config?.prefixes?.task ?? "task").toLowerCase();
		const globPattern = buildGlobPattern(taskPrefix);

		let taskFiles: string[];
		try {
			taskFiles = await Array.fromAsync(new Bun.Glob(globPattern).scan({ cwd: archiveTasksDir, followSymlinks: true }));
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

	async archiveDraft(draftId: string): Promise<boolean> {
		try {
			const draftsDir = await this.getDraftsDir();
			const archiveDraftsDir = await this.getArchiveDraftsDir();

			// Find draft file with draft- prefix
			const files = await Array.fromAsync(
				new Bun.Glob(buildGlobPattern("draft")).scan({ cwd: draftsDir, followSymlinks: true }),
			);
			const normalizedId = normalizeId(draftId, "draft");
			const filenameId = idForFilename(normalizedId);
			const draftFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));

			if (!draftFile) return false;

			const sourcePath = join(draftsDir, draftFile);
			const targetPath = join(archiveDraftsDir, draftFile);

			const content = await Bun.file(sourcePath).text();
			await this.ensureDirectoryExists(dirname(targetPath));
			await Bun.write(targetPath, content);

			await unlink(sourcePath);

			return true;
		} catch {
			return false;
		}
	}

	async promoteDraft(draftId: string): Promise<Task | false> {
		try {
			return await this.withCreateLock(async () => {
				// Load the draft
				const draft = await this.loadDraft(draftId);
				if (!draft?.filePath) return false;

				// Get task prefix from config (default: "task")
				const config = await this.loadConfig();
				const taskPrefix = config?.prefixes?.task ?? "task";

				// Get existing task IDs to generate next ID
				// Include both active and completed tasks to prevent ID collisions
				const existingTasks = await this.listTasks();
				const completedTasks = await this.listCompletedTasks();
				const existingIds = [...existingTasks, ...completedTasks].map((t) => t.id);

				// Generate new task ID
				const newTaskId = generateNextId(existingIds, taskPrefix, config?.zeroPaddedIds);

				const promotedStatus =
					!draft.status || draft.status.trim().toLowerCase() === "draft"
						? config?.defaultStatus || FALLBACK_STATUS
						: draft.status;

				// Draft-only statuses should enter the normal task workflow.
				const promotedTask: Task = {
					...draft,
					id: newTaskId,
					status: promotedStatus,
					filePath: undefined, // Will be set by saveTask
				};

				await this.saveTask(promotedTask);

				// Delete old draft file
				await unlink(draft.filePath);

				// Load the saved task to get the full object with filePath
				const savedTask = await this.loadTask(newTaskId);
				return savedTask ?? promotedTask;
			});
		} catch (error) {
			if (isCreateLockError(error)) {
				throw error;
			}
			return false;
		}
	}

	async demoteTask(taskId: string): Promise<string | null> {
		try {
			return await this.withCreateLock(async () => {
				// Load the task
				const task = await this.loadTask(taskId);
				if (!task?.filePath) return null;

				// Get existing draft IDs to generate next ID
				// Draft prefix is always "draft" (not configurable like task prefix)
				const existingDrafts = await this.listDrafts();
				const existingIds = existingDrafts.map((d) => d.id);

				// Generate new draft ID
				const config = await this.loadConfig();
				const newDraftId = generateNextId(existingIds, "draft", config?.zeroPaddedIds);

				// Update task with new draft ID and save as draft
				const demotedDraft: Task = {
					...task,
					id: newDraftId,
					filePath: undefined, // Will be set by saveDraft
				};

				await this.saveDraft(demotedDraft);

				// Delete old task file
				await unlink(task.filePath);

				return newDraftId;
			});
		} catch (error) {
			if (isCreateLockError(error)) {
				throw error;
			}
			return null;
		}
	}

	// Draft operations
	async saveDraft(task: Task): Promise<string> {
		const draftId = normalizeId(task.id, "draft");
		const filename = `${idForFilename(draftId)} - ${this.sanitizeFilename(task.title)}.md`;
		const draftsDir = await this.getDraftsDir();
		const filepath = join(draftsDir, filename);
		// Normalize the draft ID to uppercase before serialization
		const normalizedTask = { ...task, id: draftId };
		const content = serializeTask(normalizedTask);

		try {
			// Find existing draft file with same ID but possibly different filename (e.g., title changed)
			const filenameId = idForFilename(draftId);
			const existingFiles = await Array.fromAsync(
				new Bun.Glob(buildGlobPattern("draft")).scan({ cwd: draftsDir, followSymlinks: true }),
			);
			const existingFile = existingFiles.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));
			if (existingFile && existingFile !== filename) {
				await unlink(join(draftsDir, existingFile));
			}
		} catch {
			// Ignore errors if no existing files found
		}

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);
		return filepath;
	}

	async loadDraft(draftId: string): Promise<Task | null> {
		try {
			const draftsDir = await this.getDraftsDir();
			// Search for draft files with draft- prefix
			const files = await Array.fromAsync(
				new Bun.Glob(buildGlobPattern("draft")).scan({ cwd: draftsDir, followSymlinks: true }),
			);
			const normalizedId = normalizeId(draftId, "draft");
			const filenameId = idForFilename(normalizedId);

			// Find matching draft file
			const draftFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));
			if (!draftFile) return null;

			const filepath = join(draftsDir, draftFile);
			const content = await Bun.file(filepath).text();
			const task = normalizeTaskIdentity(parseTask(content));
			return { ...task, filePath: filepath };
		} catch {
			return null;
		}
	}

	async listDrafts(): Promise<Task[]> {
		try {
			const draftsDir = await this.getDraftsDir();
			const taskFiles = await Array.fromAsync(
				new Bun.Glob(buildGlobPattern("draft")).scan({ cwd: draftsDir, followSymlinks: true }),
			);

			const tasks: Task[] = [];
			for (const file of taskFiles) {
				const filepath = join(draftsDir, file);
				const content = await Bun.file(filepath).text();
				const task = normalizeTaskIdentity(parseTask(content));
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

		const matches = await Array.fromAsync(
			new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir, followSymlinks: true }),
		);
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
			const files = await Array.fromAsync(
				new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir, followSymlinks: true }),
			);

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
		const normalizedSubPath = normalizeDocumentSubPath(subPath);
		const relativePath = normalizedSubPath ? `${normalizedSubPath}/${filename}` : filename;
		const filepath = join(docsDir, ...relativePath.split("/"));
		const content = serializeDocument(document);

		await this.ensureDirectoryExists(dirname(filepath));

		const glob = new Bun.Glob("**/doc-*.md");
		const existingMatches = (await Array.fromAsync(glob.scan({ cwd: docsDir, followSymlinks: true }))).map((relative) =>
			normalizeDocumentRelativePath(relative),
		);
		const matchesForId = existingMatches.filter((relative) => {
			const base = relative.split("/").pop() || relative;
			const [candidateId] = base.split(" - ");
			if (!candidateId) return false;
			return documentIdsEqual(canonicalId, candidateId);
		});

		let sourceRelativePath = document.path ? normalizeDocumentRelativePath(document.path) : undefined;
		if (!sourceRelativePath && matchesForId.length > 0) {
			sourceRelativePath = normalizeDocumentRelativePath(matchesForId[0] ?? "");
		}

		if (sourceRelativePath && sourceRelativePath !== relativePath) {
			const sourcePath = join(docsDir, ...sourceRelativePath.split("/"));
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
			const matchPath = join(docsDir, ...normalizeDocumentRelativePath(match).split("/"));
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
			const decisionFiles = await Array.fromAsync(
				new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir, followSymlinks: true }),
			);
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
			const docFiles = await Array.fromAsync(glob.scan({ cwd: docsDir, followSymlinks: true }));
			const docs: Document[] = [];
			for (const file of docFiles) {
				const relativePath = normalizeDocumentRelativePath(file);
				const base = relativePath.split("/").pop() || relativePath;
				if (base.toLowerCase() === "readme.md") continue;
				const filepath = join(docsDir, ...relativePath.split("/"));
				const content = await Bun.file(filepath).text();
				const parsed = parseDocument(content);
				docs.push({
					...parsed,
					path: relativePath,
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

	private buildMilestoneIdentifierKeys(identifier: string): Set<string> {
		const normalized = identifier.trim().toLowerCase();
		const keys = new Set<string>();
		if (!normalized) {
			return keys;
		}

		keys.add(normalized);

		if (/^\d+$/.test(normalized)) {
			const numeric = String(Number.parseInt(normalized, 10));
			keys.add(numeric);
			keys.add(`m-${numeric}`);
			return keys;
		}

		const milestoneIdMatch = normalized.match(/^m-(\d+)$/);
		if (milestoneIdMatch?.[1]) {
			const numeric = String(Number.parseInt(milestoneIdMatch[1], 10));
			keys.add(numeric);
			keys.add(`m-${numeric}`);
		}

		return keys;
	}

	private buildMilestoneFilename(id: string, title: string): string {
		const safeTitle = title
			.replace(/[<>:"/\\|?*]/g, "")
			.replace(/\s+/g, "-")
			.toLowerCase()
			.slice(0, 50);
		return `${id} - ${safeTitle}.md`;
	}

	private serializeMilestoneContent(milestone: Milestone): string {
		return serializeMilestone(milestone);
	}

	private rewriteDefaultMilestoneDescription(rawContent: string, previousTitle: string, nextTitle: string): string {
		const defaultDescription = `Milestone: ${previousTitle}`;
		const descriptionSectionPattern = /(##\s+Description\s*(?:\r?\n)+)([\s\S]*?)(?=(?:\r?\n)##\s+|$)/i;

		return rawContent.replace(descriptionSectionPattern, (fullSection, heading: string, body: string) => {
			if (body.trim() !== defaultDescription) {
				return fullSection;
			}
			const trailingWhitespace = body.match(/\s*$/)?.[0] ?? "";
			return `${heading}Milestone: ${nextTitle}${trailingWhitespace}`;
		});
	}

	private async findMilestoneFile(
		identifier: string,
		scope: "active" | "archived" = "active",
	): Promise<{
		file: string;
		filepath: string;
		content: string;
		milestone: Milestone;
	} | null> {
		const normalizedInput = identifier.trim().toLowerCase();
		const candidateKeys = this.buildMilestoneIdentifierKeys(identifier);
		if (candidateKeys.size === 0) {
			return null;
		}
		const variantKeys = new Set<string>(candidateKeys);
		variantKeys.delete(normalizedInput);
		const canonicalInputId =
			/^\d+$/.test(normalizedInput) || /^m-\d+$/.test(normalizedInput)
				? `m-${String(Number.parseInt(normalizedInput.replace(/^m-/, ""), 10))}`
				: null;

		const milestonesDir = scope === "archived" ? await this.getArchiveMilestonesDir() : await this.getMilestonesDir();
		const milestoneFiles = await Array.fromAsync(
			new Bun.Glob("m-*.md").scan({ cwd: milestonesDir, followSymlinks: true }),
		);

		const rawExactIdMatches: Array<{ file: string; filepath: string; content: string; milestone: Milestone }> = [];
		const canonicalRawIdMatches: Array<{ file: string; filepath: string; content: string; milestone: Milestone }> = [];
		const exactAliasIdMatches: Array<{ file: string; filepath: string; content: string; milestone: Milestone }> = [];
		const exactTitleMatches: Array<{ file: string; filepath: string; content: string; milestone: Milestone }> = [];
		const variantIdMatches: Array<{ file: string; filepath: string; content: string; milestone: Milestone }> = [];
		const variantTitleMatches: Array<{ file: string; filepath: string; content: string; milestone: Milestone }> = [];

		for (const file of milestoneFiles) {
			if (file.toLowerCase() === "readme.md") {
				continue;
			}
			const filepath = join(milestonesDir, file);
			const content = await Bun.file(filepath).text();
			let milestone: Milestone;
			try {
				milestone = parseMilestone(content);
			} catch {
				continue;
			}
			const idKey = milestone.id.trim().toLowerCase();
			const idKeys = this.buildMilestoneIdentifierKeys(milestone.id);
			const titleKey = milestone.title.trim().toLowerCase();

			if (idKey === normalizedInput) {
				rawExactIdMatches.push({ file, filepath, content, milestone });
				continue;
			}
			if (canonicalInputId && idKey === canonicalInputId) {
				canonicalRawIdMatches.push({ file, filepath, content, milestone });
				continue;
			}
			if (idKeys.has(normalizedInput)) {
				exactAliasIdMatches.push({ file, filepath, content, milestone });
				continue;
			}
			if (titleKey === normalizedInput) {
				exactTitleMatches.push({ file, filepath, content, milestone });
				continue;
			}
			if (Array.from(idKeys).some((key) => variantKeys.has(key))) {
				variantIdMatches.push({ file, filepath, content, milestone });
				continue;
			}
			if (variantKeys.has(titleKey)) {
				variantTitleMatches.push({ file, filepath, content, milestone });
			}
		}

		const preferIdMatches = /^\d+$/.test(normalizedInput) || /^m-\d+$/.test(normalizedInput);
		const exactTitleMatch = exactTitleMatches.length === 1 ? exactTitleMatches[0] : null;
		const variantTitleMatch = variantTitleMatches.length === 1 ? variantTitleMatches[0] : null;
		const exactAliasIdMatch = exactAliasIdMatches.length === 1 ? exactAliasIdMatches[0] : null;
		const variantIdMatch = variantIdMatches.length === 1 ? variantIdMatches[0] : null;
		if (preferIdMatches) {
			return (
				rawExactIdMatches[0] ??
				canonicalRawIdMatches[0] ??
				exactAliasIdMatch ??
				variantIdMatch ??
				exactTitleMatch ??
				variantTitleMatch ??
				null
			);
		}
		return (
			rawExactIdMatches[0] ?? exactTitleMatch ?? canonicalRawIdMatches[0] ?? variantIdMatch ?? variantTitleMatch ?? null
		);
	}

	// Milestone operations
	async listMilestones(): Promise<Milestone[]> {
		try {
			const milestonesDir = await this.getMilestonesDir();
			const milestoneFiles = await Array.fromAsync(
				new Bun.Glob("m-*.md").scan({ cwd: milestonesDir, followSymlinks: true }),
			);
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

	async listArchivedMilestones(): Promise<Milestone[]> {
		try {
			const milestonesDir = await this.getArchiveMilestonesDir();
			const milestoneFiles = await Array.fromAsync(
				new Bun.Glob("m-*.md").scan({ cwd: milestonesDir, followSymlinks: true }),
			);
			const milestones: Milestone[] = [];
			for (const file of milestoneFiles) {
				if (file.toLowerCase() === "readme.md") {
					continue;
				}
				const filepath = join(milestonesDir, file);
				const content = await Bun.file(filepath).text();
				milestones.push(parseMilestone(content));
			}
			return milestones.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
		} catch {
			return [];
		}
	}

	async loadMilestone(id: string): Promise<Milestone | null> {
		try {
			const milestoneMatch = await this.findMilestoneFile(id, "active");
			return milestoneMatch?.milestone ?? null;
		} catch (_error) {
			return null;
		}
	}

	async createMilestone(
		title: string,
		description?: string,
		dueDate?: string,
		plannedStart?: string,
		plannedEnd?: string,
		actualStart?: string,
		actualEnd?: string,
	): Promise<Milestone> {
		return await this.withCreateLock(async () => {
			const milestonesDir = await this.getMilestonesDir();

			// Ensure milestones directory exists
			await mkdir(milestonesDir, { recursive: true });

			// Find next available milestone ID
			const archiveMilestonesDir = await this.getArchiveMilestonesDir();
			await mkdir(archiveMilestonesDir, { recursive: true });
			const [existingFiles, archivedFiles] = await Promise.all([
				Array.fromAsync(new Bun.Glob("m-*.md").scan({ cwd: milestonesDir, followSymlinks: true })),
				Array.fromAsync(new Bun.Glob("m-*.md").scan({ cwd: archiveMilestonesDir, followSymlinks: true })),
			]);
			const parseMilestoneId = async (dir: string, file: string): Promise<number | null> => {
				if (file.toLowerCase() === "readme.md") {
					return null;
				}
				const filepath = join(dir, file);
				try {
					const content = await Bun.file(filepath).text();
					const parsed = parseMilestone(content);
					const parsedIdMatch = parsed.id.match(/^m-(\d+)$/i);
					if (parsedIdMatch?.[1]) {
						return Number.parseInt(parsedIdMatch[1], 10);
					}
				} catch {
					// Fall through to filename-based fallback.
				}
				const filenameIdMatch = file.match(/^m-(\d+)/i);
				if (filenameIdMatch?.[1]) {
					return Number.parseInt(filenameIdMatch[1], 10);
				}
				return null;
			};
			const existingIds = (
				await Promise.all([
					...existingFiles.map((file) => parseMilestoneId(milestonesDir, file)),
					...archivedFiles.map((file) => parseMilestoneId(archiveMilestonesDir, file)),
				])
			).filter((id): id is number => typeof id === "number" && id >= 0);

			const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;
			const id = `m-${nextId}`;

			const filename = this.buildMilestoneFilename(id, title);
			const content = this.serializeMilestoneContent({
				id,
				title,
				description: description || `Milestone: ${title}`,
				rawContent: `## Description\n\n${description || `Milestone: ${title}`}`,
				...(dueDate !== undefined && { dueDate: dueDate.trim() || undefined }),
				...(plannedStart !== undefined && { plannedStart: plannedStart.trim() || undefined }),
				...(plannedEnd !== undefined && { plannedEnd: plannedEnd.trim() || undefined }),
				...(actualStart !== undefined && { actualStart: actualStart.trim() || undefined }),
				...(actualEnd !== undefined && { actualEnd: actualEnd.trim() || undefined }),
			});

			const filepath = join(milestonesDir, filename);
			await Bun.write(filepath, content);

			return {
				id,
				title,
				description: description || `Milestone: ${title}`,
				rawContent: parseMilestone(content).rawContent,
			};
		});
	}

	async updateMilestone(
		identifier: string,
		title: string,
		dueDate?: string,
		plannedStart?: string,
		plannedEnd?: string,
		description?: string,
		actualStart?: string,
		actualEnd?: string,
	): Promise<{
		success: boolean;
		sourcePath?: string;
		targetPath?: string;
		milestone?: Milestone;
		previousTitle?: string;
	}> {
		const normalizedTitle = title.trim();
		if (!normalizedTitle) {
			return { success: false };
		}

		let sourcePath: string | undefined;
		let targetPath: string | undefined;
		let movedFile = false;
		let originalContent: string | undefined;

		try {
			const milestoneMatch = await this.findMilestoneFile(identifier, "active");
			if (!milestoneMatch) {
				return { success: false };
			}

			const { milestone } = milestoneMatch;
			const milestonesDir = await this.getMilestonesDir();
			const targetFilename = this.buildMilestoneFilename(milestone.id, normalizedTitle);
			targetPath = join(milestonesDir, targetFilename);
			sourcePath = milestoneMatch.filepath;
			originalContent = milestoneMatch.content;
			let nextRawContent = this.rewriteDefaultMilestoneDescription(
				milestone.rawContent,
				milestone.title,
				normalizedTitle,
			);
			if (description !== undefined) {
				nextRawContent = nextRawContent.replace(
					/##\s+Description\s*(?:\r?\n)+([\s\S]*?)(?=\n##\s+|$)/i,
					`## Description\n\n${description}`,
				);
			}
			const updatedContent = this.serializeMilestoneContent({
				...milestone,
				title: normalizedTitle,
				description: parseMilestone(nextRawContent).description,
				rawContent: nextRawContent,
				...(dueDate !== undefined && { dueDate: dueDate.trim() || undefined }),
				...(plannedStart !== undefined && { plannedStart: plannedStart.trim() || undefined }),
				...(plannedEnd !== undefined && { plannedEnd: plannedEnd.trim() || undefined }),
				...(actualStart !== undefined && { actualStart: actualStart.trim() || undefined }),
				...(actualEnd !== undefined && { actualEnd: actualEnd.trim() || undefined }),
			});

			if (sourcePath !== targetPath) {
				if (await Bun.file(targetPath).exists()) {
					return { success: false };
				}
				await rename(sourcePath, targetPath);
				movedFile = true;
			}
			await Bun.write(targetPath, updatedContent);

			return {
				success: true,
				sourcePath,
				targetPath,
				milestone: parseMilestone(updatedContent),
				previousTitle: milestone.title,
			};
		} catch {
			try {
				if (movedFile && sourcePath && targetPath && sourcePath !== targetPath) {
					await rename(targetPath, sourcePath);
					if (originalContent) {
						await Bun.write(sourcePath, originalContent);
					}
				} else if (originalContent) {
					const restorePath = sourcePath ?? targetPath;
					if (restorePath) {
						await Bun.write(restorePath, originalContent);
					}
				}
			} catch {
				// Ignore rollback failures and surface operation failure to caller.
			}
			return { success: false };
		}
	}

	async archiveMilestone(identifier: string): Promise<{
		success: boolean;
		sourcePath?: string;
		targetPath?: string;
		milestone?: Milestone;
	}> {
		const normalized = identifier.trim();
		if (!normalized) {
			return { success: false };
		}

		try {
			const milestoneMatch = await this.findMilestoneFile(normalized, "active");
			if (!milestoneMatch) {
				return { success: false };
			}

			const archiveDir = await this.getArchiveMilestonesDir();
			const targetPath = join(archiveDir, milestoneMatch.file);
			await this.ensureDirectoryExists(dirname(targetPath));
			await rename(milestoneMatch.filepath, targetPath);

			return {
				success: true,
				sourcePath: milestoneMatch.filepath,
				targetPath,
				milestone: milestoneMatch.milestone,
			};
		} catch (_error) {
			return { success: false };
		}
	}

	// Config operations
	async loadConfig(): Promise<BacklogConfig | null> {
		// Return cached config if available
		if (this.cachedConfig !== null) {
			return this.cachedConfig;
		}

		try {
			const configPath = this.resolvedConfigPath;

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
		const normalizedConfig: BacklogConfig = {
			...config,
			...(this.configSource === "root" ? { backlogDirectory: this.resolvedBacklogDirName } : {}),
			definitionOfDone: this.normalizeDefinitionOfDone(config.definitionOfDone),
		};
		if (this.configSource === "folder") {
			delete normalizedConfig.backlogDirectory;
		}
		const configPath = this.resolvedConfigPath;
		const content = this.serializeConfig(normalizedConfig);
		await Bun.write(configPath, content);
		this.cachedConfig = normalizedConfig;
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
		const parsedDefinitionOfDone = this.parseDefinitionOfDone(content);
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
					if (value.startsWith("[") && value.endsWith("]")) {
						const arrayContent = value.slice(1, -1);
						config[key] = arrayContent
							.split(",")
							.map((item) => item.trim().replace(/['"]/g, ""))
							.filter(Boolean);
					}
					break;
				case "definition_of_done":
					if (parsedDefinitionOfDone !== undefined) {
						config.definitionOfDone = parsedDefinitionOfDone;
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
				case "filesystem_only":
				case "filesystemOnly":
					config.filesystemOnly = value.toLowerCase() === "true";
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
				case "task_prefix":
					config.prefixes = { task: value.replace(/['"]/g, "") };
					break;
				case "backlog_directory":
				case "backlogDirectory":
					config.backlogDirectory = value.replace(/['"]/g, "");
					break;
				case "locale":
					config.locale = value.replace(/['"]/g, "");
					break;
			}
		}

		return {
			projectName: config.projectName || "",
			defaultAssignee: config.defaultAssignee,
			defaultReporter: config.defaultReporter,
			statuses: config.statuses || [...DEFAULT_STATUSES],
			labels: config.labels || [],
			definitionOfDone: config.definitionOfDone,
			defaultStatus: config.defaultStatus,
			dateFormat: config.dateFormat || "yyyy-mm-dd",
			maxColumnWidth: config.maxColumnWidth,
			defaultEditor: config.defaultEditor,
			autoOpenBrowser: config.autoOpenBrowser,
			defaultPort: config.defaultPort,
			remoteOperations: config.remoteOperations,
			autoCommit: config.autoCommit,
			filesystemOnly: config.filesystemOnly,
			zeroPaddedIds: config.zeroPaddedIds,
			bypassGitHooks: config.bypassGitHooks,
			checkActiveBranches: config.checkActiveBranches,
			activeBranchDays: config.activeBranchDays,
			onStatusChange: config.onStatusChange,
			prefixes: config.prefixes,
			backlogDirectory: config.backlogDirectory,
			locale: config.locale,
		};
	}

	private serializeConfig(config: BacklogConfig): string {
		const normalizedDefinitionOfDone = this.normalizeDefinitionOfDone(config.definitionOfDone);
		const lines = [
			`project_name: "${config.projectName}"`,
			...(config.defaultAssignee ? [`default_assignee: "${config.defaultAssignee}"`] : []),
			...(config.defaultReporter ? [`default_reporter: "${config.defaultReporter}"`] : []),
			...(config.defaultStatus ? [`default_status: "${config.defaultStatus}"`] : []),
			`statuses: [${config.statuses.map((s) => `"${s}"`).join(", ")}]`,
			`labels: [${config.labels.map((l) => `"${l}"`).join(", ")}]`,
			...(Array.isArray(normalizedDefinitionOfDone)
				? [`definition_of_done: [${normalizedDefinitionOfDone.map((item) => JSON.stringify(item)).join(", ")}]`]
				: []),
			`date_format: ${config.dateFormat}`,
			...(config.maxColumnWidth ? [`max_column_width: ${config.maxColumnWidth}`] : []),
			...(config.defaultEditor ? [`default_editor: "${config.defaultEditor}"`] : []),
			...(typeof config.autoOpenBrowser === "boolean" ? [`auto_open_browser: ${config.autoOpenBrowser}`] : []),
			...(config.defaultPort ? [`default_port: ${config.defaultPort}`] : []),
			...(typeof config.remoteOperations === "boolean" ? [`remote_operations: ${config.remoteOperations}`] : []),
			...(typeof config.autoCommit === "boolean" ? [`auto_commit: ${config.autoCommit}`] : []),
			...(typeof config.filesystemOnly === "boolean" ? [`filesystem_only: ${config.filesystemOnly}`] : []),
			...(typeof config.zeroPaddedIds === "number" ? [`zero_padded_ids: ${config.zeroPaddedIds}`] : []),
			...(typeof config.bypassGitHooks === "boolean" ? [`bypass_git_hooks: ${config.bypassGitHooks}`] : []),
			...(typeof config.checkActiveBranches === "boolean"
				? [`check_active_branches: ${config.checkActiveBranches}`]
				: []),
			...(typeof config.activeBranchDays === "number" ? [`active_branch_days: ${config.activeBranchDays}`] : []),
			...(config.onStatusChange ? [`onStatusChange: '${config.onStatusChange}'`] : []),
			...(config.prefixes?.task ? [`task_prefix: "${config.prefixes.task}"`] : []),
			...(config.backlogDirectory ? [`backlog_directory: "${config.backlogDirectory}"`] : []),
			...(config.locale ? [`locale: "${config.locale}"`] : []),
		];

		return `${lines.join("\n")}\n`;
	}

	private parseDefinitionOfDone(content: string): string[] | undefined {
		const definitionOfDoneYaml = this.extractDefinitionOfDoneYaml(content);
		const legacyEscapedDefinitionOfDoneYaml = definitionOfDoneYaml
			? this.escapeLegacyDefinitionOfDoneBackslashes(definitionOfDoneYaml)
			: undefined;
		if (legacyEscapedDefinitionOfDoneYaml) {
			const parsedLegacyDefinitionOfDone = this.parseDefinitionOfDoneFromYaml(legacyEscapedDefinitionOfDoneYaml);
			if (parsedLegacyDefinitionOfDone !== undefined) {
				return parsedLegacyDefinitionOfDone;
			}
		}

		const parsedFromDocument = this.parseDefinitionOfDoneFromYaml(content);
		if (parsedFromDocument !== undefined) {
			return parsedFromDocument;
		}

		// Some legacy config values are accepted by the line parser but are not valid YAML.
		return definitionOfDoneYaml ? this.parseDefinitionOfDoneFromYaml(definitionOfDoneYaml) : undefined;
	}

	private parseDefinitionOfDoneFromYaml(content: string): string[] | undefined {
		try {
			const data = matter(`---\n${content.trimEnd()}\n---\n`).data as Record<string, unknown>;
			if (!Object.hasOwn(data, "definition_of_done")) {
				return undefined;
			}

			const definitionOfDone = data.definition_of_done;
			if (definitionOfDone === null) {
				return [];
			}

			return this.normalizeDefinitionOfDone(definitionOfDone);
		} catch {
			return undefined;
		}
	}

	private extractDefinitionOfDoneYaml(content: string): string | undefined {
		const lines = content.split(/\r?\n/);
		const keyPattern = /^(\s*)definition_of_done\s*:/;
		const topLevelKeyPattern = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:/;
		const startIndex = lines.findIndex((line) => keyPattern.test(line));
		if (startIndex === -1) {
			return undefined;
		}

		const startLine = lines[startIndex];
		const startIndent = startLine?.match(keyPattern)?.[1]?.length ?? 0;
		const collected: string[] = [];

		for (let index = startIndex; index < lines.length; index++) {
			const line = lines[index] ?? "";
			const trimmed = line.trim();
			const indent = line.length - line.trimStart().length;
			const isNextTopLevelKey =
				index > startIndex && trimmed.length > 0 && indent <= startIndent && topLevelKeyPattern.test(line);

			if (isNextTopLevelKey) {
				break;
			}

			collected.push(line);
		}

		return collected.join("\n");
	}

	private escapeLegacyDefinitionOfDoneBackslashes(content: string): string | undefined {
		let escaped = "";
		let quote: "'" | '"' | undefined;
		let changed = false;

		for (let index = 0; index < content.length; index++) {
			const char = content[index];

			if (quote) {
				if (quote === '"' && char === "\\") {
					let slashCount = 1;
					while (content[index + slashCount] === "\\") {
						slashCount++;
					}

					const nextChar = content[index + slashCount];
					if (nextChar === '"' && slashCount % 2 === 1) {
						escaped += "\\".repeat(slashCount);
						escaped += nextChar;
						index += slashCount;
						continue;
					}

					const escapedSlashCount = slashCount % 2 === 1 ? slashCount + 1 : slashCount;
					escaped += "\\".repeat(escapedSlashCount);
					changed ||= escapedSlashCount !== slashCount;
					index += slashCount - 1;
					continue;
				}

				if (char === quote) {
					escaped += char;
					quote = undefined;
					continue;
				}

				escaped += char;
				continue;
			}

			if (char === "'" || char === '"') {
				escaped += char;
				quote = char;
				continue;
			}

			escaped += char;
		}

		return changed ? escaped : undefined;
	}

	async readProjectFile(rawPath: string): Promise<{
		content: string;
		path: string;
		lineStart?: number;
		lineEnd?: number;
		totalLines: number;
		isMarkdown: boolean;
	}> {
		const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

		const lineRangeMatch = rawPath.match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
		const filePath = lineRangeMatch?.[1] ?? rawPath;
		const lineStart = lineRangeMatch?.[2] ? Number.parseInt(lineRangeMatch[2], 10) : undefined;
		const lineEnd = lineRangeMatch?.[3] ? Number.parseInt(lineRangeMatch[3], 10) : lineStart;

		const rootDir = resolve(this.projectRoot);
		const targetPath = resolve(join(rootDir, filePath));

		// Robust containment check: reject traversal, absolute paths, and root itself
		const rel = relative(rootDir, targetPath);
		const isInside = !rel.startsWith("..") && !isAbsolute(rel);
		if (!isInside || isAbsolute(filePath)) {
			throw new Error("Access denied");
		}

		let fileStats: ReturnType<typeof stat> extends Promise<infer T> ? T : never;
		try {
			fileStats = await stat(targetPath);
		} catch {
			throw new Error("File not found");
		}
		if (fileStats.isDirectory()) {
			throw new Error("Path is a directory");
		}
		if (fileStats.size > MAX_FILE_SIZE) {
			throw new Error("File too large");
		}

		const file = Bun.file(targetPath);
		const fullContent = await file.text();
		const allLines = fullContent.split(/\r?\n/);
		const totalLines = allLines.length;

		let content: string;
		let start: number | undefined;
		let end: number | undefined;

		if (lineStart !== undefined && lineEnd !== undefined) {
			start = Math.max(1, lineStart);
			end = Math.min(totalLines, lineEnd);
			if (start > end) {
				throw new Error("Invalid line range");
			}
			content = allLines.slice(start - 1, end).join("\n");
		} else {
			content = fullContent;
		}

		const isMarkdown = targetPath.toLowerCase().endsWith(".md");

		return {
			content,
			path: filePath,
			lineStart: start,
			lineEnd: end,
			totalLines,
			isMarkdown,
		};
	}

	async listProjectFiles(rawPath: string): Promise<{ name: string; type: "file" | "directory" }[]> {
		const rootDir = resolve(this.projectRoot);
		const targetPath = resolve(join(rootDir, rawPath));

		// Robust containment check: reject traversal, absolute paths, and root itself
		const rel = relative(rootDir, targetPath);
		const isInside = !rel.startsWith("..") && !isAbsolute(rel);
		if (!isInside || isAbsolute(rawPath)) {
			throw new Error("Access denied");
		}

		let fileStats: ReturnType<typeof stat> extends Promise<infer T> ? T : never;
		try {
			fileStats = await stat(targetPath);
		} catch {
			throw new Error("Path not found");
		}
		if (!fileStats.isDirectory()) {
			throw new Error("Path is not a directory");
		}

		const entries = await readdir(targetPath, { withFileTypes: true });
		const results = entries
			.filter((entry) => entry.isFile() || entry.isDirectory())
			.map((entry) => ({
				name: entry.name,
				type: entry.isDirectory() ? ("directory" as const) : ("file" as const),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		return results;
	}

	async searchProjectFiles(query: string): Promise<{ name: string; path: string; type: "file" | "directory" }[]> {
		const MAX_RESULTS = 50;
		const rootDir = resolve(this.projectRoot);
		const lowerQuery = query.toLowerCase();
		const results: { name: string; path: string; type: "file" | "directory" }[] = [];

		const excludeDirs = new Set(["node_modules", ".git", "dist", "build", ".backlog", ".locks"]);

		const walk = async (dirPath: string, relPath: string): Promise<void> => {
			if (results.length >= MAX_RESULTS) return;
			const entries = await readdir(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				if (results.length >= MAX_RESULTS) return;
				if (entry.name.startsWith(".")) continue;
				const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
				if (entry.isDirectory()) {
					if (excludeDirs.has(entry.name)) continue;
					if (entry.name.toLowerCase().includes(lowerQuery)) {
						results.push({ name: entry.name, path: entryRelPath, type: "directory" });
					}
					await walk(join(dirPath, entry.name), entryRelPath);
				} else if (entry.isFile()) {
					if (entry.name.toLowerCase().includes(lowerQuery)) {
						results.push({ name: entry.name, path: entryRelPath, type: "file" });
					}
				}
			}
		};

		await walk(rootDir, "");
		return results;
	}

	async getWikiTree(): Promise<WikiTreeNode[]> {
		const wikiRoot = join(this.resolvedBacklogDir, "wiki");
		return this.buildWikiTreeRecursive(wikiRoot, "");
	}

	async listWikiPages(): Promise<WikiPage[]> {
		const wikiRoot = join(this.resolvedBacklogDir, "wiki");
		const pages: WikiPage[] = [];
		const walk = async (dirPath: string, relPath: string) => {
			const entries = await readdir(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
				if (entry.isDirectory()) {
					if (entry.name === "wiki_output") continue;
					await walk(join(dirPath, entry.name), entryRelPath);
				} else if (entry.isFile() && entry.name.endsWith(".md")) {
					try {
						pages.push(await this.readWikiPage(entryRelPath));
					} catch {
						// skip unreadable pages
					}
				}
			}
		};
		try {
			await walk(wikiRoot, "");
		} catch {
			// wiki directory may not exist
		}
		return pages;
	}

	private async buildWikiTreeRecursive(dirPath: string, relPath: string): Promise<WikiTreeNode[]> {
		const entries = await readdir(dirPath, { withFileTypes: true });
		const nodes: WikiTreeNode[] = [];
		for (const entry of entries) {
			const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				if (entry.name === "wiki_output") continue;
				const children = await this.buildWikiTreeRecursive(join(dirPath, entry.name), entryRelPath);
				nodes.push({ name: entry.name, path: entryRelPath, type: "directory", children });
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				nodes.push({ name: entry.name, path: entryRelPath, type: "file" });
			}
		}
		return nodes;
	}

	async getDocsTree(): Promise<DocsTreeNode[]> {
		const docsDir = await this.getDocsDir();
		return this.buildDocsTreeRecursive(docsDir, "");
	}

	private async buildDocsTreeRecursive(dirPath: string, relPath: string): Promise<DocsTreeNode[]> {
		const entries = await readdir(dirPath, { withFileTypes: true });
		const nodes: DocsTreeNode[] = [];
		for (const entry of entries) {
			const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				const children = await this.buildDocsTreeRecursive(join(dirPath, entry.name), entryRelPath);
				nodes.push({ name: entry.name, path: entryRelPath, type: "directory", children });
			} else if (entry.isFile() && entry.name.endsWith(".md") && entry.name.toLowerCase() !== "readme.md") {
				const base = entry.name.replace(/\.md$/i, "");
				const docId = base.split(" - ")[0] ?? "";
				nodes.push({ name: entry.name, path: entryRelPath, type: "file", docId });
			}
		}
		return nodes;
	}

	async createDocsFolder(folderPath: string): Promise<string> {
		const docsDir = await this.getDocsDir();
		const normalizedPath = normalizeDocumentSubPath(folderPath);
		const dirPath = resolve(join(docsDir, ...normalizedPath.split("/")));

		const rel = relative(docsDir, dirPath);
		const isInside = !rel.startsWith("..") && !isAbsolute(rel);
		if (!isInside) {
			throw new Error("Invalid docs path");
		}

		if (await Bun.file(dirPath).exists()) {
			throw new Error("Docs folder already exists");
		}

		await mkdir(dirPath, { recursive: true });
		return normalizedPath;
	}

	async readWikiPage(pagePath: string, rootDir?: string): Promise<WikiPage> {
		const normalizedPath = pagePath.endsWith(".md") ? pagePath : `${pagePath}.md`;
		const effectiveRoot = rootDir ? resolve(rootDir) : resolve(join(this.resolvedBacklogDir, "wiki"));
		const filePath = resolve(join(effectiveRoot, normalizedPath));

		// Containment check against the effective root
		const rel = relative(effectiveRoot, filePath);
		const isInside = !rel.startsWith("..") && !isAbsolute(rel);
		if (!isInside) {
			throw new Error("Page not found");
		}

		let fileStats: ReturnType<typeof stat> extends Promise<infer T> ? T : never;
		try {
			fileStats = await stat(filePath);
		} catch {
			throw new Error("Page not found");
		}
		if (fileStats.isDirectory()) {
			throw new Error("Page not found");
		}

		const file = Bun.file(filePath);
		const content = await file.text();
		const parsed = parseMarkdown(content);

		return {
			content: parsed.content,
			frontmatter: parsed.frontmatter,
			path: normalizedPath,
		};
	}

	async saveWikiPage(pagePath: string, content: string, title?: string, labels?: string[]): Promise<void> {
		const wikiRoot = resolve(join(this.resolvedBacklogDir, "wiki"));
		const normalizedPath = pagePath.endsWith(".md") ? pagePath : `${pagePath}.md`;
		const filePath = resolve(join(wikiRoot, normalizedPath));

		// Directory traversal containment check
		const rel = relative(wikiRoot, filePath);
		const isInside = !rel.startsWith("..") && !isAbsolute(rel);
		if (!isInside) {
			throw new Error("Invalid wiki path");
		}

		await this.ensureDirectoryExists(dirname(filePath));

		// Preserve existing frontmatter, update title, labels, and set updated_date
		let frontmatter: Record<string, unknown> = {};
		if (await Bun.file(filePath).exists()) {
			const existing = await Bun.file(filePath).text();
			const parsed = parseMarkdown(existing);
			frontmatter = (parsed.frontmatter as Record<string, unknown>) || {};
		}
		if (title !== undefined) {
			frontmatter.title = title;
		}
		if (labels !== undefined) {
			frontmatter.labels = labels;
		}
		const updatedDate = new Date().toISOString().slice(0, 16).replace("T", " ");
		frontmatter.updated_date = updatedDate;

		const fileContent = Object.keys(frontmatter).length > 0 ? matter.stringify(content, frontmatter) : content;
		await Bun.write(filePath, fileContent);
	}

	async createWikiPage(pagePath: string, content = "", labels?: string[]): Promise<string> {
		const wikiRoot = resolve(join(this.resolvedBacklogDir, "wiki"));
		const normalizedPath = pagePath.endsWith(".md") ? pagePath : `${pagePath}.md`;
		const filePath = resolve(join(wikiRoot, normalizedPath));

		// Directory traversal containment check
		const rel = relative(wikiRoot, filePath);
		const isInside = !rel.startsWith("..") && !isAbsolute(rel);
		if (!isInside) {
			throw new Error("Invalid wiki path");
		}

		// Prevent overwriting existing files
		if (await Bun.file(filePath).exists()) {
			throw new Error("Wiki page already exists");
		}

		await this.ensureDirectoryExists(dirname(filePath));
		const title = basename(normalizedPath, ".md");
		const defaultContent = content || `# ${title}\n\n`;
		const createdDate = new Date().toISOString().slice(0, 16).replace("T", " ");
		const frontmatter: Record<string, unknown> = { title, created_date: createdDate };
		if (labels !== undefined && labels.length > 0) {
			frontmatter.labels = labels;
		}
		const fileContent = matter.stringify(defaultContent, frontmatter);
		await Bun.write(filePath, fileContent);

		return normalizedPath;
	}

	async createWikiFolder(folderPath: string): Promise<string> {
		const wikiRoot = resolve(join(this.resolvedBacklogDir, "wiki"));
		const dirPath = resolve(join(wikiRoot, folderPath));

		// Directory traversal containment check
		const rel = relative(wikiRoot, dirPath);
		const isInside = !rel.startsWith("..") && !isAbsolute(rel);
		if (!isInside) {
			throw new Error("Invalid wiki path");
		}

		// Prevent overwriting existing files or directories
		if (await Bun.file(dirPath).exists()) {
			throw new Error("Wiki folder already exists");
		}

		await mkdir(dirPath, { recursive: true });
		return folderPath;
	}

	async renameWikiItem(oldPath: string, newPath: string): Promise<string> {
		const wikiRoot = resolve(join(this.resolvedBacklogDir, "wiki"));
		const oldFullPath = resolve(join(wikiRoot, oldPath));
		const newFullPath = resolve(join(wikiRoot, newPath));

		// Directory traversal containment check for both paths
		const oldRel = relative(wikiRoot, oldFullPath);
		const newRel = relative(wikiRoot, newFullPath);
		const oldIsInside = !oldRel.startsWith("..") && !isAbsolute(oldRel);
		const newIsInside = !newRel.startsWith("..") && !isAbsolute(newRel);
		if (!oldIsInside || !newIsInside) {
			throw new Error("Invalid wiki path");
		}

		// Source must exist (use stat to handle both files and directories)
		try {
			await stat(oldFullPath);
		} catch {
			throw new Error("Item not found");
		}

		// Destination must not exist
		try {
			await stat(newFullPath);
			throw new Error("Destination already exists");
		} catch (err: any) {
			if (err.message === "Destination already exists") throw err;
			// stat threw because file doesn't exist — that's what we want
		}

		// Ensure parent directory of destination exists
		await this.ensureDirectoryExists(dirname(newFullPath));
		await rename(oldFullPath, newFullPath);
		return newPath;
	}

	private normalizeDefinitionOfDone(definitionOfDone: unknown): string[] | undefined {
		if (!Array.isArray(definitionOfDone)) {
			return undefined;
		}

		return definitionOfDone
			.filter((item): item is string => typeof item === "string")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}
}
