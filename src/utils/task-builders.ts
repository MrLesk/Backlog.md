import type { Core } from "../core/backlog.ts";
import type { AcceptanceCriterion, Task } from "../types/index.ts";
import { AmbiguousIdError } from "./entity-id.ts";
import { AmbiguousTaskIdError, canonicalTaskId, taskIdsEqual } from "./task-path.ts";

/**
 * Shared utilities for building tasks and validating dependencies
 * Used by both CLI and MCP to ensure consistent behavior
 */

/**
 * Reject a dependency input that names more than one entity in the corpus.
 *
 * Several canonical identities mean the input is underspecified, because bare numbers span the
 * separate task and draft counters. Several spellings of one identity (BACK-1 and BACK-01) are the
 * duplicate-ID defect `backlog doctor` repairs.
 */
function resolveUniqueDependency(dependency: string, matches: Task[]): string | null {
	const [first, ...rest] = matches;
	if (!first) return null;
	if (rest.length === 0) return first.id;

	const candidates = matches.map((match) => match.filePath ?? match.id);
	const [canonicalId, ...otherIdentities] = [...new Set(matches.map((match) => canonicalTaskId(match.id)))];
	if (canonicalId && otherIdentities.length === 0) {
		// Name the colliding identity rather than the input, which may be a bare number.
		throw new AmbiguousTaskIdError(canonicalId, candidates);
	}
	throw new AmbiguousIdError(
		"Dependency",
		dependency,
		candidates,
		`Use a full task ID instead of ${dependency.trim()} to choose one.`,
	);
}

/**
 * Validate that all dependencies exist in the current project.
 *
 * Inputs are matched by task identity, so bare numeric IDs resolve under any configured prefix, and
 * identity fails closed exactly as it does for the task a command targets. That takes two checks,
 * mirroring the identity index itself: the corpus answers whether the input names more than one
 * identity, and `Core.getTask` answers whether that identity is claimed by more than one file -
 * which the corpus cannot, because it keeps one entry per ID.
 *
 * Returns the matched canonical IDs, deduplicated, plus the inputs that matched nothing.
 */
export async function validateDependencies(
	dependencies: string[],
	core: Core,
): Promise<{ valid: string[]; invalid: string[] }> {
	const valid: string[] = [];
	const invalid: string[] = [];
	if (dependencies.length === 0) {
		return { valid, invalid };
	}
	// Task dependencies should honor cross-branch visibility when enabled in config,
	// while draft dependencies remain local-only.
	const [tasks, drafts] = await Promise.all([core.queryTasks(), core.filesystem.listDrafts()]);
	const known = [...tasks, ...drafts];
	for (const dependency of dependencies) {
		const resolved = resolveUniqueDependency(
			dependency,
			known.filter((candidate) => taskIdsEqual(dependency, candidate.id)),
		);
		if (resolved === null) {
			invalid.push(dependency);
			continue;
		}
		// Called for its ambiguity check: it raises AmbiguousTaskIdError when several files claim
		// this ID. Drafts resolve to null here and keep their own local-only lookup.
		await core.getTask(resolved);
		// Equivalent spellings of one task (1 and BACK-1) must not persist twice.
		if (!valid.some((existing) => taskIdsEqual(existing, resolved))) {
			valid.push(resolved);
		}
	}
	return { valid, invalid };
}

/**
 * Process acceptance criteria options from CLI/MCP arguments
 * Handles both --ac and --acceptance-criteria options
 */
export function processAcceptanceCriteriaOptions(options: {
	ac?: string | string[];
	acceptanceCriteria?: string | string[];
}): string[] {
	const criteria: string[] = [];
	// Process --ac options
	if (options.ac) {
		const acCriteria = Array.isArray(options.ac) ? options.ac : [options.ac];
		criteria.push(...acCriteria.map((c) => String(c).trim()).filter(Boolean));
	}
	// Process --acceptance-criteria options
	if (options.acceptanceCriteria) {
		const accCriteria = Array.isArray(options.acceptanceCriteria)
			? options.acceptanceCriteria
			: [options.acceptanceCriteria];
		criteria.push(...accCriteria.map((c) => String(c).trim()).filter(Boolean));
	}
	return criteria;
}

/**
 * Normalize a list of string values by trimming whitespace, dropping empties, and deduplicating.
 * Returns `undefined` when the resulting list is empty so callers can skip optional updates.
 */
export function normalizeStringList(values: string[] | undefined): string[] | undefined {
	if (!values) return undefined;
	const unique = Array.from(new Set(values.map((value) => String(value).trim()).filter((value) => value.length > 0)));
	return unique.length > 0 ? unique : undefined;
}

/**
 * Convert Commander-style option values into a string array.
 * Handles single values, repeated flags, and undefined/null inputs.
 */
export function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => String(item));
	}
	if (value === undefined || value === null) {
		return [];
	}
	return [String(value)];
}

/**
 * Parse repeated or comma-delimited CLI list values into a normalized string list.
 * Returns `undefined` when the resulting list is empty.
 */
export function parseDelimitedStringList(value: unknown): string[] | undefined {
	const entries = toStringArray(value).flatMap((entry) =>
		String(entry)
			.split(",")
			.map((item) => item.trim()),
	);
	return normalizeStringList(entries);
}

/**
 * Parse a CLI list option that supports an explicit empty value.
 * Returns `undefined` when the option was absent (no opinion) and `[]` when it was supplied
 * with only blank values (explicitly empty), so callers can tell the two cases apart.
 * An empty array counts as absent, so callers merging several flags into one list can pass the
 * merged values straight through.
 */
export function parseClearableStringList(value: unknown): string[] | undefined {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value) && value.length === 0) return undefined;
	return parseDelimitedStringList(value) ?? [];
}

/**
 * Parse a Commander option (single value or array) into a strictly positive integer list.
 * Throws an Error when any value is invalid so callers can surface CLI-friendly messaging.
 */
export function parsePositiveIndexList(value: unknown): number[] {
	const entries = Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [];
	return entries.map((entry) => {
		const parsed = Number.parseInt(String(entry), 10);
		if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 1) {
			throw new Error(`Invalid index: ${String(entry)}. Index must be a positive number (1-based).`);
		}
		return parsed;
	});
}

export function stringArraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((value, index) => value === b[index]);
}

export function buildDefinitionOfDoneItems(options: {
	defaults?: string[];
	add?: string[];
	disableDefaults?: boolean;
}): AcceptanceCriterion[] | undefined {
	const defaults = options.disableDefaults ? [] : (options.defaults ?? []);
	const additions = options.add ?? [];
	const combined = [...defaults, ...additions].map((value) => String(value).trim()).filter((value) => value.length > 0);
	if (combined.length === 0) {
		return undefined;
	}
	return combined.map((text, index) => ({ index: index + 1, text, checked: false }));
}
