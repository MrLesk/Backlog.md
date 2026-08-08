/**
 * Shared identity rules for prefixed entity IDs (tasks, documents, decisions).
 *
 * Identity must fail closed: an ID with no addressable body never matches, and an ID that
 * matches more than one file raises {@link AmbiguousIdError} instead of picking a winner.
 */

export class AmbiguousIdError extends Error {
	readonly id: string;
	readonly candidates: string[];

	constructor(entityLabel: string, id: string, candidates: string[], guidance: string) {
		const sortedCandidates = [...candidates].sort((left, right) => left.localeCompare(right));
		super(
			[
				`${entityLabel} ID ${id} is ambiguous; ${sortedCandidates.length} files match:`,
				...sortedCandidates.map((candidate) => `  - ${candidate}`),
				guidance,
			].join("\n"),
		);
		this.name = "AmbiguousIdError";
		this.id = id;
		this.candidates = sortedCandidates;
	}
}

export function isAmbiguousIdError(error: unknown): error is AmbiguousIdError {
	return error instanceof AmbiguousIdError;
}

function entityIdBody(prefix: string, value: string): string {
	const trimmed = value.trim();
	const match = trimmed.match(new RegExp(`^${prefix}-(.*)$`, "i"));
	return match?.[1] ?? trimmed;
}

/** Canonical comparison key, or null when the ID carries no addressable value. */
export function entityIdKey(prefix: string, id: string): string | null {
	const body = entityIdBody(prefix, id).trim();
	if (body === "") return null;
	const numeric = body.match(/^0*([0-9]+)$/)?.[1];
	return `${prefix}-${numeric ?? body.toLowerCase()}`;
}

export function normalizeEntityId(prefix: string, id: string): string {
	return `${prefix}-${entityIdBody(prefix, id)}`;
}

export function entityIdsEqual(prefix: string, left: string, right: string): boolean {
	const leftKey = entityIdKey(prefix, left);
	return leftKey !== null && leftKey === entityIdKey(prefix, right);
}

/** Resolves one entity by ID, throwing {@link AmbiguousIdError} when several files claim it. */
export function findUniqueEntityById<T extends { id: string }>(
	entityLabel: string,
	prefix: string,
	id: string,
	items: readonly T[],
	describe: (item: T) => string,
): T | null {
	const matches = items.filter((item) => entityIdsEqual(prefix, id, item.id));
	if (matches.length > 1) {
		throw new AmbiguousIdError(
			entityLabel,
			normalizeEntityId(prefix, id),
			matches.map(describe),
			"Run 'backlog doctor' to review the conflicting files.",
		);
	}
	return matches[0] ?? null;
}
