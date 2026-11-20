import { isAbsolute, relative } from "node:path";
import { ARCHIVED_TASK_DIRECTORIES } from "../constants/index.ts";
import type { Task } from "../types/index.ts";
import { canonicalTaskId, extractTaskIdFromFilename, taskIdsEqual } from "../utils/task-path.ts";
import { compareTaskIds } from "../utils/task-sorting.ts";
import { parseStoredUtcDate } from "../utils/utc-timestamp.ts";
import type { TaskDirectoryType } from "./cross-branch-tasks.ts";

export interface TaskIdentityRecord {
	id: string;
	type: TaskDirectoryType;
	branch: string;
	path: string;
	lastModified: Date;
	task?: Task;
	workingCopy?: boolean;
}

interface TaskIdentityPathContext {
	repositoryRoot: string | null;
	projectRoot: string;
	backlogDirectory: string;
}

interface TaskIdentity {
	path: string;
	records: TaskIdentityRecord[];
}

interface TaskIdentityGroup {
	id: string;
	identities: Map<string, TaskIdentity>;
}

export type TaskIdentityResolution =
	| { status: "found"; task: Task }
	| { status: "ambiguous"; candidates: string[] }
	| { status: "not-found" };

/**
 * A mutation can also land on a task that exists only in the archive, which is read-only. That
 * outcome carries the ID alone, so no caller can take it for a task it may write.
 */
export type TaskMutationResolution = TaskIdentityResolution | { status: "archived"; taskId: string };

