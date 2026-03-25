import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { acceptanceCriteria, tasks } from "../db/schema";
import type { Task, TaskCreateInput, TaskUpdateInput } from "@/types";

// Helpers to parse JSON fields stored as strings
function parseJson<T>(val: string | null | undefined, fallback: T): T {
	if (!val) return fallback;
	try {
		return JSON.parse(val) as T;
	} catch {
		return fallback;
	}
}

function rowToTask(
	row: typeof tasks.$inferSelect,
	criteria: typeof acceptanceCriteria.$inferSelect[],
): Task {
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		priority: row.priority as Task["priority"],
		assignee: parseJson<string[]>(row.assignee, []),
		reporter: row.reporter ?? undefined,
		createdDate: row.createdAt,
		updatedDate: row.updatedAt ?? undefined,
		labels: parseJson<string[]>(row.labels, []),
		milestone: row.milestone ?? undefined,
		dependencies: parseJson<string[]>(row.dependencies, []),
		parentTaskId: row.parentTaskId ?? undefined,
		subtasks: parseJson<string[]>(row.subtasks, []),
		description: row.description ?? undefined,
		implementationPlan: row.implementationPlan ?? undefined,
		implementationNotes: row.implementationNotes ?? undefined,
		ordinal: row.ordinal ?? 0,
		isDraft: row.isDraft ?? false,
		isArchived: row.isArchived ?? false,
		isCompleted: row.isCompleted ?? false,
		acceptanceCriteriaItems: criteria
			.sort((a, b) => a.index - b.index)
			.map((c) => ({ index: c.index, text: c.text, checked: c.checked ?? false })),
	};
}

export async function getAllTasks(): Promise<Task[]> {
	const rows = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.isArchived, false), eq(tasks.isDraft, false)))
		.orderBy(asc(tasks.ordinal), asc(tasks.createdAt));

	const allCriteria = await db.select().from(acceptanceCriteria);
	const criteriaByTask = new Map<string, typeof acceptanceCriteria.$inferSelect[]>();
	for (const c of allCriteria) {
		if (!criteriaByTask.has(c.taskId)) criteriaByTask.set(c.taskId, []);
		criteriaByTask.get(c.taskId)!.push(c);
	}

	return rows.map((row) => rowToTask(row, criteriaByTask.get(row.id) ?? []));
}

export async function getDraftTasks(): Promise<Task[]> {
	const rows = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.isDraft, true), eq(tasks.isArchived, false)))
		.orderBy(asc(tasks.createdAt));

	const allCriteria = await db.select().from(acceptanceCriteria);
	const criteriaByTask = new Map<string, typeof acceptanceCriteria.$inferSelect[]>();
	for (const c of allCriteria) {
		if (!criteriaByTask.has(c.taskId)) criteriaByTask.set(c.taskId, []);
		criteriaByTask.get(c.taskId)!.push(c);
	}

	return rows.map((row) => rowToTask(row, criteriaByTask.get(row.id) ?? []));
}

export async function getTaskById(id: string): Promise<Task | null> {
	const row = await db.select().from(tasks).where(eq(tasks.id, id)).get();
	if (!row) return null;

	const criteria = await db
		.select()
		.from(acceptanceCriteria)
		.where(eq(acceptanceCriteria.taskId, id));

	return rowToTask(row, criteria);
}

export async function getNextTaskId(): Promise<string> {
	// Use the max numeric ID to generate next
	const rows = await db.select({ id: tasks.id }).from(tasks);
	let max = 0;
	for (const row of rows) {
		const num = parseInt(row.id.replace("task-", ""), 10);
		if (!isNaN(num) && num > max) max = num;
	}
	return `task-${max + 1}`;
}

export async function createTask(input: TaskCreateInput): Promise<Task> {
	const id = await getNextTaskId();
	const now = new Date().toISOString();

	await db.insert(tasks).values({
		id,
		title: input.title,
		status: input.status ?? "To Do",
		priority: input.priority,
		assignee: JSON.stringify(input.assignee ?? []),
		labels: JSON.stringify(input.labels ?? []),
		dependencies: JSON.stringify(input.dependencies ?? []),
		subtasks: JSON.stringify([]),
		description: input.description,
		implementationPlan: input.implementationPlan,
		implementationNotes: input.implementationNotes,
		parentTaskId: input.parentTaskId,
		isDraft: input.isDraft ?? false,
		createdAt: now,
		updatedAt: now,
	});

	// Insert acceptance criteria
	if (input.acceptanceCriteria?.length) {
		await db.insert(acceptanceCriteria).values(
			input.acceptanceCriteria.map((ac, i) => ({
				taskId: id,
				index: i + 1,
				text: ac.text,
				checked: ac.checked ?? false,
			})),
		);
	}

	return (await getTaskById(id))!;
}

