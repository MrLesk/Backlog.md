import { mkdir, rename as moveFile, readFile, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import {
	ARCHIVED_TASK_DIRECTORIES,
	DEFAULT_DIRECTORIES,
	DEFAULT_STATUSES,
	FALLBACK_STATUS,
} from "../constants/index.ts";
import {
	type DraftFileReference,
	DraftIdentityError,
	DraftParseError,
	FileSystem,
	isConfigValueError,
	newTaskLockError,
} from "../file-system/operations.ts";
import { type GitBranchTip, type GitIndexEntry, GitOperations } from "../git/operations.ts";
import { FrontmatterReferenceError, parseFrontmatter } from "../markdown/frontmatter.ts";
import { extractSection, parseTask } from "../markdown/parser.ts";
import { assertSectionInputHasNoMarkerLines, assertValidChecklistMarks } from "../markdown/structured-sections.ts";
import {
	type AcceptanceCriterion,
	type BacklogConfig,
	type ContentRecord,
	type ContentRecordKind,
	type Decision,
	DOCUMENT_TYPE_VALUES,
	type Document,
	type DocumentCreateInput,
	type DocumentType,
	type DocumentUpdateInput,
	EntityType,
	isReadOnlyTask,
	isWorkingCopyTask,
	type Milestone,
	type SearchFilters,
	type Task,
	type TaskCommentInput,
	type TaskCreateInput,
	type TaskListFilter,
	type TaskUpdateInput,
} from "../types/index.ts";
import { normalizeAssignee } from "../utils/assignee.ts";
import { decisionIdKey, decisionNotFoundMessage, findDecisionById } from "../utils/decision-id.ts";
import { documentIdKey, documentNotFoundMessage, findDocumentById, normalizeDocumentId } from "../utils/document-id.ts";
import { getDocumentSubPathFromRelativePath, normalizeDocumentSubPath } from "../utils/document-path.ts";
import { normalizeDueDate } from "../utils/due-date.ts";
import {
	type ContentIdentityReport,
	type DraftIdentityFindings,
	detectContentIdentityIssues,
} from "../utils/duplicate-detection.ts";
import { openInEditor } from "../utils/editor.ts";
import { isAmbiguousIdError } from "../utils/entity-id.ts";
import { findBacklogRoot } from "../utils/find-backlog-root.ts";
import { generateNextDecisionId, generateNextDocId } from "../utils/id-generators.ts";
import { createMilestoneFilterValueResolver } from "../utils/milestone-filter.ts";
import {
	buildGlobPattern,
	extractIdFromFilename,
	generateNextId as generateNextPrefixedId,
	generateNextSubtaskId,
	getPrefixForType,
	normalizeId,
} from "../utils/prefix-config.ts";
import { formatValidPriorityValues, resolvePriorityValue } from "../utils/priority-config.ts";
import {
	formatValidProjectValues,
	getProjectValues,
	noProjectsConfiguredMessage,
	resolveProjectValue,
} from "../utils/project-config.ts";
import { resolveRuntimeCwd } from "../utils/runtime-cwd.ts";
import {
	getCanonicalStatus as resolveCanonicalStatus,
	getValidStatuses as resolveValidStatuses,
} from "../utils/status.ts";
import { executeStatusCallback } from "../utils/status-callback.ts";
import {
	buildDefinitionOfDoneItems,
	normalizeStringList,
	parseDelimitedStringList,
	stringArraysEqual,
	validateDependencies,
} from "../utils/task-builders.ts";
import {
	documentationEntryNamesFile,
	formatDocumentationReferencesMessage,
	withoutVacatedTaskLinks,
} from "../utils/task-links.ts";
import {
	AmbiguousTaskIdError,
	canonicalTaskId,
	extractDraftIdFromFilename,
	findDuplicateDraftFilenameGroups,
	getTaskPath,
	LOCAL_TASK_LOOKUP_HINT,
	normalizeTaskId,
	normalizeTaskIdentity,
	taskIdsEqual,
} from "../utils/task-path.ts";
import { applyTaskFilters, createTaskSearchIndex } from "../utils/task-search.ts";
import { sortByOrdinal } from "../utils/task-sorting.ts";
import { attachSubtaskSummaries, findDirectSubtasks } from "../utils/task-subtasks.ts";
import { formatValidTaskTypeValues, resolveTaskTypeValue } from "../utils/task-type-config.ts";
import { upsertTaskUpdatedDate } from "../utils/task-updated-date.ts";
import { isTerminalStatus } from "../utils/terminal-status.ts";
import { formatUtcTimestamp, parseStoredUtcDate } from "../utils/utc-timestamp.ts";
import { moveWithoutReplacing } from "./archived-task-move.ts";
import { migrateConfig, needsMigration } from "./config-migration.ts";
import { ContentStore, type TaskCorpusSnapshot } from "./content-store.ts";
import {
	applyDuplicateTaskIdRepair,
	type DuplicateRepairPlan,
	type DuplicateRepairResult,
	previewDuplicateTaskIdRepair,
} from "./duplicate-task-repair.ts";
import { migrateDraftPrefixes, needsDraftPrefixMigration } from "./prefix-migration.ts";
import {
	calculateBlockOrdinals,
	calculateNewOrdinal,
	DEFAULT_ORDINAL_STEP,
	resolveOrdinalConflicts,
} from "./reorder.ts";
import { SearchService } from "./search-service.ts";
import { TaskIdentityIndex, type TaskIdentityRecord } from "./task-identity-index.ts";
import {
	BranchTaskLoader,
	type BranchTaskStateEntry,
	getBranchHistoryCutoff,
	getTaskLoadingMessage,
} from "./task-loader.ts";

interface BlessedScreen {
	program: {
		/** True while the terminal is reporting mouse events to the program. */
		mouseEnabled?: boolean;
		disableMouse(): void;
		enableMouse(): void;
		hideCursor(): void;
		showCursor(): void;
		input: NodeJS.EventEmitter;
		pause?: () => (() => void) | undefined;
		flush?: () => void;
		put?: {
			keypad_local?: () => void;
			keypad_xmit?: () => void;
		};
	};
	leave(): void;
	enter(): void;
	render(): void;
	clearRegion(x1: number, x2: number, y1: number, y2: number): void;
	width: number;
	height: number;
	emit(event: string): void;
}

interface CreatedTaskWrite {
	filePath: string;
	createdContent: Buffer;
	previousIndexEntries?: GitIndexEntry[];
	generatedIndexEntries?: GitIndexEntry[];
}

interface CreatedTaskRollbackResult {
	indexRestored: boolean;
	workingPathRestored: boolean;
}

const REMOTE_REF_REFRESH_INTERVAL_MS = 60_000;

interface TaskCorpusLoadOptions {
	progressCallback?: (msg: string) => void;
	abortSignal?: AbortSignal;
	includeArchived?: boolean;
	visibleArchived?: boolean;
	/** Set only by the ContentStore corpus loader, whose result becomes the shared cross-branch state. */
	publishSharedState?: boolean;
	/** Set by task ID allocation, which cannot trust the coalesced remote-refresh window. */
	forceRemoteRefresh?: boolean;
}

interface TaskQueryOptions {
	filters?: TaskListFilter;
	query?: string;
	limit?: number;
	includeCrossBranch?: boolean;
	refreshCrossBranch?: boolean;
}

interface TaskReadOptions {
	includeCrossBranch?: boolean;
	refreshCrossBranch?: boolean;
}

interface ActiveBranchSnapshot {
	branchTips: readonly GitBranchTip[];
	currentBranch: string;
	fingerprint: string;
	stabilityFingerprint: string;
	settingsKey: string;
}

export type TuiTaskEditFailureReason =
	| "not_found"
	| "read_only"
	| "editor_failed"
	| "identity_conflict"
	| "unreadable"
	| "ambiguous";

export interface TuiTaskEditResult {
	changed: boolean;
	task?: Task;
	reason?: TuiTaskEditFailureReason;
}

/**
 * Sanitized copies of the records that referenced a task ID being vacated, by corpus. A draft
 * carries the ID its file name gives it, which is the identity its lock and its save use.
 */
type VacatedIdCleanup = {
	active: Task[];
	archived: Task[];
	drafts: Array<Task & { filePath: string }>;
};

function vacatedIdCleanupTasks(cleanup: VacatedIdCleanup): Task[] {
	return [...cleanup.active, ...cleanup.archived];
}

function vacatedIdCleanupTargets(cleanup: VacatedIdCleanup): Task[] {
	return [...vacatedIdCleanupTasks(cleanup), ...cleanup.drafts];
}

function sanitizeVacatedTaskLinks(tasks: Task[], vacatedTaskId: string): Task[] {
	return tasks
		.map((task) => withoutVacatedTaskLinks(task, vacatedTaskId))
		.filter((task): task is Task => task !== null);
}

/** How many times a vacating operation re-takes its locks before giving up on a stable set. */
const VACATED_ID_CLEANUP_LOCK_ATTEMPTS = 5;

/**
 * Tag a failure that happened after the record had already been moved, so callers report the state
 * the project is actually in instead of an error that reads as "nothing happened" and invites a
 * retry of a mutation that already ran.
 */
function markRecordAlreadyMoved(
	error: unknown,
	state: "archiveState" | "demotionState",
	demotionFailureCause?: "cleanup" | "commit",
): Error {
	const failure = error instanceof Error ? error : new Error(String(error));
	(failure as Error & Record<string, unknown>)[state] = "moved";
	if (state === "demotionState" && demotionFailureCause) {
		(failure as Error & Record<string, unknown>).demotionFailureCause = demotionFailureCause;
	}
	return failure;
}

/**
 * Outcome of an operation that vacates a task ID. `cleanedTaskIds` names the records that lost a
 * stored reference to it, tasks and drafts alike, so every surface can report the change instead
 * of making it silently.
 */
export interface VacatedTaskResult {
	success: boolean;
	cleanedTaskIds: string[];
}

/** What {@link Core.archiveTerminalStatusTasks} archived, skipped and could not archive. */
export interface CleanupResult {
	archivedTaskIds: string[];
	skipped: Array<{ taskId: string; reason: string }>;
	failures: Array<{ taskId: string; reason: string }>;
}

/** The lines both `backlog cleanup` and the browser's cleanup show for a cleanup result. */
export function formatCleanupResult(
	result: CleanupResult,
	selectedCount: number,
): { skipped: string[]; failed: string[]; summary: string } {
	return {
		skipped: result.skipped.map(({ taskId, reason }) => `Skipped task ${taskId}: ${reason}`),
		failed: result.failures.map(({ taskId, reason }) => `Failed to archive task ${taskId}: ${reason}`),
		summary: `Successfully archived ${result.archivedTaskIds.length} of ${selectedCount} tasks.`,
	};
}

interface TaskEditResult {
	task: Task;
	cleanedTaskIds: string[];
}

function buildUpdatedDateComparableTask(task: Task): Record<string, unknown> {
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		assignee: task.assignee ?? [],
		reporter: task.reporter,
		createdDate: task.createdDate,
		dueDate: task.dueDate,
		labels: task.labels ?? [],
		milestone: task.milestone,
		dependencies: task.dependencies ?? [],
		references: task.references ?? [],
		documentation: task.documentation ?? [],
		modifiedFiles: task.modifiedFiles ?? [],
		rawContent: task.rawContent ?? "",
		description: task.description,
		implementationPlan: task.implementationPlan,
		implementationNotes: task.implementationNotes,
		comments: task.comments ?? [],
		finalSummary: task.finalSummary,
		acceptanceCriteriaItems: task.acceptanceCriteriaItems ?? [],
		definitionOfDoneItems: task.definitionOfDoneItems ?? [],
		parentTaskId: task.parentTaskId,
		subtasks: task.subtasks ?? [],
		priority: task.priority,
		type: task.type,
		project: task.project,
		onStatusChange: task.onStatusChange,
	};
}

function hasUpdatedDateRelevantChanges(originalTask: Task | null, nextTask: Task): boolean {
	if (!originalTask) {
		return true;
	}

	return (
		JSON.stringify(buildUpdatedDateComparableTask(originalTask)) !==
		JSON.stringify(buildUpdatedDateComparableTask(nextTask))
	);
}

function normalizeDocumentTypeInput(type: unknown): DocumentType | undefined {
	if (type === undefined) {
		return undefined;
	}
	if (typeof type === "string" && (DOCUMENT_TYPE_VALUES as readonly string[]).includes(type)) {
		return type as DocumentType;
	}
	throw new Error(`Document type must be one of: ${DOCUMENT_TYPE_VALUES.join(", ")}.`);
}

function formatAvailableIndexHint(items: AcceptanceCriterion[], emptyMessage: string): string {
	if (items.length === 0) {
		return emptyMessage;
	}
	const indexes = items.map((item) => item.index).sort((a, b) => a - b);
	const first = indexes[0] ?? 1;
	const last = indexes[indexes.length - 1] ?? first;
	const range = first === last ? `#${first}` : `#${first}-#${last}`;
	return `Available indexes: ${range}.`;
}

/** Dependencies are validated against the working copy on both the create and the edit path. */
function formatMissingDependenciesError(invalid: string[]): Error {
	return new Error(
		`The following dependencies do not exist: ${invalid.join(", ")}. Please create these tasks first or verify the IDs. ${LOCAL_TASK_LOOKUP_HINT}`,
	);
}

/**
 * A board move rewrites the task file, so a task that belongs to another branch can only be moved
 * from that branch. Returns the reason to report, or null when the task is local and writable.
 */
function crossBranchMoveReason(task: Task, verb: "reordered" | "moved"): string | null {
	if (!task.branch) return null;
	return `Task ${task.id} exists in branch "${task.branch}" and cannot be ${verb} from the current branch. Switch to that branch to modify it.`;
}

/**
 * Normalize the milestone a board move targets. A named lane stores its trimmed name, while the
 * board's no-milestone lane arrives as null or a blank string and clears the field.
 */
