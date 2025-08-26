import type { Sequence, Task } from "../types/index.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

/**
 * Compute execution sequences (layers) from task dependencies.
 * - Sequence 1 contains tasks with no dependencies among the provided set.
 * - Subsequent sequences contain tasks whose dependencies appear in earlier sequences.
 * - Dependencies that reference tasks outside the provided set are ignored for layering.
 * - If cycles exist, any remaining tasks are emitted in a final sequence to ensure each task
 *   appears exactly once (consumers may choose to surface a warning in that case).
 */
export function computeSequences(tasks: Task[]): { unsequenced: Task[]; sequences: Sequence[] } {
	// Map task id -> task for fast lookups
	const byId = new Map<string, Task>();
	for (const t of tasks) byId.set(t.id, t);

	const allIds = new Set(Array.from(byId.keys()));

	// Build adjacency using only edges within provided set
	const successors = new Map<string, string[]>();
	const indegree = new Map<string, number>();
	for (const id of allIds) {
		successors.set(id, []);
		indegree.set(id, 0);
	}
	for (const t of tasks) {
		const deps = Array.isArray(t.dependencies) ? t.dependencies : [];
		for (const dep of deps) {
			if (!allIds.has(dep)) continue; // ignore external deps for layering
			successors.get(dep)?.push(t.id);
			indegree.set(t.id, (indegree.get(t.id) || 0) + 1);
		}
	}

	// Identify isolated tasks: absolutely no dependencies (even external) AND no internal dependents
	const hasAnyDeps = (t: Task) => (t.dependencies || []).length > 0;
	const hasDependents = (id: string) => (successors.get(id) || []).length > 0;

	const unsequenced = sortByTaskId(
		tasks.filter((t) => !hasAnyDeps(t) && !hasDependents(t.id) && t.ordinal === undefined),
	);

	// Build layering set by excluding unsequenced tasks
	const layeringIds = new Set(Array.from(allIds).filter((id) => !unsequenced.some((t) => t.id === id)));

	// Kahn-style layered topological grouping on the remainder
	const sequences: Sequence[] = [];
	const remaining = new Set(layeringIds);

	// Prepare local indegree copy considering only remaining nodes
	const indegRem = new Map<string, number>();
	for (const id of remaining) indegRem.set(id, 0);
	for (const id of remaining) {
		const t = byId.get(id);
		if (!t) continue;
		for (const dep of t.dependencies || []) {
			if (remaining.has(dep)) indegRem.set(id, (indegRem.get(id) || 0) + 1);
		}
	}

	while (remaining.size > 0) {
		const layerIds: string[] = [];
		for (const id of remaining) {
			if ((indegRem.get(id) || 0) === 0) layerIds.push(id);
		}

		if (layerIds.length === 0) {
			// Cycle detected; emit all remaining nodes as final layer (deterministic order)
			const finalTasks = sortByTaskId(
				Array.from(remaining)
					.map((id) => byId.get(id))
					.filter((t): t is Task => Boolean(t)),
			);
			sequences.push({ index: sequences.length + 1, tasks: finalTasks });
			break;
		}

		const layerTasks = sortByTaskId(layerIds.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t)));
		sequences.push({ index: sequences.length + 1, tasks: layerTasks });

		for (const id of layerIds) {
			remaining.delete(id);
			for (const succ of successors.get(id) || []) {
				if (!remaining.has(succ)) continue;
				indegRem.set(succ, (indegRem.get(succ) || 0) - 1);
			}
		}
	}

	return { unsequenced, sequences };
}

/**
 * Adjust dependencies when moving a task to a target sequence index.
 *
 * Rules:
 * - Set moved task's dependencies to all task IDs from the immediately previous
 *   sequence (targetIndex - 1). If targetIndex is 1, dependencies become [].
 * - Add the moved task as a dependency to all tasks in the immediately next
 *   sequence (targetIndex + 1). Duplicates are removed.
 * - Other dependencies remain unchanged for other tasks.
 */
export function adjustDependenciesForMove(
	tasks: Task[],
	sequences: Sequence[],
	movedTaskId: string,
	targetSequenceIndex: number,
): Task[] {
	// Join semantics: set moved.dependencies to previous sequence tasks (if any),
	// do NOT add moved as a dependency to next-sequence tasks, and do not touch others.
	const byId = new Map<string, Task>(tasks.map((t) => [t.id, { ...t }]));
	const moved = byId.get(movedTaskId);
	if (!moved) return tasks;

	const prevSeq = sequences.find((s) => s.index === targetSequenceIndex - 1);
	// Exclude the moved task itself to avoid creating a self-dependency when moving from seq N to N+1
	const prevIds = prevSeq ? prevSeq.tasks.map((t) => t.id).filter((id) => id !== movedTaskId) : [];

	moved.dependencies = [...prevIds];
	byId.set(moved.id, moved);

	return Array.from(byId.values());
}

/**
 * Reorder tasks within a sequence by assigning ordinal values.
 * Does not modify dependencies. Only tasks in the provided sequenceTaskIds are re-assigned ordinals.
 */
export function reorderWithinSequence(
	tasks: Task[],
	sequenceTaskIds: string[],
	movedTaskId: string,
	newIndex: number,
): Task[] {
	const seqIds = sequenceTaskIds.filter((id) => id && tasks.some((t) => t.id === id));
	const withoutMoved = seqIds.filter((id) => id !== movedTaskId);
	const clampedIndex = Math.max(0, Math.min(withoutMoved.length, newIndex));
	const newOrder = [...withoutMoved.slice(0, clampedIndex), movedTaskId, ...withoutMoved.slice(clampedIndex)];

	const byId = new Map<string, Task>(tasks.map((t) => [t.id, { ...t }]));
	newOrder.forEach((id, idx) => {
		const t = byId.get(id);
		if (t) {
			t.ordinal = idx;
			byId.set(id, t);
		}
	});
	return Array.from(byId.values());
}
