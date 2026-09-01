import type { Task } from "../types/index.ts";
import { buildDependencyGraph, type DependencyGraph } from "../utils/dependency-graph.ts";
import { createReadinessGraph, getTaskReadiness, type TaskReadiness } from "../utils/readiness.ts";
import { canonicalTaskId } from "../utils/task-id.ts";
import type { Core } from "./backlog.ts";

/**
 * The records a read is allowed to resolve relationships against, loaded once and shared by every
 * question asked about them. Readiness and the dependency graph both take this, so they can never
 * end up looking at different corpora.
 */
export interface TaskCorpus {
	tasks: Task[];
	completedTasks: Task[];
	statuses: readonly string[] | undefined;
	/**
	 * Identities the store knows more than one file claims. Reads fail closed on these whatever the
	 * merge below kept, so a collision is never answered with whichever record happened to survive.
	 */
	ambiguousIds?: ReadonlySet<string>;
}

/**
 * Load the corpus a read may see.
 *
 * Without cross-branch records this is the working copy plus the completed corpus, which is what
 * every local task lookup already resolves against. With them, the working copy is still read as
 * written and the cross-branch store only contributes identities the working copy does not have:
 * the store resolves each identity to a single record, so merging the other way round would hide a
 * local ID that two files claim and quietly turn an ambiguous dependency into a resolved one.
 */
export async function loadTaskCorpus(
	core: Core,
	options: { includeCrossBranch: boolean } = { includeCrossBranch: false },
): Promise<TaskCorpus> {
	const [workingCopyTasks, completedTasks, config] = await Promise.all([
		core.queryTasks({ includeCrossBranch: false }),
		core.filesystem.listCompletedTasks(),
		core.filesystem.loadConfig(),
	]);
	const statuses = config?.statuses;

	if (!options.includeCrossBranch) {
		return { tasks: workingCopyTasks, completedTasks, statuses };
	}

	const storeTasks = await core.queryTasks({ includeCrossBranch: true });
	const workingCopyIds = new Set(workingCopyTasks.map((task) => canonicalTaskId(task.id)));

	// The cross-branch store's task list excludes completed records, so an identity that only exists
	// as a completed record on some branch would otherwise read as missing here. Its identity index
	// still knows those records; add the ones the local completed corpus does not already cover.
	const identityIndex = (await core.getContentStore()).getTaskCorpusSnapshot().identityIndex;
	const localCompletedIds = new Set(completedTasks.map((task) => canonicalTaskId(task.id)));
	const crossBranchCompleted = (identityIndex?.getTasks(true) ?? []).filter(
		(task) => task.source === "completed" && !localCompletedIds.has(canonicalTaskId(task.id)),
	);

	return {
		tasks: [...workingCopyTasks, ...storeTasks.filter((task) => !workingCopyIds.has(canonicalTaskId(task.id)))],
		completedTasks: [...completedTasks, ...crossBranchCompleted],
		statuses,
		// Both merges above resolve an ID the working copy also holds to the local record, which is
		// the right answer for an identity only one file claims and a guess for one several do. The
		// index knows which is which, so the collisions travel with the corpus rather than being
		// re-derived from the records that survived the merge.
		ambiguousIds: identityIndex?.getContestedIds(),
	};
}

/**
 * A task as a list, search, or board read returns it: the stored record plus the one readiness
 * verdict a list renders. The blockers behind the verdict belong to the detail read, so a list of
 * any size stays the size it already was.
 */
export type TaskListItem = Task & { isReady: boolean };

/**
 * A task as a detail read returns it: the stored record plus the relationships derived from the
 * corpus around it. The derived fields exist only in the read; they are never written back to the
 * Markdown record, and edit confirmations and other non-detail output return plain `Task`s so they
 * cannot pick them up by accident.
 *
 * Surfaces receive this already built and only render it. A function that returns a `TaskDetail`
 * cannot forget to populate the fields, which is why they are required here rather than optional
 * on `Task`.
 */
export type TaskDetail = Task & { dependencyGraph: DependencyGraph; readiness: TaskReadiness };

/**
 * Attach the derived relationships using a corpus the caller already holds.
 *
 * Readiness and the dependency graph are answered from the same corpus in the same call, so the
 * two can never describe different records of the same project.
 */
export function toTaskDetail(task: Task, corpus: TaskCorpus): TaskDetail {
	return {
		...task,
		dependencyGraph: buildDependencyGraph(task, corpus),
		readiness: getTaskReadiness(task, createReadinessGraph(corpus)),
	};
}

/**
 * Attach readiness to a whole list in one pass over the corpus.
 *
 * The index is built once and every task answers from it, so a list interface never resolves
 * dependencies per row. The corpus is the whole project, never the list: `--status` and
 * `--assignee` narrow what is displayed, and readiness must still see the dependencies they hid.
 */
export function withReadiness(tasks: readonly Task[], corpus: TaskCorpus): TaskListItem[] {
	const graph = createReadinessGraph(corpus);
	return tasks.map((task) => ({ ...task, isReady: getTaskReadiness(task, graph).isReady }));
}

/** Load the corpus and attach the derived relationships, for a surface that reads per detail view. */
export async function loadTaskDetail(
	core: Core,
	task: Task,
	options: { includeCrossBranch: boolean } = { includeCrossBranch: false },
): Promise<TaskDetail> {
	return toTaskDetail(task, await loadTaskCorpus(core, options));
}

/**
 * Load the corpus and attach readiness to a list, for a surface that renders or filters it.
 *
 * Readiness needs the completed corpus to tell a finished dependency from an unfinished one, which
 * a plain list read does not load. Call this only where the verdict is rendered or filtered on, so
 * output that never mentions readiness keeps reading exactly what it reads today.
 */
export async function loadTaskListItems(
	core: Core,
	tasks: readonly Task[],
	options: { includeCrossBranch: boolean } = { includeCrossBranch: false },
): Promise<TaskListItem[]> {
	return withReadiness(tasks, await loadTaskCorpus(core, options));
}

/**
 * The dependency graph of whatever a renderer was handed. A plain `Task` simply has none, which is
 * what keeps edit confirmations and other non-detail output the size they already are.
 */
export function taskDependencyGraph(task: Task | TaskDetail | null | undefined): DependencyGraph | undefined {
	return (task as Partial<TaskDetail> | null | undefined)?.dependencyGraph;
}

/** The readiness of whatever a renderer was handed, on the same terms as the dependency graph. */
export function taskReadiness(task: Task | TaskDetail | null | undefined): TaskReadiness | undefined {
	return (task as Partial<TaskDetail> | null | undefined)?.readiness;
}
