const PREFIX_PATTERN = /^[a-zA-Z]+-/i;

function parseTaskIdSegments(value: string): number[] | null {
	const withoutPrefix = value.replace(PREFIX_PATTERN, "").toLowerCase();
	if (!/^[0-9]+(?:\.[0-9]+)*$/.test(withoutPrefix)) {
		return null;
	}
	return withoutPrefix.split(".").map((segment) => Number.parseInt(segment, 10));
}

/** Build the equivalent ID spellings shared by every task search index. */
export function createTaskIdSearchVariants(id: string): string[] {
	const lowerId = id.toLowerCase();
	const segments = parseTaskIdSegments(id);
	const prefix = id.match(PREFIX_PATTERN)?.[0] ?? "task-";

	if (!segments) {
		return id === lowerId ? [id] : [id, lowerId];
	}

	const canonicalSuffix = segments.join(".");
	const variants = new Set<string>([
		id,
		lowerId,
		`${prefix}${canonicalSuffix}`,
		`${prefix.toLowerCase()}${canonicalSuffix}`,
		canonicalSuffix,
	]);
	for (const segment of segments) {
		variants.add(String(segment));
	}
	return Array.from(variants);
}
