import { ensureDbInit } from "@/lib/db/ensure-init";
import { deleteDecision, getDecisionById, updateDecision } from "@/lib/queries/docs";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	const decision = await getDecisionById(id);
	if (!decision) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json(decision);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	const body = await request.json();
	const decision = await updateDecision(id, body);
	if (!decision) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json(decision);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	await deleteDecision(id);
	return NextResponse.json({ success: true });
}
