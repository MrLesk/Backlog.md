import Fuse from "fuse.js";
import type { Milestone } from "../types/index.ts";

export const NO_MILESTONE_FILTER_VALUE = "\u0000no-milestone";
export const NO_MILESTONE_FILTER_LABEL = "No milestone";

interface MilestoneCandidate {
	value: string;
	compact: string;
}

export interface MilestoneFilterValueResolver {
	(milestoneValue: string): string;
	resolveExactId(milestoneValue: string): string | undefined;
	resolveExactTitle(milestoneValue: string): string | undefined;
	resolveId(milestoneValue: string): string | undefined;
}

export function createMilestoneFilterValueResolver(milestones: Milestone[]): MilestoneFilterValueResolver {
	const milestonesById = new Map<string, { id: string; title: string }>();
	const milestonesByTitle = new Map<string, Array<{ id: string; title: string }>>();
	for (const milestone of milestones) {
		const normalizedId = milestone.id.trim();
		const normalizedTitle = milestone.title.trim();
		if (!normalizedId || !normalizedTitle) continue;
		const record = { id: normalizedId, title: normalizedTitle };
		if (!milestonesById.has(normalizedId.toLowerCase())) {
			milestonesById.set(normalizedId.toLowerCase(), record);
		}
		const titleKey = normalizedTitle.toLowerCase();
		milestonesByTitle.set(titleKey, [...(milestonesByTitle.get(titleKey) ?? []), record]);
	}

	const resolveExactId = (milestoneValue: string): string | undefined => {
		const normalized = milestoneValue.trim().toLowerCase();
		if (!normalized) return undefined;
		const direct = milestonesById.get(normalized);
		if (direct) return direct.id;
		const idMatch = normalized.match(/^(?:m-)?(\d+)$/i);
		if (!idMatch?.[1]) return undefined;
		const numericAlias = idMatch[1].replace(/^0+(?=\d)/, "");
		const canonical = milestonesById.get(`m-${numericAlias}`);
		if (canonical) return canonical.id;
		return Array.from(milestonesById.values()).find((milestone) => {
			const candidateMatch = milestone.id.match(/^m-(\d+)$/i);
			return candidateMatch?.[1]?.replace(/^0+(?=\d)/, "") === numericAlias;
		})?.id;
	};

	const resolveId = (milestoneValue: string): string | undefined => {
		const exactId = resolveExactId(milestoneValue);
		if (exactId) return exactId;
		const titleMatches = milestonesByTitle.get(milestoneValue.trim().toLowerCase()) ?? [];
		const titleIds = new Set(titleMatches.map((milestone) => milestone.id.toLowerCase()));
		return titleIds.size === 1 ? titleMatches[0]?.id : undefined;
	};
	const resolveExactTitle = (milestoneValue: string): string | undefined =>
		milestonesByTitle.get(milestoneValue.trim().toLowerCase())?.[0]?.title;

	const resolver = (milestoneValue: string) => {
		const normalized = milestoneValue.trim();
		if (!normalized) return milestoneValue;
		const exactId = resolveExactId(normalized);
		if (exactId) {
			return milestonesById.get(exactId.toLowerCase())?.title ?? milestoneValue;
		}
		return milestonesByTitle.get(normalized.toLowerCase())?.[0]?.title ?? milestoneValue;
	};
	return Object.assign(resolver, { resolveExactId, resolveExactTitle, resolveId });
}

export function normalizeMilestoneFilterValue(value: string): string {
	const normalizedValue = value.trim().toLowerCase();
	if (!normalizedValue) return normalizedValue;
	const searchableValue = normalizedValue
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
	return searchableValue || normalizedValue;
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
	resolveValue: ((milestoneValue: string) => string) | MilestoneFilterValueResolver = (value) => value,
): string {
	const normalizedQuery = query.trim();
	const resolvedQuery = resolveValue(query);
	const exactId = "resolveExactId" in resolveValue ? resolveValue.resolveExactId(query) : undefined;
	const exactTitle = "resolveExactTitle" in resolveValue ? resolveValue.resolveExactTitle(query) : undefined;
	if (exactId || exactTitle || resolvedQuery.trim().toLowerCase() !== normalizedQuery.toLowerCase()) {
		return resolvedQuery;
	}
	const candidates = milestoneValues.map((value) => resolveValue(value)).filter((value) => value.trim().length > 0);
	const closest = resolveClosestMilestoneFilterValue(resolvedQuery, candidates);
	return candidates.find((candidate) => normalizeMilestoneFilterValue(candidate) === closest)?.trim() ?? resolvedQuery;
}

export function createMilestoneFilterMatcher(
	query: string,
	milestoneValues: string[],
	resolveValue: MilestoneFilterValueResolver,
): (milestoneValue: string) => boolean {
	const exactId = resolveValue.resolveExactId(query);
	if (exactId) {
		const targetId = exactId.toLowerCase();
		return (milestoneValue) => resolveValue.resolveId(milestoneValue)?.toLowerCase() === targetId;
	}
	const exactTitle = resolveValue.resolveExactTitle(query);
	if (exactTitle) {
		const targetTitle = exactTitle.toLowerCase();
		return (milestoneValue) => resolveValue(milestoneValue).trim().toLowerCase() === targetTitle;
	}

	const milestoneFilter = normalizeMilestoneFilterValue(
		resolveMilestoneFilterTitle(query, milestoneValues, resolveValue),
	);
	return (milestoneValue) => normalizeMilestoneFilterValue(resolveValue(milestoneValue)) === milestoneFilter;
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
