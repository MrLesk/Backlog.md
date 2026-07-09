import { DEFAULT_STATUSES } from "../constants/index.ts";
import { Core } from "../core/backlog.ts";

type StatusConfigReader = Pick<Core, "filesystem">;

/**
 * Load valid statuses from project configuration.
 */
export async function getValidStatuses(core?: StatusConfigReader): Promise<string[]> {
	const c = core ?? new Core(process.cwd());
	const config = await c.filesystem.loadConfig();
	return config?.statuses && config.statuses.length > 0 ? config.statuses : [...DEFAULT_STATUSES];
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
export async function getCanonicalStatus(input: string | undefined, core?: StatusConfigReader): Promise<string | null> {
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

export async function getCanonicalStatuses(
	inputs: readonly string[],
	core?: StatusConfigReader,
	options: { extraStatuses?: readonly string[] } = {},
): Promise<{ values: string[]; invalid: string[]; validStatuses: string[] }> {
	const configuredStatuses = await getValidStatuses(core);
	const statuses: string[] = [];
	const seenValidStatuses = new Set<string>();
	for (const status of [...(options.extraStatuses ?? []), ...configuredStatuses]) {
		const key = status.toLowerCase().replace(/\s+/g, "");
		if (seenValidStatuses.has(key)) {
			continue;
		}
		seenValidStatuses.add(key);
		statuses.push(status);
	}
	const canonicalByNormalized = new Map(
		statuses.map((status) => [status.toLowerCase().replace(/\s+/g, ""), status] as const),
	);
	const values: string[] = [];
	const invalid: string[] = [];
	const seen = new Set<string>();

	for (const input of inputs) {
		const raw = String(input ?? "").trim();
		if (!raw) {
			continue;
		}
		const canonical = canonicalByNormalized.get(raw.toLowerCase().replace(/\s+/g, ""));
		if (!canonical) {
			invalid.push(raw);
			continue;
		}
		const key = canonical.toLowerCase();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		values.push(canonical);
	}

	return { values, invalid, validStatuses: statuses };
}

/**
 * Format a list of valid statuses for display.
 */
export function formatValidStatuses(configuredStatuses: string[]): string {
	return configuredStatuses.join(", ");
}
