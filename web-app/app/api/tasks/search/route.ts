import { ensureDbInit } from "@/lib/db/ensure-init";
import { searchTasks } from "@/lib/queries/tasks";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	await ensureDbInit();
	const { searchParams } = new URL(request.url);
	const query = searchParams.get("q") ?? "";
	const tasks = await searchTasks(query);
	return NextResponse.json(tasks);
}
