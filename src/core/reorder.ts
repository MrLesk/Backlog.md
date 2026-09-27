import type { Task } from "../types/index.ts";

export const DEFAULT_ORDINAL_STEP = 1000;
const EPSILON = 1e-6;

export interface CalculateNewOrdinalOptions {
	previous?: Pick<Task, "id" | "ordinal"> | null;
	next?: Pick<Task, "id" | "ordinal"> | null;
	defaultStep?: number;
}

export interface CalculateNewOrdinalResult {
	ordinal: number;
	requiresRebalance: boolean;
}

export function calculateNewOrdinal(options: CalculateNewOrdinalOptions): CalculateNewOrdinalResult {
	const { previous, next, defaultStep = DEFAULT_ORDINAL_STEP } = options;
	const prevOrdinal = previous?.ordinal;
	const nextOrdinal = next?.ordinal;

	if (prevOrdinal === undefined && nextOrdinal === undefined) {
		return { ordinal: defaultStep, requiresRebalance: false };
	}

	if (prevOrdinal === undefined) {
		if (nextOrdinal === undefined) {
			return { ordinal: defaultStep, requiresRebalance: false };
		}
		const candidate = nextOrdinal / 2;
		const requiresRebalance = !Number.isFinite(candidate) || candidate <= 0 || candidate >= nextOrdinal - EPSILON;
		return { ordinal: candidate, requiresRebalance };
	}

	if (nextOrdinal === undefined) {
		const candidate = prevOrdinal + defaultStep;
		const requiresRebalance = !Number.isFinite(candidate);
		return { ordinal: candidate, requiresRebalance };
	}

	const gap = nextOrdinal - prevOrdinal;
	if (gap <= EPSILON) {
		return { ordinal: prevOrdinal + defaultStep, requiresRebalance: true };
	}

	const candidate = prevOrdinal + gap / 2;
	const requiresRebalance = candidate <= prevOrdinal + EPSILON || candidate >= nextOrdinal - EPSILON;
	return { ordinal: candidate, requiresRebalance };
}

export interface CalculateBlockOrdinalsOptions {
	previous?: Pick<Task, "id" | "ordinal"> | null;
	next?: Pick<Task, "id" | "ordinal"> | null;
	count: number;
	defaultStep?: number;
}

export interface CalculateBlockOrdinalsResult {
	ordinals: number[];
	requiresRebalance: boolean;
}

/**
 * Ordinals for a contiguous block of tasks landing between two neighbors. Generalizes
 * {@link calculateNewOrdinal}: a count of 1 yields the same midpoint/step placement, and a gap too
 * tight for the block reports `requiresRebalance` so the caller can renumber the column instead.
 */
export function calculateBlockOrdinals(options: CalculateBlockOrdinalsOptions): CalculateBlockOrdinalsResult {
	const { previous, next, count, defaultStep = DEFAULT_ORDINAL_STEP } = options;
	const prevOrdinal = previous?.ordinal;
	const nextOrdinal = next?.ordinal;
	const positions = Array.from({ length: count }, (_, index) => index + 1);

	if (nextOrdinal === undefined) {
		const base = prevOrdinal ?? 0;
		const ordinals = positions.map((position) => base + defaultStep * position);
		return { ordinals, requiresRebalance: !ordinals.every(Number.isFinite) };
	}

	const base = prevOrdinal ?? 0;
	const gap = nextOrdinal - base;
	if (gap <= EPSILON) {
		return { ordinals: positions.map((position) => base + defaultStep * position), requiresRebalance: true };
	}

	const stepSize = gap / (count + 1);
	const ordinals = positions.map((position) => base + stepSize * position);
	const requiresRebalance = ordinals.some(
		(ordinal) =>
			!Number.isFinite(ordinal) ||
			ordinal <= base + EPSILON ||
			ordinal >= nextOrdinal - EPSILON ||
			(prevOrdinal === undefined && ordinal <= 0),
	);
	return { ordinals, requiresRebalance };
}

export interface ResolveOrdinalConflictsOptions {
	defaultStep?: number;
	startOrdinal?: number;
	forceSequential?: boolean;
}

export function resolveOrdinalConflicts<T extends { id: string; ordinal?: number }>(
	tasks: T[],
	options: ResolveOrdinalConflictsOptions = {},
): T[] {
	const defaultStep = options.defaultStep ?? DEFAULT_ORDINAL_STEP;
	const startOrdinal = options.startOrdinal ?? defaultStep;
	const forceSequential = options.forceSequential ?? false;

	const updates: T[] = [];
	let lastOrdinal: number | undefined;

	for (let index = 0; index < tasks.length; index += 1) {
		const task = tasks[index];
		if (!task) {
			continue;
		}
		let assigned: number;

		if (forceSequential) {
			assigned = index === 0 ? startOrdinal : (lastOrdinal ?? startOrdinal) + defaultStep;
		} else if (task.ordinal === undefined) {
			assigned = index === 0 ? startOrdinal : (lastOrdinal ?? startOrdinal) + defaultStep;
		} else if (lastOrdinal !== undefined && task.ordinal <= lastOrdinal) {
			assigned = lastOrdinal + defaultStep;
		} else {
			assigned = task.ordinal;
		}

		if (assigned !== task.ordinal) {
			updates.push({
				...task,
				ordinal: assigned,
			});
		}

		lastOrdinal = assigned;
	}

	return updates;
}
