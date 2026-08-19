import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import lockfile from "proper-lockfile";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES, DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { parseFrontmatter } from "../markdown/frontmatter.ts";
import { parseDecision, parseDocument, parseMilestone, parseTask } from "../markdown/parser.ts";
import { serializeDecision, serializeDocument, serializeTask } from "../markdown/serializer.ts";
import type { BacklogConfig, Decision, Document, Milestone, Task, TaskListFilter } from "../types/index.ts";
import type { BacklogConfigSource } from "../utils/backlog-directory.ts";
import {
	normalizeProjectBacklogDirectory,
	resolveBacklogDirectory,
	resolveBacklogDirectoryFromRootConfig,
} from "../utils/backlog-directory.ts";
import { findDecisionById } from "../utils/decision-id.ts";
import { documentIdsEqual, findDocumentById, normalizeDocumentId } from "../utils/document-id.ts";
import { normalizeDocumentRelativePath, normalizeDocumentSubPath } from "../utils/document-path.ts";
import {
	buildGlobPattern,
	extractAnyPrefix,
	generateNextId,
	idForFilename,
	normalizeId,
} from "../utils/prefix-config.ts";
import {
	AmbiguousTaskIdError,
	getTaskFilename,
	getTaskPath,
	isAmbiguousTaskIdError,
	normalizeTaskIdentity,
	taskIdsEqual,
} from "../utils/task-path.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";
import { matchesTaskTypeFilter } from "../utils/task-type-config.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
		completedDir?: string;
	};
}

interface CreateLockOptions {
	timeoutMs?: number;
	retryDelayMs?: number;
	staleMs?: number;
}

interface CreateLockTarget {
	targetPath: string;
	locksDir: string;
}

interface LockAttemptSettings {
	staleMs: number;
	retries: number;
	retryDelayMs: number;
}

/** Config keys stored as YAML lists. `default_assignee` also accepts a single scalar. */
type ConfigListKey = "statuses" | "labels" | "types" | "priorities" | "default_assignee";

/**
 * A mapping key line, whatever characters the name uses. Keys Backlog does not read still end the
 * previous key's block, so an unrelated `custom-setting:` cannot fold its value into the block being
 * extracted. A sequence item is not a key even when its text contains a colon.
 */
