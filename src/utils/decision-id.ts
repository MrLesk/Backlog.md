import { entityIdKey, findUniqueEntityById } from "./entity-id.ts";

const DECISION_PREFIX = "decision";

type DecisionIdentity = { id: string; title: string; path?: string };

/** Canonical lookup key, or null when the decision has no addressable ID. */
export function decisionIdKey(id: string): string | null {
	return entityIdKey(DECISION_PREFIX, id);
}

export function findDecisionById<T extends DecisionIdentity>(decisions: readonly T[], id: string): T | null {
	return findUniqueEntityById(
		"Decision",
		DECISION_PREFIX,
		id,
		decisions,
		(decision) => decision.path ?? decision.title,
	);
}
