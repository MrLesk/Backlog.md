import { ensureDbInit } from "@/lib/db/ensure-init";
import { getTaskStatistics } from "@/lib/queries/tasks";
import { NextResponse } from "next/server";

export async function GET() {
	await ensureDbInit();
	const stats = await getTaskStatistics();
	return NextResponse.json(stats);
}
