import { type BacklogConfig, EntityType, type PrefixConfig } from "../types/index.ts";

/**
 * Default prefix configuration.
 * Tasks use "task-" prefix, drafts use "draft-" prefix.
 */
export const DEFAULT_PREFIX_CONFIG: PrefixConfig = {
	task: "task",
	draft: "draft",
};

/**
 * Returns the default prefix configuration.
 * Use this when no custom config is specified.
 */
export function getDefaultPrefixConfig(): PrefixConfig {
	return { ...DEFAULT_PREFIX_CONFIG };
}

/**
 * Merges user-provided prefix config with defaults.
 * Missing fields are filled with default values.
 *
 * @param config - Partial prefix config from user
 * @returns Complete prefix config with defaults applied
 */
export function mergePrefixConfig(config?: Partial<PrefixConfig>): PrefixConfig {
	return {
		task: config?.task ?? DEFAULT_PREFIX_CONFIG.task,
		draft: config?.draft ?? DEFAULT_PREFIX_CONFIG.draft,
	};
}

/**
 * Normalizes an ID to ensure it has the correct prefix (uppercase).
 * If the ID already has the prefix (case-insensitive), it normalizes to uppercase.
 * If the ID is numeric only, it adds the uppercase prefix.
 *
 * @param id - The ID to normalize (e.g., "123", "task-123", "TASK-123")
 * @param prefix - The prefix to use (e.g., "task", "draft", "JIRA")
 * @returns Normalized ID with uppercase prefix (e.g., "TASK-123")
 *
 * @example
 * normalizeId("123", "task") // => "TASK-123"
 * normalizeId("task-123", "task") // => "TASK-123"
 * normalizeId("TASK-123", "task") // => "TASK-123"
 * normalizeId("jira-456", "JIRA") // => "JIRA-456"
 */
export function normalizeId(id: string, prefix: string): string {
	const trimmed = id.trim();
	const upperPrefix = prefix.toUpperCase();
	const prefixPattern = new RegExp(`^${escapeRegex(prefix)}-(.+)$`, "i");
	const match = trimmed.match(prefixPattern);
	const body = match?.[1] ?? trimmed;
	return `${upperPrefix}-${body.toUpperCase()}`;
}

/**
 * Extracts the numeric/body part from an ID, removing the prefix.
 * Returns the body portion that follows the prefix.
 *
 * @param id - The ID to extract from (e.g., "task-123", "JIRA-456.1")
 * @param prefix - The prefix to strip (e.g., "task", "JIRA")
 * @returns The body portion without prefix, or the original if no prefix match
 *
 * @example
 * extractIdBody("task-123", "task") // => "123"
 * extractIdBody("JIRA-456.1", "JIRA") // => "456.1"
 * extractIdBody("123", "task") // => "123"
 */
export function extractIdBody(id: string, prefix: string): string {
	const trimmed = id.trim();
	const prefixPattern = new RegExp(`^${escapeRegex(prefix)}-(.+)$`, "i");
	const match = trimmed.match(prefixPattern);
	return match?.[1] ?? trimmed;
}

/**
 * Extracts the numeric parts from an ID as an array of numbers.
 * Handles both simple IDs (task-5) and hierarchical IDs (task-5.2.1).
 *
 * @param id - The ID to parse (e.g., "task-123", "task-5.2.1")
 * @param prefix - The prefix to strip (e.g., "task")
 * @returns Array of numeric segments, or [0] if unparseable
 *
 * @example
 * extractIdNumbers("task-123", "task") // => [123]
 * extractIdNumbers("task-5.2.1", "task") // => [5, 2, 1]
 * extractIdNumbers("task-abc", "task") // => [0]
 */
export function extractIdNumbers(id: string, prefix: string): number[] {
	const body = extractIdBody(id, prefix);
	const segments = body.split(".").map((seg) => {
		const num = Number.parseInt(seg, 10);
		return Number.isNaN(num) ? 0 : num;
	});
	return segments.length > 0 ? segments : [0];
}

/**
 * Builds a glob pattern for finding files with a specific prefix.
 *
 * @param prefix - The prefix to match (e.g., "task", "draft")
 * @returns Glob pattern (e.g., "task-*.md")
 *
 * @example
 * buildGlobPattern("task") // => "task-*.md"
 * buildGlobPattern("JIRA") // => "JIRA-*.md"
 */
export function buildGlobPattern(prefix: string): string {
	return `${prefix}-*.md`;
}

