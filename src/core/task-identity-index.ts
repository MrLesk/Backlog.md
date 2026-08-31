import { isAbsolute, relative } from "node:path";
import type { Task } from "../types/index.ts";
import { canonicalTaskId, taskIdsEqual } from "../utils/task-path.ts";
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

function toPosixPath(path: string): string {
	return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function joinPosix(...parts: string[]): string {
	return parts
		.map((part) => toPosixPath(part).replace(/^\/+|\/+$/g, ""))
		.filter(Boolean)
		.join("/");
}

export function normalizeTaskLifecyclePath(path: string, backlogDirectory: string): string {
	for (const lifecycleDirectory of ["archive/tasks", "completed"]) {
		const lifecyclePrefix = `${backlogDirectory}/${lifecycleDirectory}/`;
		if (path.startsWith(lifecyclePrefix)) {
			return `${backlogDirectory}/tasks/${path.slice(lifecyclePrefix.length)}`;
		}
	}
	return path;
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

	return normalizeTaskLifecyclePath(path, repositoryBacklogDirectory);
}

function recordKey(record: TaskIdentityRecord): string {
	return `${record.branch}\0${toPosixPath(record.path)}\0${record.id}\0${record.task?.title ?? ""}`;
}

function stateRank(type: TaskDirectoryType): number {
	switch (type) {
		case "task":
			return 3;
		case "completed":
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
	const workingCompleted = records.filter((record) => record.workingCopy && record.type === "completed");
	if (workingCompleted.length > 0) {
		return [...workingCompleted].sort((left, right) => recordKey(left).localeCompare(recordKey(right)))[0];
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
		if (Boolean(left.workingCopy) !== Boolean(right.workingCopy)) {
			return left.workingCopy ? -1 : 1;
		}
		if (strategy === "most_progressed") {
			const leftRank = Math.max(0, statuses.indexOf(left.task?.status ?? ""));
			const rightRank = Math.max(0, statuses.indexOf(right.task?.status ?? ""));
			if (leftRank !== rightRank) return rightRank - leftRank;
		}
		const timeDifference = right.lastModified.getTime() - left.lastModified.getTime();
		if (timeDifference !== 0) return timeDifference;
		return recordKey(left).localeCompare(recordKey(right));
	})[0];
}

function liveRecords(identity: TaskIdentity): TaskIdentityRecord[] {
	return identity.records.filter((record) => record.type === "task" || record.type === "completed");
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
	}

	withWorkingCopyCorpus(activeTasks: Task[], completedTasks: Task[]): TaskIdentityIndex {
		const records = this.records.filter((record) => !record.workingCopy);
		for (const task of activeTasks) {
			records.push({
				id: task.id,
				type: "task",
				branch: "local",
				path: task.filePath ?? task.id,
				lastModified: task.lastModified ?? (task.updatedDate ? new Date(task.updatedDate) : new Date(0)),
				task: { ...task, source: "local" },
				workingCopy: true,
			});
		}
		for (const task of completedTasks) {
			records.push({
				id: task.id,
				type: "completed",
				branch: "local",
				path: task.filePath ?? task.id,
				lastModified: task.lastModified ?? (task.updatedDate ? new Date(task.updatedDate) : new Date(0)),
				task: { ...task, source: "completed" },
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
			const workingPaths = new Set(
				liveRecords(identity)
					.filter((record) => record.workingCopy)
					.map((record) => toPosixPath(record.path)),
			);
			if (workingPaths.size > 1) {
				for (const path of workingPaths) candidates.add(path);
			}
		}
		return [...candidates].sort((left, right) => left.localeCompare(right));
	}

	getTasks(includeCompleted = false): Task[] {
		const tasks: Task[] = [];
		const groups = [...this.groups.values()].sort((left, right) => left.id.localeCompare(right.id));
		for (const group of groups) {
			const identities = [...group.identities.values()].sort((left, right) => left.path.localeCompare(right.path));
			for (const identity of identities) {
				const lifecycle = selectLifecycleRecord(identity.records);
				if (!lifecycle || (lifecycle.type !== "task" && lifecycle.type !== "completed")) continue;
				if (lifecycle.type === "completed" && !includeCompleted) continue;
				const selected = selectTaskRecord(
					identity.records.filter((record) => record.type === lifecycle.type),
					this.statuses,
					this.resolutionStrategy,
				);
				if (!selected?.task) continue;
				tasks.push(lifecycle.type === "completed" ? { ...selected.task, source: "completed" } : selected.task);
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

	resolveForMutation(taskId: string): TaskIdentityResolution {
		const groups = this.getGroups(taskId);
		if (groups.length === 0) return { status: "not-found" };
		if (groups.length > 1) return { status: "ambiguous", candidates: this.candidatesAcrossGroups(groups) };
		const group = groups[0] as TaskIdentityGroup;
		const candidates = this.ambiguousCandidates(group);
		if (candidates.length > 0) return { status: "ambiguous", candidates };
		const workingTasks = [...group.identities.values()]
			.flatMap((identity) => identity.records)
			.filter((record) => record.workingCopy && record.type === "task" && record.task)
			.sort((left, right) => recordKey(left).localeCompare(recordKey(right)));
		const selected = workingTasks[0]?.task;
		return selected ? { status: "found", task: { ...selected, source: "local" } } : { status: "not-found" };
	}

	resolve(taskId: string): TaskIdentityResolution {
		return this.resolveForMutation(taskId);
	}

	getFingerprint(): string {
		return this.records
			.map(
				(record) =>
					`${record.branch}\0${normalizeRecordPath(record, this.context)}\0${record.id}\0${record.type}\0${record.workingCopy ? "1" : "0"}`,
			)
			.sort((left, right) => left.localeCompare(right))
			.join("\n");
	}

	/**
	 * The canonical IDs more than one live identity claims, the same collision `resolveForRead`
	 * reports. A corpus built from selected records cannot re-derive this: selection keeps one record
	 * per identity and skips identities whose newest record is archived or failed to parse, so a
	 * claimant can be missing from the corpus while still contesting the ID here.
	 */
	getContestedIds(): Set<string> {
		const contested = new Set<string>();
		for (const group of this.groups.values()) {
			const claimants = [...group.identities.values()].filter((identity) => liveRecords(identity).length > 0);
			if (claimants.length > 1) contested.add(group.id);
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
