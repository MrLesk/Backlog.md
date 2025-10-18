function ensureDocumentPrefix(value: string): string {
	const trimmed = value.trim();
	const match = trimmed.match(/^doc-(.+)$/i);
	const body = match ? match[1] : trimmed;
	return `doc-${body}`;
}

function extractDocumentNumber(value: string): string | null {
	const trimmed = value.trim();
	const match = trimmed.match(/^(?:doc-)?0*([0-9]+)$/i);
	return match?.[1] ?? null;
}

export function normalizeDocumentId(id: string): string {
	return ensureDocumentPrefix(id);
}

export function documentIdsEqual(left: string, right: string): boolean {
	const leftNumber = extractDocumentNumber(left);
	const rightNumber = extractDocumentNumber(right);
	if (leftNumber !== null && rightNumber !== null) {
		return leftNumber === rightNumber;
	}
	return normalizeDocumentId(left).toLowerCase() === normalizeDocumentId(right).toLowerCase();
}
