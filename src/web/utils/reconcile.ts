/**
 * Structural equality for plain JSON-shaped records. Key order is irrelevant and
 * keys holding `undefined` compare equal to absent keys, so a record refetched
 * from the server matches its normalized in-store counterpart.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((item, index) => deepEqual(item, b[index]));
	}
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	const aRecord = a as Record<string, unknown>;
	const bRecord = b as Record<string, unknown>;
	const keys = new Set([...Object.keys(aRecord), ...Object.keys(bRecord)]);
	for (const key of keys) {
		if (!deepEqual(aRecord[key], bRecord[key])) return false;
	}
	return true;
}

/**
 * Reconciles a freshly fetched list into the current store list while
 * preserving identity: records that did not change keep their existing object,
 * and a list whose content and order did not change keeps its array. React
 * views subscribed to the store then re-render only for real changes, and a
 * refresh that echoes an already-applied update is a state no-op.
 */
export function reconcileById<T extends { id: string }>(current: readonly T[], next: readonly T[]): T[] {
	const currentById = new Map(current.map((item) => [item.id, item]));
	const merged = next.map((item) => {
		const existing = currentById.get(item.id);
		return existing && deepEqual(existing, item) ? existing : item;
	});
	if (merged.length === current.length && merged.every((item, index) => item === current[index])) {
		return current as T[];
	}
	return merged;
}
