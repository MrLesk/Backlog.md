import type { Core } from "../core/backlog.ts";
import type { AcceptanceCriterion, Task } from "../types/index.ts";
import { buildDependencyGraph, findCycleThroughRoot } from "./dependency-graph.ts";
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
 * Validate that all dependencies exist in the working copy.
 *
 * The corpus spans working-copy tasks, drafts, completed, and archived records: Done is the normal
 * end state of a predecessor, so a task whose target moved to completed/ or the archive must keep a
 * valid, editable dependency list. Only validation resolves these targets; readiness and graph
 * semantics are unchanged.
 *
 * Inputs are matched by task identity, so bare numeric IDs resolve under any configured prefix, and
 * identity fails closed exactly as it does for the task a command targets. That takes two checks,
 * mirroring the identity index itself: the corpus answers whether the input names more than one
 * identity, and the working-copy lookup answers whether that identity is claimed by more than one
 * file - which the corpus cannot, because it keeps one entry per ID.
 *
 * Resolution stays local for the same reason task reads do: a dependency validated against another
 * branch would name a task no task command can show, and reaching for branches here would put a
 * remote fetch inside the task lock.
 *
 * When `target` names the task being created or edited, a dependency resolving to the target
 * itself is rejected in any spelling, and a dependency that would close a cycle through the
 * existing graph is rejected with the cycle path. An unresolved input is also checked against the
 * target before being reported as missing: creation, promotion, and demotion validate against an
 * identity allocated moments ago, which no corpus record claims, so a dangling reference to
 * exactly that ID would become a self-dependency the moment the record is written under it.
 * Resolution runs first so an input that names an existing record keeps naming it - a bare number
 * resolves to the draft or task that already claims it, not to the identity being allocated.
 *
 * Returns the matched canonical IDs, deduplicated, plus the inputs that matched nothing.
 */
export async function validateDependencies(
	dependencies: string[],
	core: Core,
	target?: Task,
): Promise<{ valid: string[]; invalid: string[] }> {
	const valid: string[] = [];
	const invalid: string[] = [];
	if (dependencies.length === 0) {
		return { valid, invalid };
	}
	const corpus = await loadDependencyCorpus(core);
	const known = [...corpus.tasks, ...corpus.drafts, ...corpus.completed, ...corpus.archived];
	for (const dependency of dependencies) {
		const resolved = resolveUniqueDependency(
			dependency,
			known.filter((candidate) => taskIdsEqual(dependency, candidate.id)),
		);
		if (resolved === null) {
			// The corpus cannot resolve a reference to the target's freshly allocated ID, so the raw
			// input is checked against the target before the reference is reported as missing.
			if (target && taskIdsEqual(dependency, target.id)) {
				throw new Error(`Task ${target.id} cannot depend on itself ("${dependency.trim()}" names this task).`);
			}
			invalid.push(dependency);
			continue;
		}
		if (target && taskIdsEqual(resolved, target.id)) {
			throw new Error(`Task ${target.id} cannot depend on itself ("${dependency.trim()}" names this task).`);
		}
		// Called for its ambiguity check: it raises AmbiguousTaskIdError when several working-copy
		// files (active or completed) claim this ID. Drafts and archived tasks resolve to null here
		// and rely on the corpus check above.
		await core.loadTaskById(resolved, { includeCrossBranch: false });
		// Equivalent spellings of one task (1 and BACK-1) must not persist twice.
		if (!valid.some((existing) => taskIdsEqual(existing, resolved))) {
			valid.push(resolved);
		}
	}
	// Every new cycle must run through the target, because the edges being added all leave it. The
	// graph is built once with the validated dependencies as the target's edges, so cycle detection
	// reuses the shared dependency-graph model instead of traversing the corpus a second time.
	if (target && valid.length > 0) {
		// The proposed list supersedes the target's stored one, so the stored record leaves the
		// corpus: its old outgoing edges would otherwise re-enter through the graph's reverse
		// traversal and let an existing cycle veto its own repair.
		const graphCorpus = dependencyGraphCorpus(corpus);
		const graph = buildDependencyGraph(
			{ ...target, dependencies: valid },
			{
				tasks: graphCorpus.tasks.filter((task) => !taskIdsEqual(task.id, target.id)),
				completedTasks: graphCorpus.completedTasks.filter((task) => !taskIdsEqual(task.id, target.id)),
			},
		);
		const cycle = findCycleThroughRoot(graph);
		if (cycle) {
			throw new Error(`These dependencies would create a cycle: ${cycle.join(" -> ")}`);
		}
		// The graph never walks through an ambiguous identity, so a return path behind one cannot
		// be seen. Whatever it hides stays unverifiable, so the mutation fails closed on it.
		const ambiguous = graph.nodes.find((node) => node.state === "ambiguous" && node.dependencyDepth !== null);
		if (ambiguous) {
			throw new Error(
				`Cannot verify the dependencies stay acyclic: more than one record claims ${ambiguous.id}. Run 'backlog doctor' to repair duplicate IDs first.`,
			);
		}
	}
	return { valid, invalid };
}

