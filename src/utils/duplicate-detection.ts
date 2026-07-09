import type { Task } from "../types/index.ts";

export type DuplicateGroup = {
	id: string;
	tasks: Task[];
};

export function detectDuplicateTaskIds(tasks: Task[]): DuplicateGroup[] {
	const byId = new Map<string, Task[]>();
	for (const task of tasks) {
		const key = task.id.toLowerCase();
		const group = byId.get(key) ?? [];
		group.push(task);
		byId.set(key, group);
	}
	return Array.from(byId.entries())
		.filter(([, group]) => group.length > 1)
		.map(([, group]) => ({ id: group[0]?.id ?? "", tasks: group }))
		.filter((g) => g.id !== "");
}

export function buildDuplicateCleanupPrompt(groups: DuplicateGroup[]): string {
	const lines = [
		"Repair duplicate Backlog.md task IDs.",
		"",
		"Goal:",
		"- Preserve every task, but make each task ID unique so merged task views stop hiding duplicates.",
		"- Keep one task in each duplicate group at its current ID. Assign new unused IDs to the other tasks in that group.",
		"- Update dependencies, parent/subtask links, documentation, decisions, and comments that reference any renumbered IDs.",
		"",
		"Workflow:",
		"- Run `backlog instructions overview` before making changes.",
		"- Because duplicate IDs make ID-based commands ambiguous, inspect the files listed below by path before editing.",
		"- Prefer Backlog.md CLI commands when they can address the change unambiguously. If file-level repair is required, keep it limited to the listed duplicate files and references to renumbered IDs.",
		"- Do not delete, merge, or rewrite task content unless a maintainer explicitly asks.",
		"- After repair, run a task list/search command to confirm each old duplicate group is gone.",
		"",
		"Duplicate groups to repair:",
	];
	for (const group of groups) {
		lines.push(`- ${group.id}`);
		for (const task of group.tasks) {
			const path = task.filePath ? ` (${task.filePath})` : "";
			lines.push(`  - "${task.title}"${path}`);
		}
	}
	return lines.join("\n");
}
