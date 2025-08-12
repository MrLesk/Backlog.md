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
 * Loads configured statuses and matches case-insensitively.
 * Returns the canonical value or null if no match is found.
 */
export async function getCanonicalStatus(input: string | undefined, core?: Core): Promise<string | null> {
	if (!input) return null;
	const statuses = await getValidStatuses(core);
	const normalized = String(input).trim().toLowerCase();
	if (!normalized) return null;
	for (const s of statuses) {
		if (s.toLowerCase() === normalized) return s; // preserve configured casing
	}
	return null;
}

/**
 * Format a list of valid statuses for display.
 */
export function formatValidStatuses(configuredStatuses: string[]): string {
	return configuredStatuses.join(", ");
}