/** The records dependency validation and `backlog doctor` resolve dependencies against. */
interface DependencyCorpus {
	tasks: Task[];
	drafts: Task[];
	completed: Task[];
	archived: Task[];
}

async function loadDependencyCorpus(core: Core): Promise<DependencyCorpus> {
	const [tasks, drafts, completed, archived] = await Promise.all([
		core.queryTasks({ includeCrossBranch: false }),
		core.filesystem.listDrafts(),
		core.filesystem.listCompletedTasks(),
		core.filesystem.listArchivedTasks(),
	]);
	return { tasks, drafts, completed, archived };
}

/** Arrange the corpus for the dependency graph, whose only split is completed versus not. */
function dependencyGraphCorpus(corpus: DependencyCorpus): { tasks: Task[]; completedTasks: Task[] } {
	return { tasks: [...corpus.tasks, ...corpus.drafts, ...corpus.archived], completedTasks: corpus.completed };
}

export interface DependencyDefects {
	/** Tasks that list themselves as a dependency, with the spelling the file records. */
	selfDependencies: Array<{ taskId: string; dependency: string }>;
	/** Each detected cycle as a dependency path, opening and closing on the same task. */
	cycles: string[][];
}

/**
 * Report the self-dependencies and dependency cycles already stored in the project, for
 * `backlog doctor`. Validation refuses to create these, so any found here predate it; the report
 * names them for human repair and changes nothing.
 *
 * Every record that can carry dependencies is checked as a root against the same corpus
 * validation resolves against, reusing the shared graph model per root. Each root contributes its
 * shortest cycle, and cycles are deduplicated as rotations of one member sequence, so one cycle is
 * one finding while distinct cycles sharing a task are all reported.
 */
export async function findDependencyDefects(core: Core): Promise<DependencyDefects> {
	const corpus = await loadDependencyCorpus(core);
	const graphCorpus = dependencyGraphCorpus(corpus);
	const selfDependencies: DependencyDefects["selfDependencies"] = [];
	const cycles: string[][] = [];
	const seen = new Set<string>();
	for (const task of [...corpus.tasks, ...corpus.drafts, ...corpus.completed]) {
		const dependencies = task.dependencies ?? [];
		for (const dependency of dependencies) {
			if (taskIdsEqual(dependency, task.id)) {
				selfDependencies.push({ taskId: task.id, dependency });
			}
		}
		if (dependencies.length === 0) continue;
		const cycle = findCycleThroughRoot(buildDependencyGraph(task, graphCorpus));
		if (!cycle) continue;
		// One cycle read from different roots is the same member sequence rotated; keying on the
		// rotation that starts at the smallest canonical member collapses them.
		const members = cycle.slice(0, -1).map((id) => canonicalTaskId(id));
		let start = 0;
		for (let index = 1; index < members.length; index++) {
			if ((members[index] as string) < (members[start] as string)) start = index;
		}
		const key = [...members.slice(start), ...members.slice(0, start)].join(" ");
		if (seen.has(key)) continue;
		seen.add(key);
		cycles.push(cycle);
	}
	return { selfDependencies, cycles };
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
