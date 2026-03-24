import { ensureDbInit } from "@/lib/db/ensure-init";
import { createDocument, getAllDocuments } from "@/lib/queries/docs";
import { NextResponse } from "next/server";

export async function GET() {
	await ensureDbInit();
	const docs = await getAllDocuments();
	return NextResponse.json(docs);
}

export async function POST(request: Request) {
	await ensureDbInit();
	try {
		const body = await request.json();
		const doc = await createDocument(body);
		return NextResponse.json(doc, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to create document";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