/**
 * Builds a regex pattern for matching IDs with a specific prefix.
 * Captures the numeric/body portion after the prefix.
 *
 * @param prefix - The prefix to match (e.g., "task", "draft")
 * @returns RegExp that matches IDs and captures the body (e.g., /^task-(\d+(?:\.\d+)*)/)
 *
 * @example
 * const regex = buildIdRegex("task");
 * "task-123".match(regex) // => ["task-123", "123"]
 * "task-5.2.1".match(regex) // => ["task-5.2.1", "5.2.1"]
 */
export function buildIdRegex(prefix: string): RegExp {
	return new RegExp(`^${escapeRegex(prefix)}-(\\d+(?:\\.\\d+)*)`, "i");
}

/**
 * Builds a regex pattern for extracting IDs from filenames.
 * Similar to buildIdRegex but designed for filename parsing.
 *
 * @param prefix - The prefix to match (e.g., "task", "draft")
 * @returns RegExp for filename matching
 *
 * @example
 * const regex = buildFilenameIdRegex("task");
 * "task-123 - Some Title.md".match(regex) // => ["task-123", "123"]
 */
export function buildFilenameIdRegex(prefix: string): RegExp {
	return new RegExp(`^${escapeRegex(prefix)}-(\\d+(?:\\.\\d+)*)`, "i");
}

/**
 * Builds a regex pattern for extracting IDs from file paths.
 * Unlike buildIdRegex, this doesn't use ^ anchor so it can match IDs
 * anywhere in a file path string.
 *
 * @param prefix - The prefix to match (e.g., "task", "draft")
 * @returns RegExp for path matching (matches anywhere in string)
 *
 * @example
 * const regex = buildPathIdRegex("task");
 * "backlog/tasks/task-123 - Title.md".match(regex) // => ["task-123", "123"]
 * "task-5.2.1 - Subtask.md".match(regex) // => ["task-5.2.1", "5.2.1"]
 */
export function buildPathIdRegex(prefix: string): RegExp {
	return new RegExp(`${escapeRegex(prefix)}-(\\d+(?:\\.\\d+)*)`, "i");
}

/**
 * Checks if an ID matches a given prefix pattern.
 *
 * @param id - The ID to check
 * @param prefix - The prefix to match against
 * @returns true if the ID starts with the prefix pattern
 *
 * @example
 * hasPrefix("task-123", "task") // => true
 * hasPrefix("TASK-123", "task") // => true (case-insensitive)
 * hasPrefix("draft-1", "task") // => false
 */
export function hasPrefix(id: string, prefix: string): boolean {
	const pattern = new RegExp(`^${escapeRegex(prefix)}-`, "i");
	return pattern.test(id.trim());
}

/**
 * Checks if an ID has any valid prefix pattern (letters followed by dash).
 * Use this for filtering/validation when you want to accept any prefix.
 *
 * @param id - The ID to check
 * @returns true if the ID matches the pattern: letters-dash-something
 *
 * @example
 * hasAnyPrefix("task-123") // => true
 * hasAnyPrefix("JIRA-456") // => true
 * hasAnyPrefix("draft-1") // => true
 * hasAnyPrefix("123") // => false
 * hasAnyPrefix("") // => false
 */
export function hasAnyPrefix(id: string): boolean {
	if (!id || typeof id !== "string") return false;
	return /^[a-zA-Z]+-\S/.test(id.trim());
}

/**
 * Strips any prefix from an ID (e.g., "task-123" -> "123", "JIRA-456" -> "456").
 * Use this when you need the body/number part without the prefix.
 *
 * @param id - The ID to strip
 * @returns The ID without its prefix, or the original if no prefix
 *
 * @example
 * stripAnyPrefix("task-123") // => "123"
 * stripAnyPrefix("JIRA-456.1") // => "456.1"
 * stripAnyPrefix("123") // => "123"
 */
export function stripAnyPrefix(id: string): string {
	if (!id || typeof id !== "string") return id;
	return id.trim().replace(/^[a-zA-Z]+-/, "");
}

/**
 * Compares two IDs for equality, ignoring case in the prefix.
 *
 * @param id1 - First ID
 * @param id2 - Second ID
 * @param prefix - The prefix both IDs should have
 * @returns true if the IDs are equivalent
 *
 * @example
 * idsEqual("task-123", "TASK-123", "task") // => true
 * idsEqual("task-1", "task-01", "task") // => false (different body)
 */
export function idsEqual(id1: string, id2: string, prefix: string): boolean {
	return normalizeId(id1, prefix).toLowerCase() === normalizeId(id2, prefix).toLowerCase();
}

