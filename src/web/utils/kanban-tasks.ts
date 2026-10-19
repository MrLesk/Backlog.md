import type { Task } from "../../types";

/** Archived tasks are off the board; they stay reachable through their task detail only. */
export function filterKanbanTasks(tasks: Task[]): Task[] {
	return tasks.filter((task) => task.source !== "archived");
}
