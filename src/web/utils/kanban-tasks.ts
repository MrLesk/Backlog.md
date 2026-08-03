import type { Task } from "../../types";

/** The shared browser corpus omits archived identities; completed identities remain detail-addressable only. */
export function filterKanbanTasks(tasks: Task[]): Task[] {
	return tasks.filter((task) => task.source !== "completed");
}
