import { ensureDbInit } from "@/lib/db/ensure-init";
import { createTask, getAllTasks, getDraftTasks } from "@/lib/queries/tasks";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	await ensureDbInit();
	const { searchParams } = new URL(request.url);
	const includeDrafts = searchParams.get("drafts") === "true";

	const tasks = includeDrafts ? await getDraftTasks() : await getAllTasks();
	return NextResponse.json(tasks);
}

export async function POST(request: Request) {
	await ensureDbInit();
	try {
		const body = await request.json();
		const task = await createTask(body);
		return NextResponse.json(task, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to create task";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
