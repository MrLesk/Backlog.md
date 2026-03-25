import { ensureDbInit } from "@/lib/db/ensure-init";
import { archiveTask, completeTask, getTaskById, updateTask } from "@/lib/queries/tasks";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	const task = await getTaskById(id);
	if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json(task);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	try {
		const body = await request.json();

		// Support complete action via body flag
		if (body._action === "complete") {
			const task = await completeTask(id);
			if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
			return NextResponse.json(task);
		}

		const task = await updateTask(id, body);
		if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
		return NextResponse.json(task);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to update task";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	await archiveTask(id);
	return NextResponse.json({ success: true });
}