function toPosixPath(path: string): string {
	return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function joinPosix(...parts: string[]): string {
	return parts
		.map((part) => toPosixPath(part).replace(/^\/+|\/+$/g, ""))
		.filter(Boolean)
		.join("/");
}

/** Compare filenames across branches without treating ID padding or an archive move as a new task. */
export function normalizeTaskIdentityPath(path: string, backlogDirectory: string, taskId: string): string {
	const filename = taskFilename(path);
	const separator = filename.indexOf(" - ");
	let normalizedPath = path;
	if (separator >= 0 && filenameHasId(path, taskId)) {
		const directory = path.slice(0, path.length - filename.length);
		normalizedPath = `${directory}${canonicalTaskId(taskId).toLowerCase()}${filename.slice(separator)}`;
	}
	for (const lifecycleDirectory of ARCHIVED_TASK_DIRECTORIES) {
		const lifecyclePrefix = `${backlogDirectory}/${lifecycleDirectory}/`;
		if (normalizedPath.startsWith(lifecyclePrefix)) {
			return `${backlogDirectory}/tasks/${normalizedPath.slice(lifecyclePrefix.length)}`;
		}
	}
	return normalizedPath;
}

function normalizeRecordPath(record: TaskIdentityRecord, context: TaskIdentityPathContext): string {
	const repositoryRoot = context.repositoryRoot ?? context.projectRoot;
	const projectPrefix = context.repositoryRoot
		? toPosixPath(relative(context.repositoryRoot, context.projectRoot))
		: "";
	let path = record.path;

	if (isAbsolute(path)) {
		const worktreePrefix = "worktree:";
		const sourceRoot = record.branch.startsWith(worktreePrefix)
			? record.branch.slice(worktreePrefix.length)
			: repositoryRoot;
		path = relative(sourceRoot, path);
	}

	path = toPosixPath(path);
	const repositoryBacklogDirectory = joinPosix(projectPrefix, context.backlogDirectory);
	const projectBacklogDirectory = toPosixPath(context.backlogDirectory);
	if (
		projectPrefix &&
		(path === projectBacklogDirectory || path.startsWith(`${projectBacklogDirectory}/`)) &&
		!(path === repositoryBacklogDirectory || path.startsWith(`${repositoryBacklogDirectory}/`))
	) {
		path = joinPosix(projectPrefix, path);
	}

	return normalizeTaskIdentityPath(path, repositoryBacklogDirectory, record.id);
}

function recordKey(record: TaskIdentityRecord): string {
	return `${record.branch}\0${toPosixPath(record.path)}\0${record.id}\0${record.task?.title ?? ""}`;
}

function stateRank(type: TaskDirectoryType): number {
	switch (type) {
		case "task":
			return 2;
		case "archived":
			return 1;
		case "draft":
			return 0;
	}
}

function selectLifecycleRecord(records: TaskIdentityRecord[]): TaskIdentityRecord | undefined {
	const workingTasks = records.filter((record) => record.workingCopy && record.type === "task");
	if (workingTasks.length > 0) {
		return [...workingTasks].sort((left, right) => recordKey(left).localeCompare(recordKey(right)))[0];
	}
	const workingArchived = records.filter((record) => record.workingCopy && record.type === "archived");
	if (workingArchived.length > 0) {
		return [...workingArchived].sort((left, right) => recordKey(left).localeCompare(recordKey(right)))[0];
	}

	return [...records].sort((left, right) => {
		const timeDifference = right.lastModified.getTime() - left.lastModified.getTime();
		if (timeDifference !== 0) return timeDifference;
		const rankDifference = stateRank(right.type) - stateRank(left.type);
		if (rankDifference !== 0) return rankDifference;
		return recordKey(left).localeCompare(recordKey(right));
	})[0];
}

function selectTaskRecord(
	records: TaskIdentityRecord[],
	statuses: string[],
	strategy: "most_recent" | "most_progressed",
): TaskIdentityRecord | undefined {
	const candidates = records.filter((record) => record.task);
	return [...candidates].sort((left, right) => {
		if (strategy === "most_progressed") {
			const leftRank = Math.max(0, statuses.indexOf(left.task?.status ?? ""));
			const rightRank = Math.max(0, statuses.indexOf(right.task?.status ?? ""));
			if (leftRank !== rightRank) return rightRank - leftRank;
		}
		// Equal statuses keep the editable working copy; branch-only ties use time.
		if (Boolean(left.workingCopy) !== Boolean(right.workingCopy)) {
			return left.workingCopy ? -1 : 1;
		}
		const timeDifference = right.lastModified.getTime() - left.lastModified.getTime();
		if (timeDifference !== 0) return timeDifference;
		return recordKey(left).localeCompare(recordKey(right));
	})[0];
}

/** Records that hold their task ID: tasks on the board and archived tasks. A draft holds none. */
function liveRecords(identity: TaskIdentity): TaskIdentityRecord[] {
	return identity.records.filter((record) => record.type === "task" || record.type === "archived");
}

function taskFilename(path: string): string {
	return toPosixPath(path).split("/").at(-1) ?? path;
}

function filenameHasId(path: string, taskId: string): boolean {
	const filenameId = extractTaskIdFromFilename(taskFilename(path));
	return filenameId !== null && taskIdsEqual(filenameId, taskId);
}

function filenameTitle(path: string): string {
	const filename = taskFilename(path);
	const separator = filename.indexOf(" - ");
	return separator === -1 ? filename : filename.slice(separator + 3);
}

/** A different title in the filename is the only reason to look up creation times. */
export function idsWithDifferentFilenameTitles(
	branchFiles: Iterable<{ id: string; path: string }>,
	workingTasks: Task[],
): Set<string> {
	const firstTitle = new Map<string, string>();
	const changed = new Set<string>();
	const compare = (taskId: string, path: string) => {
		const id = canonicalTaskId(taskId);
		if (changed.has(id)) return;
		const title = filenameTitle(path);
		const first = firstTitle.get(id);
		if (first === undefined) firstTitle.set(id, title);
		else if (first !== title) changed.add(id);
	};
	for (const file of branchFiles) compare(file.id, file.path);
	for (const task of workingTasks) {
		if (task.filePath && filenameHasId(task.filePath, task.id)) compare(task.id, task.filePath);
	}
	return changed;
}

function creationSecond(record: TaskIdentityRecord): number | undefined {
	if (!record.task || !taskIdsEqual(record.task.id, record.id) || !filenameHasId(record.path, record.id))
		return undefined;
	const value = record.task.createdDate;
	// A day-only date has no creation time. Legacy timestamps without a zone use UTC.
	if (!value?.includes(":")) return undefined;
	const date = parseStoredUtcDate(value);
	return date ? Math.floor(date.getTime() / 1000) : undefined;
}

function duplicatePathsInOneBranch(records: TaskIdentityRecord[]): Set<string> {
	if (records.length < 2) return new Set();
	const pathsByBranch = new Map<string, Set<string>>();
	for (const record of records) {
		const branch = record.workingCopy ? "working-copy" : `branch:${record.branch}`;
		const paths = pathsByBranch.get(branch) ?? new Set<string>();
		paths.add(toPosixPath(record.path));
		pathsByBranch.set(branch, paths);
	}
	return new Set([...pathsByBranch.values()].filter((paths) => paths.size > 1).flatMap((paths) => [...paths]));
}

/** A creation time links copies with different filenames. Other records keep their path identity. */
function mergeRenamedIdentities(group: TaskIdentityGroup): void {
	if (group.identities.size < 2) return;
	const paths = [...group.identities.values()];
	if (new Set(paths.map((identity) => filenameTitle(identity.path))).size < 2) return;
	const bySecond = new Map<number, { paths: Set<string>; records: TaskIdentityRecord[] }>();
	for (const identity of paths) {
		for (const record of liveRecords(identity)) {
			const second = creationSecond(record);
			if (second === undefined) continue;
			const copies = bySecond.get(second) ?? { paths: new Set<string>(), records: [] };
			copies.paths.add(identity.path);
			copies.records.push(record);
			bySecond.set(second, copies);
		}
	}
	const matched = new Set<TaskIdentityRecord>();
	for (const [second, copies] of bySecond) {
		if (copies.paths.size < 2 || new Set([...copies.paths].map(filenameTitle)).size < 2) continue;
		if (duplicatePathsInOneBranch(copies.records).size > 0) continue;
		const [path] = [...copies.paths].sort();
		if (!path) continue;
		group.identities.set(`created\0${second}`, { path, records: copies.records });
		for (const record of copies.records) matched.add(record);
	}
	if (matched.size === 0) return;
	for (const identity of paths) {
		identity.records = identity.records.filter((record) => !matched.has(record));
		if (identity.records.length === 0) group.identities.delete(identity.path);
	}
}

export class TaskIdentityIndex {
	private readonly groups = new Map<string, TaskIdentityGroup>();
	private readonly records: TaskIdentityRecord[];

	constructor(
		records: TaskIdentityRecord[],
		private readonly context: TaskIdentityPathContext,
		private readonly statuses: string[],
		private readonly resolutionStrategy: "most_recent" | "most_progressed",
	) {
		this.records = records.slice();
		for (const record of this.records) {
			const canonicalId = canonicalTaskId(record.id);
			const path = normalizeRecordPath(record, context);
			const group = this.groups.get(canonicalId) ?? { id: canonicalId, identities: new Map() };
			const identity = group.identities.get(path) ?? { path, records: [] };
			identity.records.push(record);
			group.identities.set(path, identity);
			this.groups.set(canonicalId, group);
		}
		for (const group of this.groups.values()) mergeRenamedIdentities(group);
	}

	withWorkingCopyCorpus(activeTasks: Task[], archivedTasks: Task[]): TaskIdentityIndex {
		const records = this.records.filter((record) => !record.workingCopy);
		for (const task of activeTasks) {
			records.push({
				id: task.id,
				type: "task",
				branch: "local",
				path: task.filePath ?? task.id,
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
				path: task.filePath ?? task.id,
				lastModified:
					task.lastModified ??
					(task.updatedDate ? (parseStoredUtcDate(task.updatedDate) ?? new Date(Number.NaN)) : new Date(0)),
				task: { ...task, source: "archived" },
				workingCopy: true,
			});
		}
		return new TaskIdentityIndex(records, this.context, this.statuses, this.resolutionStrategy);
	}

	withRecord(record: TaskIdentityRecord): TaskIdentityIndex {
		return new TaskIdentityIndex([...this.records, record], this.context, this.statuses, this.resolutionStrategy);
	}

	private getGroups(taskId: string): TaskIdentityGroup[] {
		return [...this.groups.values()].filter((group) => taskIdsEqual(group.id, taskId));
	}

	private candidatesAcrossGroups(groups: TaskIdentityGroup[]): string[] {
		const candidates = new Set<string>();
		for (const group of groups) {
			for (const identity of group.identities.values()) {
				for (const record of liveRecords(identity)) candidates.add(record.path);
			}
		}
		return [...candidates].sort((left, right) => left.localeCompare(right));
	}

	private ambiguousCandidates(group: TaskIdentityGroup): string[] {
		const liveIdentities = [...group.identities.values()].filter((identity) => liveRecords(identity).length > 0);
		const candidates = new Set<string>();
		if (liveIdentities.length > 1) {
			for (const identity of liveIdentities) {
				for (const record of liveRecords(identity)) candidates.add(record.path);
			}
		}
		for (const identity of liveIdentities) {
			for (const path of duplicatePathsInOneBranch(liveRecords(identity))) candidates.add(path);
		}
		return [...candidates].sort((left, right) => left.localeCompare(right));
	}

	getTasks(includeArchived = false): Task[] {
		const tasks: Task[] = [];
		// Task ids are hierarchical numbers, so the shared comparator decides their order here.
		// Comparing them as strings puts task-1.10 before task-1.2 for every consumer that
		// renders this corpus without re-sorting it, which is what the board's task list does.
		const groups = [...this.groups.values()].sort((left, right) => compareTaskIds(left.id, right.id));
		for (const group of groups) {
			const identities = [...group.identities.values()].sort((left, right) => left.path.localeCompare(right.path));
			for (const identity of identities) {
				const lifecycle = selectLifecycleRecord(identity.records);
				if (!lifecycle || (lifecycle.type !== "task" && lifecycle.type !== "archived")) continue;
				if (lifecycle.type === "archived" && !includeArchived) continue;
				const selected = selectTaskRecord(
					identity.records.filter((record) => record.type === lifecycle.type),
					this.statuses,
					this.resolutionStrategy,
				);
				if (!selected?.task) continue;
				tasks.push(lifecycle.type === "archived" ? { ...selected.task, source: "archived" } : selected.task);
			}
		}
		return tasks;
	}

	resolveForRead(taskId: string): TaskIdentityResolution {
		const groups = this.getGroups(taskId);
		if (groups.length === 0) return { status: "not-found" };
		if (groups.length > 1) return { status: "ambiguous", candidates: this.candidatesAcrossGroups(groups) };
		const group = groups[0] as TaskIdentityGroup;
		const candidates = this.ambiguousCandidates(group);
		if (candidates.length > 0) return { status: "ambiguous", candidates };
		const tasks = this.getTasks(true).filter((task) => taskIdsEqual(task.id, taskId));
		return tasks[0] ? { status: "found", task: tasks[0] } : { status: "not-found" };
	}

	/**
	 * Resolve the working-copy task a mutation targets. Only a task on the board can be changed; an
	 * ID whose only working-copy record is archived resolves as `archived` so callers can say so.
	 */
	resolveForMutation(taskId: string): TaskMutationResolution {
		const groups = this.getGroups(taskId);
		if (groups.length === 0) return { status: "not-found" };
		if (groups.length > 1) return { status: "ambiguous", candidates: this.candidatesAcrossGroups(groups) };
		const group = groups[0] as TaskIdentityGroup;
		const candidates = this.ambiguousCandidates(group);
		if (candidates.length > 0) return { status: "ambiguous", candidates };
		const workingRecords = [...group.identities.values()]
			.flatMap((identity) => identity.records)
			.filter((record) => record.workingCopy && record.task)
			.sort((left, right) => recordKey(left).localeCompare(recordKey(right)));
		const active = workingRecords.find((record) => record.type === "task")?.task;
		if (active) return { status: "found", task: { ...active, source: "local" } };
		const archived = workingRecords.find((record) => record.type === "archived")?.task;
		return archived ? { status: "archived", taskId: archived.id } : { status: "not-found" };
	}

	getFingerprint(): string {
		const entries: string[] = [];
		for (const group of this.groups.values()) {
			for (const [identityKey, identity] of group.identities) {
				for (const record of identity.records) {
					entries.push(
						[
							record.branch,
							normalizeRecordPath(record, this.context),
							identityKey,
							record.id,
							record.type,
							record.workingCopy ? "1" : "0",
						].join("\0"),
					);
				}
			}
		}
		return entries.sort((left, right) => left.localeCompare(right)).join("\n");
	}

	/**
	 * The canonical IDs more than one live identity claims, the same collision `resolveForRead`
	 * reports. A corpus built from selected records cannot re-derive this: selection keeps one record
	 * per identity and skips identities whose newest record is archived or failed to parse, so a
	 * claimant can be missing from the corpus while still contesting the ID here.
	 */
	getContestedIds(): Set<string> {
		return new Set(this.getConflictingRecords().keys());
	}

	/** Doctor shows each branch and path that claims a conflicting ID. */
	getConflictingRecords(): Map<string, TaskIdentityRecord[]> {
		const contested = new Map<string, TaskIdentityRecord[]>();
		for (const group of this.groups.values()) {
			if (this.ambiguousCandidates(group).length > 0) {
				contested.set(group.id, [...group.identities.values()].flatMap(liveRecords));
			}
		}
		return contested;
	}

	getOccupiedIds(): string[] {
		const ids = new Set<string>();
		for (const group of this.groups.values()) {
			for (const identity of group.identities.values()) {
				for (const record of liveRecords(identity)) ids.add(record.id);
			}
		}
		return [...ids];
	}
}
