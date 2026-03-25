import { ensureDbInit } from "@/lib/db/ensure-init";
import { cleanupCompletedTasks } from "@/lib/queries/tasks";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
	await ensureDbInit();
	const completedTasks = await db
		.select({ id: tasks.id, title: tasks.title, updatedAt: tasks.updatedAt, createdAt: tasks.createdAt })
		.from(tasks)
		.where(and(eq(tasks.isCompleted, true), eq(tasks.isArchived, false)));

	return NextResponse.json({
		count: completedTasks.length,
		tasks: completedTasks.map((t) => ({
			id: t.id,
			title: t.title,
			updatedDate: t.updatedAt ?? undefined,
			createdDate: t.createdAt,
		})),
	});
}

export async function POST() {
	await ensureDbInit();
	const deleted = await cleanupCompletedTasks();
	return NextResponse.json({ success: true, movedCount: deleted, totalCount: deleted, message: `Archived ${deleted} tasks` });
}