export async function updateTask(id: string, input: TaskUpdateInput): Promise<Task | null> {
	const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get();
	if (!existing) return null;

	const now = new Date().toISOString();

	await db
		.update(tasks)
		.set({
			...(input.title !== undefined && { title: input.title }),
			...(input.status !== undefined && { status: input.status }),
			...(input.priority !== undefined && { priority: input.priority }),
			...(input.assignee !== undefined && { assignee: JSON.stringify(input.assignee) }),
			...(input.labels !== undefined && { labels: JSON.stringify(input.labels) }),
			...(input.dependencies !== undefined && { dependencies: JSON.stringify(input.dependencies) }),
			...(input.description !== undefined && { description: input.description }),
			...(input.implementationPlan !== undefined && { implementationPlan: input.implementationPlan }),
			...(input.implementationNotes !== undefined && {
				implementationNotes: input.implementationNotes,
			}),
			...(input.ordinal !== undefined && { ordinal: input.ordinal }),
			...(input.isDraft !== undefined && { isDraft: input.isDraft }),
			...(input.isArchived !== undefined && { isArchived: input.isArchived }),
			...(input.isCompleted !== undefined && { isCompleted: input.isCompleted }),
			updatedAt: now,
		})
		.where(eq(tasks.id, id));

	// Replace acceptance criteria if provided
	if (input.acceptanceCriteria !== undefined) {
		await db.delete(acceptanceCriteria).where(eq(acceptanceCriteria.taskId, id));
		if (input.acceptanceCriteria.length > 0) {
			await db.insert(acceptanceCriteria).values(
				input.acceptanceCriteria.map((ac, i) => ({
					taskId: id,
					index: i + 1,
					text: ac.text,
					checked: ac.checked ?? false,
				})),
			);
		}
	}

	return getTaskById(id);
}

export async function archiveTask(id: string): Promise<void> {
	await db
		.update(tasks)
		.set({ isArchived: true, updatedAt: new Date().toISOString() })
		.where(eq(tasks.id, id));
}

export async function completeTask(id: string): Promise<Task | null> {
	return updateTask(id, { status: "Done", isCompleted: true });
}

export async function reorderTask(id: string, newOrdinal: number): Promise<void> {
	await db
		.update(tasks)
		.set({ ordinal: newOrdinal, updatedAt: new Date().toISOString() })
		.where(eq(tasks.id, id));
}

export async function searchTasks(query: string): Promise<Task[]> {
	if (!query.trim()) return getAllTasks();

	// Use FTS5 for full-text search
	const ftsResults = await db.run(
		sql`SELECT tasks.* FROM tasks_fts
        JOIN tasks ON tasks.id = tasks_fts.id
        WHERE tasks_fts MATCH ${query + "*"}
        AND tasks.is_archived = 0 AND tasks.is_draft = 0
        ORDER BY rank LIMIT 50`,
	);

	const rows = (ftsResults.rows as unknown[]) as (typeof tasks.$inferSelect)[];
	if (!rows.length) return [];

	const ids = rows.map((r) => r.id);
	const allCriteria = await db.select().from(acceptanceCriteria);
	const criteriaByTask = new Map<string, typeof acceptanceCriteria.$inferSelect[]>();
	for (const c of allCriteria) {
		if (!criteriaByTask.has(c.taskId)) criteriaByTask.set(c.taskId, []);
		criteriaByTask.get(c.taskId)!.push(c);
	}

	return rows
		.filter((r) => ids.includes(r.id))
		.map((row) => rowToTask(row, criteriaByTask.get(row.id) ?? []));
}

export async function getTaskStatistics() {
	const allTasks = await getAllTasks();
	const drafts = await getDraftTasks();

	const statusCounts: Record<string, number> = {};
	const priorityCounts: Record<string, number> = { high: 0, medium: 0, low: 0, none: 0 };

	for (const task of allTasks) {
		statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
		priorityCounts[task.priority ?? "none"] = (priorityCounts[task.priority ?? "none"] ?? 0) + 1;
	}

	const completedTasks = allTasks.filter((t) => t.isCompleted).length;

	return {
		statusCounts,
		priorityCounts,
		totalTasks: allTasks.length,
		completedTasks,
		completionPercentage: allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0,
		draftCount: drafts.length,
	};
}

export async function cleanupCompletedTasks(): Promise<number> {
	const result = await db
		.delete(tasks)
		.where(and(eq(tasks.isCompleted, true), eq(tasks.isArchived, false)));
	return result.rowsAffected ?? 0;
}
