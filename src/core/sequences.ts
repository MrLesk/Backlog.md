import type { Task } from "../types/index.ts";

/**
 * Represents a sequence of tasks that can be worked on in parallel.
 * Tasks in the same sequence have no dependencies on each other,
 * but may depend on tasks from earlier sequences.
 */
export interface Sequence {
	/** The sequence number, starting from 1 */
	number: number;
	/** Tasks that belong to this sequence */
	tasks: Task[];
}

/**
 * Computes sequences from task dependencies using topological sorting with level assignment.
 *
 * @param tasks - Array of all tasks to organize into sequences
 * @returns Array of sequences, where each sequence contains tasks that can be worked on in parallel
 * @throws Error if circular dependencies are detected
 */
export function computeSequences(tasks: Task[]): Sequence[] {
	if (tasks.length === 0) {
		return [];
	}

	// Create a map for quick task lookup by ID
	const taskMap = new Map<string, Task>();
	for (const task of tasks) {
		taskMap.set(task.id, task);
	}

	// Build adjacency list and in-degree count
	const adjList = new Map<string, string[]>();
	const inDegree = new Map<string, number>();

	// Initialize all tasks
	for (const task of tasks) {
		adjList.set(task.id, []);
		inDegree.set(task.id, 0);
	}

	// Build the dependency graph
	for (const task of tasks) {
		for (const depId of task.dependencies) {
			// Only process dependencies that exist in our task set
			if (taskMap.has(depId)) {
				// depId must be completed before task.id
				const depTaskDependents = adjList.get(depId) || [];
				depTaskDependents.push(task.id);
				adjList.set(depId, depTaskDependents);

				// Increment in-degree for the current task
				inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
			}
		}
	}

	// Kahn's algorithm with level assignment
	const sequences: Sequence[] = [];
	const taskLevels = new Map<string, number>();
	const queue: string[] = [];
	let processedCount = 0;

	// Find all tasks with no dependencies (in-degree = 0)
	for (const [taskId, degree] of inDegree.entries()) {
		if (degree === 0) {
			queue.push(taskId);
			taskLevels.set(taskId, 1);
		}
	}

	// Process tasks level by level
	while (queue.length > 0) {
		const currentLevel = new Set<string>();
		const queueSize = queue.length;

		// Process all tasks at the current level
		for (let i = 0; i < queueSize; i++) {
			const taskId = queue.shift();
			if (!taskId) continue;

			currentLevel.add(taskId);
			processedCount++;

			// Update in-degrees of dependent tasks
			const dependents = adjList.get(taskId) || [];
			for (const dependentId of dependents) {
				const newDegree = (inDegree.get(dependentId) || 0) - 1;
				inDegree.set(dependentId, newDegree);

				if (newDegree === 0) {
					queue.push(dependentId);
					// Set level based on maximum dependency level + 1
					const dependentTask = taskMap.get(dependentId);
					if (dependentTask) {
						const depLevel =
							Math.max(
								...[taskId, ...dependentTask.dependencies]
									.filter((id) => taskLevels.has(id))
									.map((id) => taskLevels.get(id) || 0),
							) + 1;
						taskLevels.set(dependentId, depLevel);
					}
				}
			}
		}
	}

	// Check for circular dependencies
	if (processedCount !== tasks.length) {
		const unprocessed = tasks.filter((task) => !taskLevels.has(task.id)).map((task) => task.id);
		throw new Error(`Circular dependencies detected involving tasks: ${unprocessed.join(", ")}`);
	}

	// Group tasks by their level
	const levelGroups = new Map<number, Task[]>();
	for (const task of tasks) {
		const level = taskLevels.get(task.id) || 1;
		if (!levelGroups.has(level)) {
			levelGroups.set(level, []);
		}
		const group = levelGroups.get(level);
		if (group) {
			group.push(task);
		}
	}

	// Convert level groups to sequences
	const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
	for (const level of sortedLevels) {
		const tasksForLevel = levelGroups.get(level);
		if (tasksForLevel) {
			sequences.push({
				number: level,
				tasks: tasksForLevel.sort((a, b) => a.id.localeCompare(b.id)),
			});
		}
	}

	return sequences;
}
