import { Core } from "../core/backlog.ts";

/**
 * Load valid statuses from project configuration.
 */
export async function getValidStatuses(core?: Core): Promise<string[]> {
	const c = core ?? new Core(process.cwd());
	const config = await c.filesystem.loadConfig();
	return config?.statuses || [];
}

/**
 * Find the canonical status (matching config casing) for a given input.
 * Loads configured statuses and matches case-insensitively and space-insensitively.
 * Returns the canonical value or null if no match is found.
 *
 * Examples:
 * - "todo" matches "To Do"
 * - "in progress" matches "In Progress"
 * - "DONE" matches "Done"
 */
export async function getCanonicalStatus(input: string | undefined, core?: Core): Promise<string | null> {
	if (!input) return null;
	const statuses = await getValidStatuses(core);
	// Normalize: lowercase, trim, and remove all whitespace
	const normalized = String(input).trim().toLowerCase().replace(/\s+/g, "");
	if (!normalized) return null;
	for (const s of statuses) {
		// Normalize config status the same way
		const configNormalized = s.toLowerCase().replace(/\s+/g, "");
		if (configNormalized === normalized) return s; // preserve configured casing
	}
	return null;
}

/**
 * Format a list of valid statuses for display.
 */
export function formatValidStatuses(configuredStatuses: string[]): string {
	return configuredStatuses.join(", ");
}
