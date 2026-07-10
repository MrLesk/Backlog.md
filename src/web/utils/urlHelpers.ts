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

/** Creates a URL-friendly path for an item with a prefixed numeric ID. */
export function createUrlPath(basePath: string, id: string, title: string): string {
	const sanitizedTitle = sanitizeUrlTitle(title);
	const cleanId = id.replace(/^[a-zA-Z]+-/, "");
	const path = `${basePath.replace(/\/$/, "")}/${encodeURIComponent(cleanId)}`;
	return sanitizedTitle ? `${path}/${encodeURIComponent(sanitizedTitle)}` : path;
}
