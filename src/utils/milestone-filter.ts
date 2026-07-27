import Fuse from "fuse.js";
import type { Milestone } from "../types/index.ts";

export const NO_MILESTONE_FILTER_VALUE = "\u0000no-milestone";
export const NO_MILESTONE_FILTER_LABEL = "No milestone";

interface MilestoneCandidate {
	value: string;
	compact: string;
}

export function createMilestoneFilterValueResolver(milestones: Milestone[]): (milestoneValue: string) => string {
	const milestoneLabelsByKey = new Map<string, string>();
	for (const milestone of milestones) {
		const normalizedId = milestone.id.trim();
		const normalizedTitle = milestone.title.trim();
		if (!normalizedId || !normalizedTitle) continue;
		milestoneLabelsByKey.set(normalizedId.toLowerCase(), normalizedTitle);
		const idMatch = normalizedId.match(/^m-(\d+)$/i);
		if (idMatch?.[1]) {
			const numericAlias = String(Number.parseInt(idMatch[1], 10));
			milestoneLabelsByKey.set(`m-${numericAlias}`, normalizedTitle);
			milestoneLabelsByKey.set(numericAlias, normalizedTitle);
		}
		milestoneLabelsByKey.set(normalizedTitle.toLowerCase(), normalizedTitle);
	}

	return (milestoneValue: string) => {
		const normalized = milestoneValue.trim();
		if (!normalized) return milestoneValue;
		return milestoneLabelsByKey.get(normalized.toLowerCase()) ?? milestoneValue;
	};
}

export function normalizeMilestoneFilterValue(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function compactMilestoneFilterValue(value: string): string {
	return value.replace(/\s+/g, "");
}

/**
 * Resolve a milestone query to the milestone title that title-based matchers compare against.
 *
 * ID aliases ("8", "m-8") resolve deterministically through the resolver before the closest-match
 * step, so an exact ID behaves like an exact title. Falls back to the closest matching title, and
 * to the resolved query itself when nothing matches.
 */
export function resolveMilestoneFilterTitle(
	query: string,
	milestoneValues: string[],
	resolveValue: (milestoneValue: string) => string = (value) => value,
): string {
	const resolvedQuery = resolveValue(query);
	const candidates = milestoneValues.map((value) => resolveValue(value)).filter((value) => value.trim().length > 0);
	const closest = resolveClosestMilestoneFilterValue(resolvedQuery, candidates);

	const titleByNormalized = new Map<string, string>();
	for (const candidate of candidates) {
		const normalized = normalizeMilestoneFilterValue(candidate);
		if (normalized && !titleByNormalized.has(normalized)) {
			titleByNormalized.set(normalized, candidate.trim());
		}
	}

	return titleByNormalized.get(closest) ?? resolvedQuery;
}

export function resolveClosestMilestoneFilterValue(query: string, milestoneValues: string[]): string {
	const normalizedQuery = normalizeMilestoneFilterValue(query);
	if (!normalizedQuery) {
		return normalizedQuery;
	}

	const normalizedCandidates = Array.from(
		new Set(milestoneValues.map((value) => normalizeMilestoneFilterValue(value)).filter(Boolean)),
	).sort((left, right) => left.localeCompare(right));

	if (normalizedCandidates.length === 0) {
		return normalizedQuery;
	}

	if (normalizedCandidates.includes(normalizedQuery)) {
		return normalizedQuery;
	}

	const candidates: MilestoneCandidate[] = normalizedCandidates.map((value) => ({
		value,
		compact: compactMilestoneFilterValue(value),
	}));

	const fuse = new Fuse(candidates, {
		includeScore: true,
		threshold: 0.45,
		ignoreLocation: true,
		minMatchCharLength: 2,
		keys: [
			{ name: "value", weight: 0.7 },
			{ name: "compact", weight: 0.3 },
		],
	});

	const compactQuery = compactMilestoneFilterValue(normalizedQuery);
	const best =
		fuse.search(normalizedQuery)[0]?.item.value ??
		(compactQuery ? fuse.search(compactQuery)[0]?.item.value : undefined);

	return best ?? normalizedQuery;
}