/**
 * Generates the next ID in sequence given a list of existing IDs.
 *
 * @param existingIds - Array of existing IDs
 * @param prefix - The prefix to use
 * @param zeroPadding - Optional zero padding width (e.g., 3 for "001")
 * @returns Next ID in sequence (e.g., "task-43")
 *
 * @example
 * generateNextId(["task-1", "task-2", "task-5"], "task") // => "task-6"
 * generateNextId(["task-001", "task-002"], "task", 3) // => "task-003"
 */
export function generateNextId(existingIds: string[], prefix: string, zeroPadding?: number): string {
	const regex = buildIdRegex(prefix);
	const upperPrefix = prefix.toUpperCase();
	let max = 0;

	for (const id of existingIds) {
		const match = id.match(regex);
		if (match?.[1]) {
			// Only consider top-level IDs (no dots for subtasks)
			const body = match[1];
			if (!body.includes(".")) {
				const num = Number.parseInt(body, 10);
				if (!Number.isNaN(num) && num > max) {
					max = num;
				}
			}
		}
	}

	const nextNum = max + 1;

	if (zeroPadding && zeroPadding > 0) {
		return `${upperPrefix}-${String(nextNum).padStart(zeroPadding, "0")}`;
	}

	return `${upperPrefix}-${nextNum}`;
}

/**
 * Generates the next subtask ID for a parent task.
 *
 * @param existingIds - Array of existing IDs (including subtasks)
 * @param parentId - The parent task ID (e.g., "task-5")
 * @param prefix - The prefix being used
 * @param zeroPadding - Optional zero padding width for subtask number
 * @returns Next subtask ID (e.g., "task-5.3")
 *
 * @example
 * generateNextSubtaskId(["task-5", "task-5.1", "task-5.2"], "task-5", "task") // => "task-5.3"
 */
export function generateNextSubtaskId(
	existingIds: string[],
	parentId: string,
	prefix: string,
	zeroPadding?: number,
): string {
	const normalizedParent = normalizeId(parentId, prefix);
	const parentBody = extractIdBody(normalizedParent, prefix);

	let max = 0;

	for (const id of existingIds) {
		const body = extractIdBody(id, prefix);
		if (body.startsWith(`${parentBody}.`)) {
			const rest = body.slice(parentBody.length + 1);
			const firstSegment = rest.split(".")[0];
			if (firstSegment) {
				const num = Number.parseInt(firstSegment, 10);
				if (!Number.isNaN(num) && num > max) {
					max = num;
				}
			}
		}
	}

	const nextNum = max + 1;

	if (zeroPadding && zeroPadding > 0) {
		return `${normalizedParent}.${String(nextNum).padStart(2, "0")}`;
	}

	return `${normalizedParent}.${nextNum}`;
}

/**
 * Converts an ID to lowercase format for use in filenames.
 * IDs are uppercase (TASK-123) but filenames use lowercase (task-123 - Title.md).
 *
 * @param id - The ID to convert (e.g., "TASK-123", "DRAFT-5")
 * @returns Lowercase version for filenames (e.g., "task-123", "draft-5")
 *
 * @example
 * idForFilename("TASK-123") // => "task-123"
 * idForFilename("DRAFT-5") // => "draft-5"
 */
export function idForFilename(id: string): string {
	return id.toLowerCase();
}

/**
 * Escapes special regex characters in a string.
 * Used internally to safely build regex patterns from user-provided prefixes.
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Gets the prefix for a given entity type.
 * Only tasks have configurable prefixes (via config); other types use hardcoded prefixes.
 *
 * @param type - The entity type
 * @param config - Optional backlog config (only used for Task type)
 * @returns The prefix string for the entity type
 *
 * @example
 * getPrefixForType(EntityType.Task) // => "task"
 * getPrefixForType(EntityType.Task, { prefixes: { task: "JIRA" } }) // => "JIRA"
 * getPrefixForType(EntityType.Draft) // => "draft"
 * getPrefixForType(EntityType.Document) // => "doc"
 * getPrefixForType(EntityType.Decision) // => "decision"
 */
export function getPrefixForType(type: EntityType, config?: BacklogConfig): string {
	switch (type) {
		case EntityType.Task:
			return config?.prefixes?.task ?? DEFAULT_PREFIX_CONFIG.task;
		case EntityType.Draft:
			return DEFAULT_PREFIX_CONFIG.draft;
		case EntityType.Document:
			return "doc";
		case EntityType.Decision:
			return "decision";
		default:
			return type;
	}
}
