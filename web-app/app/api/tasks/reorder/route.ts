import { ensureDbInit } from "@/lib/db/ensure-init";
import { reorderTask } from "@/lib/queries/tasks";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	await ensureDbInit();
	try {
		const { id, ordinal } = await request.json();
		await reorderTask(id, ordinal);
		return NextResponse.json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to reorder";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
