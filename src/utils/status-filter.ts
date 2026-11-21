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

/** Resolve names entered in filters against the same allowed statuses on every surface. */
export function resolveConfiguredStatuses(
	inputs: readonly string[],
	allowedStatuses: readonly string[],
): { values: string[]; invalid: string[]; validStatuses: string[] } {
	const normalizedName = (status: string) => status.toLowerCase().replace(/\s+/g, "");
	const canonicalByName = new Map<string, string>();
	for (const status of allowedStatuses) {
		const key = normalizedName(status);
		if (!canonicalByName.has(key)) canonicalByName.set(key, status);
	}

	const values = new Set<string>();
	const invalid: string[] = [];
	for (const input of inputs) {
		const raw = input.trim();
		if (!raw) continue;
		const canonical = canonicalByName.get(normalizedName(raw));
		if (canonical) {
			values.add(canonical);
		} else {
			invalid.push(raw);
		}
	}

	return { values: [...values], invalid, validStatuses: [...canonicalByName.values()] };
}
