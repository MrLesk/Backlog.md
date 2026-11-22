import { extractIdBody } from "../../utils/prefix-config";

/**
 * Sanitizes a string to be URL-friendly
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes special characters except hyphens and underscores
 * - Removes multiple consecutive hyphens
 * - Trims hyphens from start and end
 */
export function sanitizeUrlTitle(title: string): string {
	return (
		title
			.toLowerCase()
			.trim()
			// Replace spaces with hyphens
			.replace(/\s+/g, "-")
			// Remove special characters except hyphens and underscores
			.replace(/[^a-z0-9\-_]/g, "")
			// Replace multiple hyphens with single hyphen
			.replace(/-+/g, "-")
			// Remove leading and trailing hyphens
			.replace(/^-+|-+$/g, "")
	);
}

/** Adds an encoded ID and an optional human-readable title to a browser route. */
export function createUrlPath(basePath: string, id: string, title: string): string {
	const sanitizedTitle = sanitizeUrlTitle(title);
	const path = `${basePath.replace(/\/$/, "")}/${encodeURIComponent(id)}`;
	return sanitizedTitle ? `${path}/${encodeURIComponent(sanitizedTitle)}` : path;
}

export type RecordListPath = "/documentation" | "/decisions";

export function createRecordUrlPath(path: RecordListPath, record: { id: string; title: string }): string {
	const prefix = path === "/documentation" ? "doc" : "decision";
	const id = extractIdBody(record.id, prefix);
	// The unprefixed "new" route opens the record editor.
	const routeId = id === "new" ? `${prefix}-new` : id;
	return createUrlPath(path, routeId, record.title);
}
