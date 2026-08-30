import type { Task } from "../types/index.ts";
import { buildDependencyGraph, type DependencyGraph } from "../utils/dependency-graph.ts";
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
	return {
		tasks: [...workingCopyTasks, ...storeTasks.filter((task) => !workingCopyIds.has(canonicalTaskId(task.id)))],
		completedTasks,
		statuses,
	};
}

/**
 * A task as a detail read returns it: the stored record plus the relationships derived from the
 * corpus around it. The derived fields exist only in the read; they are never written back to the
 * Markdown record, and the compact list, search, and board projections return plain `Task`s so they
 * cannot pick them up by accident.
 *
 * Surfaces receive this already built and only render it. A function that returns a `TaskDetail`
 * cannot forget to populate the field, which is why the field is required here rather than optional
 * on `Task`.
 */
export type TaskDetail = Task & { dependencyGraph: DependencyGraph };

/** Attach the derived relationships using a corpus the caller already holds. */
export function withDependencyGraph(task: Task, corpus: TaskCorpus): TaskDetail {
	return { ...task, dependencyGraph: buildDependencyGraph(task, corpus) };
}

/** Load the corpus and attach the derived relationships, for a surface that reads per detail view. */
export async function loadTaskDetail(
	core: Core,
	task: Task,
	options: { includeCrossBranch: boolean } = { includeCrossBranch: false },
): Promise<TaskDetail> {
	return withDependencyGraph(task, await loadTaskCorpus(core, options));
}

/**
 * The dependency graph of whatever a renderer was handed. A plain `Task` simply has none, which is
 * what keeps edit confirmations and other non-detail output the size they already are.
 */
export function taskDependencyGraph(task: Task | TaskDetail | null | undefined): DependencyGraph | undefined {
	return (task as Partial<TaskDetail> | null | undefined)?.dependencyGraph;
}
