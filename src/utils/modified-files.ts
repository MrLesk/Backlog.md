export function normalizeModifiedFileFilters(value?: string | string[]): string[] | undefined {
	if (!value) {
		return undefined;
	}

	const values = Array.isArray(value) ? value : [value];
	const normalized = values.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0);

	return normalized.length > 0 ? normalized : undefined;
}

export function matchesModifiedFileFilters(
	modifiedFiles: readonly string[] | undefined,
	filters: readonly string[] | undefined,
): boolean {
	if (!filters || filters.length === 0) {
		return true;
	}
	if (!modifiedFiles || modifiedFiles.length === 0) {
		return false;
	}

	const filePaths = modifiedFiles.map((file) => file.trim().toLowerCase()).filter((file) => file.length > 0);
	return filters.some((filter) => filePaths.some((file) => file.includes(filter)));
}
