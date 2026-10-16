import { entityIdKey, entityIdsEqual, findUniqueEntityById, normalizeEntityId } from "./entity-id.ts";

const DOCUMENT_PREFIX = "doc";

type DocumentIdentity = { id: string };

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

/** What a command answers when no document claims the ID it was given. */
export function documentNotFoundMessage(id: string): string {
	return `Document not found: ${id}`;
}

/**
 * Resolves one document by ID among `documents`. When several of them claim the ID the lookup
 * throws instead of picking one, and `describeFile` names each claimant in the message.
 */
export function findDocumentById<T extends DocumentIdentity>(
	documents: readonly T[],
	id: string,
	describeFile: (document: T) => string,
): T | null {
	return findUniqueEntityById("Document", DOCUMENT_PREFIX, id, documents, describeFile);
}
