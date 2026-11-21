import { DEFAULT_STATUSES } from "../constants/index.ts";
import { type Core, createRuntimeCore } from "../core/backlog.ts";
import { resolveConfiguredStatuses } from "./status-filter.ts";

type StatusConfigReader = Pick<Core, "filesystem">;

/**
 * Load valid statuses from project configuration.
 */
export async function getValidStatuses(core?: StatusConfigReader): Promise<string[]> {
	const c = core ?? (await createRuntimeCore());
	const config = await c.filesystem.loadConfig();
	return config?.statuses && config.statuses.length > 0 ? config.statuses : [...DEFAULT_STATUSES];
}

/**
 * Find the canonical status (matching config casing) for a given input.
 * Loads configured statuses and matches case-insensitively and space-insensitively.
 * `allowedStatuses` narrows the match set (e.g. drafts, which only accept Draft).
 * Returns the canonical value or null if no match is found.
 *
 * Examples:
 * - "todo" matches "To Do"
 * - "in progress" matches "In Progress"
 * - "DONE" matches "Done"
 */
export async function getCanonicalStatus(
	input: string | undefined,
	core?: StatusConfigReader,
	allowedStatuses?: string[],
): Promise<string | null> {
	if (!input) return null;
	const statuses = allowedStatuses ?? (await getValidStatuses(core));
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

export async function getCanonicalStatuses(
	inputs: readonly string[],
	core?: StatusConfigReader,
	options: { extraStatuses?: readonly string[] } = {},
): Promise<{ values: string[]; invalid: string[]; validStatuses: string[] }> {
	const configuredStatuses = await getValidStatuses(core);
	return resolveConfiguredStatuses(inputs, [...(options.extraStatuses ?? []), ...configuredStatuses]);
}

/**
 * Format a list of valid statuses for display.
 */
export function formatValidStatuses(configuredStatuses: string[]): string {
	return configuredStatuses.join(", ");
}
