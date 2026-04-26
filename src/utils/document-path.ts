const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;

function hasAbsolutePrefix(value: string): boolean {
	return value.startsWith("/") || value.startsWith("\\") || WINDOWS_ABSOLUTE_PATH.test(value);
}

export function normalizeDocumentSubPath(path?: string | null): string {
	const trimmed = path?.trim();
	if (!trimmed || trimmed === ".") {
		return "";
	}

	if (hasAbsolutePrefix(trimmed)) {
		throw new Error("Document path must be relative to the docs directory.");
	}

	const segments = trimmed
		.split(/[\\/]+/)
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== ".");
	if (segments.some((segment) => segment === "..")) {
		throw new Error("Document path cannot include traversal segments.");
	}

	return segments.join("/");
}

export function normalizeDocumentRelativePath(path: string): string {
	const normalized = normalizeDocumentSubPath(path);
	if (!normalized) {
		throw new Error("Document path cannot be empty.");
	}
	return normalized;
}

export function getDocumentSubPathFromRelativePath(path?: string): string {
	if (!path) {
		return "";
	}
	return normalizeDocumentSubPath(
		path
			.split(/[\\/]+/)
			.slice(0, -1)
			.join("/"),
	);
}
