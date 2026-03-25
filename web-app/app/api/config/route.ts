import { ensureDbInit } from "@/lib/db/ensure-init";
import { getConfig, updateConfig } from "@/lib/queries/config";
import { NextResponse } from "next/server";

export async function GET() {
	await ensureDbInit();
	const cfg = await getConfig();
	return NextResponse.json(cfg);
}

export async function PUT(request: Request) {
	await ensureDbInit();
	try {
		const body = await request.json();
		const cfg = await updateConfig(body);
		return NextResponse.json(cfg);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to update config";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
