import { ensureDbInit } from "@/lib/db/ensure-init";
import { createDecision, getAllDecisions } from "@/lib/queries/docs";
import { NextResponse } from "next/server";

export async function GET() {
	await ensureDbInit();
	const decisions = await getAllDecisions();
	return NextResponse.json(decisions);
}

export async function POST(request: Request) {
	await ensureDbInit();
	try {
		const body = await request.json();
		const decision = await createDecision(body);
		return NextResponse.json(decision, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to create decision";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
