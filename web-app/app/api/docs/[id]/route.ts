import { ensureDbInit } from "@/lib/db/ensure-init";
import { deleteDocument, getDocumentById, updateDocument } from "@/lib/queries/docs";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	const doc = await getDocumentById(id);
	if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json(doc);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	const body = await request.json();
	const doc = await updateDocument(id, body);
	if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await ensureDbInit();
	const { id } = await params;
	await deleteDocument(id);
	return NextResponse.json({ success: true });
}
