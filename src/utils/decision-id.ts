import { entityIdKey, entityIdsEqual, findUniqueEntityById } from "./entity-id.ts";

const DECISION_PREFIX = "decision";

type DecisionIdentity = { id: string };

/** Canonical lookup key, or null when the decision has no addressable ID. */
export function decisionIdKey(id: string): string | null {
	return entityIdKey(DECISION_PREFIX, id);
}

export function decisionIdsEqual(left: string, right: string): boolean {
	return entityIdsEqual(DECISION_PREFIX, left, right);
}

/** What a command answers when no decision claims the ID it was given. */
export function decisionNotFoundMessage(id: string): string {
	return `Decision not found: ${id}`;
}

/**
 * Resolves one decision by ID among `decisions`. When several of them claim the ID the lookup
 * throws instead of picking one, and `describeFile` names each claimant in the message.
 */
export function findDecisionById<T extends DecisionIdentity>(
	decisions: readonly T[],
	id: string,
	describeFile: (decision: T) => string,
): T | null {
	return findUniqueEntityById("Decision", DECISION_PREFIX, id, decisions, describeFile);
}