function normalizeTargetMilestone(targetMilestone: string | null | undefined): string | undefined {
	if (typeof targetMilestone !== "string") return undefined;
	const trimmed = targetMilestone.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Structured-section input that contains its own sentinel marker as a whole
 * line is rejected before any write: wrapping it would nest markers and hide
 * the stored content from every reader (GitHub issue #932).
 */
function assertSectionInputsSafe(input: {
	description?: string;
	implementationPlan?: string;
	implementationNotes?: string;
	finalSummary?: string;
	appendImplementationPlan?: string[];
	appendImplementationNotes?: string[];
	appendFinalSummary?: string[];
}): void {
	assertSectionInputHasNoMarkerLines(input.description, "description");
	assertSectionInputHasNoMarkerLines(input.implementationPlan, "implementationPlan");
	assertSectionInputHasNoMarkerLines(input.implementationNotes, "implementationNotes");
	assertSectionInputHasNoMarkerLines(input.finalSummary, "finalSummary");
	for (const value of input.appendImplementationPlan ?? []) {
		assertSectionInputHasNoMarkerLines(value, "implementationPlan");
	}
	for (const value of input.appendImplementationNotes ?? []) {
		assertSectionInputHasNoMarkerLines(value, "implementationNotes");
	}
	for (const value of input.appendFinalSummary ?? []) {
		assertSectionInputHasNoMarkerLines(value, "finalSummary");
	}
}

/**
 * Core refused an operation because of the state the record is in: a task, a document or a
 * decision. The message is the answer for the caller, so every interface reports it as it is.
 */
export class RecordRefusedError extends Error {}

function refuseBrokenFrontmatterReference(error: unknown): never {
	if (error instanceof FrontmatterReferenceError) {
		throw new RecordRefusedError(error.message, { cause: error });
	}
	throw error;
}

/**
 * A change targeted a task that exists only in the archive, where tasks are read-only. Restoring
 * the task is the way to change it, so the message names the command.
 */
export class TaskArchivedError extends RecordRefusedError {
	constructor(taskId: string) {
		super(
			`Task ${taskId} is archived. Archived tasks are read-only. Restore it to the board first: backlog task restore ${taskId}`,
		);
		this.name = "TaskArchivedError";
	}
}

/** A lifecycle operation targeted a task that exists only on another branch; it is read-only here. */
export class TaskOnOtherBranchError extends RecordRefusedError {
	constructor(taskId: string, branch: string | undefined) {
		const where = branch ? `on branch "${branch}"` : "on another branch";
		super(`Task ${taskId} exists only ${where} and is read-only here. Switch to that branch to change it.`);
		this.name = "TaskOnOtherBranchError";
	}
}

/** Archive or restore found a file with the task file's name already in the destination. Nothing was changed. */
export class TaskFileExistsError extends RecordRefusedError {
	constructor(taskId: string, operation: "archive" | "restore", fileName: string) {
		super(
			operation === "archive"
				? `Task ${taskId} cannot be archived: the archive already has a file named ${fileName}.`
				: `Task ${taskId} cannot be restored: the board already has a file named ${fileName}.`,
		);
		this.name = "TaskFileExistsError";
	}
}

/** Delete or restore targeted a task that is on the board; both act on archived tasks only. */
export class TaskNotArchivedError extends RecordRefusedError {
	constructor(taskId: string, operation: "delete" | "restore") {
		super(
			operation === "delete"
				? `Task ${taskId} is not archived. A task must be archived before it can be deleted.`
				: `Task ${taskId} is not archived. It is already on the board.`,
		);
		this.name = "TaskNotArchivedError";
	}
}

/**
 * The words of each content record kind. Every message, commit subject and report of archive,
 * restore and delete is built from these, so documents and decisions say the same things in their
 * own nouns. A new kind is one more entry here.
 * - `singular`, `plural`, `sentenceStart`: the noun, as in "Archived document doc-1", "Archived
 *   documents are read-only" and "Document doc-1 was archived".
 * - `cliCommand`: the command group that changes the kind, named in the read-only message.
 * - `folderName`: the folder a record of the kind is in when it is not archived.
 * - `notFound`: the answer when no record of the kind claims an ID.
 */
export const CONTENT_RECORD_WORDS = {
	document: {
		singular: "document",
		plural: "documents",
		sentenceStart: "Document",
		cliCommand: "backlog doc",
		folderName: "docs folder",
		notFound: documentNotFoundMessage,
	},
	decision: {
		singular: "decision",
		plural: "decisions",
		sentenceStart: "Decision",
		cliCommand: "backlog decision",
		folderName: "decisions folder",
		notFound: decisionNotFoundMessage,
	},
} as const satisfies Record<ContentRecordKind, unknown>;

/** The words of each operation: the start of its commit subject, what was done, and how it is reported. */
const CONTENT_RECORD_OPERATION_WORDS = {
	archive: { commitVerb: "Archive", done: "archived", reported: "Archived" },
	restore: { commitVerb: "Restore", done: "restored", reported: "Restored" },
	delete: { commitVerb: "Delete", done: "deleted", reported: "Deleted" },
} as const;

type ContentRecordOperation = keyof typeof CONTENT_RECORD_OPERATION_WORDS;

/**
 * A change targeted a document or decision that is in the archive, where it is read-only: an
 * update, or archiving it a second time. Restoring it is the way to change it, so the message names
 * the command.
 */
export class ContentRecordArchivedError extends RecordRefusedError {
	constructor(kind: ContentRecordKind, id: string) {
		const words = CONTENT_RECORD_WORDS[kind];
		super(
			`${words.sentenceStart} ${id} is archived. Archived ${words.plural} are read-only. Restore it first: ${words.cliCommand} restore ${id}`,
		);
		this.name = "ContentRecordArchivedError";
	}
}

/** Restore or delete targeted a document or decision that is not archived; both act on archived ones only. */
export class ContentRecordNotArchivedError extends RecordRefusedError {
	constructor(kind: ContentRecordKind, id: string, operation: "restore" | "delete") {
		const words = CONTENT_RECORD_WORDS[kind];
		super(
			operation === "delete"
				? `${words.sentenceStart} ${id} is not archived. A ${words.singular} must be archived before it can be deleted.`
				: `${words.sentenceStart} ${id} is not archived, so there is nothing to restore.`,
		);
		this.name = "ContentRecordNotArchivedError";
	}
}

/**
 * Archive or restore found a file already at the path the record's file would move to. Neither file
 * was moved or changed. `takenPath` is written from the project root.
 */
export class ContentRecordFileExistsError extends RecordRefusedError {
	constructor(kind: ContentRecordKind, id: string, operation: "archive" | "restore", takenPath: string) {
		const words = CONTENT_RECORD_WORDS[kind];
		super(
			operation === "archive"
				? `${words.sentenceStart} ${id} cannot be archived: the archive already has a file at ${takenPath}.`
				: `${words.sentenceStart} ${id} cannot be restored: the ${words.folderName} already has a file at ${takenPath}.`,
		);
		this.name = "ContentRecordFileExistsError";
	}
}

/** The line every view of an archived document shows above the document, on every interface. */
export const ARCHIVED_DOCUMENT_NOTICE = "This document is archived and read-only.";

/**
 * Outcome of archiving, restoring or deleting a document or decision. `listedAsDocumentationBy`
 * holds the IDs of the tasks and drafts whose `documentation` list names a path the file is no
 * longer at: the path it left when it was archived or restored, and for a delete also the path it
 * had before it was archived. Core changes none of them, so every interface reports them and a
 * person can update them.
 */
export interface ContentRecordChangeResult {
	id: string;
	listedAsDocumentationBy: string[];
}

/**
 * What every interface reports after archive, restore or delete of a document or decision, one
 * line each: the confirmation, then the tasks and drafts that still name a path the file is no
 * longer at, when there are any.
 */
export function describeContentRecordChange(
	kind: ContentRecordKind,
	operation: ContentRecordOperation,
	result: ContentRecordChangeResult,
): string[] {
	const confirmation = `${CONTENT_RECORD_OPERATION_WORDS[operation].reported} ${CONTENT_RECORD_WORDS[kind].singular} ${result.id}`;
	const references = formatDocumentationReferencesMessage(result.listedAsDocumentationBy);
	return references ? [confirmation, references] : [confirmation];
}

/**
 * What the shared archive, restore and delete need from one content record kind, besides its words
 * (`CONTENT_RECORD_WORDS`) and its storage (`FileSystem.contentRecordStorage`): how an ID is
 * resolved, and how a running server's lists and search follow a record that left or reached its
 * folder. `Core.contentRecords` builds one per kind.
 */
interface ContentRecordOperations<R extends ContentRecord> {
	/** The record an ID names, in its folder or in the archive (`archived` set). Null when none claims it. */
	find(id: string): Promise<R | null>;
	/** The record's file left its folder for the archive. */
	leftFolder(record: R): void;
	/** The record's file reached its folder from the archive. */
	reachedFolder(record: R): void;
}

/** A copy of a record without the `archived` flag, as a record that is listed from its folder is. */
function withoutArchivedFlag<R extends ContentRecord>(record: R): R {
	const copy = { ...record };
	delete copy.archived;
	return copy;
}

/**
 * A change is on disk and only its commit failed. The message says both, so nobody runs the change
 * again: "Task TASK-1 was archived, but committing the change failed: <reason>". The archive,
 * restore and delete operations of tasks, documents and decisions throw this one error for that
 * case, and every interface reports the message as it is.
 *
 * `change` is the part before the comma, for example `Task TASK-1 was archived`. Where the browser
 * calls the operation, core tags the error with `markRecordAlreadyMoved` as well, so that the page
 * refreshes instead of offering the change again.
 */
export class ChangeNotCommittedError extends Error {
	constructor(change: string, cause: unknown) {
		const reason = cause instanceof Error ? cause.message : String(cause);
		super(`${change}, but committing the change failed: ${reason}`);
		this.name = "ChangeNotCommittedError";
	}
}

/** The subject of the commit an operation makes, for example `backlog: Archive decision decision-2`. */
function contentRecordCommitSubject(kind: ContentRecordKind, operation: ContentRecordOperation, id: string): string {
	return `backlog: ${CONTENT_RECORD_OPERATION_WORDS[operation].commitVerb} ${CONTENT_RECORD_WORDS[kind].singular} ${id}`;
}

/** The error for an operation whose change is on disk while its commit failed: "Decision decision-2 was archived, but ...". */
function contentRecordNotCommittedError(
	kind: ContentRecordKind,
	operation: ContentRecordOperation,
	id: string,
	cause: unknown,
): ChangeNotCommittedError {
	const change = `${CONTENT_RECORD_WORDS[kind].sentenceStart} ${id} was ${CONTENT_RECORD_OPERATION_WORDS[operation].done}`;
	return new ChangeNotCommittedError(change, cause);
}

/**
 * Delete targeted a task that tasks or drafts still name as their parent. A subtask's ID is built
 * on the ID the delete would release, and promoting such a draft gives it an ID built on it too.
 */
export class TaskHasSubtasksError extends RecordRefusedError {
	constructor(taskId: string, subtaskIds: string[]) {
		super(`Task ${taskId} cannot be deleted while its subtasks exist: ${subtaskIds.join(", ")}.`);
		this.name = "TaskHasSubtasksError";
	}
}

/** Delete removed the file, but a later step failed. Every interface must report the applied deletion. */
export class TaskDeletionAppliedError extends Error {}

export class Core {
	public fs: FileSystem;
	public git: GitOperations;
	private contentStore?: ContentStore;
	private searchService?: SearchService;
	private readonly enableWatchers: boolean;
	private branchTaskLoader: BranchTaskLoader;
	private projectGeneration = 0;
	private activeBranchFingerprint: string | null = null;
	private activeBranchSnapshotPromise: {
		generation: number;
		settingsKey: string;
		promise: Promise<ActiveBranchSnapshot>;
	} | null = null;
	private activeBranchRefreshPromise: Promise<void> | null = null;
	private remoteRefRefreshPromise: Promise<void> | null = null;
	private lastRemoteRefRefreshAt = 0;

	constructor(projectRoot: string, options?: { enableWatchers?: boolean }) {
		this.fs = new FileSystem(projectRoot);
		this.git = new GitOperations(projectRoot, null, () => this.fs.loadConfig());
		this.branchTaskLoader = new BranchTaskLoader(this.git);
		// Disable watchers by default for CLI commands (non-interactive)
		// Interactive modes (TUI, browser, MCP) should explicitly pass enableWatchers: true
		this.enableWatchers = options?.enableWatchers ?? false;
		// Note: Config is loaded lazily when needed since constructor can't be async
	}

	private async buildTaskIdentityIndex(
		localTasks: Array<Task & { lastModified?: Date }>,
		archivedTasks: Task[],
		branchRecords: BranchTaskStateEntry[],
		statuses: string[],
		resolutionStrategy: "most_recent" | "most_progressed",
		repositoryRoot?: string | null,
		filesystem = this.fs,
		git = this.git,
	): Promise<TaskIdentityIndex> {
		const records: TaskIdentityRecord[] = [];
		for (const task of localTasks) {
			records.push({
				id: task.id,
				type: "task",
				branch: "local",
				path: task.filePath ?? join(filesystem.tasksDir, task.id),
				lastModified:
					task.lastModified ??
					(task.updatedDate ? (parseStoredUtcDate(task.updatedDate) ?? new Date(Number.NaN)) : new Date(0)),
				task: { ...task, source: "local" },
				workingCopy: true,
			});
		}
		for (const task of archivedTasks) {
			records.push({
				id: task.id,
				type: "archived",
				branch: "local",
				path: task.filePath ?? join(filesystem.archiveTasksDir, task.id),
				lastModified:
					task.lastModified ??
					(task.updatedDate ? (parseStoredUtcDate(task.updatedDate) ?? new Date(Number.NaN)) : new Date(0)),
				task: { ...task, source: "archived" },
				workingCopy: true,
			});
		}
		records.push(...branchRecords);

		return new TaskIdentityIndex(
			records,
			{
				repositoryRoot: repositoryRoot === undefined ? await git.getRepositoryRoot() : repositoryRoot,
				projectRoot: filesystem.rootDir,
				backlogDirectory: filesystem.backlogDirName,
			},
			statuses,
			resolutionStrategy,
		);
	}

	async withCreateLock<T>(fn: () => Promise<T>): Promise<T> {
		return await this.fs.withCreateLock(fn);
	}

	async previewDuplicateTaskIdRepair(options: { includeBranches?: boolean } = {}): Promise<DuplicateRepairPlan> {
		const storeAlreadyReady = this.contentStore?.isInitialized() ?? false;
		const store = await this.getContentStore();
		if (storeAlreadyReady) {
			if (options.includeBranches) await this.refreshTasksForTaskRead();
			else await store.refreshLocalTaskCorpus();
		}
		return await previewDuplicateTaskIdRepair(this, options, store.getTaskCorpusSnapshot());
	}

	async repairDuplicateTaskIds(expectedFingerprint: string): Promise<DuplicateRepairResult> {
		const result = await applyDuplicateTaskIdRepair(this, expectedFingerprint);
		if (this.contentStore) {
			await this.contentStore.refreshTasks();
		}
		return result;
	}

	/** Reports draft files whose numeric identities collide, whose frontmatter drifted from their filename, or that are unreadable. */
	async diagnoseDraftIdentity(): Promise<DraftIdentityFindings> {
		return this.fs.diagnoseDraftIdentity();
	}

	/**
	 * Reports document and decision files whose IDs collide or are missing, so lookups can fail
	 * closed. Archived documents and decisions are checked together with the ones in their folder,
	 * because an archived record keeps its ID: one file in each folder with the same ID is a
	 * duplicate.
	 */
	async diagnoseContentIdentity(): Promise<ContentIdentityReport> {
		const unreadableDocuments: string[] = [];
		const unreadableArchivedDocuments: string[] = [];
		const unreadableDecisions: string[] = [];
		const unreadableArchivedDecisions: string[] = [];
		const [documents, archivedDocuments, decisions, archivedDecisions] = await Promise.all([
			this.fs.listDocuments(unreadableDocuments),
			this.fs.listArchivedDocuments(unreadableArchivedDocuments),
			this.fs.listDecisions(unreadableDecisions),
			this.fs.listArchivedDecisions(unreadableArchivedDecisions),
		]);
		// An empty collected path denotes the content directory itself, which the filesystem reports
		// when it could not be scanned at all.
		const locate = (directory: string, path: string) =>
			path ? `${this.fs.backlogDirName}/${directory}/${path}` : `${this.fs.backlogDirName}/${directory}`;
		const describe = (directory: string, item: { path?: string; title: string }) =>
			item.path ? locate(directory, item.path) : item.title;
		return {
			documents: detectContentIdentityIssues(
				[
					...documents.map((document) => ({ id: document.id, path: describe(DEFAULT_DIRECTORIES.DOCS, document) })),
					...archivedDocuments.map((document) => ({
						id: document.id,
						path: describe(DEFAULT_DIRECTORIES.ARCHIVE_DOCS, document),
					})),
				],
				documentIdKey,
				[
					...unreadableDocuments.map((path) => locate(DEFAULT_DIRECTORIES.DOCS, path)),
					...unreadableArchivedDocuments.map((path) => locate(DEFAULT_DIRECTORIES.ARCHIVE_DOCS, path)),
				],
			),
			decisions: detectContentIdentityIssues(
				[
					...decisions.map((decision) => ({
						id: decision.id,
						path: describe(DEFAULT_DIRECTORIES.DECISIONS, decision),
					})),
					...archivedDecisions.map((decision) => ({
						id: decision.id,
						path: describe(DEFAULT_DIRECTORIES.ARCHIVE_DECISIONS, decision),
					})),
				],
				decisionIdKey,
				[
					...unreadableDecisions.map((path) => locate(DEFAULT_DIRECTORIES.DECISIONS, path)),
					...unreadableArchivedDecisions.map((path) => locate(DEFAULT_DIRECTORIES.ARCHIVE_DECISIONS, path)),
				],
			),
		};
	}

	private async resolveCreateOrdinal(inputOrdinal: number | undefined, isDraft: boolean): Promise<number | undefined> {
		if (typeof inputOrdinal === "number") {
			return inputOrdinal;
		}
		if (isDraft) {
			return undefined;
		}

		const tasks = await this.fs.listTasks();
		const ordinals = tasks
			.map((task) => task.ordinal)
			.filter((ordinal): ordinal is number => typeof ordinal === "number" && Number.isFinite(ordinal));

		if (ordinals.length === 0) {
			return tasks.length === 0 ? DEFAULT_ORDINAL_STEP : undefined;
		}

		return Math.max(...ordinals) + DEFAULT_ORDINAL_STEP;
	}

	async getContentStore(progressCallback?: (message: string) => void): Promise<ContentStore> {
		while (true) {
			const generation = this.projectGeneration;
			const filesystem = this.fs;
			const backlogRoot = filesystem.backlogDir;
			let store = this.contentStore;
			if (!store) {
				// Use loadTasks as the task loader to include cross-branch tasks
				store = new ContentStore(
					filesystem,
					(callback, options) => this.loadContentStoreCorpus(callback, options),
					this.enableWatchers,
				);
				this.contentStore = store;
			}

			try {
				await store.ensureInitialized(progressCallback);
			} catch (error) {
				if (
					generation !== this.projectGeneration ||
					filesystem !== this.fs ||
					backlogRoot !== filesystem.backlogDir ||
					store !== this.contentStore
				) {
					continue;
				}
				throw error;
			}
			if (
				generation === this.projectGeneration &&
				filesystem === this.fs &&
				backlogRoot === filesystem.backlogDir &&
				store === this.contentStore
			) {
				return store;
			}
		}
	}

	async getSearchService(): Promise<SearchService> {
		while (true) {
			const generation = this.projectGeneration;
			const filesystem = this.fs;
			const backlogRoot = filesystem.backlogDir;
			const store = await this.getContentStore();
			if (
				generation !== this.projectGeneration ||
				filesystem !== this.fs ||
				backlogRoot !== filesystem.backlogDir ||
				store !== this.contentStore
			) {
				continue;
			}
			let searchService = this.searchService;
			if (!searchService) {
				searchService = new SearchService(store);
				this.searchService = searchService;
			}
			try {
				await searchService.ensureInitialized();
			} catch (error) {
				if (
					generation !== this.projectGeneration ||
					filesystem !== this.fs ||
					backlogRoot !== filesystem.backlogDir ||
					store !== this.contentStore ||
					searchService !== this.searchService
				) {
					continue;
				}
				throw error;
			}
			if (
				generation === this.projectGeneration &&
				filesystem === this.fs &&
				backlogRoot === filesystem.backlogDir &&
				store === this.contentStore &&
				searchService === this.searchService
			) {
				return searchService;
			}
		}
	}

	private async refreshCachedTasksForCrossBranchRead(
		includeCrossBranch: boolean,
		storeAlreadyExisted: boolean,
	): Promise<void> {
		const store = this.contentStore;
		if (!storeAlreadyExisted || !this.enableWatchers || !includeCrossBranch || !store) {
			return;
		}

		await this.refreshTasksForTaskRead();
	}

	private getActiveBranchSettings(config: BacklogConfig | null, filesystem = this.fs) {
		const activeBranchDays = config?.activeBranchDays ?? 30;
		const checkActiveBranches = config?.checkActiveBranches !== false;
		const filesystemOnly = config?.filesystemOnly === true;
		return {
			checkActiveBranches,
			activeBranchDays,
			branchHistoryCutoff:
				checkActiveBranches && !filesystemOnly ? (getBranchHistoryCutoff(activeBranchDays)?.getTime() ?? null) : null,
			remoteOperations: config?.remoteOperations !== false,
			filesystemOnly,
			taskPrefix: config?.prefixes?.task ?? "task",
			taskResolutionStrategy: config?.taskResolutionStrategy ?? "most_progressed",
			statuses: config?.statuses ?? DEFAULT_STATUSES,
			backlogDir: filesystem.backlogDirName,
		};
	}

	private async computeActiveBranchSnapshot(
		config: BacklogConfig | null,
		filesystem = this.fs,
		git = this.git,
	): Promise<ActiveBranchSnapshot> {
		const settings = {
			...this.getActiveBranchSettings(config, filesystem),
		};
		const settingsKey = JSON.stringify(settings);

		git.setConfig(config);
		if (!settings.checkActiveBranches || settings.filesystemOnly) {
			return {
				branchTips: [],
				currentBranch: "",
				fingerprint: settingsKey,
				stabilityFingerprint: settingsKey,
				settingsKey,
			};
		}

		const branchTips = Object.freeze(
			(await git.listRecentBranchTips(settings.activeBranchDays))
				.map((tip) => Object.freeze({ ...tip }))
				.sort(
					(left, right) =>
						left.name.localeCompare(right.name) ||
						left.commit.localeCompare(right.commit) ||
						Number(left.current) - Number(right.current),
				),
		);
		const markedCurrentBranch = branchTips.find((tip) => tip.current && !tip.name.startsWith("origin/"))?.name;
		const currentBranch = markedCurrentBranch ?? (await git.getCurrentBranch()).trim();
		const fingerprintTips = branchTips.map((tip) => (tip.current ? { ...tip, commit: "working-copy" } : tip));
		return {
			branchTips,
			currentBranch,
			fingerprint: JSON.stringify({ ...settings, currentBranch, branchTips: fingerprintTips }),
			stabilityFingerprint: JSON.stringify({ ...settings, currentBranch, branchTips }),
			settingsKey,
		};
	}

	private async getActiveBranchSnapshot(
		config?: BacklogConfig | null,
		generation = this.projectGeneration,
		filesystem = this.fs,
		git = this.git,
	): Promise<ActiveBranchSnapshot> {
		const loadedConfig = config === undefined ? await filesystem.loadConfig() : config;
		const settingsKey = JSON.stringify(this.getActiveBranchSettings(loadedConfig, filesystem));
		if (
			this.activeBranchSnapshotPromise?.generation !== generation ||
			this.activeBranchSnapshotPromise.settingsKey !== settingsKey
		) {
			const snapshotPromise = this.computeActiveBranchSnapshot(loadedConfig, filesystem, git);
			const pending = { generation, settingsKey, promise: snapshotPromise };
			this.activeBranchSnapshotPromise = pending;
			const clearSnapshotPromise = () => {
				if (this.activeBranchSnapshotPromise === pending) this.activeBranchSnapshotPromise = null;
			};
			void snapshotPromise.then(clearSnapshotPromise, clearSnapshotPromise);
		}
		return await this.activeBranchSnapshotPromise.promise;
	}

	private async refreshRemoteRefsForTaskRead(
		config: BacklogConfig | null,
		git = this.git,
		options?: { force?: boolean },
	): Promise<void> {
		if (git !== this.git) return;
		if (
			config?.checkActiveBranches === false ||
			config?.remoteOperations === false ||
			config?.filesystemOnly === true
		) {
			return;
		}
		// Reads may reuse a recent fetch, but task ID allocation may not: an ID that
		// looks free only because remote refs are up to a minute old is an ID another
		// clone has already published.
		const force = options?.force === true;
		if (!force && Date.now() - this.lastRemoteRefRefreshAt < REMOTE_REF_REFRESH_INTERVAL_MS) {
			return;
		}

		// A forced request must observe refs from a fetch that started after the request
		// arrived. Joining a refresh that was already in flight is not enough: it captured
		// remote state before this request, so a push landing while it runs stays invisible
		// and allocation can hand out an ID another clone already published. Waiting that
		// refresh out first leaves the slot empty, so the fetch joined below always starts
		// afterwards. A non-forced request keeps the plain join-or-start behavior.
		if (force && this.remoteRefRefreshPromise) {
			await this.remoteRefRefreshPromise;
			// The project may have been re-pointed while we waited: reinitializeProjectRoot
			// clears this slot and installs a new GitOperations. Starting a fetch for the old
			// project now would publish it into the new project's slot, where a new-project
			// read could join it and skip the refresh it actually needs.
			if (git !== this.git) return;
		}

		if (!this.remoteRefRefreshPromise) {
			const refreshPromise = (async () => {
				git.setConfig(config);
				try {
					await git.fetch();
				} catch (error) {
					console.error("Failed to refresh remote refs:", error);
				} finally {
					if (this.git === git) this.lastRemoteRefRefreshAt = Date.now();
				}
			})();
			this.remoteRefRefreshPromise = refreshPromise;
			const clearRefreshPromise = () => {
				if (this.remoteRefRefreshPromise === refreshPromise) this.remoteRefRefreshPromise = null;
			};
			void refreshPromise.then(clearRefreshPromise, clearRefreshPromise);
		}

		await this.remoteRefRefreshPromise;
	}

	/** Refresh the existing cross-branch store only when relevant config or refs changed. */
	async refreshTasksForTaskRead(): Promise<boolean> {
		while (true) {
			const generation = this.projectGeneration;
			const filesystem = this.fs;
			const git = this.git;
			const backlogRoot = filesystem.backlogDir;
			const projectChanged = () =>
				generation !== this.projectGeneration ||
				filesystem !== this.fs ||
				git !== this.git ||
				backlogRoot !== filesystem.backlogDir;
			const config = await filesystem.loadConfig();
			if (projectChanged()) continue;
			await this.refreshRemoteRefsForTaskRead(config, git);
			if (projectChanged()) continue;
			const snapshot = await this.getActiveBranchSnapshot(config, generation, filesystem, git);
			if (projectChanged()) continue;
			if (snapshot.fingerprint === this.activeBranchFingerprint) {
				const store = this.contentStore;
				if (store?.isInitialized()) await store.refreshLocalTaskCorpus();
				if (projectChanged()) continue;
				return false;
			}

			const joinedExistingRefresh = this.activeBranchRefreshPromise !== null;
			if (!this.activeBranchRefreshPromise) {
				const refreshExistingStore = this.contentStore !== undefined;
				const refreshPromise = (async () => {
					const store = await this.getContentStore();
					if (refreshExistingStore) await store.refreshTasks();
				})();
				this.activeBranchRefreshPromise = refreshPromise;
				const clearRefreshPromise = () => {
					if (this.activeBranchRefreshPromise === refreshPromise) {
						this.activeBranchRefreshPromise = null;
					}
				};
				void refreshPromise.then(clearRefreshPromise, clearRefreshPromise);
			}

			const refreshPromise = this.activeBranchRefreshPromise;
			await refreshPromise;
			if (projectChanged()) continue;
			if (joinedExistingRefresh && this.activeBranchFingerprint !== snapshot.fingerprint) continue;
			return true;
		}
	}

	private filterWorkingCopyTasks(tasks: Task[]): Task[] {
		return tasks.filter(isWorkingCopyTask);
	}

	private async requireCanonicalStatus(status: string): Promise<string> {
		const canonical = await resolveCanonicalStatus(status, this);
		if (canonical) {
			return canonical;
		}
		const validStatuses = await resolveValidStatuses(this);
		throw new Error(`Invalid status: ${status}. Valid statuses are: ${validStatuses.join(", ")}`);
	}

	private async normalizePriority(value: string | undefined): Promise<string | undefined> {
		if (value === undefined || value.trim() === "") {
			return undefined;
		}
		const config = await this.fs.loadConfig();
		const normalized = resolvePriorityValue(value, config);
		if (!normalized) {
			throw new Error(`Invalid priority: ${value}. Valid values are: ${formatValidPriorityValues(config)}`);
		}
		return normalized;
	}

	private async normalizeTaskType(value: string | undefined): Promise<string | undefined> {
		if (value === undefined || value === "") {
			return undefined;
		}
		const config = await this.fs.loadConfig();
		const canonical = resolveTaskTypeValue(value, config);
		if (!canonical) {
			throw new Error(`Invalid type: ${value}. Valid types are: ${formatValidTaskTypeValues(config)}`);
		}
		return canonical;
	}

	private async normalizeProject(value: string | undefined): Promise<string | undefined> {
		if (value === undefined || value === "") {
			return undefined;
		}
		const config = await this.fs.loadConfig();
		const configuredProjects = getProjectValues(config);
		if (configuredProjects.length === 0) {
			throw new Error(noProjectsConfiguredMessage(this.fs.configFilePath));
		}
		const canonical = resolveProjectValue(value, config);
		if (!canonical) {
			throw new Error(`Invalid project: ${value}. Valid projects are: ${formatValidProjectValues(config)}`);
		}
		return canonical;
	}

	/**
	 * Collect the records that name a task ID which demoting or deleting is about to vacate.
	 *
	 * Both free the numeric slot for the allocator, so a reference left behind stops meaning
	 * what it said: once the ID is handed to the next created task, the stale reference silently
	 * resolves to an unrelated task instead of failing closed. The scan covers the active working
	 * copy and the archived corpus, because an archived record is still read by the dependency
	 * graph, and the drafts, because a draft keeps its links when it is promoted.
	 *
	 * A draft is included only when its ID resolves to exactly the file it was read from, which is
	 * what a draft edit requires too. A draft whose file is damaged, or whose ID another file also
	 * claims, is left as it is: a draft edit refuses such a draft, and so does this cleanup.
	 */
	private async collectVacatedIdCleanup(vacatedTaskId: string): Promise<VacatedIdCleanup> {
		const [activeTasks, archivedTasks, drafts] = await Promise.all([
			this.fs.listTasks(),
			this.fs.listArchivedTasks(),
			this.fs.listHealthyDrafts(),
		]);
		const others = (tasks: Task[]) => tasks.filter((task) => !taskIdsEqual(task.id, vacatedTaskId));
		const cleanedDrafts: VacatedIdCleanup["drafts"] = [];
		for (const draft of sanitizeVacatedTaskLinks(drafts, vacatedTaskId)) {
			const reference = await this.fs.resolveDraftReference(draft.id).catch(() => null);
			if (reference && reference.filePath === draft.filePath) {
				cleanedDrafts.push({ ...draft, id: reference.canonicalId, filePath: reference.filePath });
			}
		}
		return {
			active: sanitizeVacatedTaskLinks(others(activeTasks), vacatedTaskId),
			archived: sanitizeVacatedTaskLinks(others(archivedTasks), vacatedTaskId),
			drafts: cleanedDrafts,
		};
	}

	/**
	 * Run a vacating operation while holding the record's lock and the lock of every task and
	 * draft that references the ID it is about to free.
	 *
	 * The set cannot be known without reading the corpus, and a set read before the locks are held
	 * is only a guess: a dependent edited in that window would be rewritten from the pre-edit
	 * snapshot, losing that edit, and a task that started referencing the ID in that window would
	 * not be locked and would keep the reference the operation exists to remove. So the scan is
	 * repeated inside the locks, and a scan naming a record the held locks do not cover releases
	 * them and runs again over the wider set. Widening only ever adds records, and the locks are
	 * always taken through {@link FileSystem.withTaskLocks} and then
	 * {@link FileSystem.withDraftLocks}, which sort them. The allocator lock comes last and covers
	 * the final scan and `run`, excluding creates and archive/restore membership moves throughout that span.
	 * Widening exits all three lock wrappers before retrying; it never takes more task or draft locks
	 * while holding the allocator.
	 *
	 * An arbitrary relationship edit to a record outside the locked set can still add a reference
	 * after the final scan. Such edits do not take the allocator lock. The stale reference renders
	 * as an unknown task ID until the allocator hands the number out again.
	 */
	private async withVacatedIdCleanup<T>(
		target: Pick<Task, "id" | "filePath">,
		vacatedTaskId: string,
		run: (cleanup: VacatedIdCleanup) => Promise<T>,
	): Promise<T> {
		let candidates = await this.collectVacatedIdCleanup(vacatedTaskId);

		for (let attempt = 0; attempt < VACATED_ID_CLEANUP_LOCK_ATTEMPTS; attempt++) {
			const lockedTasks = vacatedIdCleanupTasks(candidates);
			const lockedDrafts = candidates.drafts;
			// Use the same identity relation as the corpus scan. In particular, a bare ID and the
			// configured-prefix spelling it resolves against must not cause pointless widening.
			const coversTask = (task: Task) => lockedTasks.some((candidate) => taskIdsEqual(candidate.id, task.id));
			// A draft is locked as a file, so it is covered when its file is.
			const coversDraft = (draft: Task) => lockedDrafts.some((candidate) => candidate.filePath === draft.filePath);
			// Task locks first, then draft locks, then allocator, on every attempt.
			const outcome = await this.fs.withTaskLocks([target, ...lockedTasks], () =>
				this.fs.withDraftLocks(
					lockedDrafts.map((draft) => ({ filePath: draft.filePath, canonicalId: draft.id })),
					() =>
						this.withCreateLock(async (): Promise<{ value: T } | { widened: VacatedIdCleanup }> => {
							const cleanup = await this.collectVacatedIdCleanup(vacatedTaskId);
							if (!vacatedIdCleanupTasks(cleanup).every(coversTask) || !cleanup.drafts.every(coversDraft)) {
								return { widened: cleanup };
							}
							return { value: await run(cleanup) };
						}),
				),
			);
			if ("value" in outcome) return outcome.value;
			candidates = outcome.widened;
		}

		throw new Error(
			`Could not take a stable set of locks to clean references to ${vacatedTaskId}. Retry once the tasks and drafts referencing it stop changing.`,
		);
	}

	/**
	 * Write the sanitized records. Callers hold the locks for every one of them, taken with the
	 * operation's own lock so the mutation is one span.
	 *
	 * Every task is written to the path it was selected from, never through {@link updateTask}:
	 * that path re-resolves the record by ID, which throws on a contested identity and would fail
	 * the cleanup after the target had already been vacated. The scan already chose the exact files,
	 * and an archived record must not go through {@link updateTask} anyway - it would not be found
	 * in the active corpus and the write would look like a brand-new task whose status just changed.
	 *
	 * A draft goes through the save every draft update uses, which names the file after the draft's
	 * ID and title. A draft whose file was named otherwise is therefore saved under the new name.
	 *
	 * `filePaths` is every path the cleanup changed, for a commit: the files it wrote, and the old
	 * path of a draft it saved under a new name.
	 */
	private async writeVacatedIdCleanup(cleanup: VacatedIdCleanup): Promise<{
		cleanedTaskIds: string[];
		filePaths: string[];
	}> {
		const filePaths: string[] = [];
		const updatedDate = formatUtcTimestamp();
		const writeAll = async () => {
			for (const task of cleanup.active) {
				const updated = { ...task, updatedDate };
				const savedPath = await this.fs.saveTask(updated);
				filePaths.push(savedPath);
				this.contentStore?.upsertTask({ ...updated, filePath: savedPath });
			}
			for (const task of cleanup.archived) {
				const updated = { ...task, updatedDate };
				const savedPath = await this.fs.saveTask(updated);
				filePaths.push(savedPath);
				// The record stays archived, with the reference gone. Refresh exactly this file in any
				// in-process ContentStore: a record elsewhere claiming the same ID is a conflict this
				// cleanup has no business dissolving.
				this.contentStore?.refreshArchivedTask({ ...updated, filePath: savedPath });
			}
			for (const draft of cleanup.drafts) {
				const savedPath = await this.fs.saveDraft({ ...draft, updatedDate });
				filePaths.push(savedPath);
				if (draft.filePath !== savedPath) filePaths.push(draft.filePath);
			}
		};
		// One notification for the whole cleanup, as the bulk writer does for a batch of edits.
		if (this.contentStore) await this.contentStore.batchTaskUpdates(writeAll);
		else await writeAll();
		return { cleanedTaskIds: vacatedIdCleanupTargets(cleanup).map((record) => record.id), filePaths };
	}

	/**
	 * Stage a path an operation wrote or removed. A removed file has a removal to stage only when
	 * Git tracks it; asking first, rather than ignoring a failed `git add`, keeps a real staging
	 * failure from passing as "nothing to commit".
	 */
	private async stageChangedPath(path: string): Promise<void> {
		const removed = !(await Bun.file(path).exists());
		if (removed && (await this.git.getIndexEntries(path)).length === 0) return;
		await this.git.addFile(path);
	}

	async queryTasks(options: TaskQueryOptions = {}): Promise<Task[]> {
		while (true) {
			const generation = this.projectGeneration;
			const filesystem = this.fs;
			const backlogRoot = filesystem.backlogDir;
			const projectChanged = () =>
				generation !== this.projectGeneration || filesystem !== this.fs || backlogRoot !== filesystem.backlogDir;
			const { filters, query, limit } = options;
			const trimmedQuery = query?.trim();
			const includeCrossBranch = options.includeCrossBranch ?? true;
			const milestoneResolverPromise = filters?.milestone
				? Promise.all([filesystem.listMilestones(), filesystem.listArchivedMilestones()]).then(
						([activeMilestones, archivedMilestones]) =>
							createMilestoneFilterValueResolver([...activeMilestones, ...archivedMilestones]),
					)
				: undefined;

			const applyFiltersAndLimit = async (collection: Task[]): Promise<Task[]> => {
				const resolveMilestoneLabel = milestoneResolverPromise ? await milestoneResolverPromise : undefined;
				let filtered = filters ? applyTaskFilters(collection, { ...filters, resolveMilestoneLabel }) : [...collection];
				if (!includeCrossBranch) {
					filtered = this.filterWorkingCopyTasks(filtered);
				}
				if (typeof limit === "number" && limit >= 0) {
					return filtered.slice(0, limit);
				}
				return filtered;
			};

			if (!includeCrossBranch) {
				const localTasks = await filesystem.listTasks();
				if (projectChanged()) continue;
				const tasks = trimmedQuery ? createTaskSearchIndex(localTasks).search({ query: trimmedQuery }) : localTasks;
				const filteredTasks = await applyFiltersAndLimit(tasks);
				if (projectChanged()) continue;
				return filteredTasks;
			}

			const storeAlreadyReady = this.contentStore?.isInitialized() ?? false;
			const store = await this.getContentStore();
			if (projectChanged() || store !== this.contentStore) continue;
			await this.refreshCachedTasksForCrossBranchRead(
				includeCrossBranch,
				storeAlreadyReady && options.refreshCrossBranch !== false,
			);
			if (projectChanged() || store !== this.contentStore) continue;

			if (!trimmedQuery) {
				const filteredTasks = await applyFiltersAndLimit(store.getTasks());
				if (projectChanged() || store !== this.contentStore) continue;
				return filteredTasks;
			}

			const searchService = await this.getSearchService();
			if (projectChanged() || store !== this.contentStore) continue;
			const searchFilters: SearchFilters = {};
			if (filters?.status) {
				searchFilters.status = filters.status;
			}
			if (filters?.excludeStatus) {
				searchFilters.excludeStatus = filters.excludeStatus;
			}
			if (filters?.type) {
				searchFilters.type = filters.type;
			}
			if (filters?.project) {
				searchFilters.project = filters.project;
			}
			if (filters?.priority) {
				searchFilters.priority = filters.priority;
			}
			if (filters?.assignee) {
				searchFilters.assignee = filters.assignee;
			}
			if (filters?.labels) {
				searchFilters.labels = filters.labels;
				searchFilters.labelMatch = filters.labelMatch;
			}

			const searchResults = searchService.search({
				query: trimmedQuery,
				limit,
				types: ["task"],
				filters: Object.keys(searchFilters).length > 0 ? searchFilters : undefined,
			});

			const seen = new Set<string>();
			const tasks: Task[] = [];
			for (const result of searchResults) {
				if (result.type !== "task") continue;
				const task = result.task;
				if (seen.has(task.id)) continue;
				seen.add(task.id);
				tasks.push(task);
			}

			const filteredTasks = await applyFiltersAndLimit(tasks);
			if (projectChanged() || store !== this.contentStore) continue;
			return filteredTasks;
		}
	}

	async getTask(taskId: string, options: TaskReadOptions = {}): Promise<Task | null> {
		while (true) {
			const generation = this.projectGeneration;
			const filesystem = this.fs;
			const backlogRoot = filesystem.backlogDir;
			const projectChanged = () =>
				generation !== this.projectGeneration || filesystem !== this.fs || backlogRoot !== filesystem.backlogDir;
			const storeAlreadyReady = this.contentStore?.isInitialized() ?? false;
			const store = await this.getContentStore();
			if (projectChanged() || store !== this.contentStore) continue;
			if (storeAlreadyReady && options.refreshCrossBranch !== false) {
				await this.refreshTasksForTaskRead();
			}
			if (projectChanged() || store !== this.contentStore) continue;
			const identityResolution = store.resolveTaskForRead(taskId);
			if (identityResolution.status === "ambiguous") {
				throw new AmbiguousTaskIdError(taskId, identityResolution.candidates);
			}
			if (identityResolution.status === "found") return identityResolution.task;
			// Diagnose a file skipped during loading without bypassing the identity index's result.
			try {
				await filesystem.loadTask(taskId);
			} catch (error) {
				if (projectChanged()) continue;
				throw error;
			}
			if (projectChanged()) continue;
			return null;
		}
	}

	async getTaskWithSubtasks(taskId: string, localTasks?: Task[], options: TaskReadOptions = {}): Promise<Task | null> {
		while (true) {
			const generation = this.projectGeneration;
			const filesystem = this.fs;
			const backlogRoot = filesystem.backlogDir;
			const task =
				options.includeCrossBranch === false
					? await this.loadWorkingCopyTask(taskId, false, localTasks)
					: await this.getTask(taskId, options);
			if (generation !== this.projectGeneration || filesystem !== this.fs || backlogRoot !== filesystem.backlogDir)
				continue;
			if (!task) return null;

			const tasks = localTasks ?? (await filesystem.listTasks());
			if (generation !== this.projectGeneration || filesystem !== this.fs || backlogRoot !== filesystem.backlogDir)
				continue;
			return attachSubtaskSummaries(task, tasks);
		}
	}

	async loadTaskById(taskId: string, options: TaskReadOptions = {}): Promise<Task | null> {
		return options.includeCrossBranch === false
			? await this.loadWorkingCopyTask(taskId, false)
			: await this.getTask(taskId, options);
	}

	private async buildWorkingCopyTaskIndex(activeTasks?: Task[]): Promise<TaskIdentityIndex> {
		let suppliedActiveTasks = activeTasks;
		while (true) {
			const filesystem = this.fs;
			const backlogRoot = filesystem.backlogDir;
			const [localTasks, archivedTasks, config] = await Promise.all([
				suppliedActiveTasks ? Promise.resolve(suppliedActiveTasks) : filesystem.listTasks(),
				filesystem.listArchivedTasks(),
				filesystem.loadConfig(),
			]);
			if (this.fs !== filesystem || backlogRoot !== filesystem.backlogDir) {
				suppliedActiveTasks = undefined;
				continue;
			}
			const index = await this.buildTaskIdentityIndex(
				localTasks,
				archivedTasks,
				[],
				config?.statuses ?? [...DEFAULT_STATUSES],
				config?.taskResolutionStrategy ?? "most_progressed",
				null,
				filesystem,
			);
			if (this.fs === filesystem && backlogRoot === filesystem.backlogDir) return index;
			suppliedActiveTasks = undefined;
		}
	}

	async loadWorkingCopyTasks(includeArchived = false): Promise<Task[]> {
		return (await this.buildWorkingCopyTaskIndex()).getTasks(includeArchived);
	}

	private async loadWorkingCopyTask(taskId: string, forMutation: boolean, activeTasks?: Task[]): Promise<Task | null> {
		const index = await this.buildWorkingCopyTaskIndex(activeTasks);
		const resolution = forMutation ? index.resolveForMutation(taskId) : index.resolveForRead(taskId);
		if (resolution.status === "ambiguous") throw new AmbiguousTaskIdError(taskId, resolution.candidates);
		if (resolution.status === "archived") throw new TaskArchivedError(resolution.taskId);
		if (resolution.status === "found") return { ...resolution.task };
		// Lists skip damaged files; an explicit lookup must still report why its task cannot load.
		await this.fs.loadTask(taskId);
		return null;
	}

	/**
	 * Load the task a mutation targets. Only a task on the board can be changed: an ambiguous ID
	 * and an archived task both throw, and null means no working-copy record claims the ID.
	 */
	private async loadTaskForMutation(taskId: string, options: TaskReadOptions = {}): Promise<Task | null> {
		if (options.includeCrossBranch === false) {
			return await this.loadWorkingCopyTask(taskId, true);
		}
		const store = await this.getContentStore();
		await store.refreshTasks();
		const resolution = store.resolveTaskForMutation(taskId);
		if (resolution.status === "ambiguous") throw new AmbiguousTaskIdError(taskId, resolution.candidates);
		if (resolution.status === "archived") throw new TaskArchivedError(resolution.taskId);
		if (resolution.status === "found") return { ...resolution.task };
		await this.fs.loadTask(taskId);
		return null;
	}

	/**
	 * Called when a lifecycle operation finds no record for an ID in the working copy. If the
	 * cross-branch read still finds the task, on the board or in the archive of another branch, it is
	 * read-only here and the caller is told that instead of "not found". An ID that several records
	 * claim across branches fails closed as ambiguous, as it does for a read.
	 *
	 * A caller that reads the working copy only (the CLI) never asks. `task edit` does not ask
	 * either: it reports such a task as not found. The store is read as it is, without a refresh,
	 * because every caller has just loaded or refreshed it to look for the working-copy record.
	 */
	private async refuseTaskOnOtherBranch(taskId: string, options: TaskReadOptions): Promise<void> {
		if (options.includeCrossBranch === false) return;
		const resolution = (await this.getContentStore()).resolveTaskForRead(taskId);
		if (resolution.status === "ambiguous") throw new AmbiguousTaskIdError(taskId, resolution.candidates);
		if (resolution.status === "found") {
			throw new TaskOnOtherBranchError(resolution.task.id, resolution.task.branch);
		}
	}

	/**
	 * Load the archived task that delete or restore targets, from the working copy. A task on the
	 * board throws `TaskNotArchivedError` for that operation, a task that exists only on another
	 * branch throws `TaskOnOtherBranchError`, an ambiguous ID throws, and null means no record
	 * claims the ID.
	 */
	private async loadArchivedTask(
		taskId: string,
		operation: "delete" | "restore",
		options: TaskReadOptions,
	): Promise<Task | null> {
		const task = await this.loadWorkingCopyTask(taskId, false);
		if (!task) await this.refuseTaskOnOtherBranch(taskId, options);
		if (task && task.source !== "archived") throw new TaskNotArchivedError(task.id, operation);
		return task;
	}

	async getTaskContent(taskId: string): Promise<string | null> {
		const task = await this.fs.loadTask(taskId);
		const filePath = task?.filePath ?? null;
		if (!filePath) return null;
		return await Bun.file(filePath).text();
	}

	/**
	 * The document an ID names, from the docs folder or from the archive (`archived` is then set).
	 * Every interface resolves a document ID here. The two folders are searched together, so an ID
	 * that more than one file claims fails closed with `AmbiguousIdError` wherever the files are, and
	 * the message names each file by its path from the project root.
	 */
	async getDocument(documentId: string): Promise<Document | null> {
		const [documents, archivedDocuments] = await Promise.all([
			this.fs.listDocuments(),
			this.fs.listArchivedDocuments(),
		]);
		return findDocumentById([...documents, ...archivedDocuments], documentId, (document) =>
			this.fs.contentRecordProjectPath("document", document),
		);
	}

	/**
	 * The decision an ID names, from the decisions folder or from the archive (`archived` is then
	 * set). Every interface resolves a decision ID here. The two folders are searched together, so an
	 * ID that more than one file claims fails closed with `AmbiguousIdError` wherever the files are,
	 * and the message names each file by its path from the project root.
	 */
	async getDecision(decisionId: string): Promise<Decision | null> {
		const [decisions, archivedDecisions] = await Promise.all([
			this.fs.listDecisions(),
			this.fs.listArchivedDecisions(),
		]);
		return findDecisionById([...decisions, ...archivedDecisions], decisionId, (decision) =>
			this.fs.contentRecordProjectPath("decision", decision),
		);
	}

	/**
	 * What `backlog doc view` prints and the interactive viewer shows for a document: its file as it
	 * is stored and, for an archived document, {@link ARCHIVED_DOCUMENT_NOTICE} on a line above it.
	 * Null when no document claims the ID or its file cannot be read.
	 */
	async getDocumentViewText(documentId: string): Promise<string | null> {
		const document = await this.getDocument(documentId);
		if (!document) return null;

		let content: string;
		try {
			content = await Bun.file(this.fs.contentRecordFilePath("document", document)).text();
		} catch {
			return null;
		}
		return document.archived ? `${ARCHIVED_DOCUMENT_NOTICE}\n\n${content}` : content;
	}

	/**
	 * Re-point this Core instance to a different project root.
	 * Disposes caches and re-creates FileSystem / GitOperations.
	 */
	reinitializeProjectRoot(projectRoot: string): void {
		this.projectGeneration += 1;
		this.disposeSearchService();
		this.disposeContentStore();
		this.fs = new FileSystem(projectRoot);
		this.git = new GitOperations(projectRoot, null, () => this.fs.loadConfig());
		this.branchTaskLoader = new BranchTaskLoader(this.git);
	}

	disposeSearchService(): void {
		if (this.searchService) {
			this.searchService.dispose();
			this.searchService = undefined;
		}
	}

	disposeContentStore(): void {
		if (this.contentStore) {
			this.contentStore.dispose();
			this.contentStore = undefined;
		}
		this.activeBranchFingerprint = null;
		this.activeBranchSnapshotPromise = null;
		this.activeBranchRefreshPromise = null;
		this.remoteRefRefreshPromise = null;
		this.lastRemoteRefRefreshAt = 0;
	}

	// Backward compatibility aliases
	get filesystem() {
		return this.fs;
	}

	get gitOps() {
		return this.git;
	}

	async ensureConfigLoaded(): Promise<void> {
		try {
			const config = await this.fs.loadConfig();
			this.git.setConfig(config);
		} catch (error) {
			// A config value Backlog refuses to read is the user's to fix and must reach the command;
			// only the recoverable git-configuration failures this guard exists for are suppressed.
			if (isConfigValueError(error)) {
				throw error;
			}
			// Config loading failed, git operations will work with null config
			if (process.env.DEBUG) {
				console.warn("Failed to load config for git operations:", error);
			}
		}
	}

	private async getBacklogDirectoryName(): Promise<string> {
		return this.fs.backlogDirName;
	}

	async shouldAutoCommit(overrideValue?: boolean): Promise<boolean> {
		const config = await this.fs.loadConfig();
		this.git.setConfig(config);
		if (config?.filesystemOnly) {
			return false;
		}
		// If override is explicitly provided, use it
		if (overrideValue !== undefined) {
			return overrideValue;
		}
		// Otherwise, check config (default to false for safety)
		return config?.autoCommit ?? false;
	}

	async getGitOps() {
		await this.ensureConfigLoaded();
		return this.git;
	}

	// Config migration
	private parseLegacyInlineArray(value: string): string[] {
		const items: string[] = [];
		let current = "";
		let quote: '"' | "'" | null = null;

		const pushCurrent = () => {
			const normalized = current.trim().replace(/\\(['"])/g, "$1");
			if (normalized) {
				items.push(normalized);
			}
			current = "";
		};

		for (let i = 0; i < value.length; i += 1) {
			const ch = value[i];
			const prev = i > 0 ? value[i - 1] : "";
			if (quote) {
				if (ch === quote && prev !== "\\") {
					quote = null;
					continue;
				}
				current += ch;
				continue;
			}
			if (ch === '"' || ch === "'") {
				quote = ch;
				continue;
			}
			if (ch === ",") {
				pushCurrent();
				continue;
			}
			current += ch;
		}
		pushCurrent();
		return items;
	}

	private stripYamlComment(value: string): string {
		let quote: '"' | "'" | null = null;
		for (let i = 0; i < value.length; i += 1) {
			const ch = value[i];
			const prev = i > 0 ? value[i - 1] : "";
			if (quote) {
				if (ch === quote && prev !== "\\") {
					quote = null;
				}
				continue;
			}
			if (ch === '"' || ch === "'") {
				quote = ch;
				continue;
			}
			if (ch === "#") {
				return value.slice(0, i).trimEnd();
			}
		}
		return value;
	}

	private parseLegacyYamlValue(value: string): string {
		const trimmed = this.stripYamlComment(value).trim();
		const singleQuoted = trimmed.match(/^'(.*)'$/);
		if (singleQuoted?.[1] !== undefined) {
			return singleQuoted[1].replace(/''/g, "'");
		}
		const doubleQuoted = trimmed.match(/^"(.*)"$/);
		if (doubleQuoted?.[1] !== undefined) {
			return doubleQuoted[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
		}
		return trimmed;
	}

	private async extractLegacyConfigMilestones(): Promise<string[]> {
		try {
			const configPath = this.fs.configFilePath;
			const content = await Bun.file(configPath).text();
			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i += 1) {
				const line = lines[i] ?? "";
				const match = line.match(/^(\s*)milestones\s*:\s*(.*)$/);
				if (!match) {
					continue;
				}

				const milestoneIndent = (match[1] ?? "").length;
				const trailing = this.stripYamlComment(match[2] ?? "").trim();
				if (trailing.startsWith("[")) {
					let combined = trailing;
					let closed = trailing.endsWith("]");
					let j = i + 1;
					while (!closed && j < lines.length) {
						const segment = this.stripYamlComment(lines[j] ?? "").trim();
						combined += segment;
						if (segment.includes("]")) {
							closed = true;
							break;
						}
						j += 1;
					}
					if (closed) {
						const openIndex = combined.indexOf("[");
						const closeIndex = combined.lastIndexOf("]");
						if (openIndex !== -1 && closeIndex > openIndex) {
							const parsed = this.parseLegacyInlineArray(combined.slice(openIndex + 1, closeIndex));
							return parsed.map((item) => this.parseLegacyYamlValue(item)).filter(Boolean);
						}
					}
				}
				if (trailing.length > 0) {
					const single = this.parseLegacyYamlValue(trailing);
					return single ? [single] : [];
				}

				const values: string[] = [];
				for (let j = i + 1; j < lines.length; j += 1) {
					const nextLine = lines[j] ?? "";
					if (!nextLine.trim()) {
						continue;
					}
					const nextIndent = nextLine.match(/^\s*/)?.[0].length ?? 0;
					if (nextIndent <= milestoneIndent) {
						break;
					}
					const trimmed = nextLine.trim();
					if (!trimmed.startsWith("-")) {
						continue;
					}
					const itemValue = this.parseLegacyYamlValue(trimmed.slice(1));
					if (itemValue) {
						values.push(itemValue);
					}
				}
				return values;
			}
			return [];
		} catch {
			return [];
		}
	}

	private async migrateLegacyConfigMilestonesToFiles(legacyMilestones: string[]): Promise<void> {
		if (legacyMilestones.length === 0) {
			return;
		}
		const existingMilestones = await this.fs.listMilestones();
		const existingKeys = new Set<string>();
		for (const milestone of existingMilestones) {
			const idKey = milestone.id.trim().toLowerCase();
			const titleKey = milestone.title.trim().toLowerCase();
			if (idKey) {
				existingKeys.add(idKey);
			}
			if (titleKey) {
				existingKeys.add(titleKey);
			}
		}
		for (const name of legacyMilestones) {
			const normalized = name.trim();
			const key = normalized.toLowerCase();
			if (!normalized || existingKeys.has(key)) {
				continue;
			}
			const created = await this.fs.createMilestone(normalized);
			const createdIdKey = created.id.trim().toLowerCase();
			const createdTitleKey = created.title.trim().toLowerCase();
			if (createdIdKey) {
				existingKeys.add(createdIdKey);
			}
			if (createdTitleKey) {
				existingKeys.add(createdTitleKey);
			}
		}
	}

	async ensureConfigMigrated(): Promise<void> {
		await this.ensureConfigLoaded();
		const legacyMilestones = await this.extractLegacyConfigMilestones();
		let config = await this.fs.loadConfig();
		const needsSchemaMigration = !config || needsMigration(config);

		if (needsSchemaMigration) {
			config = migrateConfig(config || {});
		}
		if (legacyMilestones.length > 0) {
			await this.migrateLegacyConfigMilestonesToFiles(legacyMilestones);
		}
		if (config && (needsSchemaMigration || legacyMilestones.length > 0)) {
			// Rewrite config to apply schema defaults and strip legacy milestones key after successful migration.
			await this.fs.saveConfig(config);
		}

		// Run draft prefix migration if needed (one-time migration)
		// This renames task-*.md files in drafts/ to draft-*.md
		if (needsDraftPrefixMigration(config)) {
			await migrateDraftPrefixes(this.fs);
		}
	}

	// ID generation
	/**
	 * Generates the next ID for a given entity type.
	 *
	 * @param type - The entity type (Task, Draft, Document, Decision). Defaults to Task.
	 * @param parent - Optional parent ID for subtask generation (only applicable for tasks).
	 * @returns The next available ID (e.g., "task-42", "draft-5", "doc-3")
	 *
	 * Folder scanning by type:
	 * - Task: /tasks and the archived task directories, cross-branch (if enabled), remote (if enabled)
	 * - Draft: /drafts only
	 * - Document: /docs and the archived documents
	 * - Decision: /decisions and the archived decisions
	 */
	async generateNextId(type: EntityType = EntityType.Task, parent?: string): Promise<string> {
		const config = await this.fs.loadConfig();
		const prefix = getPrefixForType(type, config ?? undefined);

		// Collect existing IDs based on entity type
		const allIds = await this.getExistingIdsForType(type);

		if (parent) {
			// Subtask generation (only applicable for tasks)
			const normalizedParent = allIds.find((id) => taskIdsEqual(parent, id)) ?? normalizeTaskId(parent);
			return generateNextSubtaskId(allIds, normalizedParent, prefix, config?.zeroPaddedIds);
		}

		return generateNextPrefixedId(allIds, prefix, config?.zeroPaddedIds);
	}

	/**
	 * Task files found by name in this project's tasks folder and archived task folders and, inside
	 * a Git repository, in the same folders of every other worktree. A file reserves the number in
	 * its name whatever its frontmatter says, and worktrees share the task ID namespace before their
	 * files are committed.
	 */
	private async loadTaskFileNameEntries(taskPrefix: string): Promise<BranchTaskStateEntry[]> {
		const backlogDir = await this.getBacklogDirectoryName();
		const projectRoot = this.fs.rootDir;
		// This project is always read: outside a Git repository there is no worktree list to find it in.
		const entries = await this.loadTaskFileNameEntriesFromProject(projectRoot, backlogDir, taskPrefix, projectRoot);

		const [repoRoot, worktreeRoots] = await Promise.all([this.git.getRepositoryRoot(), this.git.listWorktreePaths()]);
		if (!repoRoot) {
			return entries;
		}
		const projectRelativePath = relative(repoRoot, projectRoot);
		if (projectRelativePath.startsWith("..") || isAbsolute(projectRelativePath)) {
			return entries;
		}

		for (const worktreeRoot of worktreeRoots) {
			const worktreeProjectRoot = projectRelativePath ? join(worktreeRoot, projectRelativePath) : worktreeRoot;
			if (worktreeProjectRoot === projectRoot) continue;
			entries.push(
				...(await this.loadTaskFileNameEntriesFromProject(worktreeProjectRoot, backlogDir, taskPrefix, worktreeRoot)),
			);
		}

		return entries;
	}

	/**
	 * Task files found by name under one project root: this project, or the same project in another
	 * worktree. `worktreeRoot` labels the entries with the place they were found in.
	 */
	private async loadTaskFileNameEntriesFromProject(
		projectRoot: string,
		backlogDir: string,
		taskPrefix: string,
		worktreeRoot: string,
	): Promise<BranchTaskStateEntry[]> {
		const globPattern = buildGlobPattern(taskPrefix.toLowerCase());
		const directories: Array<{ path: string; type: "task" | "archived" }> = [
			{ path: join(projectRoot, backlogDir, DEFAULT_DIRECTORIES.TASKS), type: "task" },
			...ARCHIVED_TASK_DIRECTORIES.map((directory) => ({
				path: join(projectRoot, backlogDir, directory),
				type: "archived" as const,
			})),
		];
		const entries: BranchTaskStateEntry[] = [];

		for (const { path, type } of directories) {
			let files: string[];
			try {
				files = await Array.fromAsync(new Bun.Glob(globPattern).scan({ cwd: path, followSymlinks: true }));
			} catch {
				continue;
			}

			for (const file of files) {
				const id = extractIdFromFilename(file, taskPrefix);
				if (!id) continue;

				const filePath = join(path, file);
				const stats = await stat(filePath).catch(() => null);
				entries.push({
					id,
					type,
					branch: `worktree:${worktreeRoot}`,
					path: filePath,
					lastModified: stats?.mtime ?? new Date(0),
				});
			}
		}

		return entries;
	}

	/**
	 * Every task ID that is taken: tasks on the board and archived tasks, in the working copy, in
	 * sibling worktrees and (when cross-branch checks are enabled) in the scanned branches. An
	 * archived task keeps its ID, so allocation never hands that ID out again.
	 */
	private async getOccupiedTaskIds(): Promise<string[]> {
		const snapshot = await this.loadTasksWithStableBranchSnapshot({ forceRemoteRefresh: true });
		const config = snapshot.config;
		const taskPrefix = config?.prefixes?.task ?? "task";
		if (!snapshot.identityIndex) throw new Error("Task corpus identity index was not initialized");

		// The identity index holds the IDs stored in frontmatter. A number is also taken when a file
		// name claims it, in this project or in a worktree of the same repository.
		const fileNameEntries = await this.loadTaskFileNameEntries(taskPrefix);
		const occupiedIds = new Set(snapshot.identityIndex.getOccupiedIds());
		for (const entry of fileNameEntries) occupiedIds.add(entry.id);
		return [...occupiedIds];
	}

	/**
	 * Gets all existing IDs for a given entity type.
	 * Used internally by generateNextId to determine the next available ID.
	 */
	private async getExistingIdsForType(type: EntityType): Promise<string[]> {
		switch (type) {
			case EntityType.Task: {
				return this.getOccupiedTaskIds();
			}
			case EntityType.Draft: {
				return this.fs.listOccupiedDraftIds();
			}
			case EntityType.Document: {
				// An archived document keeps its ID, so that ID is taken too.
				const [documents, archivedDocuments] = await Promise.all([
					this.fs.listDocuments(),
					this.fs.listArchivedDocuments(),
				]);
				return [...documents, ...archivedDocuments].map((d) => d.id);
			}
			case EntityType.Decision: {
				// An archived decision keeps its ID, so that ID is taken too.
				const [decisions, archivedDecisions] = await Promise.all([
					this.fs.listDecisions(),
					this.fs.listArchivedDecisions(),
				]);
				return [...decisions, ...archivedDecisions].map((d) => d.id);
			}
			default:
				return [];
		}
	}

	private async writePreparedTask(task: Task, isDraft: boolean): Promise<string> {
		if (isDraft) {
			task.status = "Draft";
			normalizeAssignee(task);
			return await this.fs.saveDraft(task);
		}

		normalizeAssignee(task);
		return await this.fs.saveTask(task);
	}

	private async finalizeCreatedTask(
		task: Task,
		filepath: string,
		isDraft: boolean,
		autoCommit: boolean,
		write?: CreatedTaskWrite,
	): Promise<Task | null> {
		const savedTask = isDraft ? await this.fs.loadDraft(task.id) : await this.fs.loadTask(task.id);

		if (!isDraft && this.contentStore && savedTask) {
			this.contentStore.upsertTask(savedTask);
		}

		if (autoCommit) {
			if (isDraft) {
				await this.git.addFile(filepath);
				if (write) write.generatedIndexEntries = await this.git.getIndexEntries(filepath);
				await this.git.commitTaskChange(task.id, `Create draft ${task.id}`, filepath);
			} else {
				await this.git.addAndCommitTaskFile(task.id, filepath, "create", (entries) => {
					if (write) write.generatedIndexEntries = entries;
				});
			}
		}

		return savedTask;
	}

	private async readFileIfPresent(filePath: string): Promise<Buffer | null> {
		try {
			return await readFile(filePath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw error;
		}
	}

	private async rollbackCreatedTask(write: CreatedTaskWrite): Promise<CreatedTaskRollbackResult> {
		let indexRestored = true;
		if (write.generatedIndexEntries) {
			indexRestored = await this.git.restoreIndexEntriesIfMatches(
				write.filePath,
				write.generatedIndexEntries,
				write.previousIndexEntries ?? [],
			);
		}

		// A create adds one new file and touches no other, so undoing it means removing that file.
		// A file that no longer holds what the create wrote is left for the user.
		const currentContent = await this.readFileIfPresent(write.filePath);
		const stillOwnsCreatedPath = currentContent?.equals(write.createdContent) ?? false;
		let workingPathRestored = false;
		if (currentContent === null) {
			workingPathRestored = true;
		} else if (stillOwnsCreatedPath && indexRestored) {
			await unlink(write.filePath);
			workingPathRestored = true;
		}

		if (this.contentStore) {
			await this.contentStore.refreshTasks();
		}

		return { indexRestored, workingPathRestored };
	}

	async createTaskFromInput(input: TaskCreateInput, autoCommit?: boolean): Promise<{ task: Task; filePath?: string }> {
		if (!input.title || input.title.trim().length === 0) {
			throw new Error("Title is required to create a task.");
		}
		assertSectionInputsSafe(input);

		// Determine if this is a draft BEFORE generating the ID
		const requestedStatus = input.status?.trim();
		const isDraft = requestedStatus?.toLowerCase() === "draft";
		const requestedParentTaskId = input.parentTaskId?.trim();

		// Generate ID with appropriate entity type - drafts get DRAFT-X, tasks get TASK-X
		const entityType = isDraft ? EntityType.Draft : EntityType.Task;

		const normalizedLabels = normalizeStringList(input.labels) ?? [];
		const normalizedAssignees = normalizeStringList(input.assignee) ?? [];
		const normalizedDependencies = parseDelimitedStringList(input.dependencies) ?? [];
		const normalizedReferences = normalizeStringList(input.references) ?? [];
		const normalizedDocumentation = normalizeStringList(input.documentation) ?? [];
		const normalizedModifiedFiles = normalizeStringList(input.modifiedFiles) ?? [];
		const dueDate = normalizeDueDate(input.dueDate, "Due date");

		let status = "";
		if (requestedStatus) {
			if (isDraft) {
				status = "Draft";
			} else {
				status = await this.requireCanonicalStatus(requestedStatus);
			}
		}

		const priority = await this.normalizePriority(input.priority);
		const type = await this.normalizeTaskType(input.type);
		const project = await this.normalizeProject(input.project);
		const createdDate = formatUtcTimestamp();
		if (
			input.ordinal !== undefined &&
			(typeof input.ordinal !== "number" || !Number.isFinite(input.ordinal) || input.ordinal < 0)
		) {
			throw new Error("Ordinal must be a non-negative number.");
		}

		const acceptanceCriteriaItems = Array.isArray(input.acceptanceCriteria)
			? input.acceptanceCriteria
					.map((criterion, index) => ({
						index: index + 1,
						text: String(criterion.text ?? "").trim(),
						checked: Boolean(criterion.checked),
					}))
					.filter((criterion) => criterion.text.length > 0)
			: [];
		const config = await this.fs.loadConfig();
		const definitionOfDoneItems = buildDefinitionOfDoneItems({
			defaults: config?.definitionOfDone,
			add: input.definitionOfDoneAdd,
			disableDefaults: input.disableDefinitionOfDoneDefaults,
		});
		const resolvedStatus = isDraft ? "Draft" : status || config?.defaultStatus || FALLBACK_STATUS;
		// An absent assignee means "no opinion" and takes the configured default; an explicit
		// assignee replaces it entirely, and an explicit empty list means "unassigned".
		const resolvedAssignees =
			input.assignee === undefined ? (normalizeStringList(config?.defaultAssignee) ?? []) : normalizedAssignees;
		const autoCommitEnabled = await this.shouldAutoCommit(autoCommit);

		const { task, write } = await this.withCreateLock(async () => {
			const parentTaskId = requestedParentTaskId
				? await this.resolveParentTaskIdForCreate(requestedParentTaskId)
				: undefined;
			const id = await this.generateNextId(entityType, isDraft ? undefined : parentTaskId);
			// Validated inside the create lock, against the allocated identity: a record can hold a
			// dangling dependency on exactly this not-yet-existing ID, so materializing it with a
			// dependency pointing back would store a cycle that no later edit could have created.
			const { valid: validDependencies, invalid: invalidDependencies } = await validateDependencies(
				normalizedDependencies,
				this,
				{
					id,
					title: input.title.trim(),
					status: resolvedStatus,
					assignee: [],
					createdDate,
					labels: [],
					dependencies: [],
				},
			);
			if (invalidDependencies.length > 0) {
				throw formatMissingDependenciesError(invalidDependencies);
			}
			const ordinal = await this.resolveCreateOrdinal(input.ordinal, isDraft);
			const task: Task = {
				id,
				title: input.title.trim(),
				status: resolvedStatus,
				assignee: resolvedAssignees,
				labels: normalizedLabels,
				dependencies: validDependencies,
				references: normalizedReferences,
				documentation: normalizedDocumentation,
				modifiedFiles: normalizedModifiedFiles,
				rawContent: input.rawContent ?? "",
				createdDate,
				...(dueDate && { dueDate }),
				...(parentTaskId && { parentTaskId }),
				...(priority && { priority }),
				...(type && { type }),
				...(project && { project }),
				...(typeof ordinal === "number" && { ordinal }),
				...(typeof input.milestone === "string" &&
					input.milestone.trim().length > 0 && {
						milestone: input.milestone.trim(),
					}),
				...(typeof input.description === "string" && { description: input.description }),
				...(typeof input.implementationPlan === "string" && { implementationPlan: input.implementationPlan }),
				...(typeof input.implementationNotes === "string" && { implementationNotes: input.implementationNotes }),
				...(typeof input.finalSummary === "string" && { finalSummary: input.finalSummary }),
				...(acceptanceCriteriaItems.length > 0 && { acceptanceCriteriaItems }),
				...(definitionOfDoneItems && definitionOfDoneItems.length > 0 && { definitionOfDoneItems }),
			};

			const targetPath = await this.fs.getTaskWritePath(task, isDraft);
			const previousIndexEntries = autoCommitEnabled ? await this.git.getIndexEntries(targetPath) : undefined;
			const filePath = await this.writePreparedTask(task, isDraft);
			const createdContent = await readFile(filePath);
			const write: CreatedTaskWrite = {
				filePath,
				createdContent,
				previousIndexEntries,
			};
			return {
				task,
				write,
			};
		});

		try {
			const savedTask = await this.finalizeCreatedTask(task, write.filePath, isDraft, autoCommitEnabled, write);
			return { task: savedTask ?? task, filePath: write.filePath };
		} catch (error) {
			let rollback: CreatedTaskRollbackResult;
			try {
				rollback = await this.rollbackCreatedTask(write);
			} catch (rollbackError) {
				const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
				throw new Error(`Task creation failed and cleanup also failed: ${message}`, { cause: error });
			}
			if (!rollback.workingPathRestored || !rollback.indexRestored) {
				if (!rollback.indexRestored) {
					throw new Error(
						`Task creation failed, and Backlog no longer owned the staged entry for ${write.filePath}. The task file and staged Git state were preserved, ${task.id} remains in use, and manual Git review is required before retrying.`,
						{ cause: error },
					);
				}
				throw new Error(
					`Task creation failed, and cleanup could not safely remove the changed file at ${write.filePath}. Your changes were preserved. Review or remove the preserved file before retrying because ${task.id} remains in use.`,
					{ cause: error },
				);
			}
			throw error;
		}
	}

	/**
	 * Resolve `--parent` against the working copy, the same corpus the parent filter and task reads
	 * use, so one ID cannot be an acceptable parent for a child that no task command can then show.
	 */
	private async resolveParentTaskIdForCreate(parentTaskId: string): Promise<string> {
		const parentTask = await this.loadTaskById(parentTaskId, { includeCrossBranch: false });
		if (!parentTask) {
			const config = await this.fs.loadConfig();
			const canonicalParent = canonicalTaskId(parentTaskId, config?.prefixes?.task ?? "task");
			throw new Error(
				`Parent task ${canonicalParent} not found. ${LOCAL_TASK_LOOKUP_HINT} Use an existing task ID with --parent; use --milestone to assign a task to a milestone.`,
			);
		}
		return parentTask.id;
	}

	async createTask(task: Task, autoCommit?: boolean): Promise<string> {
		if (!task.status) {
			const config = await this.fs.loadConfig();
			task.status = config?.defaultStatus || FALLBACK_STATUS;
		}

		const autoCommitEnabled = await this.shouldAutoCommit(autoCommit);
		const filepath = await this.writePreparedTask(task, false);
		await this.finalizeCreatedTask(task, filepath, false, autoCommitEnabled);

		return filepath;
	}

	/**
	 * The stored board record a write is about to replace. An archived task throws. An ID the loaded
	 * store cannot settle (it is unknown or ambiguous there, or no store is loaded) is resolved
	 * against the working copy, where a collision throws and null means no record claims the ID.
	 *
	 * Unlike `loadTaskForMutation`, this never initializes or refreshes the store: it runs inside the
	 * task lock and once per task in bulk writes, so it only reads what is already loaded.
	 */
	private async loadStoredTaskForWrite(taskId: string): Promise<Task | null> {
		if (this.contentStore?.isInitialized()) {
			const resolution = this.contentStore.resolveTaskForMutation(taskId);
			if (resolution.status === "archived") throw new TaskArchivedError(resolution.taskId);
			if (resolution.status === "found") return resolution.task;
		}
		return await this.loadWorkingCopyTask(taskId, true);
	}

	/**
	 * Write a task that lives on the board. The check is made against the stored record, not the
	 * object the caller holds, so an archived task cannot be written through this method either.
	 */
	async updateTask(task: Task, autoCommit?: boolean): Promise<string> {
		normalizeAssignee(task);

		// The stored record also tells whether the status changed, for the status callback.
		const originalTask = await this.loadStoredTaskForWrite(task.id);
		const oldStatus = originalTask?.status ?? "";
		const newStatus = task.status ?? "";
		const statusChanged = oldStatus !== newStatus;

		if (hasUpdatedDateRelevantChanges(originalTask, task)) {
			task.updatedDate = formatUtcTimestamp();
		} else if (originalTask?.updatedDate) {
			task.updatedDate = originalTask.updatedDate;
		} else {
			delete task.updatedDate;
		}

		const filePath = await this.fs.saveTask(task);
		// Keep any in-process ContentStore in sync for immediate UI/search freshness.

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.git.addAndCommitTaskFile(task.id, filePath, "update");
		}

		// Fire status change callback if status changed
		if (statusChanged) {
			await this.executeStatusChangeCallback(task, oldStatus, newStatus);
		}

		return filePath;
	}

	private async applyTaskUpdateInput(
		task: Task,
		input: TaskUpdateInput,
		statusResolver: (status: string) => Promise<string>,
	): Promise<{ task: Task; mutated: boolean }> {
		assertSectionInputsSafe(input);
		if (
			input.acceptanceCriteria !== undefined ||
			input.removeAcceptanceCriteria?.length ||
			input.checkAcceptanceCriteria?.length ||
			input.uncheckAcceptanceCriteria?.length
		) {
			assertValidChecklistMarks(task.rawContent ?? "", "AC");
		}
		if (
			input.removeDefinitionOfDone?.length ||
			input.checkDefinitionOfDone?.length ||
			input.uncheckDefinitionOfDone?.length
		) {
			assertValidChecklistMarks(task.rawContent ?? "", "DOD");
		}
		let mutated = false;

		const applyStringField = (
			value: string | undefined,
			current: string | undefined,
			assign: (next: string) => void,
		) => {
			if (typeof value === "string") {
				const next = value;
				if ((current ?? "") !== next) {
					assign(next);
					mutated = true;
				}
			}
		};

		if (input.title !== undefined) {
			const trimmed = input.title.trim();
			if (trimmed.length === 0) {
				throw new Error("Title cannot be empty.");
			}
			if (task.title !== trimmed) {
				task.title = trimmed;
				mutated = true;
			}
		}

		applyStringField(input.description, task.description, (next) => {
			task.description = next;
		});

		if (input.dueDate !== undefined) {
			const dueDate = input.dueDate === null ? undefined : normalizeDueDate(input.dueDate, "Due date");
			if (task.dueDate !== dueDate) {
				if (dueDate) task.dueDate = dueDate;
				else delete task.dueDate;
				mutated = true;
			}
		}

		if (input.status !== undefined) {
			const canonicalStatus = await statusResolver(input.status);
			if ((task.status ?? "") !== canonicalStatus) {
				task.status = canonicalStatus;
				mutated = true;
			}
		}

		if (input.priority !== undefined) {
			const normalizedPriority = await this.normalizePriority(String(input.priority));
			if (task.priority !== normalizedPriority) {
				task.priority = normalizedPriority;
				mutated = true;
			}
		}

		if (input.type !== undefined) {
			const normalizedType = await this.normalizeTaskType(String(input.type));
			if (task.type !== normalizedType) {
				task.type = normalizedType;
				mutated = true;
			}
		}

		if (input.project !== undefined) {
			const normalizedProject = input.project === null ? undefined : await this.normalizeProject(input.project);
			if ((task.project ?? undefined) !== normalizedProject) {
				if (normalizedProject === undefined) {
					delete task.project;
				} else {
					task.project = normalizedProject;
				}
				mutated = true;
			}
		}

		if (input.milestone !== undefined) {
			const normalizedMilestone =
				input.milestone === null ? undefined : input.milestone.trim().length > 0 ? input.milestone.trim() : undefined;
			if ((task.milestone ?? undefined) !== normalizedMilestone) {
				if (normalizedMilestone === undefined) {
					delete task.milestone;
				} else {
					task.milestone = normalizedMilestone;
				}
				mutated = true;
			}
		}

		if (input.ordinal !== undefined) {
			if (typeof input.ordinal !== "number" || !Number.isFinite(input.ordinal) || input.ordinal < 0) {
				throw new Error("Ordinal must be a non-negative number.");
			}
			if (task.ordinal !== input.ordinal) {
				task.ordinal = input.ordinal;
				mutated = true;
			}
		}

		if (input.assignee !== undefined) {
			const sanitizedAssignee = normalizeStringList(input.assignee) ?? [];
			if (!stringArraysEqual(sanitizedAssignee, task.assignee ?? [])) {
				task.assignee = sanitizedAssignee;
				mutated = true;
			}
		}

		const resolveLabelChanges = (): void => {
			let currentLabels = [...(task.labels ?? [])];
			if (input.labels !== undefined) {
				const sanitizedLabels = normalizeStringList(input.labels) ?? [];
				if (!stringArraysEqual(sanitizedLabels, currentLabels)) {
					task.labels = sanitizedLabels;
					mutated = true;
				}
				currentLabels = sanitizedLabels;
			}

			const labelsToAdd = normalizeStringList(input.addLabels) ?? [];
			if (labelsToAdd.length > 0) {
				const labelSet = new Set(currentLabels.map((label) => label.toLowerCase()));
				for (const label of labelsToAdd) {
					if (!labelSet.has(label.toLowerCase())) {
						currentLabels.push(label);
						labelSet.add(label.toLowerCase());
						mutated = true;
					}
				}
				task.labels = currentLabels;
			}

			const labelsToRemove = normalizeStringList(input.removeLabels) ?? [];
			if (labelsToRemove.length > 0) {
				const removalSet = new Set(labelsToRemove.map((label) => label.toLowerCase()));
				const filtered = currentLabels.filter((label) => !removalSet.has(label.toLowerCase()));
				if (!stringArraysEqual(filtered, currentLabels)) {
					task.labels = filtered;
					mutated = true;
				}
			}
		};

		resolveLabelChanges();

		const resolveDependencies = async (): Promise<void> => {
			let currentDependencies = [...(task.dependencies ?? [])];

			if (input.dependencies !== undefined) {
				const normalized = parseDelimitedStringList(input.dependencies) ?? [];
				const { valid, invalid } = await validateDependencies(normalized, this, task);
				if (invalid.length > 0) {
					throw formatMissingDependenciesError(invalid);
				}
				if (!stringArraysEqual(valid, currentDependencies)) {
					currentDependencies = valid;
					mutated = true;
				}
			}

			if (input.addDependencies && input.addDependencies.length > 0) {
				const additions = parseDelimitedStringList(input.addDependencies) ?? [];
				const { valid, invalid } = await validateDependencies(additions, this, task);
				if (invalid.length > 0) {
					throw formatMissingDependenciesError(invalid);
				}
				const depSet = new Set(currentDependencies);
				for (const dep of valid) {
					if (!depSet.has(dep)) {
						currentDependencies.push(dep);
						depSet.add(dep);
						mutated = true;
					}
				}
			}

			if (input.removeDependencies && input.removeDependencies.length > 0) {
				const removals = parseDelimitedStringList(input.removeDependencies) ?? [];
				const filtered = currentDependencies.filter((dep) => !removals.some((removal) => taskIdsEqual(removal, dep)));
				if (!stringArraysEqual(filtered, currentDependencies)) {
					currentDependencies = filtered;
					mutated = true;
				}
			}

			task.dependencies = currentDependencies;
		};

		await resolveDependencies();

		const resolveReferences = (): void => {
			let currentReferences = [...(task.references ?? [])];
			if (input.references !== undefined) {
				const sanitizedReferences = normalizeStringList(input.references) ?? [];
				if (!stringArraysEqual(sanitizedReferences, currentReferences)) {
					task.references = sanitizedReferences;
					mutated = true;
				}
				currentReferences = sanitizedReferences;
			}

			const referencesToAdd = normalizeStringList(input.addReferences) ?? [];
			if (referencesToAdd.length > 0) {
				const refSet = new Set(currentReferences);
				for (const ref of referencesToAdd) {
					if (!refSet.has(ref)) {
						currentReferences.push(ref);
						refSet.add(ref);
						mutated = true;
					}
				}
				task.references = currentReferences;
			}

			const referencesToRemove = normalizeStringList(input.removeReferences) ?? [];
			if (referencesToRemove.length > 0) {
				const removalSet = new Set(referencesToRemove);
				const filtered = currentReferences.filter((ref) => !removalSet.has(ref));
				if (!stringArraysEqual(filtered, currentReferences)) {
					task.references = filtered;
					mutated = true;
				}
			}
		};

		resolveReferences();

		const resolveDocumentation = (): void => {
			let currentDocumentation = [...(task.documentation ?? [])];
			if (input.documentation !== undefined) {
				const sanitizedDocumentation = normalizeStringList(input.documentation) ?? [];
				if (!stringArraysEqual(sanitizedDocumentation, currentDocumentation)) {
					task.documentation = sanitizedDocumentation;
					mutated = true;
				}
				currentDocumentation = sanitizedDocumentation;
			}

			const documentationToAdd = normalizeStringList(input.addDocumentation) ?? [];
			if (documentationToAdd.length > 0) {
				const docSet = new Set(currentDocumentation);
				for (const doc of documentationToAdd) {
					if (!docSet.has(doc)) {
						currentDocumentation.push(doc);
						docSet.add(doc);
						mutated = true;
					}
				}
				task.documentation = currentDocumentation;
			}

			const documentationToRemove = normalizeStringList(input.removeDocumentation) ?? [];
			if (documentationToRemove.length > 0) {
				const removalSet = new Set(documentationToRemove);
				const filtered = currentDocumentation.filter((doc) => !removalSet.has(doc));
				if (!stringArraysEqual(filtered, currentDocumentation)) {
					task.documentation = filtered;
					mutated = true;
				}
			}
		};

		resolveDocumentation();

		const resolveModifiedFiles = (): void => {
			if (input.modifiedFiles === undefined) {
				return;
			}
			const sanitizedModifiedFiles = normalizeStringList(input.modifiedFiles) ?? [];
			if (!stringArraysEqual(sanitizedModifiedFiles, task.modifiedFiles ?? [])) {
				task.modifiedFiles = sanitizedModifiedFiles;
				mutated = true;
			}
		};

		resolveModifiedFiles();

		const sanitizeAppendInput = (values: string[] | undefined): string[] => {
			if (!values) return [];
			return values.map((value) => String(value).trim()).filter((value) => value.length > 0);
		};

		const appendBlock = (
			existing: string | undefined,
			additions: string[] | undefined,
		): { value?: string; changed: boolean } => {
			const sanitizedAdditions = (additions ?? [])
				.map((value) => String(value).trim())
				.filter((value) => value.length > 0);
			if (sanitizedAdditions.length === 0) {
				return { value: existing, changed: false };
			}
			const current = (existing ?? "").trim();
			const additionBlock = sanitizedAdditions.join("\n\n");
			if (current.length === 0) {
				return { value: additionBlock, changed: true };
			}
			return { value: `${current}\n\n${additionBlock}`, changed: true };
		};

		const containsCommentMarker = (inputValue: string): boolean => /<!--\s*COMMENTS?:/i.test(inputValue);
		const containsCommentDelimiter = (inputValue: string): boolean =>
			/^\s*---\s*$/m.test(inputValue.replace(/\r\n/g, "\n"));

		const sanitizeCommentInput = (value: TaskCommentInput | string): TaskCommentInput | undefined => {
			const rawBody = typeof value === "string" ? value : value.body;
			const body = String(rawBody ?? "")
				.replace(/\r\n/g, "\n")
				.trim();
			if (body.length === 0) return undefined;
			if (containsCommentMarker(body)) {
				throw new Error("Comment body cannot contain Backlog comment markers.");
			}
			if (containsCommentDelimiter(body)) {
				throw new Error("Comment body cannot contain standalone '---' delimiter lines.");
			}
			const author =
				typeof value === "string"
					? undefined
					: String(value.author ?? "")
							.replace(/\s+/g, " ")
							.trim();
			const createdDate = typeof value === "string" ? undefined : String(value.createdDate ?? "").trim();
			if (author && containsCommentMarker(author)) {
				throw new Error("Comment author cannot contain Backlog comment markers.");
			}
			if (author && containsCommentDelimiter(author)) {
				throw new Error("Comment author cannot contain standalone '---' delimiter lines.");
			}
			if (createdDate && containsCommentMarker(createdDate)) {
				throw new Error("Comment created date cannot contain Backlog comment markers.");
			}
			if (createdDate && containsCommentDelimiter(createdDate)) {
				throw new Error("Comment created date cannot contain standalone '---' delimiter lines.");
			}
			return {
				body,
				...(author && { author }),
				...(createdDate && { createdDate }),
			};
		};

		if (input.clearImplementationPlan) {
			if (task.implementationPlan !== undefined) {
				task.implementationPlan = "";
				mutated = true;
			}
		}

		applyStringField(input.implementationPlan, task.implementationPlan, (next) => {
			task.implementationPlan = next;
		});

		const planAppends = sanitizeAppendInput(input.appendImplementationPlan);
		if (planAppends.length > 0) {
			const { value, changed } = appendBlock(task.implementationPlan, planAppends);
			if (changed) {
				task.implementationPlan = value;
				mutated = true;
			}
		}

		if (input.clearImplementationNotes) {
			if (task.implementationNotes !== undefined) {
				task.implementationNotes = "";
				mutated = true;
			}
		}

		applyStringField(input.implementationNotes, task.implementationNotes, (next) => {
			task.implementationNotes = next;
		});

		const notesAppends = sanitizeAppendInput(input.appendImplementationNotes);
		if (notesAppends.length > 0) {
			const { value, changed } = appendBlock(task.implementationNotes, notesAppends);
			if (changed) {
				task.implementationNotes = value;
				mutated = true;
			}
		}

		if (input.appendComments && input.appendComments.length > 0) {
			const currentComments = Array.isArray(task.comments) ? task.comments.map((comment) => ({ ...comment })) : [];
			let nextIndex = currentComments.length > 0 ? Math.max(...currentComments.map((comment) => comment.index)) + 1 : 1;
			const createdDate = formatUtcTimestamp();
			for (const value of input.appendComments) {
				const sanitized = sanitizeCommentInput(value);
				if (!sanitized) continue;
				currentComments.push({
					index: nextIndex++,
					body: sanitized.body,
					createdDate: sanitized.createdDate ?? createdDate,
					...(sanitized.author && { author: sanitized.author }),
				});
				mutated = true;
			}
			if (mutated) {
				task.comments = currentComments;
			}
		}

		if (input.clearFinalSummary) {
			if (task.finalSummary !== undefined) {
				task.finalSummary = "";
				mutated = true;
			}
		}

		applyStringField(input.finalSummary, task.finalSummary, (next) => {
			task.finalSummary = next;
		});

		const finalSummaryAppends = sanitizeAppendInput(input.appendFinalSummary);
		if (finalSummaryAppends.length > 0) {
			const { value, changed } = appendBlock(task.finalSummary, finalSummaryAppends);
			if (changed) {
				task.finalSummary = value;
				mutated = true;
			}
		}

		let acceptanceCriteria = Array.isArray(task.acceptanceCriteriaItems)
			? task.acceptanceCriteriaItems.map((criterion) => ({ ...criterion }))
			: [];

		const rebuildIndices = () => {
			acceptanceCriteria = acceptanceCriteria.map((criterion, index) => ({
				...criterion,
				index: index + 1,
			}));
		};

		if (input.acceptanceCriteria !== undefined) {
			const unmatchedCriteria = [...acceptanceCriteria];
			const sanitized = input.acceptanceCriteria
				.map((criterion) => ({
					text: String(criterion.text ?? "").trim(),
					checked: criterion.checked,
				}))
				.filter((criterion) => criterion.text.length > 0)
				.map((criterion, index) => {
					const matchIndex = unmatchedCriteria.findIndex((previous) => previous.text.trim() === criterion.text);
					const previous = matchIndex < 0 ? undefined : unmatchedCriteria.splice(matchIndex, 1)[0];
					return {
						index: index + 1,
						text: criterion.text,
						checked: typeof criterion.checked === "boolean" ? criterion.checked : (previous?.checked ?? false),
					};
				});
			acceptanceCriteria = sanitized;
			mutated = true;
		}

		if (input.addAcceptanceCriteria && input.addAcceptanceCriteria.length > 0) {
			const additions = input.addAcceptanceCriteria
				.map((criterion) => (typeof criterion === "string" ? criterion.trim() : String(criterion.text ?? "").trim()))
				.filter((text) => text.length > 0);
			let index =
				acceptanceCriteria.length > 0 ? Math.max(...acceptanceCriteria.map((criterion) => criterion.index)) + 1 : 1;
			for (const text of additions) {
				acceptanceCriteria.push({ index: index++, text, checked: false });
				mutated = true;
			}
		}

		if (input.removeAcceptanceCriteria && input.removeAcceptanceCriteria.length > 0) {
			const removalSet = new Set(input.removeAcceptanceCriteria);
			const beforeLength = acceptanceCriteria.length;
			acceptanceCriteria = acceptanceCriteria.filter((criterion) => !removalSet.has(criterion.index));
			if (acceptanceCriteria.length === beforeLength) {
				throw new Error(
					`Acceptance criterion ${Array.from(removalSet)
						.map((index) => `#${index}`)
						.join(", ")} not found. ${formatAvailableIndexHint(
						acceptanceCriteria,
						"No acceptance criteria are defined.",
					)}`,
				);
			}
			mutated = true;
			rebuildIndices();
		}

		const toggleCriteria = (indices: number[] | undefined, checked: boolean) => {
			if (!indices || indices.length === 0) return;
			const missing: number[] = [];
			for (const index of indices) {
				const criterion = acceptanceCriteria.find((item) => item.index === index);
				if (!criterion) {
					missing.push(index);
					continue;
				}
				if (criterion.checked !== checked) {
					criterion.checked = checked;
					mutated = true;
				}
			}
			if (missing.length > 0) {
				const label = missing.map((index) => `#${index}`).join(", ");
				throw new Error(
					`Acceptance criterion ${label} not found. ${formatAvailableIndexHint(
						acceptanceCriteria,
						"No acceptance criteria are defined.",
					)}`,
				);
			}
		};

		toggleCriteria(input.checkAcceptanceCriteria, true);
		toggleCriteria(input.uncheckAcceptanceCriteria, false);

		task.acceptanceCriteriaItems = acceptanceCriteria;

		let definitionOfDone = Array.isArray(task.definitionOfDoneItems)
			? task.definitionOfDoneItems.map((criterion) => ({ ...criterion }))
			: [];

		const rebuildDefinitionIndices = () => {
			definitionOfDone = definitionOfDone.map((criterion, index) => ({
				...criterion,
				index: index + 1,
			}));
		};

		if (input.addDefinitionOfDone && input.addDefinitionOfDone.length > 0) {
			const additions = input.addDefinitionOfDone
				.map((criterion) => (typeof criterion === "string" ? criterion.trim() : String(criterion.text ?? "").trim()))
				.filter((text) => text.length > 0);
			let index =
				definitionOfDone.length > 0 ? Math.max(...definitionOfDone.map((criterion) => criterion.index)) + 1 : 1;
			for (const text of additions) {
				definitionOfDone.push({ index: index++, text, checked: false });
				mutated = true;
			}
		}

		const toggleDefinitionItems = (indices: number[] | undefined, checked: boolean) => {
			if (!indices || indices.length === 0) return;
			const missing: number[] = [];
			for (const index of indices) {
				const criterion = definitionOfDone.find((item) => item.index === index);
				if (!criterion) {
					missing.push(index);
					continue;
				}
				if (criterion.checked !== checked) {
					criterion.checked = checked;
					mutated = true;
				}
			}
			if (missing.length > 0) {
				const label = missing.map((index) => `#${index}`).join(", ");
				throw new Error(
					`Definition of Done item ${label} not found. ${formatAvailableIndexHint(
						definitionOfDone,
						"No Definition of Done items are defined.",
					)}`,
				);
			}
		};

		toggleDefinitionItems(input.checkDefinitionOfDone, true);
		toggleDefinitionItems(input.uncheckDefinitionOfDone, false);

		if (input.removeDefinitionOfDone && input.removeDefinitionOfDone.length > 0) {
			const removalSet = new Set(input.removeDefinitionOfDone);
			const beforeLength = definitionOfDone.length;
			definitionOfDone = definitionOfDone.filter((criterion) => !removalSet.has(criterion.index));
			if (definitionOfDone.length === beforeLength) {
				throw new Error(
					`Definition of Done item ${Array.from(removalSet)
						.map((index) => `#${index}`)
						.join(", ")} not found. ${formatAvailableIndexHint(
						definitionOfDone,
						"No Definition of Done items are defined.",
					)}`,
				);
			}
			mutated = true;
			rebuildDefinitionIndices();
		}

		task.definitionOfDoneItems = definitionOfDone;

		return { task, mutated };
	}

	async updateTaskFromInput(
		taskId: string,
		input: TaskUpdateInput,
		autoCommit?: boolean,
		options: TaskReadOptions = {},
	): Promise<Task> {
		const task = await this.loadTaskForMutation(taskId, options);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		const requestedStatus = input.status?.trim().toLowerCase();
		if (requestedStatus === "draft") {
			// demoteTaskWithUpdates takes the task lock itself, so it must not be nested here.
			return (await this.demoteTaskWithUpdates(task, input, autoCommit, options)).task;
		}

		// Fail fast when another process is mid-edit, and re-read inside the lock so the whole
		// read-modify-write is protected. Locking only the write would still lose an update
		// whenever one writer releases before the next acquires: the second would then apply
		// its changes to a snapshot taken before the first wrote.
		return await this.fs.withTaskLock(task, async () => {
			const current = await this.loadTaskForMutation(taskId, options);
			if (!current) {
				throw new Error(`Task not found: ${taskId}`);
			}

			const { mutated } = await this.applyTaskUpdateInput(current, input, async (status) =>
				this.requireCanonicalStatus(status),
			);

			if (!mutated) {
				return current;
			}

			await this.updateTask(current, autoCommit);
			return current;
		});
	}

	async updateDraft(task: Task, autoCommit?: boolean): Promise<string> {
		// Drafts always keep status Draft
		task.status = "Draft";
		normalizeAssignee(task);
		task.updatedDate = formatUtcTimestamp();

		const previousPath = task.filePath;
		const filepath = await this.fs.saveDraft(task);

		if (await this.shouldAutoCommit(autoCommit)) {
			if (previousPath && previousPath !== filepath) {
				// A title rename moved the file: stage the deletion of the old path together with
				// the addition of the new one, mirroring how task moves stage their renames.
				const repoRoot = await this.git.stageFileMove(previousPath, filepath);
				await this.git.commitFiles(`Update draft ${task.id}`, [previousPath, filepath], repoRoot ?? undefined);
			} else {
				await this.git.addFile(filepath);
				await this.git.commitTaskChange(task.id, `Update draft ${task.id}`, filepath);
			}
		}

		return filepath;
	}

	async updateDraftFromInput(
		reference: DraftFileReference,
		input: TaskUpdateInput,
		autoCommit?: boolean,
	): Promise<Task> {
		// Same discipline as task edits: acquire the namespaced per-file lock before the
		// read-modify-write and re-read inside it, so a concurrent editor fails fast instead of
		// losing its update. The reference's own file is the only thing touched; no id is ever
		// re-resolved to a different path.
		return await this.fs.withDraftLock(reference, async () => {
			const current = await this.fs.draftReferenceFromPath(reference.filePath);
			// Bind the mutated record to the selected file's own identity: a padded filename whose
			// frontmatter carries an unpadded id must keep converging onto that one file instead of
			// minting a second spelling of the same numeric id.
			current.task.id = reference.canonicalId;

			const { mutated } = await this.applyTaskUpdateInput(current.task, input, async (status) => {
				if (status.trim().toLowerCase() !== "draft") {
					throw new Error("Drafts must use status Draft.");
				}
				return "Draft";
			});

			if (!mutated) {
				return current.task;
			}

			const savedPath = await this.updateDraft(current.task, autoCommit);
			const refreshed = await this.fs.draftReferenceFromPath(savedPath);
			return refreshed.task;
		});
	}

	async editTaskOrDraft(
		taskId: string,
		input: TaskUpdateInput,
		autoCommit?: boolean,
		options: TaskReadOptions = {},
	): Promise<TaskEditResult> {
		const resolvedDraft = await this.fs.resolveDraftReference(taskId);
		if (resolvedDraft) {
			const requestedStatus = input.status?.trim();
			const wantsDraft = requestedStatus?.toLowerCase() === "draft";
			if (requestedStatus && !wantsDraft) {
				return {
					task: await this.promoteDraftWithUpdates(resolvedDraft, input, autoCommit),
					cleanedTaskIds: [],
				};
			}
			return { task: await this.updateDraftFromInput(resolvedDraft, input, autoCommit), cleanedTaskIds: [] };
		}

		if (input.status?.trim().toLowerCase() === "draft") {
			const task = await this.loadTaskForMutation(taskId, options);
			if (!task) throw new Error(`Task not found: ${taskId}`);
			return await this.demoteTaskWithUpdates(task, input, autoCommit, options);
		}

		return { task: await this.updateTaskFromInput(taskId, input, autoCommit, options), cleanedTaskIds: [] };
	}

	private async promoteDraftWithUpdates(
		reference: DraftFileReference,
		input: TaskUpdateInput,
		autoCommit?: boolean,
	): Promise<Task> {
		const targetStatus = input.status?.trim();
		if (!targetStatus || targetStatus.toLowerCase() === "draft") {
			throw new Error("Promoting a draft requires a non-draft status.");
		}

		const canonicalStatus = await this.requireCanonicalStatus(targetStatus);

		// Same locked read-apply-promote discipline as edit/promote: hold the draft lock across
		// the whole span and re-read inside it, so a concurrent editor cannot be omitted from the
		// promoted task or left behind as a second record.
		return await this.fs.withDraftLock(reference, async () => {
			const current = await this.fs.draftReferenceFromPath(reference.filePath);
			const draft = current.task;
			draft.id = reference.canonicalId;

			const { mutated } = await this.applyTaskUpdateInput(draft, { ...input, status: undefined }, async (status) => {
				if (status.trim().toLowerCase() !== "draft") {
					throw new Error("Drafts must use status Draft.");
				}
				return "Draft";
			});

			const { promotedTask, savedPath } = await this.withCreateLock(async () => {
				const newTaskId = await this.generateNextId(EntityType.Task, draft.parentTaskId);
				// Same guard as creation: a stored dangling reference can name exactly this allocated
				// ID, so the record's dependencies are re-validated against its final identity. Only
				// the self/cycle guard matters here; stored entries that no longer resolve are legacy
				// defects doctor reports, so the stored list itself is written unchanged.
				await validateDependencies(draft.dependencies ?? [], this, { ...draft, id: newTaskId });
				const draftPath = current.filePath;

				const promotedTask: Task = {
					...draft,
					id: newTaskId,
					status: canonicalStatus,
					// The path must be cleared so the save writes a new file. Left set, the save would take
					// over the source file, and removing the source afterwards would delete the only copy.
					filePath: undefined,
					...(mutated || draft.status !== canonicalStatus ? { updatedDate: formatUtcTimestamp() } : {}),
				};

				normalizeAssignee(promotedTask);
				const savedPath = await this.fs.saveTask(promotedTask, await Bun.file(current.filePath).text());

				if (draftPath) {
					await unlink(draftPath);
				}

				return { promotedTask, savedPath };
			});

			const savedTask = await this.fs.loadTask(promotedTask.id);
			if (this.contentStore && savedTask) {
				this.contentStore.upsertTask(savedTask);
			}

			if (await this.shouldAutoCommit(autoCommit)) {
				await this.commitWrittenFile(
					`backlog: Promote draft ${normalizeId(reference.canonicalId, "draft")}`,
					[reference.filePath],
					savedPath,
				);
			}

			return savedTask ?? { ...promotedTask, filePath: savedPath };
		});
	}

	// Demotion is a read-modify-write of the task file too, reached from both updateTaskFromInput
	// and editTaskOrDraft. The shared cleanup takes task, draft and allocator locks for the whole
	// mutation, so neither caller may take another lock around it.
	private async demoteTaskWithUpdates(
		task: Task,
		input: TaskUpdateInput,
		autoCommit?: boolean,
		options: TaskReadOptions = {},
	): Promise<TaskEditResult> {
		// Editing a task into the Draft status vacates its ID just as `task demote` does, so it
		// runs the same cleanup rather than leaving dependents pointing at the freed ID.
		return await this.withVacatedIdCleanup(task, task.id, async (cleanup) => {
			const current = await this.loadTaskForMutation(task.id, options);
			if (!current) {
				throw new Error(`Task not found: ${task.id}`);
			}

			const { mutated } = await this.applyTaskUpdateInput(current, { ...input, status: undefined }, async (status) => {
				if (status.trim().toLowerCase() === "draft") {
					return "Draft";
				}
				return this.requireCanonicalStatus(status);
			});

			// The record keeps its own links under the new draft identity, so a link naming the task
			// ID it is vacating would rebind to whatever task is allocated that ID next.
			const vacating = withoutVacatedTaskLinks(current, current.id) ?? current;

			// withVacatedIdCleanup already holds the allocator while assigning the draft identity.
			const newDraftId = await this.generateNextId(EntityType.Draft);
			// Mirrors promotion: the allocated draft ID can be named by a stored dangling
			// reference, so the demoted record must not materialize a cycle through it.
			await validateDependencies(vacating.dependencies ?? [], this, { ...vacating, id: newDraftId });
			const taskPath = current.filePath;

			const demotedDraft: Task = {
				...vacating,
				id: newDraftId,
				status: "Draft",
				// The path must be cleared so the save writes a new file. Left set, the save would take
				// over the source file, and removing the source afterwards would delete the only copy.
				filePath: undefined,
				...(mutated || current.status !== "Draft" ? { updatedDate: formatUtcTimestamp() } : {}),
			};

			normalizeAssignee(demotedDraft);
			const savedPath = await this.fs.saveDraft(
				demotedDraft,
				current.filePath ? await Bun.file(current.filePath).text() : undefined,
			);

			if (taskPath) {
				await unlink(taskPath);
			}

			// The draft is written and the task file is gone, so anything failing from here reports
			// the demotion as done, the way the dedicated demote command does.
			let cleanedTaskIds: string[] = [];
			let cleanedPaths: string[] = [];
			try {
				const written = await this.writeVacatedIdCleanup(cleanup);
				cleanedTaskIds = written.cleanedTaskIds;
				cleanedPaths = written.filePaths;
			} catch (error) {
				throw markRecordAlreadyMoved(error, "demotionState", "cleanup");
			}

			try {
				if (await this.shouldAutoCommit(autoCommit)) {
					const previousPaths = current.filePath ? [current.filePath] : [];
					await this.commitWrittenFile(
						`backlog: Demote task ${normalizeTaskId(current.id)}`,
						previousPaths,
						savedPath,
						cleanedPaths,
					);
				}
			} catch (error) {
				throw markRecordAlreadyMoved(error, "demotionState", "commit");
			}

			return {
				task: (await this.fs.loadDraft(demotedDraft.id)) ?? { ...demotedDraft, filePath: savedPath },
				cleanedTaskIds,
			};
		});
	}

	/**
	 * Execute the onStatusChange callback if configured.
	 * Per-task callback takes precedence over global config.
	 * Failures are logged but don't block the status change.
	 */
	private async executeStatusChangeCallback(task: Task, oldStatus: string, newStatus: string): Promise<void> {
		const config = await this.fs.loadConfig();

		// Per-task callback takes precedence over global config
		const callbackCommand = task.onStatusChange ?? config?.onStatusChange;
		if (!callbackCommand) {
			return;
		}

		try {
			const result = await executeStatusCallback({
				command: callbackCommand,
				taskId: task.id,
				oldStatus,
				newStatus,
				taskTitle: task.title,
				cwd: this.fs.rootDir,
			});

			if (!result.success) {
				console.error(`Status change callback failed for ${task.id}: ${result.error ?? "Unknown error"}`);
				if (result.output) {
					console.error(`Callback output: ${result.output}`);
				}
			} else if (process.env.DEBUG && result.output) {
				console.log(`Status change callback output for ${task.id}: ${result.output}`);
			}
		} catch (error) {
			console.error(`Failed to execute status change callback for ${task.id}:`, error);
		}
	}

	async editTask(
		taskId: string,
		input: TaskUpdateInput,
		autoCommit?: boolean,
		options: TaskReadOptions = {},
	): Promise<Task> {
		return await this.updateTaskFromInput(taskId, input, autoCommit, options);
	}

	private async writeTasksBulk(tasks: Task[]): Promise<string[]> {
		const filePaths: string[] = [];
		const updateAll = async () => {
			for (const task of tasks) {
				const filePath = await this.updateTask(task, false);
				filePaths.push(filePath);
				// Keep an in-process ContentStore serving what was just written: without this the
				// server, MCP and TUI keep reading the pre-write copy until a watcher refresh lands.
				this.contentStore?.upsertTask({ ...task, filePath });
			}
		};
		if (this.contentStore) await this.contentStore.batchTaskUpdates(updateAll);
		else await updateAll();
		return filePaths;
	}

	async updateTasksBulk(tasks: Task[], commitMessage?: string, autoCommit?: boolean): Promise<void> {
		const filePaths = await this.fs.withTaskLocks(tasks, async () => await this.writeTasksBulk(tasks));

		// Commit all changes at once if auto-commit is enabled
		if (await this.shouldAutoCommit(autoCommit)) {
			if (filePaths.length > 0) {
				await this.git.addFiles(filePaths);
				await this.git.commitFiles(commitMessage || `Update ${tasks.length} tasks`, filePaths);
			}
		}
	}

	/**
	 * Resolve the task ids of a board move against a freshly refreshed content store.
	 *
	 * Ids are trimmed and de-duplicated by normalized identity while keeping the caller's spelling so
	 * messages echo what was asked for. An identity that matches more than one file fails closed with
	 * the ambiguity error instead of picking a winner. An id the store does not know comes back as
	 * `task: null` with no error, because a gap means different things to different callers.
	 *
	 * The failure semantics stay with the callers on purpose: {@link reorderTask} raises the first
	 * problem and writes all or nothing, while {@link moveTasksToStatus} reports problems per task and
	 * moves the tasks that did resolve.
	 */
	private async resolveTasksForBoardMove(taskIds: readonly string[]): Promise<{
		store: ContentStore;
		resolutions: Array<{ taskId: string; task: Task | null; ambiguity: AmbiguousTaskIdError | null }>;
	}> {
		const requestedIds: string[] = [];
		const seen = new Set<string>();
		for (const rawId of taskIds) {
			const trimmed = String(rawId || "").trim();
			if (!trimmed) continue;
			// Canonical identity collapses cosmetic spellings such as leading zeros, so TASK-1 and
			// TASK-01 cannot both survive and write the same task twice.
			const key = canonicalTaskId(trimmed);
			if (seen.has(key)) continue;
			seen.add(key);
			requestedIds.push(trimmed);
		}

		const store = await this.getContentStore();
		await store.refreshTasks();

		const resolutions = requestedIds.map((taskId) => {
			const resolution = store.resolveTaskForMutation(normalizeTaskId(taskId));
			if (resolution.status === "ambiguous") {
				return { taskId, task: null, ambiguity: new AmbiguousTaskIdError(taskId, resolution.candidates) };
			}
			return { taskId, task: resolution.status === "found" ? resolution.task : null, ambiguity: null };
		});

		return { store, resolutions };
	}

	async reorderTask(params: {
		taskId: string;
		targetStatus: string;
		orderedTaskIds: string[];
		targetMilestone?: string | null;
		commitMessage?: string;
		autoCommit?: boolean;
		defaultStep?: number;
	}): Promise<{ updatedTask: Task; changedTasks: Task[] }> {
		const taskId = normalizeTaskId(String(params.taskId || "").trim());
		const targetStatus = String(params.targetStatus || "").trim();
		const orderedTaskIds = params.orderedTaskIds.map((id) => normalizeTaskId(String(id || "").trim())).filter(Boolean);
		const defaultStep = params.defaultStep ?? DEFAULT_ORDINAL_STEP;

		if (!taskId) throw new Error("taskId is required");
		if (!targetStatus) throw new Error("targetStatus is required");
		if (orderedTaskIds.length === 0) throw new Error("orderedTaskIds must include at least one task");
		if (!orderedTaskIds.includes(taskId)) {
			throw new Error("orderedTaskIds must include the task being moved");
		}

		// A repeated id means the caller sent a corrupt ordering, so reject it rather than let the
		// shared resolver quietly drop it and reorder the column into an order nobody asked for.
		const seen = new Set<string>();
		for (const id of orderedTaskIds) {
			if (seen.has(id)) {
				throw new Error(`Duplicate task id ${id} in orderedTaskIds`);
			}
			seen.add(id);
		}

		const { resolutions } = await this.resolveTasksForBoardMove(orderedTaskIds);
		for (const resolution of resolutions) {
			if (resolution.ambiguity) throw resolution.ambiguity;
		}

		// Tasks that couldn't be loaded (may have been moved/deleted) drop out of the ordering
		const validTasks = resolutions.map((resolution) => resolution.task).filter((t): t is Task => t !== null);

		// Verify the moved task itself exists
		const movedTask = validTasks.find((t) => t.id === taskId);
		if (!movedTask) {
			throw new Error(`Task ${taskId} not found while reordering`);
		}

		// Reject reordering tasks from other branches - they can only be modified in their source branch
		const crossBranchReason = crossBranchMoveReason(movedTask, "reordered");
		if (crossBranchReason) {
			throw new Error(crossBranchReason);
		}

		const hasTargetMilestone = params.targetMilestone !== undefined;
		const normalizedTargetMilestone = normalizeTargetMilestone(params.targetMilestone);

		// Calculate target index within the valid tasks list
		const validOrderedIds = orderedTaskIds.filter((id) => validTasks.some((t) => t.id === id));
		const targetIndex = validOrderedIds.indexOf(taskId);

		if (targetIndex === -1) {
			throw new Error("Implementation error: Task found in validTasks but index missing");
		}

		const previousTask = targetIndex > 0 ? validTasks[targetIndex - 1] : null;
		const nextTask = targetIndex < validTasks.length - 1 ? validTasks[targetIndex + 1] : null;

		const { ordinal: newOrdinal, requiresRebalance } = calculateNewOrdinal({
			previous: previousTask,
			next: nextTask,
			defaultStep,
		});

		const updatedMoved: Task = {
			...movedTask,
			status: targetStatus,
			...(hasTargetMilestone ? { milestone: normalizedTargetMilestone } : {}),
			ordinal: newOrdinal,
		};

		const tasksInOrder: Task[] = validTasks.map((task, index) => (index === targetIndex ? updatedMoved : task));
		const resolutionUpdates = resolveOrdinalConflicts(tasksInOrder, {
			defaultStep,
			startOrdinal: defaultStep,
			forceSequential: requiresRebalance,
		});

		const updatesMap = new Map<string, Task>();
		for (const update of resolutionUpdates) {
			updatesMap.set(update.id, update);
		}
		if (!updatesMap.has(updatedMoved.id)) {
			updatesMap.set(updatedMoved.id, updatedMoved);
		}

		const originalMap = new Map(validTasks.map((task) => [task.id, task]));
		const changedTasks = Array.from(updatesMap.values()).filter((task) => {
			const original = originalMap.get(task.id);
			if (!original) return true;
			return (
				(original.ordinal ?? null) !== (task.ordinal ?? null) ||
				(original.status ?? "") !== (task.status ?? "") ||
				(original.milestone ?? "") !== (task.milestone ?? "")
			);
		});

		if (changedTasks.length > 0) {
			await this.updateTasksBulk(
				changedTasks,
				params.commitMessage ?? `Reorder tasks in ${targetStatus}`,
				params.autoCommit,
			);
		}

		const updatedTask = updatesMap.get(taskId) ?? updatedMoved;
		return { updatedTask, changedTasks };
	}

	/**
	 * Move a set of tasks into a status column, reporting problems per task instead of aborting the
	 * batch. Without `orderedTaskIds` the moved tasks append to the end of the column. With it, the
	 * caller names the column's final order and the moved tasks land exactly there, seeded with
	 * block ordinals the way {@link reorderTask} places a single task.
	 */
	async moveTasksToStatus(params: {
		taskIds: string[];
		targetStatus: string;
		orderedTaskIds?: string[];
		targetMilestone?: string | null;
		commitMessage?: string;
		autoCommit?: boolean;
		defaultStep?: number;
	}): Promise<{ movedTasks: Task[]; changedTasks: Task[]; failures: Array<{ taskId: string; reason: string }> }> {
		const targetStatus = String(params.targetStatus || "").trim();
		if (!targetStatus) throw new Error("targetStatus is required");
		const defaultStep = params.defaultStep ?? DEFAULT_ORDINAL_STEP;

		const { store, resolutions } = await this.resolveTasksForBoardMove(params.taskIds);
		if (resolutions.length === 0) throw new Error("taskIds must include at least one task");

		const failures: Array<{ taskId: string; reason: string }> = [];
		const tasksToMove: Task[] = [];
		for (const { taskId, task, ambiguity } of resolutions) {
			if (ambiguity) {
				failures.push({ taskId, reason: ambiguity.message });
				continue;
			}
			if (!task) {
				failures.push({ taskId, reason: `Task ${taskId} not found.` });
				continue;
			}
			const crossBranchReason = crossBranchMoveReason(task, "moved");
			if (crossBranchReason) {
				failures.push({ taskId, reason: crossBranchReason });
				continue;
			}
			tasksToMove.push(task);
		}

		if (tasksToMove.length === 0) {
			return { movedTasks: [], changedTasks: [], failures };
		}

		// A drop into a milestone lane means the lane as much as the column, so the batch carries the
		// same milestone semantics as a single-task reorder: the field is only touched when the caller
		// names a lane, and the board's no-milestone lane clears it.
		const hasTargetMilestone = params.targetMilestone !== undefined;
		const normalizedTargetMilestone = normalizeTargetMilestone(params.targetMilestone);

		const movedIds = new Set(tasksToMove.map((task) => task.id));
		const applyMove = (task: Task): Task => ({
			...task,
			status: targetStatus,
			...(hasTargetMilestone ? { milestone: normalizedTargetMilestone } : {}),
		});

		let movedTasks: Task[];
		let changedTasks: Task[];

		if (params.orderedTaskIds) {
			// The caller names the target column's final order, so the moved tasks land exactly where
			// the board previewed them instead of appending to the end.
			const seenOrdered = new Set<string>();
			for (const id of params.orderedTaskIds) {
				const key = canonicalTaskId(id);
				if (seenOrdered.has(key)) throw new Error(`Duplicate task ID in orderedTaskIds: ${id}`);
				seenOrdered.add(key);
			}
			for (const task of tasksToMove) {
				if (!seenOrdered.has(canonicalTaskId(task.id))) {
					throw new Error("orderedTaskIds must include every task being moved");
				}
			}

			const movedByKey = new Map(tasksToMove.map((task) => [canonicalTaskId(task.id), task]));
			// A task that failed to resolve is not moving, so it keeps its place and stays out of the
			// target column's ordering.
			const failedKeys = new Set(failures.map((failure) => canonicalTaskId(failure.taskId)));
			const rows: Array<{ task: Task; moved: boolean }> = [];
			for (const id of params.orderedTaskIds) {
				const key = canonicalTaskId(id);
				if (failedKeys.has(key)) continue;
				const movedTask = movedByKey.get(key);
				if (movedTask) {
					rows.push({ task: movedTask, moved: true });
					continue;
				}
				const resolution = store.resolveTaskForMutation(key);
				if (resolution.status === "ambiguous") throw new AmbiguousTaskIdError(id, resolution.candidates);
				// Tasks that couldn't be loaded (may have been moved/deleted) drop out of the ordering
				if (resolution.status === "found") rows.push({ task: resolution.task, moved: false });
			}

			// Seed each run of moved tasks with block ordinals between its unmoved neighbors, exactly
			// as a single-task reorder seeds its midpoint, then let conflict resolution settle the rest.
			let requiresRebalance = false;
			const tasksInOrder: Task[] = [];
			for (let index = 0; index < rows.length; ) {
				const row = rows[index];
				if (!row) break;
				if (!row.moved) {
					tasksInOrder.push(row.task);
					index += 1;
					continue;
				}
				let runEnd = index;
				while (runEnd < rows.length && rows[runEnd]?.moved) runEnd += 1;
				const block = calculateBlockOrdinals({
					previous: index > 0 ? (rows[index - 1]?.task ?? null) : null,
					next: rows[runEnd]?.task ?? null,
					count: runEnd - index,
					defaultStep,
				});
				requiresRebalance = requiresRebalance || block.requiresRebalance;
				for (let offset = index; offset < runEnd; offset += 1) {
					const movedRow = rows[offset];
					if (!movedRow) continue;
					tasksInOrder.push({ ...applyMove(movedRow.task), ordinal: block.ordinals[offset - index] });
				}
				index = runEnd;
			}

			const resolutionUpdates = resolveOrdinalConflicts(tasksInOrder, {
				defaultStep,
				startOrdinal: defaultStep,
				forceSequential: requiresRebalance,
			});
			const updatesMap = new Map(tasksInOrder.map((task) => [task.id, task]));
			for (const update of resolutionUpdates) {
				updatesMap.set(update.id, update);
			}

			const originalMap = new Map([
				...rows.map(({ task }) => [task.id, task] as const),
				...tasksToMove.map((task) => [task.id, task] as const),
			]);
			movedTasks = tasksToMove.map((task) => updatesMap.get(task.id) ?? applyMove(task));
			changedTasks = Array.from(updatesMap.values()).filter((task) => {
				const original = originalMap.get(task.id);
				if (!original) return true;
				return (
					(original.status ?? "") !== (task.status ?? "") ||
					(original.ordinal ?? null) !== (task.ordinal ?? null) ||
					(original.milestone ?? "") !== (task.milestone ?? "")
				);
			});
		} else {
			// A task already in the target column is not moving, so it keeps its place and ordinal;
			// only a named lane still applies to it. Everything else appends after the column as
			// rendered.
			const stayingIds = new Set(tasksToMove.filter((task) => task.status === targetStatus).map((task) => task.id));
			const arriving = tasksToMove.filter((task) => !stayingIds.has(task.id));

			if (arriving.length === 0) {
				movedTasks = tasksToMove.map((task) => applyMove(task));
				changedTasks = movedTasks.filter((task, index) => {
					const original = tasksToMove[index];
					if (!original) return true;
					return original.status !== task.status || (original.milestone ?? "") !== (task.milestone ?? "");
				});
			} else {
				// Ordinal-less column tasks render after ordinal-bearing ones, so they get materialized
				// ordinals rather than letting the appended tasks slot in above them, and a non-finite
				// ordinal from a corrupt file counts as missing instead of poisoning the column.
				// A named lane scopes the ordering to that lane: a drop into Milestone A must not
				// renumber cards that only share the status in other lanes. Staying tasks remain in
				// scope regardless, because a named lane still has to be applied to them.
				const sanitizeOrdinal = (task: Task): Task =>
					task.ordinal === undefined || Number.isFinite(task.ordinal) ? task : { ...task, ordinal: undefined };
				const inTargetLane = (task: Task): boolean =>
					!hasTargetMilestone || (task.milestone?.trim() || "") === (normalizedTargetMilestone ?? "");
				const columnTasks = sortByOrdinal(
					store
						.getTasks({ status: targetStatus })
						.filter((task) => (stayingIds.has(task.id) ? true : !movedIds.has(task.id) && inTargetLane(task)))
						.map(sanitizeOrdinal),
				);
				const tasksInOrder: Task[] = [
					...columnTasks.map((task) => (stayingIds.has(task.id) ? applyMove(task) : task)),
					...arriving.map((task) => ({ ...applyMove(task), ordinal: undefined })),
				];
				const resolutionUpdates = resolveOrdinalConflicts(tasksInOrder, { defaultStep, startOrdinal: defaultStep });
				const updatesMap = new Map(tasksInOrder.map((task) => [task.id, task]));
				for (const update of resolutionUpdates) {
					updatesMap.set(update.id, update);
				}

				const originalMap = new Map([
					...store.getTasks({ status: targetStatus }).map((task) => [task.id, task] as const),
					...tasksToMove.map((task) => [task.id, task] as const),
				]);
				movedTasks = tasksToMove.map((task) => updatesMap.get(task.id) ?? applyMove(task));
				changedTasks = Array.from(updatesMap.values()).filter((task) => {
					const original = originalMap.get(task.id);
					if (!original) return true;
					return (
						(original.status ?? "") !== (task.status ?? "") ||
						(original.ordinal ?? null) !== (task.ordinal ?? null) ||
						(original.milestone ?? "") !== (task.milestone ?? "")
					);
				});
			}
		}

		// A cross-branch card can constrain the ordering, but writing it here would create a local
		// copy of a task the board treats as read-only. It keeps its file untouched on its own branch.
		changedTasks = changedTasks.filter((task) => !task.branch);

		if (changedTasks.length > 0) {
			await this.updateTasksBulk(
				changedTasks,
				params.commitMessage ?? `Move ${changedTasks.length} tasks to ${targetStatus}`,
				params.autoCommit,
			);
		}

		return { movedTasks, changedTasks, failures };
	}

	/**
	 * Move a record's file between its own folder and the archive, creating the destination folder
	 * when it is missing. A file already at the destination stops the move: nothing is replaced, and
	 * `destinationTaken` builds the refusal the caller reports.
	 */
	private async moveRecordFile(
		fromPath: string,
		toPath: string,
		destinationTaken: () => RecordRefusedError,
	): Promise<void> {
		await mkdir(dirname(toPath), { recursive: true });
		try {
			await moveWithoutReplacing(fromPath, toPath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			throw destinationTaken();
		}
	}

	/** Archive a resolved task while its task lock and the create lock are held. */
	private async archiveTaskFile(task: Task, fromPath: string, autoCommit?: boolean): Promise<void> {
		const toPath = join(await this.fs.getArchiveTasksDir(), basename(fromPath));
		await this.moveRecordFile(fromPath, toPath, () => new TaskFileExistsError(task.id, "archive", basename(toPath)));
		this.contentStore?.transitionTask(task.id, { ...task, filePath: toPath, source: "archived" });

		// A failed commit must report that the file has already moved.
		try {
			if (await this.shouldAutoCommit(autoCommit)) {
				const repoRoot = await this.git.stageFileMove(fromPath, toPath);
				await this.git.commitFiles(`backlog: Archive task ${task.id}`, [fromPath, toPath], repoRoot);
			}
		} catch (error) {
			throw markRecordAlreadyMoved(new ChangeNotCommittedError(`Task ${task.id} was archived`, error), "archiveState");
		}
	}

	/**
	 * Move a task off the board into the archive. Any status can be archived. The record keeps its
	 * ID, its status and every link other tasks hold to it, and no other record is rewritten.
	 *
	 * Returns false when no record claims the ID. Every refusal is a `RecordRefusedError`: the task is
	 * archived already, it exists only on another branch, or the archive has a file of its name.
	 */
	async archiveTask(taskId: string, autoCommit?: boolean, options: TaskReadOptions = {}): Promise<boolean> {
		const task = await this.loadTaskForMutation(taskId, options);
		if (!task) {
			await this.refuseTaskOnOtherBranch(taskId, options);
			return false;
		}

		return await this.fs.withTaskLock(task, () =>
			this.withCreateLock(async () => {
				// Membership moves share the allocator boundary with vacated-ID scans, so a child
				// cannot disappear between their active and archived enumerations.
				// A concurrent archive or demotion may have moved the record before this lock was acquired.
				const current = await this.loadTaskForMutation(task.id, options);
				const fromPath = current?.filePath;
				if (!current || !fromPath) return false;
				await this.archiveTaskFile(current, fromPath, autoCommit);
				return true;
			}),
		);
	}

	/**
	 * Permanently remove an archived task. The ID stops being reserved, so the dependencies and
	 * references other tasks and drafts hold to it are removed in the same locked span and reported.
	 *
	 * Returns `success: false` when no record claims the ID. Every refusal is a `RecordRefusedError`:
	 * the task is on the board, it exists only on another branch, or a task on the board, a task in
	 * the archive or a draft names it as its parent. The referencing records are written before the
	 * file is removed. A failure after removal reports that deletion already happened.
	 */
	async deleteTask(taskId: string, autoCommit?: boolean, options: TaskReadOptions = {}): Promise<VacatedTaskResult> {
		const task = await this.loadArchivedTask(taskId, "delete", options);
		if (!task) return { success: false, cleanedTaskIds: [] };
		const autoCommitEnabled = await this.shouldAutoCommit(autoCommit);
		let deletionApplied = false;
		let failureStep = "finishing the deletion";

		try {
			return await this.withVacatedIdCleanup(task, task.id, async (cleanup) => {
				// The cleanup owner holds the allocator through staging and commit, so a create
				// cannot reuse the ID and matching board path before the deletion is committed.
				// Another process may have deleted the record before these locks were held.
				const current = await this.loadArchivedTask(task.id, "delete", options);
				if (!current?.filePath) return { success: false, cleanedTaskIds: [] };
				// A subtask that was demoted is a draft that still names this task as its parent. Drafts are
				// read file by file, as the link cleanup reads them: one damaged draft must not hide the rest.
				const [activeTasks, archivedTasks, drafts] = await Promise.all([
					this.fs.listTasks(),
					this.fs.listArchivedTasks(),
					this.fs.listHealthyDrafts(),
				]);
				const subtasks = findDirectSubtasks(current, [...activeTasks, ...archivedTasks, ...drafts]);
				if (subtasks.length > 0) {
					throw new TaskHasSubtasksError(
						current.id,
						subtasks.map((subtask) => subtask.id),
					);
				}

				const written = await this.writeVacatedIdCleanup(cleanup);
				// unlink removes a symlinked task file as a link; the file it points to is left alone.
				await unlink(current.filePath);
				// Record the mutation before the content store, commit, or any lock release can fail.
				deletionApplied = true;
				this.contentStore?.transitionTask(current.id);

				if (autoCommitEnabled) {
					failureStep = "committing the change";
					// A task file keeps its name through the archive, so this is where the task was on the board.
					// If the archive was never committed, Git still tracks the task there, so its removal is committed too.
					const boardPath = join(this.fs.tasksDir, basename(current.filePath));
					const changedPaths = [current.filePath, boardPath, ...written.filePaths];
					for (const path of changedPaths) await this.stageChangedPath(path);
					await this.git.commitFiles(`backlog: Delete task ${current.id}`, changedPaths);
				}
				failureStep = "releasing deletion locks";
				return { success: true, cleanedTaskIds: written.cleanedTaskIds };
			});
		} catch (error) {
			if (!deletionApplied) throw error;
			if (failureStep === "committing the change") {
				throw new ChangeNotCommittedError(`Task ${task.id} was deleted`, error);
			}
			const reason = error instanceof Error ? error.message : String(error);
			throw new TaskDeletionAppliedError(`Task ${task.id} was deleted, but ${failureStep} failed: ${reason}`);
		}
	}

	/**
	 * Move an archived task back to the board. The file returns to the tasks folder under the same
	 * name and is not rewritten, so the task keeps its ID and the status it had.
	 *
	 * Returns false when no record claims the ID. Every refusal is a `RecordRefusedError`: the task is
	 * already on the board, it exists only on another branch, or the board has a file of its name.
	 */
	async restoreTask(taskId: string, autoCommit?: boolean, options: TaskReadOptions = {}): Promise<boolean> {
		const task = await this.loadArchivedTask(taskId, "restore", options);
		if (!task) return false;

		return await this.fs.withTaskLock(task, () =>
			this.withCreateLock(async () => {
				// Like archive, restore cannot cross a vacated-ID scan between its corpus enumerations.
				// Another process may have restored or deleted the record before these locks were held.
				const current = await this.loadArchivedTask(task.id, "restore", options);
				const fromPath = current?.filePath;
				if (!current || !fromPath) return false;
				const toPath = join(this.fs.tasksDir, basename(fromPath));
				await this.moveRecordFile(
					fromPath,
					toPath,
					() => new TaskFileExistsError(current.id, "restore", basename(toPath)),
				);
				this.contentStore?.transitionTask(current.id, { ...current, filePath: toPath, source: "local" });

				try {
					if (await this.shouldAutoCommit(autoCommit)) {
						const repoRoot = await this.git.stageFileMove(fromPath, toPath);
						await this.git.commitFiles(`backlog: Restore task ${current.id}`, [fromPath, toPath], repoRoot);
					}
				} catch (error) {
					throw new ChangeNotCommittedError(`Task ${current.id} was restored`, error);
				}
				return true;
			}),
		);
	}

	async archiveMilestone(
		identifier: string,
		autoCommit?: boolean,
	): Promise<{ success: boolean; sourcePath?: string; targetPath?: string; milestone?: Milestone }> {
		// Read the config before the move, so a config Backlog refuses to read aborts the command
		// while the milestone is still active rather than after it has been archived.
		const autoCommitEnabled = await this.shouldAutoCommit(autoCommit);
		const result = await this.fs.archiveMilestone(identifier);

		if (result.success && result.sourcePath && result.targetPath && autoCommitEnabled) {
			const repoRoot = await this.git.stageFileMove(result.sourcePath, result.targetPath);
			const label = result.milestone?.id ? ` ${result.milestone.id}` : "";
			const commitPaths = [result.sourcePath, result.targetPath];
			try {
				await this.git.commitFiles(`backlog: Archive milestone${label}`, commitPaths, repoRoot);
			} catch (error) {
				await this.git.resetPaths(commitPaths, repoRoot);
				try {
					await moveFile(result.targetPath, result.sourcePath);
				} catch {
					// Ignore rollback failure and propagate original commit error.
				}
				throw error;
			}
		}

		return {
			success: result.success,
			sourcePath: result.sourcePath,
			targetPath: result.targetPath,
			milestone: result.milestone,
		};
	}

	async renameMilestone(
		identifier: string,
		title: string,
		autoCommit?: boolean,
		dueDate?: string | null,
	): Promise<{
		success: boolean;
		sourcePath?: string;
		targetPath?: string;
		milestone?: Milestone;
		previousTitle?: string;
		previousDueDate?: string;
	}> {
		const result = await this.fs.renameMilestone(identifier, title, dueDate);
		if (!result.success) {
			return result;
		}

		if (result.sourcePath && result.targetPath && (await this.shouldAutoCommit(autoCommit))) {
			const repoRoot = await this.git.stageFileMove(result.sourcePath, result.targetPath);
			const label = result.milestone?.id ? ` ${result.milestone.id}` : "";
			const commitPaths = [result.sourcePath, result.targetPath];
			try {
				await this.git.commitFiles(`backlog: Rename milestone${label}`, commitPaths, repoRoot);
			} catch (error) {
				await this.git.resetPaths(commitPaths, repoRoot);
				const rollbackTitle = result.previousTitle ?? title;
				try {
					await this.fs.renameMilestone(
						result.milestone?.id ?? identifier,
						rollbackTitle,
						result.previousDueDate ?? null,
					);
				} catch {
					// Ignore rollback failure and propagate original commit error.
				}
				throw error;
			}
		}

		return result;
	}

	/**
	 * The board tasks cleanup would archive: tasks in the final status whose last change is older
	 * than the given number of days. An age of 0 selects every finished task.
	 */
	async getTerminalStatusTasksByAge(olderThanDays: number): Promise<Task[]> {
		const tasks = await this.fs.listTasks();
		const config = await this.fs.loadConfig();
		const statuses = config?.statuses ?? [...DEFAULT_STATUSES];
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

		return tasks.filter((task) => {
			if (!isTerminalStatus(task.status, statuses)) return false;

			// Check updatedDate first, then createdDate as fallback
			const taskDate = task.updatedDate || task.createdDate;
			if (!taskDate) return false;

			const date = parseStoredUtcDate(taskDate);
			return date !== null && date < cutoffDate;
		});
	}

	/**
	 * Cleanup, as `backlog cleanup` and the browser's cleanup both run it: archive the tasks the
	 * caller selected with {@link getTerminalStatusTasksByAge}. Only those IDs are archived, so a
	 * task that became eligible after the selection was shown stays on the board.
	 *
	 * Each task is checked under its lock. One that has left the board or the final status since it was
	 * selected is skipped with the reason. One that cannot be archived is a failure with the reason.
	 * Neither stops the others. {@link formatCleanupResult} words the result for both callers.
	 */
	async archiveTerminalStatusTasks(taskIds: string[]): Promise<CleanupResult> {
		const config = await this.fs.loadConfig();
		const statuses = config?.statuses ?? [...DEFAULT_STATUSES];
		const archivedTaskIds: string[] = [];
		const skipped: Array<{ taskId: string; reason: string }> = [];
		const failures: Array<{ taskId: string; reason: string }> = [];
		const leftTheBoard = "it is no longer on the board";
		if (taskIds.length === 0) return { archivedTaskIds, skipped, failures };
		const loadIndex = async () => {
			for (let attempt = 0; ; attempt++) {
				try {
					const snapshot = await this.loadTaskCorpusSnapshot(undefined, { publishSharedState: false });
					if (!snapshot.identityIndex) throw new Error("Task corpus identity index was not initialized");
					return snapshot.identityIndex;
				} catch (error) {
					// A task can move between enumeration and metadata reads. Retry that snapshot,
					// but stop after three attempts so a continuously changing board cannot stall cleanup.
					if ((error as NodeJS.ErrnoException).code !== "ENOENT" || attempt >= 2) throw error;
				}
			}
		};
		const initialIndex = await loadIndex();
		const tasks = taskIds.flatMap((taskId) => {
			const resolution = initialIndex.resolveForMutation(taskId);
			return resolution.status === "found" ? [resolution.task] : [];
		});
		const lockedIds = new Set(tasks.map((task) => canonicalTaskId(task.id)));
		const movedIds = new Set<string>();
		const archiveSelected = async (taskId: string, index: TaskIdentityIndex) => {
			const resolution = index.resolveForMutation(taskId);
			if (resolution.status === "ambiguous") throw new AmbiguousTaskIdError(taskId, resolution.candidates);
			if (resolution.status !== "found") {
				// Explicit lookups still report damaged files that corpus lists omit.
				if (resolution.status === "not-found") await this.fs.loadTask(taskId);
				skipped.push({ taskId, reason: leftTheBoard });
				return;
			}
			const task = resolution.task;
			const identity = canonicalTaskId(task.id);
			if (movedIds.has(identity)) {
				skipped.push({ taskId, reason: leftTheBoard });
			} else if (!lockedIds.has(identity)) {
				throw new Error(`Task ${taskId} changed while cleanup was starting. Preview it again before archiving.`);
			} else if (!isTerminalStatus(task.status, statuses)) {
				skipped.push({ taskId, reason: `its status is now ${task.status}` });
			} else {
				if (!task.filePath) throw new Error(`Task ${taskId} has no file path.`);
				try {
					await this.archiveTaskFile(task, task.filePath);
					archivedTaskIds.push(taskId);
				} finally {
					// Includes a move whose later Git commit failed; do not retry it through an ID alias.
					if (!(await Bun.file(task.filePath).exists())) movedIds.add(identity);
				}
			}
		};
		const runSelected = async (operation: (taskId: string) => Promise<void>) => {
			for (const taskId of taskIds) {
				try {
					await operation(taskId);
				} catch (error) {
					failures.push({ taskId, reason: error instanceof Error ? error.message : String(error) });
				}
			}
		};

		// Task locks come before the create lock, as in single-task archive. Once both are held,
		// one fresh identity index is safe for the whole batch instead of rescanning for every ID.
		let batchStarted = false;
		try {
			await this.fs.withTaskLocks(tasks, () =>
				this.withCreateLock(async () => {
					batchStarted = true;
					const currentIndex = await loadIndex();
					await runSelected((taskId) => archiveSelected(taskId, currentIndex));
				}),
			);
		} catch (error) {
			if (batchStarted) throw error;
			// A busy or moved task must not stop unrelated tasks. No writes happened before the
			// batch acquired every lock, so it is safe to retry each task with the same checks.
			await runSelected(async (taskId) => {
				const currentIndex = await loadIndex();
				const resolution = currentIndex.resolveForMutation(taskId);
				if (resolution.status !== "found") return await archiveSelected(taskId, currentIndex);
				let taskStarted = false;
				try {
					await this.fs.withTaskLock(resolution.task, () =>
						this.withCreateLock(async () => {
							taskStarted = true;
							await archiveSelected(taskId, await loadIndex());
						}),
					);
				} catch (error) {
					if (taskStarted) throw error;
					// It can leave the board between the refreshed lookup and lock acquisition too.
					const latestIndex = await loadIndex();
					if (latestIndex.resolveForMutation(taskId).status === "found") throw error;
					await archiveSelected(taskId, latestIndex);
				}
			});
		}
		return { archivedTaskIds, skipped, failures };
	}

	async archiveDraft(draftId: string, autoCommit?: boolean): Promise<boolean> {
		// Read the config before the move: a config Backlog refuses to read must abort the command
		// while the draft is still where the user left it, not after it has been half-archived.
		const autoCommitEnabled = await this.shouldAutoCommit(autoCommit);
		const moved = await this.fs.archiveDraft(draftId);

		if (moved && autoCommitEnabled) {
			await this.commitWrittenFile(
				`backlog: Archive draft ${normalizeId(draftId, "draft")}`,
				[moved.sourcePath],
				moved.targetPath,
			);
		}

		return moved !== null;
	}

	async promoteDraft(draftId: string, autoCommit?: boolean): Promise<boolean> {
		// Whole-file operation: filename binding decides which file is promoted, so resolution
		// goes through the file resolver and frontmatter equivalence is not required.
		const sourcePath = await this.fs.resolveDraftFilePath(draftId);
		if (!sourcePath) return false;
		const canonicalId = extractDraftIdFromFilename(basename(sourcePath));
		if (!canonicalId) return false;

		// Hold the draft lock across the read-unlink span so a concurrent edit cannot be omitted
		// from the promoted task or leave both records on disk. Draft lock first, create lock
		// second: nothing acquires them in the opposite order, so this cannot deadlock.
		// "false" means there is no draft to promote: no file, or a file that cannot be read as a
		// draft. Every other failure, such as a write that is refused because the new task's path is
		// taken, reaches the caller with its own message.
		return await this.fs.withDraftLock({ filePath: sourcePath, canonicalId }, async () => {
			const moved = await this.withCreateLock(async () => {
				const draft = await this.fs.loadDraftFromFile(sourcePath);
				if (!draft) return null;

				const config = await this.fs.loadConfig();
				const newTaskId = await this.generateNextId(EntityType.Task, draft.parentTaskId);
				const promotedStatus =
					!draft.status || draft.status.trim().toLowerCase() === "draft"
						? config?.defaultStatus || FALLBACK_STATUS
						: draft.status;

				const promotedTask: Task = {
					...draft,
					id: newTaskId,
					status: promotedStatus,
					// The path must be cleared so the save writes a new file. Left set, the save would take
					// over the source file, and removing the source afterwards would delete the only copy.
					filePath: undefined,
				};

				normalizeAssignee(promotedTask);
				const savedPath = await this.fs.saveTask(promotedTask, await Bun.file(sourcePath).text());
				await unlink(sourcePath);

				const savedTask = await this.fs.loadTask(promotedTask.id);
				if (this.contentStore && savedTask) {
					this.contentStore.upsertTask(savedTask);
				}

				return { previousPath: sourcePath, savedPath };
			});

			if (moved && (await this.shouldAutoCommit(autoCommit))) {
				await this.commitWrittenFile(
					`backlog: Promote draft ${normalizeId(draftId, "draft")}`,
					[moved.previousPath],
					moved.savedPath,
				);
			}

			return moved !== null;
		});
	}

	async demoteTask(taskId: string, autoCommit?: boolean, options: TaskReadOptions = {}): Promise<VacatedTaskResult> {
		const task = await this.loadTaskForMutation(taskId, options);
		if (!task) return { success: false, cleanedTaskIds: [] };
		// Direct demotion is a read-modify-write too. Hold the task lock across the
		// filesystem read and move so an in-flight task update cannot recreate the
		// active file after this operation has written the draft. The record demoted here also
		// vacates its task ID, so the dependents are locked and cleaned in the same span.
		const demotion = {
			success: false,
			moved: undefined as { previousPath: string; savedPath: string } | undefined,
			cleanedTaskIds: [] as string[],
			cleanedPaths: [] as string[],
		};
		let result: typeof demotion;
		try {
			result = await this.withVacatedIdCleanup(task, task.id, async (cleanup) => {
				const movedPaths: Array<{ previousPath: string; savedPath: string }> = [];
				const success = await this.fs.demoteTask(task.id, (previousPath, savedPath) => {
					movedPaths.push({ previousPath, savedPath });
				});
				// Record the move before anything that can fail after it. A cleanup write that
				// throws must still report the demotion as "moved", or a client is told the task
				// is untouched and retries a demotion that already happened.
				demotion.success = success;
				demotion.moved = movedPaths[0];
				if (success) {
					this.contentStore?.transitionTask(task.id);
					try {
						const written = await this.writeVacatedIdCleanup(cleanup);
						demotion.cleanedTaskIds = written.cleanedTaskIds;
						demotion.cleanedPaths = written.filePaths;
					} catch (error) {
						throw markRecordAlreadyMoved(error, "demotionState", "cleanup");
					}
				}
				return demotion;
			});
		} catch (error) {
			// The lock wrapper can fail while releasing after the move completed. Keep
			// the mutation outcome visible to the Web API and other clients.
			if (demotion.success && demotion.moved) {
				throw markRecordAlreadyMoved(error, "demotionState");
			}
			throw error;
		}
		const { success, moved, cleanedTaskIds, cleanedPaths } = result;

		if (success && moved) {
			try {
				if (await this.shouldAutoCommit(autoCommit)) {
					await this.commitWrittenFile(
						`backlog: Demote task ${task.id}`,
						[moved.previousPath],
						moved.savedPath,
						cleanedPaths,
					);
				}
			} catch (error) {
				throw markRecordAlreadyMoved(error, "demotionState", "commit");
			}
		}

		return { success, cleanedTaskIds };
	}

	/**
	 * Add acceptance criteria to a task
	 */
	async addAcceptanceCriteria(taskId: string, criteria: string[], autoCommit?: boolean): Promise<void> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		// Get existing criteria or initialize empty array
		const current = Array.isArray(task.acceptanceCriteriaItems) ? [...task.acceptanceCriteriaItems] : [];

		// Calculate next index (1-based)
		let nextIndex = current.length > 0 ? Math.max(...current.map((c) => c.index)) + 1 : 1;

		// Append new criteria
		const newCriteria = criteria.map((text) => ({ index: nextIndex++, text, checked: false }));
		task.acceptanceCriteriaItems = [...current, ...newCriteria];

		// Save the task
		await this.updateTask(task, autoCommit);
	}

	/**
	 * Remove acceptance criteria by indices (supports batch operations)
	 * @returns Array of removed indices
	 */
	async removeAcceptanceCriteria(taskId: string, indices: number[], autoCommit?: boolean): Promise<number[]> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}
		assertValidChecklistMarks(task.rawContent ?? "", "AC");

		let list = Array.isArray(task.acceptanceCriteriaItems) ? [...task.acceptanceCriteriaItems] : [];
		const removed: number[] = [];

		// Sort indices in descending order to avoid index shifting issues
		const sortedIndices = [...indices].sort((a, b) => b - a);

		for (const idx of sortedIndices) {
			const before = list.length;
			list = list.filter((c) => c.index !== idx);
			if (list.length < before) {
				removed.push(idx);
			}
		}

		if (removed.length === 0) {
			throw new Error("No criteria were removed. Check that the specified indices exist.");
		}

		// Re-index remaining items (1-based)
		list = list.map((c, i) => ({ ...c, index: i + 1 }));
		task.acceptanceCriteriaItems = list;

		// Save the task
		await this.updateTask(task, autoCommit);

		return removed.sort((a, b) => a - b); // Return in ascending order
	}

	/**
	 * Check or uncheck acceptance criteria by indices (supports batch operations)
	 * Silently ignores invalid indices and only updates valid ones.
	 * @returns Array of updated indices
	 */
	async checkAcceptanceCriteria(
		taskId: string,
		indices: number[],
		checked: boolean,
		autoCommit?: boolean,
	): Promise<number[]> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}
		assertValidChecklistMarks(task.rawContent ?? "", "AC");

		let list = Array.isArray(task.acceptanceCriteriaItems) ? [...task.acceptanceCriteriaItems] : [];
		const updated: number[] = [];

		// Filter to only valid indices and update them
		for (const idx of indices) {
			if (list.some((c) => c.index === idx)) {
				list = list.map((c) => {
					if (c.index === idx) {
						updated.push(idx);
						return { ...c, checked };
					}
					return c;
				});
			}
		}

		if (updated.length === 0) {
			throw new Error("No criteria were updated.");
		}

		task.acceptanceCriteriaItems = list;

		// Save the task
		await this.updateTask(task, autoCommit);

		return updated.sort((a, b) => a - b);
	}

	/**
	 * List all acceptance criteria for a task
	 */
	async listAcceptanceCriteria(taskId: string): Promise<AcceptanceCriterion[]> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		return task.acceptanceCriteriaItems || [];
	}

	/**
	 * Stage and commit a single written file, scoped to exactly the paths this write touched
	 * (the new file, plus any previous paths it replaced, plus the other paths the same operation
	 * changed). Never sweeps in unrelated dirty state.
	 */
	private async commitWrittenFile(
		message: string,
		previousPaths: string[],
		newPath: string,
		alsoChangedPaths: string[] = [],
	): Promise<void> {
		for (const changedPath of alsoChangedPaths) {
			await this.stageChangedPath(changedPath);
		}
		if (previousPaths.length > 0) {
			let repoRoot: string | null = null;
			for (const previousPath of previousPaths) {
				repoRoot = await this.git.stageFileMove(previousPath, newPath);
			}
			await this.git.commitFiles(message, [...previousPaths, newPath, ...alsoChangedPaths], repoRoot);
		} else {
			await this.git.addFile(newPath);
			await this.git.commitFiles(message, [newPath, ...alsoChangedPaths]);
		}
	}

	async createDecision(decision: Decision, autoCommit?: boolean): Promise<void> {
		const { filepath, movedFrom } = await this.fs.saveDecision(decision).catch(refuseBrokenFrontmatterReference);

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.commitWrittenFile(`backlog: Add decision ${decision.id}`, movedFrom ? [movedFrom] : [], filepath);
		}
	}

	/**
	 * Change a decision in the decisions folder from its Markdown. An archived decision is read-only:
	 * the update is refused with `ContentRecordArchivedError` and no file is written. The web save
	 * updates through this method.
	 */
	async updateDecisionFromContent(decisionId: string, content: string, autoCommit?: boolean): Promise<void> {
		const existingDecision = await this.getDecision(decisionId);
		if (!existingDecision) {
			throw new Error(decisionNotFoundMessage(decisionId));
		}
		if (existingDecision.archived) {
			throw new ContentRecordArchivedError("decision", existingDecision.id);
		}

		// Parse the markdown content to extract the decision data
		const frontmatter = parseFrontmatter(content, ["date"]).data as Partial<
			Pick<Decision, "title" | "status" | "date">
		>;

		const updatedDecision = {
			...existingDecision,
			title: frontmatter.title || existingDecision.title,
			status: frontmatter.status || existingDecision.status,
			date: frontmatter.date || existingDecision.date,
			context: extractSection(content, "Context") ?? existingDecision.context,
			decision: extractSection(content, "Decision") ?? existingDecision.decision,
			consequences: extractSection(content, "Consequences") ?? existingDecision.consequences,
			alternatives: extractSection(content, "Alternatives") ?? existingDecision.alternatives,
		};

		await this.createDecision(updatedDecision, autoCommit);
	}

	async createDecisionWithTitle(title: string, autoCommit?: boolean): Promise<Decision> {
		const id = await generateNextDecisionId(this);

		const decision: Decision = {
			id,
			title,
			date: formatUtcTimestamp(),
			status: "proposed",
			context: "[Describe the context and problem that needs to be addressed]",
			decision: "[Describe the decision that was made]",
			consequences: "[Describe the consequences of this decision]",
			rawContent: "",
		};

		await this.createDecision(decision, autoCommit);
		return decision;
	}

	/**
	 * Changes the status of an existing decision and leaves the rest of its file as it is. Returns the
	 * decision's ID. Resolves active and archived IDs together; archived decisions are read-only.
	 * Storage refuses a status that cannot be replaced without changing other content.
	 */
	async updateDecisionStatus(decisionId: string, status: string, autoCommit?: boolean): Promise<string> {
		const decision = await this.getDecision(decisionId);
		if (!decision) {
			throw new Error(`Decision ${decisionId} not found`);
		}
		if (decision.archived) {
			throw new ContentRecordArchivedError("decision", decision.id);
		}
		const filepath = await this.fs.updateDecisionStatus(decision, status);

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.commitWrittenFile(`backlog: Update decision ${decision.id}`, [], filepath);
		}
		return decision.id;
	}

	async createDocument(doc: Document, autoCommit?: boolean, subPath = ""): Promise<void> {
		const { relativePath, movedFrom } = await this.fs
			.saveDocument(doc, normalizeDocumentSubPath(subPath))
			.catch(refuseBrokenFrontmatterReference);
		doc.path = relativePath;

		if (await this.shouldAutoCommit(autoCommit)) {
			const docsDir = this.fs.docsDir;
			const absolutePath = join(docsDir, ...relativePath.split("/"));
			await this.commitWrittenFile(`backlog: Add document ${doc.id}`, movedFrom ? [movedFrom] : [], absolutePath);
		}
	}

	async updateDocument(existingDoc: Document, content: string, autoCommit?: boolean): Promise<void> {
		await this.updateDocumentFromInput(
			{
				id: existingDoc.id,
				title: existingDoc.title,
				type: existingDoc.type,
				tags: existingDoc.tags,
				content,
				...(existingDoc.path !== undefined && { path: getDocumentSubPathFromRelativePath(existingDoc.path) }),
			},
			autoCommit,
		);
	}

	async createDocumentWithId(title: string, content: string, autoCommit?: boolean): Promise<Document> {
		return await this.createDocumentFromInput({ title, content }, autoCommit);
	}

	async createDocumentFromInput(input: DocumentCreateInput, autoCommit?: boolean): Promise<Document> {
		const title = input.title.trim();
		if (!title) {
			throw new Error("Title is required to create a document.");
		}

		const subPath = normalizeDocumentSubPath(input.path);
		const tags = normalizeStringList(input.tags);
		const type = normalizeDocumentTypeInput(input.type) ?? "other";
		const document = await this.withCreateLock(async () => {
			const id = normalizeDocumentId(await generateNextDocId(this));
			const document: Document = {
				id,
				title,
				type,
				createdDate: formatUtcTimestamp(),
				rawContent: input.content ?? "",
				...(tags && tags.length > 0 && { tags }),
			};

			await this.createDocument(document, autoCommit, subPath);
			return document;
		});

		return (await this.getDocument(document.id)) ?? document;
	}

	/**
	 * Change a document in the docs folder. An archived document is read-only: the update is refused
	 * with `ContentRecordArchivedError` and no file is written. The CLI, MCP and the web save all update
	 * through this method, so they refuse with that one message.
	 */
	async updateDocumentFromInput(input: DocumentUpdateInput, autoCommit?: boolean): Promise<Document> {
		const existingDoc = await this.getDocument(input.id);
		if (!existingDoc) {
			throw new Error(documentNotFoundMessage(input.id));
		}
		if (existingDoc.archived) {
			throw new ContentRecordArchivedError("document", existingDoc.id);
		}

		const normalizedTitle = input.title?.trim();
		if (input.title !== undefined && !normalizedTitle) {
			throw new Error("Document title cannot be empty.");
		}

		const tags = input.tags !== undefined ? normalizeStringList(input.tags) : existingDoc.tags;
		const type = normalizeDocumentTypeInput(input.type) ?? existingDoc.type;
		const subPath =
			input.path === undefined
				? getDocumentSubPathFromRelativePath(existingDoc.path)
				: normalizeDocumentSubPath(input.path);
		const updatedDoc: Document = {
			...existingDoc,
			id: normalizeDocumentId(existingDoc.id),
			title: normalizedTitle ?? existingDoc.title,
			type,
			rawContent: input.content,
			updatedDate: formatUtcTimestamp(),
			tags: tags && tags.length > 0 ? tags : undefined,
		};

		await this.createDocument(updatedDoc, autoCommit, subPath);
		return (await this.getDocument(existingDoc.id)) ?? updatedDoc;
	}

	/**
	 * Move a document or decision out of its folder into the archive of its kind, under the same
	 * path. From then on it cannot be changed, and lists and search leave it out. See
	 * {@link moveContentRecord} for what the move keeps and when it is refused.
	 */
	async archiveContentRecord(
		kind: ContentRecordKind,
		id: string,
		autoCommit?: boolean,
	): Promise<ContentRecordChangeResult | null> {
		return await this.moveContentRecord(kind, id, "archive", autoCommit);
	}

	/**
	 * Move an archived document or decision back to its folder, under the path it has in the archive.
	 * It is then a record like any other. See {@link moveContentRecord}.
	 */
	async restoreContentRecord(
		kind: ContentRecordKind,
		id: string,
		autoCommit?: boolean,
	): Promise<ContentRecordChangeResult | null> {
		return await this.moveContentRecord(kind, id, "restore", autoCommit);
	}

	/**
	 * The one move behind archive and restore, for every content record kind. `archive` moves the
	 * record's file from its folder to the archive of its kind, `restore` moves it back; the path
	 * under the folder stays the same. The file is moved as it is and not rewritten, so the record
	 * keeps its ID, and a file that is a symbolic link stays a link to the same file. No task or
	 * draft is changed: the result names the ones whose `documentation` list names the path the file
	 * left.
	 *
	 * Returns null when no record of the kind claims the ID. An ID that several files claim throws
	 * `AmbiguousIdError`. Every refusal is a `RecordRefusedError` with nothing moved: the record is
	 * already where the move would take it, or a file is already at the destination path.
	 *
	 * Documents and decisions have no update lock yet, so this takes none.
	 */
	private async moveContentRecord(
		kind: ContentRecordKind,
		id: string,
		direction: "archive" | "restore",
		autoCommit?: boolean,
	): Promise<ContentRecordChangeResult | null> {
		const record = await this.loadContentRecordForChange(kind, id, direction);
		if (!record) return null;
		// Everything that only reads comes before the move: a config or a task file that cannot be
		// read then stops the command while the record is still where it was.
		const commitMove = await this.shouldAutoCommit(autoCommit);
		const listedAsDocumentationBy = await this.listRecordsDocumenting([this.fs.contentRecordProjectPath(kind, record)]);

		const movedRecord = direction === "archive" ? { ...record, archived: true } : withoutArchivedFlag(record);
		const fromPath = this.fs.contentRecordFilePath(kind, record);
		const toPath = this.fs.contentRecordFilePath(kind, movedRecord);
		await this.moveRecordFile(
			fromPath,
			toPath,
			() =>
				new ContentRecordFileExistsError(
					kind,
					record.id,
					direction,
					this.fs.contentRecordProjectPath(kind, movedRecord),
				),
		);
		// Lists and search read the content store, which holds the records of each folder. Without
		// this, a long-running server would show the old state until its file watcher noticed.
		const records = this.contentRecords(kind);
		if (direction === "archive") records.leftFolder(record);
		else records.reachedFolder(movedRecord);

		if (commitMove) {
			// The file is moved from here on. A commit that fails says so, so that nobody runs the
			// move a second time.
			try {
				const repoRoot = await this.git.stageFileMove(fromPath, toPath);
				await this.git.commitFiles(
					contentRecordCommitSubject(kind, direction, record.id),
					[fromPath, toPath],
					repoRoot,
				);
			} catch (error) {
				const failure = contentRecordNotCommittedError(kind, direction, record.id, error);
				// The browser archives documents and decisions, as it archives tasks. The tag tells it the
				// record moved, so the page treats it as archived instead of offering the archive again.
				throw direction === "archive" ? markRecordAlreadyMoved(failure, "archiveState") : failure;
			}
		}
		return { id: record.id, listedAsDocumentationBy };
	}

	/**
	 * Permanently remove an archived document or decision. Its file is removed, and a file that is a
	 * symbolic link is removed as a link; the file it points to stays. The ID is then free again,
	 * unless another file of this checkout or a committed file on a branch still claims it. No task
	 * or draft is changed: the result names the ones whose `documentation` list names the removed
	 * file, by its path in the archive or by the path it had before it was archived.
	 *
	 * Returns null when no record of the kind claims the ID. An ID that several files claim throws
	 * `AmbiguousIdError`. A record that is not archived is refused with
	 * `ContentRecordNotArchivedError` and nothing is removed.
	 *
	 * Documents and decisions have no update lock yet, so this takes none.
	 */
	async deleteContentRecord(
		kind: ContentRecordKind,
		id: string,
		autoCommit?: boolean,
	): Promise<ContentRecordChangeResult | null> {
		const record = await this.loadContentRecordForChange(kind, id, "delete");
		if (!record) return null;
		// Everything that only reads comes before the removal, as for a move.
		const commitRemoval = await this.shouldAutoCommit(autoCommit);
		const activeRecord = withoutArchivedFlag(record);
		const activePath = this.fs.contentRecordFilePath(kind, activeRecord);
		const listedAsDocumentationBy = await this.listRecordsDocumenting([
			this.fs.contentRecordProjectPath(kind, record),
			this.fs.contentRecordProjectPath(kind, activeRecord),
		]);

		const removedPath = await this.fs.removeArchivedContentRecordFile(kind, record);

		if (commitRemoval) {
			// An archive made without a commit can leave the active-path deletion pending.
			const changedPaths = [removedPath, activePath];
			try {
				for (const path of changedPaths) await this.stageChangedPath(path);
				await this.git.commitFiles(contentRecordCommitSubject(kind, "delete", record.id), changedPaths);
			} catch (error) {
				throw contentRecordNotCommittedError(kind, "delete", record.id, error);
			}
		}
		return { id: record.id, listedAsDocumentationBy };
	}

	/**
	 * The document or decision an ID names, for archive, restore or delete. Null when no record of
	 * the kind claims the ID. A record in the wrong place for `operation` is refused here, so the
	 * three operations answer with the same words for every kind: archive needs a record that is not
	 * archived, restore and delete need an archived one.
	 */
	private async loadContentRecordForChange(
		kind: ContentRecordKind,
		id: string,
		operation: ContentRecordOperation,
	): Promise<ContentRecord | null> {
		const record = await this.contentRecords(kind).find(id);
		if (!record) return null;
		if (operation === "archive" && record.archived) throw new ContentRecordArchivedError(kind, record.id);
		if (operation !== "archive" && !record.archived) {
			throw new ContentRecordNotArchivedError(kind, record.id, operation);
		}
		return record;
	}

	/**
	 * How the shared archive, restore and delete resolve an ID of one kind and keep a running
	 * server's lists and search in step. This is the one place in core that knows the kinds apart; a
	 * new kind is one more case here, one in `CONTENT_RECORD_WORDS` and one in
	 * `FileSystem.contentRecordStorage`.
	 *
	 * The functions are typed for their own kind and returned as operations on any content record.
	 * That is sound here because every record the shared operations hand back is one this `find`
	 * returned, or a copy of it.
	 */
	private contentRecords(kind: ContentRecordKind): ContentRecordOperations<ContentRecord> {
		switch (kind) {
			case "document": {
				const documents: ContentRecordOperations<Document> = {
					find: (id) => this.getDocument(id),
					leftFolder: (document) => {
						if (document.path) this.contentStore?.removeDocument(document.path);
					},
					reachedFolder: (document) => this.contentStore?.addDocument(document),
				};
				return documents;
			}
			case "decision": {
				const decisions: ContentRecordOperations<Decision> = {
					find: (id) => this.getDecision(id),
					leftFolder: (decision) => this.contentStore?.removeDecision(decision.id),
					reachedFolder: (decision) => this.contentStore?.addDecision(decision),
				};
				return decisions;
			}
		}
	}

	/**
	 * The IDs of the records of this checkout whose `documentation` list names one of `projectPaths`:
	 * tasks on the board, then archived tasks, then drafts. Nothing is changed. `documentation` holds
	 * free text, so only an entry that is one of these paths counts; see `documentationEntryNamesFile`
	 * for the exact rule.
	 */
	private async listRecordsDocumenting(projectPaths: readonly string[]): Promise<string[]> {
		// Drafts are read file by file: one damaged draft must not hide the drafts that name the file.
		const [tasks, archivedTasks, drafts] = await Promise.all([
			this.fs.listTasks(),
			this.fs.listArchivedTasks(),
			this.fs.listHealthyDrafts(),
		]);
		const namesFile = (entry: string) => projectPaths.some((path) => documentationEntryNamesFile(entry, path));
		const ids = [...tasks, ...archivedTasks, ...drafts]
			.filter((record) => record.documentation?.some(namesFile))
			.map((record) => record.id);
		return [...new Set(ids)];
	}

	async listTasksWithMetadata(
		includeBranchMeta = false,
		filesystem = this.fs,
		git = this.git,
	): Promise<Array<Task & { lastModified?: Date; branch?: string }>> {
		const tasks = await filesystem.listTasks();
		return await Promise.all(
			tasks.map(async (task) => {
				const filePath = task.filePath ?? (await getTaskPath(task.id, { filesystem }));

				if (filePath) {
					const bunFile = Bun.file(filePath);
					const stats = await bunFile.stat();
					return {
						...task,
						lastModified: new Date(stats.mtime),
						// Only include branch if explicitly requested
						...(includeBranchMeta && {
							branch: (await git.getFileLastModifiedBranch(filePath)) || undefined,
						}),
					};
				}
				return task;
			}),
		);
	}

	/**
	 * Open a file in the configured editor with minimal interference
	 * @param filePath - Path to the file to edit
	 * @param screen - Optional blessed screen to suspend (for TUI contexts)
	 */
	async editTaskInTui(taskId: string, screen: BlessedScreen, selectedTask?: Task): Promise<TuiTaskEditResult> {
		const contextualTask = selectedTask && taskIdsEqual(selectedTask.id, taskId) ? selectedTask : undefined;

		if (contextualTask && isReadOnlyTask(contextualTask)) {
			return { changed: false, task: contextualTask, reason: "read_only" };
		}

		let resolvedTask: Task | null | undefined = contextualTask ?? (await this.getTask(taskId));
		if (!resolvedTask) {
			try {
				resolvedTask = await this.fs.loadDraft(taskId);
			} catch (error) {
				if (isAmbiguousIdError(error)) {
					return { changed: false, reason: "ambiguous" };
				}
				throw error;
			}
		}
		if (!resolvedTask) {
			return { changed: false, reason: "not_found" };
		}
		if (isReadOnlyTask(resolvedTask)) {
			return { changed: false, task: resolvedTask, reason: "read_only" };
		}

		const draftsDir = await this.fs.getDraftsDir();
		const selectedFilePath = resolvedTask.filePath;

		let taskFilePath: string | null = null;
		let draftFilePath: string | null = null;
		let editableTask: Task;

		if (selectedFilePath !== undefined && dirname(selectedFilePath) === draftsDir) {
			// The row's home directory decides its store before any task lookup: a project whose
			// task prefix is "draft" can hold task ids identical to draft ids, so resolving by id
			// first would silently target the task file instead of the selected draft row. The
			// validated reference binds the editor session to this exact file — but a numeric
			// identity shared with another file stays ambiguous and must fail closed here too.
			let validated: Awaited<ReturnType<FileSystem["draftReferenceFromPath"]>>;
			try {
				validated = await this.fs.draftReferenceFromPath(selectedFilePath);
			} catch (error) {
				return {
					changed: false,
					task: resolvedTask,
					reason: error instanceof DraftParseError ? "unreadable" : "identity_conflict",
				};
			}
			const selectedDuplicates = findDuplicateDraftFilenameGroups(await this.fs.listDraftFilenames()).find((group) =>
				group.includes(basename(selectedFilePath)),
			);
			if (selectedDuplicates) {
				return { changed: false, task: resolvedTask, reason: "ambiguous" };
			}
			editableTask = validated.task;
			draftFilePath = validated.filePath;
		} else {
			const localTask = await this.fs.loadTask(resolvedTask.id);
			editableTask = localTask ?? resolvedTask;

			taskFilePath = await getTaskPath(editableTask.id, this);
			if (!taskFilePath) {
				const rowFilePath = editableTask.filePath;
				if (rowFilePath !== undefined && dirname(rowFilePath) === draftsDir) {
					let validatedRow: Awaited<ReturnType<FileSystem["draftReferenceFromPath"]>>;
					try {
						validatedRow = await this.fs.draftReferenceFromPath(rowFilePath);
					} catch (error) {
						return {
							changed: false,
							task: editableTask,
							reason: error instanceof DraftParseError ? "unreadable" : "identity_conflict",
						};
					}
					const rowDuplicates = findDuplicateDraftFilenameGroups(await this.fs.listDraftFilenames()).find((group) =>
						group.includes(basename(rowFilePath)),
					);
					if (rowDuplicates) {
						return { changed: false, task: editableTask, reason: "ambiguous" };
					}
					draftFilePath = validatedRow.filePath;
				} else {
					const resolvedReference = await this.fs.resolveDraftReference(editableTask.id);
					if (!resolvedReference) {
						return { changed: false, task: editableTask, reason: "not_found" };
					}
					editableTask = resolvedReference.task;
					draftFilePath = resolvedReference.filePath;
				}
			}
		}

		const filePath = taskFilePath ?? draftFilePath;
		if (!filePath) {
			return { changed: false, task: editableTask, reason: "not_found" };
		}
		// Re-reading through the validation authority keeps the editor session honest. Parse or
		// read failures and genuine identity conflicts are reported as distinct outcomes. The
		// known on-disk path is attached to reloaded tasks so contentStore publication works.
		const reloadTaskAfterEdit = async (path: string): Promise<{ task: Task } | { failure: "unreadable" }> => {
			try {
				const content = await Bun.file(path).text();
				const reparsed = normalizeTaskIdentity(parseTask(content));
				return { task: { ...reparsed, filePath: path } };
			} catch {
				return { failure: "unreadable" };
			}
		};

		let beforeContent: string;
		try {
			beforeContent = await Bun.file(filePath).text();
		} catch {
			return { changed: false, task: editableTask, reason: "not_found" };
		}

		const opened = await this.openEditor(filePath, screen);
		if (!opened) {
			return { changed: false, task: editableTask, reason: "editor_failed" };
		}

		let afterContent: string;
		try {
			afterContent = await Bun.file(filePath).text();
		} catch {
			return { changed: false, task: editableTask, reason: "not_found" };
		}

		if (afterContent === beforeContent) {
			if (!taskFilePath) {
				try {
					return { changed: false, task: (await this.fs.draftReferenceFromPath(filePath)).task };
				} catch (error) {
					return {
						changed: false,
						task: editableTask,
						reason: error instanceof DraftParseError ? "unreadable" : "identity_conflict",
					};
				}
			}
			const outcome = await reloadTaskAfterEdit(taskFilePath);
			if ("failure" in outcome) {
				return { changed: false, task: editableTask, reason: outcome.failure };
			}
			return { changed: false, task: outcome.task };
		}

		const now = formatUtcTimestamp();

		if (!taskFilePath) {
			// Draft close: hold the draft lock around the write+validate window so a concurrent
			// edit cannot interleave with the save. The lock is never held across the interactive
			// editor itself; contention detected inside fails fast and leaves the user's saved
			// content on disk untouched. Identity or parse problems keep their distinct reasons.
			const canonicalId = extractDraftIdFromFilename(basename(filePath)) ?? "";
			try {
				return await this.fs.withDraftLock({ filePath, canonicalId }, async () => {
					const currentOnDisk = await Bun.file(filePath).text();
					if (currentOnDisk !== afterContent) {
						throw newTaskLockError(canonicalId);
					}
					await Bun.write(filePath, upsertTaskUpdatedDate(afterContent, now));
					const validated = await this.fs.draftReferenceFromPath(filePath);
					return { changed: true, task: validated.task };
				});
			} catch (error) {
				if (error instanceof DraftParseError) {
					return { changed: false, task: editableTask, reason: "unreadable" };
				}
				if (error instanceof DraftIdentityError) {
					return { changed: false, task: editableTask, reason: "identity_conflict" };
				}
				throw error;
			}
		}

		await Bun.write(filePath, upsertTaskUpdatedDate(afterContent, now));

		const outcome = await reloadTaskAfterEdit(taskFilePath);
		if ("failure" in outcome) {
			return { changed: false, task: editableTask, reason: outcome.failure };
		}
		const refreshedTask = outcome.task;
		if (this.contentStore && refreshedTask) {
			this.contentStore.upsertTask(refreshedTask);
		}

		return {
			changed: true,
			task: refreshedTask ?? { ...editableTask, updatedDate: now },
		};
	}

	async openEditor(filePath: string, screen?: BlessedScreen): Promise<boolean> {
		const config = await this.fs.loadConfig();

		// If no screen provided, use simple editor opening
		if (!screen) {
			return await openInEditor(filePath, config);
		}

		const program = screen.program;

		// screen.leave() turns mouse reporting off and screen.enter() does not turn it back on, so
		// remember whether it was on and restore it once the editor has closed.
		const mouseWasEnabled = program.mouseEnabled === true;

		// Leave alternate screen buffer FIRST
		screen.leave();

		// Reset keypad/cursor mode using terminfo if available
		if (typeof program.put?.keypad_local === "function") {
			program.put.keypad_local();
			if (typeof program.flush === "function") {
				program.flush();
			}
		}

		// Send escape sequences directly as reinforcement
		// ESC[0m   = Reset all SGR attributes (fixes white background in nano)
		// ESC[?25h = Show cursor (ensure cursor is visible)
		// ESC[?1l  = Reset DECCKM (cursor keys send CSI sequences)
		// ESC>     = DECKPNM (numeric keypad mode)
		const fs = await import("node:fs");
		fs.writeSync(1, "\u001b[0m\u001b[?25h\u001b[?1l\u001b>");

		// Pause the terminal AFTER leaving alt buffer (disables raw mode, releases terminal)
		const resume = typeof program.pause === "function" ? program.pause() : undefined;
		try {
			return await openInEditor(filePath, config);
		} finally {
			// Resume terminal state FIRST (re-enables raw mode)
			if (typeof resume === "function") {
				resume();
			}
			// Re-enter alternate screen buffer
			screen.enter();
			if (mouseWasEnabled) {
				program.enableMouse();
			}
			// Restore application cursor mode
			if (typeof program.put?.keypad_xmit === "function") {
				program.put.keypad_xmit();
				if (typeof program.flush === "function") {
					program.flush();
				}
			}
			// Full redraw
			screen.render();
		}
	}

	/**
	 * Load and process all tasks with the same logic as CLI overview
	 * This method extracts the common task loading logic for reuse
	 */
	async loadAllTasksForStatistics(
		progressCallback?: (msg: string) => void,
	): Promise<{ tasks: Task[]; drafts: Task[]; statuses: string[]; priorities: string[] }> {
		const snapshot = await this.loadTaskCorpusSnapshot(progressCallback);
		const config = snapshot.config;
		const statuses = (config?.statuses || DEFAULT_STATUSES) as string[];
		const priorities = config?.priorities ?? [];
		if (!snapshot.identityIndex) throw new Error("Task corpus identity index was not initialized");
		const tasks = snapshot.identityIndex.getTasks(true);

		// Load drafts
		progressCallback?.("Loading drafts...");
		const drafts = await this.fs.listDrafts();

		return { tasks, drafts, statuses: statuses as string[], priorities };
	}

	/**
	 * Load all tasks with cross-branch support
	 * This is the single entry point for loading tasks across all interfaces
	 */
	async loadTasks(
		progressCallback?: (msg: string) => void,
		abortSignal?: AbortSignal,
		options?: { includeArchived?: boolean },
	): Promise<Task[]> {
		return (
			await this.loadTasksWithStableBranchSnapshot({
				progressCallback,
				abortSignal,
				includeArchived: options?.includeArchived,
			})
		).tasks;
	}

	private async loadTaskCorpusSnapshot(
		progressCallback?: (message: string) => void,
		options?: { publishSharedState?: boolean },
	): Promise<TaskCorpusSnapshot> {
		return await this.loadTasksWithStableBranchSnapshot({
			progressCallback,
			includeArchived: true,
			visibleArchived: false,
			publishSharedState: options?.publishSharedState,
		});
	}

	/**
	 * The ContentStore's corpus loader. By default its result becomes the shared cross-branch
	 * state; pass { publish: false } for a throwaway load (e.g. resolving one task's identity)
	 * whose result must not be installed on the store's behalf.
	 */
	private async loadContentStoreCorpus(
		progressCallback?: (message: string) => void,
		options?: { publish?: boolean },
	): Promise<TaskCorpusSnapshot> {
		if (Object.hasOwn(this, "loadTasks")) {
			const [activeTasks, archivedTasks, config] = await Promise.all([
				this.loadTasks(progressCallback),
				this.fs.listArchivedTasks(),
				this.fs.loadConfig(),
			]);
			const identityIndex = await this.buildTaskIdentityIndex(
				activeTasks,
				archivedTasks,
				[],
				config?.statuses ?? [...DEFAULT_STATUSES],
				config?.taskResolutionStrategy ?? "most_progressed",
			);
			return {
				tasks: identityIndex.getTasks(false),
				activeTasks,
				archivedTasks,
				identityIndex,
				branchStateEntries: [],
				config,
			};
		}
		return await this.loadTaskCorpusSnapshot(progressCallback, { publishSharedState: options?.publish ?? true });
	}

	private async loadTasksWithStableBranchSnapshot(
		options: TaskCorpusLoadOptions,
		snapshotAttempt = 0,
		retrySnapshot?: ActiveBranchSnapshot,
	): Promise<TaskCorpusSnapshot> {
		const { progressCallback, abortSignal } = options;
		const generation = this.projectGeneration;
		const filesystem = this.fs;
		const git = this.git;
		const branchTaskLoader = this.branchTaskLoader;
		const projectRoot = filesystem.rootDir;
		const backlogRoot = filesystem.backlogDir;
		const projectChanged = () =>
			generation !== this.projectGeneration ||
			filesystem !== this.fs ||
			git !== this.git ||
			branchTaskLoader !== this.branchTaskLoader ||
			projectRoot !== this.fs.rootDir ||
			backlogRoot !== filesystem.backlogDir;
		const retryForCurrentProject = async (nextSnapshot?: ActiveBranchSnapshot) => {
			if (snapshotAttempt >= 2) {
				throw new Error("Project root or active branch refs kept changing while tasks were loading");
			}
			return await this.loadTasksWithStableBranchSnapshot(options, snapshotAttempt + 1, nextSnapshot);
		};

		const config = await filesystem.loadConfig();
		if (projectChanged()) return await retryForCurrentProject();
		git.setConfig(config);
		// A cancelled load must not wait out the fetch timeout before noticing.
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}
		await this.refreshRemoteRefsForTaskRead(config, git, { force: options.forceRemoteRefresh });
		if (projectChanged()) return await retryForCurrentProject();
		const settingsKey = JSON.stringify(this.getActiveBranchSettings(config, filesystem));
		const snapshotBefore =
			retrySnapshot?.settingsKey === settingsKey
				? retrySnapshot
				: await this.getActiveBranchSnapshot(config, generation, filesystem, git);
		if (projectChanged()) return await retryForCurrentProject();
		const statuses = config?.statuses || [...DEFAULT_STATUSES];
		const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";
		const includeArchived = options.includeArchived ?? false;
		const shouldLoadBranches = config?.checkActiveBranches !== false && config?.filesystemOnly !== true;

		// Check for cancellation
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Load local filesystem tasks first (needed for optimization)
		const [localTasks, archivedTasks] = await Promise.all([
			this.listTasksWithMetadata(false, filesystem, git),
			filesystem.listArchivedTasks(),
		]);
		if (projectChanged()) return await retryForCurrentProject();

		// Check for cancellation
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Load tasks from remote branches and other local branches in parallel
		// Skip entirely when cross-branch scanning is disabled
		const branchStateEntries: BranchTaskStateEntry[] = [];
		let branchLoadComplete = true;

		let backlogDir: string | null = null;
		if (shouldLoadBranches) {
			progressCallback?.(getTaskLoadingMessage(config));
			backlogDir = filesystem.backlogDirName;
			const branchLoad = await branchTaskLoader.load(
				snapshotBefore.branchTips,
				config,
				localTasks,
				includeArchived,
				backlogDir,
				progressCallback,
				snapshotBefore.currentBranch,
			);
			branchStateEntries.push(...branchLoad.entries);
			branchLoadComplete = branchLoad.complete;
			if (projectChanged()) return await retryForCurrentProject();
		}

		// Check for cancellation after loading
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Check for cancellation before identity resolution
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		if (shouldLoadBranches) {
			progressCallback?.("Applying latest task states from branch scans...");
		}
		const identityIndex = await this.buildTaskIdentityIndex(
			localTasks,
			archivedTasks,
			branchStateEntries,
			statuses,
			resolutionStrategy,
			undefined,
			filesystem,
			git,
		);
		if (projectChanged()) return await retryForCurrentProject();
		const filteredTasks = identityIndex.getTasks(options.visibleArchived ?? includeArchived);

		// This read must begin after this scan finishes. Reusing an unrelated
		// in-flight pre-scan snapshot could otherwise publish a generation that
		// moved while immutable commit trees were still being indexed.
		const snapshotAfter = await this.computeActiveBranchSnapshot(await filesystem.loadConfig(), filesystem, git);
		if (projectChanged()) return await retryForCurrentProject();
		if (snapshotBefore.stabilityFingerprint !== snapshotAfter.stabilityFingerprint) {
			return await retryForCurrentProject(snapshotAfter);
		}
		// Only the corpus this Core installs into its ContentStore may advance shared
		// freshness state. A standalone load (statistics, ID allocation, a TUI board
		// read) that publishes its refs would make every later read believe the store
		// already holds them and serve the older corpus until the refs move again.
		// Healthy branches remain publishable after a partial read, but an
		// incomplete generation must retry even while its refs stay unchanged.
		if (options.publishSharedState) {
			this.activeBranchFingerprint = branchLoadComplete ? snapshotAfter.fingerprint : null;
		}
		if (shouldLoadBranches && backlogDir) {
			branchTaskLoader.retainSnapshot(snapshotAfter.branchTips, {
				backlogDir,
				prefix: config?.prefixes?.task ?? "task",
				activeBranchDays: config?.activeBranchDays ?? 30,
			});
		} else {
			branchTaskLoader.clear();
		}
		return {
			tasks: filteredTasks,
			activeTasks: localTasks,
			archivedTasks,
			identityIndex,
			branchStateEntries,
			config,
		};
	}
}

/**
 * Builds a Core bound to the project every interface resolves the same way: the runtime working
 * directory (`--cwd`/`BACKLOG_CWD`, else `process.cwd()`), then walked up to the project root just
 * like the CLI commands do. When no project is found the resolved directory is used as-is, so
 * callers keep degrading to their own fallbacks instead of failing.
 * Prefer passing an existing Core; use this only where no instance is available.
 */
export async function createRuntimeCore(options?: { enableWatchers?: boolean }): Promise<Core> {
	const { cwd } = await resolveRuntimeCwd();
	return new Core((await findBacklogRoot(cwd)) ?? cwd, options);
}
