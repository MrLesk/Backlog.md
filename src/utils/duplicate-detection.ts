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
		"I have duplicate task IDs in my backlog, caused by two git branches independently creating tasks with the same ID before being merged.",
		"Please renumber the duplicates: keep one task at its original number and assign the next available IDs to the others. Update any cross-references between tasks as needed.",
		"",
		"Duplicate groups:",
	];
	for (const group of groups) {
		const titles = group.tasks.map((t) => `"${t.title}"`).join(" and ");
		lines.push(`- ID ${group.id}: ${titles}`);
	}
	return lines.join("\n");
}