const CONFIG_KEY_LINE_PATTERN = /^\s*(?!-\s)[^\s#][^:]*:/;

/**
 * Extract the YAML block that carries one config key's value: its `key:` line plus the lines that
 * continue it, stopping at the next key written at the same or lower indentation. Returns nothing
 * when the key is absent. The last occurrence wins, which is what YAML does with a repeated key.
 *
 * A config key belongs at column 0, so an unindented line always outranks an indented look-alike:
 * without that rule a `statuses:` line nested inside another key's mapping or block scalar would
 * hijack the real key. Indented matches are used only when the key appears nowhere at column 0.
 */
function extractConfigKeyYaml(content: string, key: string): string | undefined {
	const lines = content.split(/\r?\n/);
	const keyPattern = new RegExp(`^(\\s*)${key}\\s*:`);
	const keyIndent = (line: string) => line.match(keyPattern)?.[1]?.length;
	const startIndex = lines.some((line) => keyIndent(line) === 0)
		? lines.findLastIndex((line) => keyIndent(line) === 0)
		: lines.findLastIndex((line) => keyIndent(line) !== undefined);
	if (startIndex === -1) {
		return undefined;
	}

	const startIndent = keyIndent(lines[startIndex] ?? "") ?? 0;
	const collected: string[] = [];

	for (let index = startIndex; index < lines.length; index++) {
		const line = lines[index] ?? "";
		const trimmed = line.trim();
		const indent = line.length - line.trimStart().length;
		const isNextKey =
			index > startIndex && trimmed.length > 0 && indent <= startIndent && CONFIG_KEY_LINE_PATTERN.test(line);

		if (isNextKey) {
			break;
		}

		collected.push(line);
	}

	return collected.join("\n");
}

const CONFIG_VALUE_ERROR_NAME = "ConfigValueError";

/** Reports a config value Backlog refuses to guess at, naming the file and the offending key. */
function configValueError(configPath: string, key: string, problem: string, remedy: string): Error {
	const error = new Error(
		`Backlog could not start because ${configPath} has an invalid value for "${key}"${problem ? `: ${problem}` : ""}. ${remedy}`,
	);
	error.name = CONFIG_VALUE_ERROR_NAME;
	return error;
}

/** Reports a value YAML could not read at all. */
function configSyntaxError(configPath: string, key: string, reason: unknown): Error {
	const detail = (reason instanceof Error ? reason.message : String(reason)).split("\n")[0]?.trim();
	return configValueError(
		configPath,
		key,
		detail ?? "",
		"Edit that key so its value is valid YAML, then run the command again.",
	);
}

/** Names the shape a rejected value turned out to have, for an error a person has to act on. */
function describeConfigValue(value: unknown): string {
	if (value === undefined) return "no value Backlog could read";
	switch (typeof value) {
		case "string":
			return "a scalar";
		case "number":
			return "a number";
		case "boolean":
			return "a boolean";
		default:
			return "a mapping";
	}
}

/** Reports a value YAML read fine but the key cannot hold, such as a scalar where a list belongs. */
function configTypeError(configPath: string, key: ConfigListKey, value: unknown): Error {
	const expected = key === "default_assignee" ? "a list or a single name" : "a list";
	return configValueError(
		configPath,
		key,
		`expected ${expected}, got ${describeConfigValue(value)}`,
		`Edit that key so its value is ${expected}, then run the command again.`,
	);
}

/** True when an error already explains an unreadable config value, so it needs no extra framing. */
export function isConfigValueError(error: unknown): error is Error {
	return error instanceof Error && error.name === CONFIG_VALUE_ERROR_NAME;
}

/** Read one key from a YAML document, reporting the parse error instead of a value when invalid. */
function readYamlKey(document: string, key: string): { value: unknown } | { error: unknown } {
	try {
		return { value: (Bun.YAML.parse(document) as Record<string, unknown> | null)?.[key] };
	} catch (error) {
		return { error };
	}
}

/**
 * Parse one list-valued config key as YAML, so quoting, escapes, block sequences, and trailing
 * comments are handled by the parser instead of by hand. The key's own block is what gets parsed, so a
 * malformed value for one key cannot change how another key reads; only a block YAML rejects outright
 * is reread in document context, where aliases resolve. Throws when neither read succeeds, and when the
 * value YAML read is not a shape the key can hold, so callers fail fast rather than proceed with a
 * guessed value. Returns nothing when the key is absent or carries no value; `default_assignee` also
 * accepts a single scalar name.
 */
function parseConfigListValue(content: string, key: ConfigListKey, configPath: string): string[] | undefined {
	const block = extractConfigKeyYaml(content, key);
	if (block === undefined) {
		return undefined;
	}

	const fromBlock = readYamlKey(block, key);
	let parsed: unknown;
	if ("value" in fromBlock) {
		parsed = fromBlock.value;
	} else {
		// An alias resolves only against the anchors defined elsewhere in the file, so a block YAML
		// rejects on its own gets one more read in document context before it counts as broken. The
		// document is never read first: doing that is what let one broken key change how another reads.
		const fromDocument = readYamlKey(content, key);
		if (!("value" in fromDocument)) {
			throw configSyntaxError(configPath, key, fromBlock.error);
		}
		parsed = fromDocument.value;
	}

	// `key:` with no value, including the first line of a block sequence.
	if (parsed === null) {
		return key === "default_assignee" ? [] : undefined;
	}
	if (Array.isArray(parsed)) {
		return parsed.map((item) => String(item).trim()).filter((item) => item.length > 0);
	}
	// A single name is the legacy spelling of a one-entry default_assignee.
	if (typeof parsed === "string" && key === "default_assignee") {
		const assignee = parsed.trim();
		return assignee ? [assignee] : [];
	}
	throw configTypeError(configPath, key, parsed);
}

const DEFAULT_CREATE_LOCK_TIMEOUT_MS = 30_000;
const DEFAULT_CREATE_LOCK_RETRY_DELAY_MS = 100;
const DEFAULT_CREATE_LOCK_STALE_MS = 10_000;
const TASK_FILE_READ_CONCURRENCY = 32;

interface ParsedTaskFile {
	content: string;
	task: Task;
}

export const CREATE_LOCK_ERROR_CODE = "ECREATELOCK";
export const CREATE_LOCK_ERROR_MESSAGE =
	"Another task create/promote/demote operation is already in progress. Please try again.";

const CREATE_LOCK_ERROR_NAME = "CreateLockError";
const TASK_LOCK_ERROR_NAME = "TaskLockError";
const TASK_LOCK_ERROR_CODE = "ETASKLOCK";

function lockError(name: string, code: string, message: string, cause?: unknown): Error {
	const error = new Error(message, cause === undefined ? undefined : { cause }) as Error & { code?: string };
	error.name = name;
	error.code = code;
	return error;
}

function isLockError(error: unknown, name: string, code: string): error is Error {
	return error instanceof Error && error.name === name && (error as Error & { code?: string }).code === code;
}

function createLockError(message: string, cause?: unknown): Error {
	return lockError(CREATE_LOCK_ERROR_NAME, CREATE_LOCK_ERROR_CODE, message, cause);
}

function taskLockError(message: string, cause?: unknown): Error {
	return lockError(TASK_LOCK_ERROR_NAME, TASK_LOCK_ERROR_CODE, message, cause);
}

/**
 * Records a directory-level listing failure so callers can report it instead of treating an
 * unreadable directory as an empty one. A directory that does not exist yet is normal and is
 * reported as empty; anything else means the contents could not be inspected. The empty string
 * denotes the content directory itself.
 */
function recordUnreadableDirectory(error: unknown, unreadable?: string[]): void {
	if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return;
	unreadable?.push("");
}

export function isCreateLockError(error: unknown): error is Error {
	return isLockError(error, CREATE_LOCK_ERROR_NAME, CREATE_LOCK_ERROR_CODE);
}

export function isTaskLockError(error: unknown): error is Error {
	return isLockError(error, TASK_LOCK_ERROR_NAME, TASK_LOCK_ERROR_CODE);
}

export function taskLockErrorMessage(taskId: string): string {
	return `Edit failed: ${taskId} is being modified by another process; retry if appropriate.`;
}

export class FileSystem {
	private resolvedBacklogDir: string;
	private resolvedBacklogDirName: string;
	private resolvedConfigPath: string;
	private configSource: BacklogConfigSource;
	private readonly projectRoot: string;
	private cachedConfig: BacklogConfig | null = null;
	private cachedConfigSnapshot: { path: string; content: string } | null = null;
	private readonly parsedTaskFiles = new Map<string, ParsedTaskFile>();
	private taskParseCacheEpoch = 0;
	private taskFileReadGeneration = 0;
	private readonly taskFileReadGenerations = new Map<string, number>();
	private activeTaskFileReads = 0;
	private readonly pendingTaskFileReads: Array<() => void> = [];

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
		this.cachedConfigSnapshot = null;
		this.refreshConfigResolution();
	}

	getCachedConfigContent(sourceConfigPath: string): string | null {
		return this.cachedConfigSnapshot && resolve(this.cachedConfigSnapshot.path) === resolve(sourceConfigPath)
			? this.cachedConfigSnapshot.content
			: null;
	}

	publishConfig(config: BacklogConfig, sourceConfigPath: string, content: string): boolean {
		const rootConfigPath = join(this.projectRoot, DEFAULT_FILES.ROOT_CONFIG);
		if (resolve(sourceConfigPath) === resolve(rootConfigPath)) {
			if (config.backlogDirectory !== undefined && normalizeProjectBacklogDirectory(config.backlogDirectory) === null) {
				return false;
			}
			const resolution = resolveBacklogDirectoryFromRootConfig(this.projectRoot, config.backlogDirectory);
			if (!resolution.backlogDir || !resolution.backlogPath || resolution.configSource !== "root") {
				return false;
			}
			this.applyConfigResolution(resolution);
		}
		this.cachedConfig = config;
		this.cachedConfigSnapshot = { path: sourceConfigPath, content };
		return true;
	}

	private refreshConfigResolution(): void {
		this.applyConfigResolution(resolveBacklogDirectory(this.projectRoot));
	}

	private applyConfigResolution(resolution: ReturnType<typeof resolveBacklogDirectory>): void {
		const backlogDirName = resolution.backlogDir ?? DEFAULT_DIRECTORIES.BACKLOG;
		const backlogDir = resolution.backlogPath ?? join(this.projectRoot, DEFAULT_DIRECTORIES.BACKLOG);
		if (resolve(backlogDir) !== resolve(this.resolvedBacklogDir)) {
			this.invalidateTaskParseCache();
		}
		this.resolvedBacklogDirName = backlogDirName;
		this.resolvedBacklogDir = backlogDir;
		this.resolvedConfigPath = resolution.configPath ?? join(this.resolvedBacklogDir, DEFAULT_FILES.CONFIG);
		this.configSource = resolution.configSource ?? "folder";
	}

	setBacklogDirectory(backlogDir: string): void {
		const normalized = normalizeProjectBacklogDirectory(backlogDir);
		if (!normalized) {
			throw new Error("Backlog directory must be a project-relative path.");
		}
		const nextBacklogDir = join(this.projectRoot, normalized);
		if (resolve(nextBacklogDir) !== resolve(this.resolvedBacklogDir)) {
			this.invalidateTaskParseCache();
		}
		this.resolvedBacklogDirName = normalized;
		this.resolvedBacklogDir = nextBacklogDir;
		if (this.configSource === "folder") {
			this.resolvedConfigPath = join(this.resolvedBacklogDir, DEFAULT_FILES.CONFIG);
		}
	}

	private invalidateTaskParseCache(): void {
		this.taskParseCacheEpoch++;
		this.parsedTaskFiles.clear();
		this.taskFileReadGenerations.clear();
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
			try {
				await mkdir(dir, { recursive: true });
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				if (!(await stat(dir)).isDirectory()) throw error;
			}
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

	private toTaskLockError(error: unknown, taskId: string): Error {
		if (isTaskLockError(error)) {
			return error;
		}

		const code = (error as NodeJS.ErrnoException | undefined)?.code;
		if (code === "ELOCKED") {
			return taskLockError(taskLockErrorMessage(taskId), error);
		}
		if (code === "ENOENT") {
			// The file was moved or removed between loading the snapshot and locking it.
			return taskLockError(`Edit failed: ${taskId} was moved or removed by another process.`, error);
		}
		if (code === "ECOMPROMISED") {
			return taskLockError(`Edit failed: the lock on ${taskId} was interrupted; retry if appropriate.`, error);
		}
		return error instanceof Error ? error : new Error(String(error));
	}

	private async getGitCommonDir(): Promise<string | null> {
		try {
			const config = await this.loadConfig();
			if (config?.filesystemOnly) {
				return null;
			}
		} catch {
			// If config cannot be read, still try git and fall back to the backlog directory on failure.
		}

		try {
			const subprocess = Bun.spawn(["git", "rev-parse", "--git-common-dir"], {
				cwd: this.projectRoot,
				stdin: "ignore",
				stdout: "pipe",
				stderr: "ignore",
				env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } as Record<string, string>,
			});
			const stdoutPromise = subprocess.stdout ? new Response(subprocess.stdout).text() : Promise.resolve("");
			const [exitCode, stdout] = await Promise.all([subprocess.exited, stdoutPromise]);
			if (exitCode !== 0) return null;
			const commonDir = stdout.trim();
			if (!commonDir) return null;
			return isAbsolute(commonDir) ? commonDir : resolve(this.projectRoot, commonDir);
		} catch {
			return null;
		}
	}

	private async getCreateLockTarget(backlogDir: string): Promise<CreateLockTarget> {
		const commonGitDir = await this.getGitCommonDir();
		if (commonGitDir) {
			return {
				targetPath: commonGitDir,
				locksDir: join(commonGitDir, "backlog.md", "locks"),
			};
		}

		return {
			targetPath: backlogDir,
			locksDir: join(backlogDir, ".locks"),
		};
	}

	// Uses a maintained lockfile with stale-lock recovery; USE_GLOBAL_TASK_ID_LOCK=false restores legacy behavior.
	async withCreateLock<T>(fn: () => Promise<T>, options: CreateLockOptions = {}): Promise<T> {
		if (process.env.USE_GLOBAL_TASK_ID_LOCK?.toLowerCase() === "false") {
			return await fn();
		}

		const backlogDir = await this.getBacklogDir();
		const lockTarget = await this.getCreateLockTarget(backlogDir);
		const timeoutMs = options.timeoutMs ?? DEFAULT_CREATE_LOCK_TIMEOUT_MS;
		const retryDelayMs = options.retryDelayMs ?? DEFAULT_CREATE_LOCK_RETRY_DELAY_MS;
		return await this.withLockTarget(
			lockTarget.targetPath,
			join(lockTarget.locksDir, "create"),
			{
				staleMs: options.staleMs ?? DEFAULT_CREATE_LOCK_STALE_MS,
				retryDelayMs,
				retries: Math.max(Math.ceil(timeoutMs / retryDelayMs) - 1, 0),
			},
			(error) => this.toCreateLockError(error),
			fn,
		);
	}

	/**
	 * Per-task counterpart of the create lock, used to serialize a task's read-modify-write.
	 * It fails fast instead of waiting: on contention the caller (human or agent) decides
	 * whether to retry, and nothing is merged or overwritten behind their back.
	 *
	 * The lock target is the task file itself because proper-lockfile keys its in-process
	 * lock registry by target path: a shared target with per-task lockfile paths would
	 * clobber concurrent locks held by one process. Unlike the create lock, the lockfile
	 * lives under this project's backlog directory rather than the shared git common dir:
	 * an edit protects one file, so sibling worktrees editing their own copy of a task must
	 * not fail each other. USE_GLOBAL_TASK_ID_LOCK=false bypasses it like the create lock.
	 */
	async withTaskLock<T>(task: Pick<Task, "id" | "filePath">, fn: () => Promise<T>): Promise<T> {
		if (process.env.USE_GLOBAL_TASK_ID_LOCK?.toLowerCase() === "false") {
			return await fn();
		}

		const filePath = task.filePath?.trim();
		if (!filePath) {
			throw new Error(`Cannot lock task ${task.id} for editing without its file path.`);
		}

		const lockKey = task.id
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9._-]+/g, "-")
			.replace(/^\.+/, "");
		return await this.withLockTarget(
			filePath,
			join(await this.getBacklogDir(), ".locks", `task-${lockKey || "unknown"}`),
			{ staleMs: DEFAULT_CREATE_LOCK_STALE_MS, retries: 0, retryDelayMs: 0 },
			(error) => this.toTaskLockError(error, task.id),
			fn,
		);
	}

	/**
	 * Hold a stable set of task locks for one operation. The callback runs only after every
	 * lock is acquired, so a contended task cannot leave an earlier write from a bulk operation
	 * on disk. Sorting also keeps multi-task operations from acquiring the same locks in opposite
	 * orders and deadlocking each other.
	 */
	async withTaskLocks<T>(tasks: Array<Pick<Task, "id" | "filePath">>, fn: () => Promise<T>): Promise<T> {
		const uniqueTasks = Array.from(
			new Map(tasks.map((task) => [task.id.trim().toLowerCase(), task])).values(),
		).sort((left, right) => left.id.localeCompare(right.id));

		const acquire = async (index: number): Promise<T> => {
			const task = uniqueTasks[index];
			if (!task) return await fn();
			return await this.withTaskLock(task, async () => await acquire(index + 1));
		};

		return await acquire(0);
	}

	private async withLockTarget<T>(
		targetPath: string,
		lockDir: string,
		settings: LockAttemptSettings,
		toError: (error: unknown) => Error,
		fn: () => Promise<T>,
	): Promise<T> {
		await mkdir(dirname(lockDir), { recursive: true });

		let release: (() => Promise<void>) | undefined;
		try {
			release = await lockfile.lock(targetPath, {
				lockfilePath: lockDir,
				realpath: true,
				stale: Math.max(settings.staleMs, 2_000),
				retries: {
					retries: settings.retries,
					factor: 1,
					minTimeout: settings.retryDelayMs,
					maxTimeout: settings.retryDelayMs,
					randomize: false,
				},
			});
		} catch (error) {
			throw toError(error);
		}

		try {
			const result = await fn();
			try {
				await release?.();
			} catch (error) {
				throw toError(error);
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
	private async resolveTaskWriteTarget(
		task: Task,
		isDraft = false,
	): Promise<{ id: string; filename: string; filePath: string }> {
		let prefix = isDraft ? "draft" : extractAnyPrefix(task.id);
		if (!prefix) prefix = (await this.loadConfig())?.prefixes?.task ?? "task";
		const id = normalizeId(task.id, prefix);
		const filename = `${idForFilename(id)} - ${this.sanitizeFilename(task.title)}.md`;
		const directory = isDraft ? await this.getDraftsDir() : await this.getTasksDir();
		const preservesPath = !isDraft && typeof task.filePath === "string" && task.filePath.trim().length > 0;
		return { id, filename, filePath: preservesPath ? (task.filePath as string) : join(directory, filename) };
	}

	async getTaskWritePath(task: Task, isDraft = false): Promise<string> {
		return (await this.resolveTaskWriteTarget(task, isDraft)).filePath;
	}

	async saveTask(task: Task): Promise<string> {
		const { id: taskId, filename, filePath: filepath } = await this.resolveTaskWriteTarget(task);
		const prefix = extractAnyPrefix(taskId) ?? "task";
		const tasksDir = await this.getTasksDir();
		const shouldPreservePath = typeof task.filePath === "string" && task.filePath.trim().length > 0;
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
			} catch (error) {
				if (isAmbiguousTaskIdError(error)) throw error;
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
			const [activeTasks, completedTasks] = await Promise.all([this.listTasks(), this.listCompletedTasks()]);
			const identityMatches = [...activeTasks, ...completedTasks].filter((task) => taskIdsEqual(taskId, task.id));
			if (identityMatches.length > 1) {
				throw new AmbiguousTaskIdError(
					taskId,
					identityMatches.map((task) => task.filePath ?? task.id),
				);
			}
			const activeMatch = activeTasks.find((task) => taskIdsEqual(taskId, task.id));
			if (activeMatch?.filePath) return activeMatch;
			if (identityMatches.length === 1) return null;

			const core = { filesystem: { tasksDir, completedDir: this.completedDir } };
			const filepath = await getTaskPath(taskId, core as TaskPathContext);

			if (!filepath) return null;

			const content = await Bun.file(filepath).text();
			const task = normalizeTaskIdentity(parseTask(content));
			return { ...task, filePath: filepath };
		} catch (error) {
			if (isAmbiguousTaskIdError(error)) throw error;
			return null;
		}
	}

	private async withTaskFileReadSlot<T>(read: () => Promise<T>): Promise<T> {
		if (this.activeTaskFileReads < TASK_FILE_READ_CONCURRENCY) {
			this.activeTaskFileReads++;
		} else {
			await new Promise<void>((resolve) => this.pendingTaskFileReads.push(resolve));
		}

		try {
			return await read();
		} finally {
			const next = this.pendingTaskFileReads.shift();
			if (next) {
				// Transfer this slot directly to the next reader before it resumes.
				next();
			} else {
				this.activeTaskFileReads--;
			}
		}
	}

	/** Re-read for freshness, but only reparse when the exact text changed. */
	private async readParsedTaskFile(filepath: string, cacheEpoch = this.taskParseCacheEpoch): Promise<Task> {
		const cacheKey = resolve(filepath);
		const generation = ++this.taskFileReadGeneration;
		if (cacheEpoch === this.taskParseCacheEpoch) {
			this.taskFileReadGenerations.set(cacheKey, generation);
		}
		const content = await this.withTaskFileReadSlot(async () => await Bun.file(filepath).text());
		const cached = this.parsedTaskFiles.get(cacheKey);
		if (cached?.content === content) {
			return structuredClone(cached.task);
		}

		const parsed = parseTask(content);
		if (cacheEpoch === this.taskParseCacheEpoch && this.taskFileReadGenerations.get(cacheKey) === generation) {
			this.parsedTaskFiles.set(cacheKey, { content, task: parsed });
		}
		// Task consumers mutate nested lists while preparing edits and branch metadata.
		return structuredClone(parsed);
	}

	private async readTaskFiles(
		directory: string,
		files: string[],
		options: { normalizeIdentity: boolean; debugLabel: string },
		cacheEpoch = this.taskParseCacheEpoch,
	): Promise<Task[]> {
		const directoryPath = resolve(directory);
		const livePaths = new Set(files.map((file) => resolve(directory, file)));
		if (cacheEpoch === this.taskParseCacheEpoch) {
			const trackedPaths = new Set([...this.parsedTaskFiles.keys(), ...this.taskFileReadGenerations.keys()]);
			for (const trackedPath of trackedPaths) {
				if (dirname(trackedPath) === directoryPath && !livePaths.has(trackedPath)) {
					this.parsedTaskFiles.delete(trackedPath);
					this.taskFileReadGenerations.delete(trackedPath);
				}
			}
		}

		const tasks = new Array<Task | undefined>(files.length);
		let nextIndex = 0;
		const worker = async () => {
			while (nextIndex < files.length) {
				const index = nextIndex++;
				const file = files[index];
				if (!file) continue;
				const filepath = join(directory, file);
				try {
					const parsed = await this.readParsedTaskFile(filepath, cacheEpoch);
					const task = options.normalizeIdentity ? normalizeTaskIdentity(parsed) : parsed;
					tasks[index] = { ...task, filePath: filepath };
				} catch (error) {
					if (process.env.DEBUG) {
						console.error(`Failed to parse ${options.debugLabel} ${filepath}`, error);
					}
				}
			}
		};

		await Promise.all(Array.from({ length: Math.min(TASK_FILE_READ_CONCURRENCY, files.length) }, () => worker()));
		return tasks.filter((task): task is Task => task !== undefined);
	}

	async listTasks(filter?: TaskListFilter): Promise<Task[]> {
		const cacheEpoch = this.taskParseCacheEpoch;
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

		let tasks = await this.readTaskFiles(
			tasksDir,
			taskFiles,
			{
				normalizeIdentity: true,
				debugLabel: "task file",
			},
			cacheEpoch,
		);

		if (filter?.status) {
			const statusLower = filter.status.toLowerCase();
			tasks = tasks.filter((t) => t.status.toLowerCase() === statusLower);
		}
		if (filter?.excludeStatus) {
			const excludedStatuses = Array.isArray(filter.excludeStatus) ? filter.excludeStatus : [filter.excludeStatus];
			const excluded = new Set(
				excludedStatuses.map((status) => status.trim().toLowerCase()).filter((status) => status.length > 0),
			);
			if (excluded.size > 0) {
				tasks = tasks.filter((t) => !excluded.has(t.status.toLowerCase()));
			}
		}
		if (filter?.type) {
			tasks = tasks.filter((task) => matchesTaskTypeFilter(task.type, filter.type));
		}

		if (filter?.assignee) {
			const assignee = filter.assignee;
			tasks = tasks.filter((t) => t.assignee.includes(assignee));
		}

		return sortByTaskId(tasks);
	}

	async listCompletedTasks(): Promise<Task[]> {
		const cacheEpoch = this.taskParseCacheEpoch;
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

		const tasks = await this.readTaskFiles(
			completedDir,
			taskFiles,
			{
				normalizeIdentity: false,
				debugLabel: "completed task file",
			},
			cacheEpoch,
		);

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
			const core = { filesystem: { tasksDir, completedDir: this.completedDir } };
			const sourcePath = await getTaskPath(taskId, core as TaskPathContext);
			const taskFile = await getTaskFilename(taskId, core as TaskPathContext);

			if (!sourcePath || !taskFile) return false;

			const targetPath = join(archiveTasksDir, taskFile);

			// Ensure target directory exists
			await this.ensureDirectoryExists(dirname(targetPath));

			// Use rename for proper Git move detection
			await rename(sourcePath, targetPath);

			return true;
		} catch (error) {
			if (isAmbiguousTaskIdError(error)) throw error;
			return false;
		}
	}

	async completeTask(taskId: string): Promise<boolean> {
		try {
			const tasksDir = await this.getTasksDir();
			const completedDir = await this.getCompletedDir();
			const core = { filesystem: { tasksDir, completedDir } };
			const sourcePath = await getTaskPath(taskId, core as TaskPathContext);
			const taskFile = await getTaskFilename(taskId, core as TaskPathContext);

			if (!sourcePath || !taskFile) return false;

			const targetPath = join(completedDir, taskFile);

			// Ensure target directory exists
			await this.ensureDirectoryExists(dirname(targetPath));

			// Use rename for proper Git move detection
			await rename(sourcePath, targetPath);

			return true;
		} catch (error) {
			if (isAmbiguousTaskIdError(error)) throw error;
			return false;
		}
	}

	async archiveDraft(draftId: string): Promise<{ sourcePath: string; targetPath: string } | null> {
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

			if (!draftFile) return null;

			const sourcePath = join(draftsDir, draftFile);
			const targetPath = join(archiveDraftsDir, draftFile);

			const content = await Bun.file(sourcePath).text();
			await this.ensureDirectoryExists(dirname(targetPath));
			await Bun.write(targetPath, content);

			await unlink(sourcePath);

			return { sourcePath, targetPath };
		} catch {
			return null;
		}
	}

	async promoteDraft(draftId: string): Promise<boolean> {
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

				return true;
			});
		} catch (error) {
			if (isCreateLockError(error) || isAmbiguousTaskIdError(error)) {
				throw error;
			}
			return false;
		}
	}

	async demoteTask(taskId: string, onMoved?: (fromPath: string, toPath: string) => void): Promise<boolean> {
		return await this.withCreateLock(async () => {
			// Load the task. A missing task is the only false result; filesystem failures must reach
			// callers so the Web API can distinguish an operational failure from a 404.
			const task = await this.loadTask(taskId);
			if (!task?.filePath) return false;

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

			const savedPath = await this.saveDraft(demotedDraft);

			// Delete old task file. If that fails, remove the newly written draft so a retry cannot
			// encounter two copies of the task.
			try {
				await unlink(task.filePath);
			} catch (error) {
				try {
					await unlink(savedPath);
				} catch (cleanupError) {
					const failure = error instanceof Error ? error : new Error(String(error));
					(failure as Error & { demotionState?: string }).demotionState = "partial";
					failure.cause = cleanupError;
					throw failure;
				}
				throw error;
			}
			onMoved?.(task.filePath, savedPath);

			return true;
		});
	}

	// Draft operations
	async saveDraft(task: Task): Promise<string> {
		const { id: draftId, filename, filePath: filepath } = await this.resolveTaskWriteTarget(task, true);
		const draftsDir = await this.getDraftsDir();
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
	async saveDecision(decision: Decision): Promise<{ filepath: string; removedFilepaths: string[] }> {
		// Normalize ID - remove "decision-" prefix if present
		const normalizedId = decision.id.replace(/^decision-/, "");
		const filename = `decision-${normalizedId} - ${this.sanitizeFilename(decision.title)}.md`;
		const decisionsDir = await this.getDecisionsDir();
		const filepath = join(decisionsDir, filename);
		const content = serializeDecision(decision);

		const matches = await Array.fromAsync(
			new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir, followSymlinks: true }),
		);
		const removedFilepaths: string[] = [];
		for (const match of matches) {
			if (match === filename) continue;
			if (!match.startsWith(`decision-${normalizedId} -`)) continue;
			try {
				const matchPath = join(decisionsDir, match);
				await unlink(matchPath);
				removedFilepaths.push(matchPath);
			} catch {
				// Ignore cleanup errors
			}
		}

		await this.ensureDirectoryExists(dirname(filepath));
		await Bun.write(filepath, content);

		return { filepath, removedFilepaths };
	}

	async loadDecision(decisionId: string): Promise<Decision | null> {
		return findDecisionById(await this.listDecisions(), decisionId);
	}

	// Document operations
	async saveDocument(document: Document, subPath = ""): Promise<{ relativePath: string; removedFilepaths: string[] }> {
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

		const removedFilepaths: string[] = [];
		if (sourceRelativePath && sourceRelativePath !== relativePath) {
			const sourcePath = join(docsDir, ...sourceRelativePath.split("/"));
			try {
				await this.ensureDirectoryExists(dirname(filepath));
				await rename(sourcePath, filepath);
				removedFilepaths.push(sourcePath);
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
				removedFilepaths.push(matchPath);
			} catch {
				// Ignore cleanup errors - file may have been removed already
			}
		}

		await Bun.write(filepath, content);

		document.path = relativePath;
		return { relativePath, removedFilepaths };
	}

	/** Lists decisions, skipping files that cannot be read or parsed and collecting their paths in `unreadable`. */
	async listDecisions(unreadable?: string[]): Promise<Decision[]> {
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
				try {
					const content = await Bun.file(filepath).text();
					decisions.push({ ...parseDecision(content), path: file });
				} catch {
					// One malformed file must not hide every other decision from lookups.
					unreadable?.push(file);
				}
			}
			return sortByTaskId(decisions);
		} catch (error) {
			recordUnreadableDirectory(error, unreadable);
			return [];
		}
	}

	/** Lists documents, skipping files that cannot be read or parsed and collecting their paths in `unreadable`. */
	async listDocuments(unreadable?: string[]): Promise<Document[]> {
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
				try {
					const content = await Bun.file(filepath).text();
					docs.push({ ...parseDocument(content), path: relativePath });
				} catch {
					// One malformed file must not hide every other document from lookups.
					unreadable?.push(relativePath);
				}
			}

			// Stable sort by title for UI/CLI listing
			return docs.sort((a, b) => a.title.localeCompare(b.title));
		} catch (error) {
			recordUnreadableDirectory(error, unreadable);
			return [];
		}
	}

	async loadDocument(id: string): Promise<Document> {
		const document = findDocumentById(await this.listDocuments(), id);
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

	private serializeMilestoneContent(id: string, title: string, rawContent: string): string {
		return `---
id: ${id}
title: "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"
---

${rawContent.trim()}
`;
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

	async getMilestoneFilePath(identifier: string): Promise<string | null> {
		const match = await this.findMilestoneFile(identifier, "active");
		return match?.filepath ?? null;
	}

	async loadMilestone(id: string): Promise<Milestone | null> {
		try {
			const milestoneMatch = await this.findMilestoneFile(id, "active");
			return milestoneMatch?.milestone ?? null;
		} catch (_error) {
			return null;
		}
	}

	async createMilestone(title: string, description?: string): Promise<Milestone> {
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
			const content = this.serializeMilestoneContent(
				id,
				title,
				`## Description

${description || `Milestone: ${title}`}`,
			);

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

	async renameMilestone(
		identifier: string,
		title: string,
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
			const nextRawContent = this.rewriteDefaultMilestoneDescription(
				milestone.rawContent,
				milestone.title,
				normalizedTitle,
			);
			const updatedContent = this.serializeMilestoneContent(milestone.id, normalizedTitle, nextRawContent);

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

		const configPath = this.resolvedConfigPath;
		let content: string;
		try {
			// Check if file exists first to avoid hanging on Windows
			const file = Bun.file(configPath);
			if (!(await file.exists())) {
				return null;
			}
			content = await file.text();
		} catch (_error) {
			return null;
		}

		// A value Backlog cannot read is reported, not swallowed: callers must not silently
		// fall back to defaults while the config file says something else.
		const config = this.parseConfig(content);
		this.cachedConfig = config;
		this.cachedConfigSnapshot = { path: configPath, content };
		return config;
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
		this.cachedConfigSnapshot = { path: configPath, content };
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

	parseConfig(content: string): BacklogConfig {
		const config: Partial<BacklogConfig> = {};
		const parsedDefinitionOfDone = this.parseDefinitionOfDone(content);
		// Every list key goes through the same strict parse, which throws rather than guess.
		const parseListValue = (key: ConfigListKey) => parseConfigListValue(content, key, this.resolvedConfigPath);
		config.statuses = parseListValue("statuses");
		config.labels = parseListValue("labels");
		config.types = parseListValue("types");
		config.priorities = parseListValue("priorities");
		config.defaultAssignee = parseListValue("default_assignee");
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
				case "default_reporter":
					config.defaultReporter = value.replace(/['"]/g, "");
					break;
				case "default_status":
					config.defaultStatus = value.replace(/['"]/g, "");
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
				case "hide_empty_columns":
					config.hideEmptyColumns = value.toLowerCase() === "true";
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
			}
		}

		return {
			projectName: config.projectName || "",
			defaultAssignee: config.defaultAssignee,
			defaultReporter: config.defaultReporter,
			statuses: config.statuses || [...DEFAULT_STATUSES],
			labels: config.labels || [],
			types: config.types,
			priorities: config.priorities,
			definitionOfDone: config.definitionOfDone,
			defaultStatus: config.defaultStatus,
			dateFormat: config.dateFormat || "yyyy-mm-dd",
			maxColumnWidth: config.maxColumnWidth,
			defaultEditor: config.defaultEditor,
			autoOpenBrowser: config.autoOpenBrowser,
			hideEmptyColumns: config.hideEmptyColumns,
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
		};
	}

	private serializeConfig(config: BacklogConfig): string {
		const normalizedDefinitionOfDone = this.normalizeDefinitionOfDone(config.definitionOfDone);
		const lines = [
			`project_name: "${config.projectName}"`,
			...(config.defaultAssignee?.length
				? [`default_assignee: [${config.defaultAssignee.map((assignee) => JSON.stringify(assignee)).join(", ")}]`]
				: []),
			...(config.defaultReporter ? [`default_reporter: "${config.defaultReporter}"`] : []),
			...(config.defaultStatus ? [`default_status: "${config.defaultStatus}"`] : []),
			`statuses: [${config.statuses.map((s) => `"${s}"`).join(", ")}]`,
			`labels: [${config.labels.map((l) => `"${l}"`).join(", ")}]`,
			...(config.types && config.types.length > 0 ? [`types: [${config.types.map((t) => `"${t}"`).join(", ")}]`] : []),
			...(config.priorities && config.priorities.length > 0
				? [`priorities: [${config.priorities.map((p) => `"${p}"`).join(", ")}]`]
				: []),
			...(Array.isArray(normalizedDefinitionOfDone)
				? [`definition_of_done: [${normalizedDefinitionOfDone.map((item) => JSON.stringify(item)).join(", ")}]`]
				: []),
			`date_format: ${config.dateFormat}`,
			...(config.maxColumnWidth ? [`max_column_width: ${config.maxColumnWidth}`] : []),
			...(config.defaultEditor ? [`default_editor: "${config.defaultEditor}"`] : []),
			...(typeof config.autoOpenBrowser === "boolean" ? [`auto_open_browser: ${config.autoOpenBrowser}`] : []),
			...(typeof config.hideEmptyColumns === "boolean" ? [`hide_empty_columns: ${config.hideEmptyColumns}`] : []),
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
		];

		return `${lines.join("\n")}\n`;
	}

	private parseDefinitionOfDone(content: string): string[] | undefined {
		const definitionOfDoneYaml = extractConfigKeyYaml(content, "definition_of_done");
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
			const { data } = parseFrontmatter(`---\n${content.trimEnd()}\n---\n`);
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
