/**
 * Shared multi-status matching for task filters, used by Core.applyTaskFilters,
 * ContentStore.getTasks, FileSystem.listTasks, and the interactive task views so every
 * surface agrees on how a status selection is compared.
 *
 * Status names are matched case-insensitively after trimming. Blank names are dropped,
 * and an empty selection matches nothing by design: callers skip filtering when the set
 * is empty instead of treating it as "match every task".
 */
export function normalizeStatusSet(values: string | string[] | undefined): Set<string> {
	const list = Array.isArray(values) ? values : values ? [values] : [];
	return new Set(list.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0));
}

/** Case-insensitive check of one task's status against a set from `normalizeStatusSet`. */
export function statusMatchesSet(wanted: Set<string>, status: string | null | undefined): boolean {
	return wanted.has((status ?? "").toLowerCase());
}
