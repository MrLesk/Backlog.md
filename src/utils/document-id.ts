import { entityIdKey, entityIdsEqual, findUniqueEntityById, normalizeEntityId } from "./entity-id.ts";

const DOCUMENT_PREFIX = "doc";

type DocumentIdentity = { id: string; title: string; path?: string };

export function normalizeDocumentId(id: string): string {
	return normalizeEntityId(DOCUMENT_PREFIX, id);
}

/** Canonical lookup key, or null when the document has no addressable ID. */
export function documentIdKey(id: string): string | null {
	return entityIdKey(DOCUMENT_PREFIX, id);
}

export function documentIdsEqual(left: string, right: string): boolean {
	return entityIdsEqual(DOCUMENT_PREFIX, left, right);
}

export function findDocumentById<T extends DocumentIdentity>(documents: readonly T[], id: string): T | null {
	return findUniqueEntityById(
		"Document",
		DOCUMENT_PREFIX,
		id,
		documents,
		(document) => document.path ?? document.title,
	);
}
