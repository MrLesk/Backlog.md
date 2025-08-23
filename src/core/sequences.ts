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
export function computeSequences(tasks: Task[]): Sequence[] {
	// Map task id -> task for fast lookups
	const byId = new Map<string, Task>();
	for (const t of tasks) byId.set(t.id, t);

	const ids = new Set(Array.from(byId.keys()));

	// Build adjacency list and indegree counts considering only dependencies within provided set
	const successors = new Map<string, string[]>();
	const indegree = new Map<string, number>();

	for (const id of ids) {
		successors.set(id, []);
		indegree.set(id, 0);
	}

	for (const t of tasks) {
		const deps = Array.isArray(t.dependencies) ? t.dependencies : [];
		for (const dep of deps) {
			if (!ids.has(dep)) continue; // ignore external deps
			successors.get(dep)?.push(t.id);
			indegree.set(t.id, (indegree.get(t.id) || 0) + 1);
		}
	}

	// Kahn-style layered topological grouping
	const remaining = new Set(ids);
	const sequences: Sequence[] = [];

	while (remaining.size > 0) {
		// Pick all nodes with indegree 0
		const layerIds: string[] = [];
		for (const id of remaining) {
			if ((indegree.get(id) || 0) === 0) layerIds.push(id);
		}

		if (layerIds.length === 0) {
			// Cycle detected among remaining tasks; emit them as a final sequence (sorted for determinism)
			const finalTasks = sortByTaskId(
				Array.from(remaining)
					.map((id) => byId.get(id))
					.filter((t): t is Task => Boolean(t)),
			);
			sequences.push({ index: sequences.length + 1, tasks: finalTasks });
			break;
		}

		// Sort layer by task id for stable ordering
		const layerTasks = sortByTaskId(layerIds.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t)));
		sequences.push({ index: sequences.length + 1, tasks: layerTasks });

		// Remove layer from graph, decrement successors' indegree
		for (const id of layerIds) {
			remaining.delete(id);
			for (const succ of successors.get(id) || []) {
				indegree.set(succ, (indegree.get(succ) || 0) - 1);
			}
		}
	}

	return sequences;
}
