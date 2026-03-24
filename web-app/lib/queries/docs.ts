import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { decisions, documents } from "../db/schema";
import type { Decision, Document } from "@/types";

function docRowToDoc(row: typeof documents.$inferSelect): Document {
	return {
		id: row.id,
		title: row.title,
		content: row.content,
		createdDate: row.createdAt,
		updatedDate: row.updatedAt ?? undefined,
	};
}

function decisionRowToDecision(row: typeof decisions.$inferSelect): Decision {
	return {
		id: row.id,
		title: row.title,
		status: row.status ?? undefined,
		content: row.content,
		createdDate: row.createdAt,
		updatedDate: row.updatedAt ?? undefined,
	};
}

async function getNextDocId(): Promise<string> {
	const rows = await db.select({ id: documents.id }).from(documents);
	let max = 0;
	for (const row of rows) {
		const num = parseInt(row.id.replace("doc-", ""), 10);
		if (!isNaN(num) && num > max) max = num;
	}
	return `doc-${max + 1}`;
}

async function getNextDecisionId(): Promise<string> {
	const rows = await db.select({ id: decisions.id }).from(decisions);
	let max = 0;
	for (const row of rows) {
		const num = parseInt(row.id.replace("decision-", ""), 10);
		if (!isNaN(num) && num > max) max = num;
	}
	return `decision-${max + 1}`;
}

// Documents
export async function getAllDocuments(): Promise<Document[]> {
	const rows = await db.select().from(documents).orderBy(asc(documents.createdAt));
	return rows.map(docRowToDoc);
}

export async function getDocumentById(id: string): Promise<Document | null> {
	const row = await db.select().from(documents).where(eq(documents.id, id)).get();
	return row ? docRowToDoc(row) : null;
}

export async function createDocument(input: { title: string; content?: string }): Promise<Document> {
	const id = await getNextDocId();
	const now = new Date().toISOString();
	await db.insert(documents).values({ id, title: input.title, content: input.content ?? "", createdAt: now });
	return (await getDocumentById(id))!;
}

export async function updateDocument(
	id: string,
	input: { title?: string; content?: string },
): Promise<Document | null> {
	const now = new Date().toISOString();
	await db
		.update(documents)
		.set({
			...(input.title !== undefined && { title: input.title }),
			...(input.content !== undefined && { content: input.content }),
			updatedAt: now,
		})
		.where(eq(documents.id, id));
	return getDocumentById(id);
}

export async function deleteDocument(id: string): Promise<void> {
	await db.delete(documents).where(eq(documents.id, id));
}

// Decisions
export async function getAllDecisions(): Promise<Decision[]> {
	const rows = await db.select().from(decisions).orderBy(asc(decisions.createdAt));
	return rows.map(decisionRowToDecision);
}

export async function getDecisionById(id: string): Promise<Decision | null> {
	const row = await db.select().from(decisions).where(eq(decisions.id, id)).get();
	return row ? decisionRowToDecision(row) : null;
}

export async function createDecision(input: {
	title: string;
	status?: string;
	content?: string;
}): Promise<Decision> {
	const id = await getNextDecisionId();
	const now = new Date().toISOString();
	await db.insert(decisions).values({
		id,
		title: input.title,
		status: input.status,
		content: input.content ?? "",
		createdAt: now,
	});
	return (await getDecisionById(id))!;
}

export async function updateDecision(
	id: string,
	input: { title?: string; status?: string; content?: string },
): Promise<Decision | null> {
	const now = new Date().toISOString();
	await db
		.update(decisions)
		.set({
			...(input.title !== undefined && { title: input.title }),
			...(input.status !== undefined && { status: input.status }),
			...(input.content !== undefined && { content: input.content }),
			updatedAt: now,
		})
		.where(eq(decisions.id, id));
	return getDecisionById(id);
}

export async function deleteDecision(id: string): Promise<void> {
	await db.delete(decisions).where(eq(decisions.id, id));
}
