import type { Milestone } from "../types/index.ts";

type MilestoneRef = Pick<Milestone, "id" | "title">;

function milestoneStorageKey(value: string): string {
	return value.trim().toLowerCase();
}

function collectMilestoneAliasKeys(value: string): Set<string> {
	const normalized = value.trim();
	const keys = new Set<string>();
	const baseKey = milestoneStorageKey(normalized);
	if (!baseKey) {
		return keys;
	}

	keys.add(baseKey);

	if (/^\d+$/.test(normalized)) {
		const numeric = String(Number.parseInt(normalized, 10));
		keys.add(numeric);
		keys.add(`m-${numeric}`);
		return keys;
	}

	const idMatch = normalized.match(/^m-(\d+)$/i);
	if (idMatch?.[1]) {
		const numeric = String(Number.parseInt(idMatch[1], 10));
		keys.add(numeric);
		keys.add(`m-${numeric}`);
	}

	return keys;
}

function canonicalMilestoneIdAlias(value: string): string | null {
	const normalized = value.trim();
	if (/^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized)) {
		return `m-${String(Number.parseInt(normalized.replace(/^m-/i, ""), 10))}`;
	}
	return null;
}

function milestoneIdMatchesAlias(milestoneId: string, aliasKeys: Set<string>): boolean {
	for (const key of collectMilestoneAliasKeys(milestoneId)) {
		if (aliasKeys.has(key)) {
			return true;
		}
	}
	return false;
}

function findIdMatch(input: string, milestones: MilestoneRef[], aliasKeys: Set<string>): MilestoneRef | undefined {
	const inputKey = milestoneStorageKey(input);
	const rawExactMatch = milestones.find((item) => milestoneStorageKey(item.id) === inputKey);
	if (rawExactMatch) {
		return rawExactMatch;
	}

	const canonicalInputId = canonicalMilestoneIdAlias(input);
	if (canonicalInputId) {
		const canonicalRawMatch = milestones.find((item) => milestoneStorageKey(item.id) === canonicalInputId);
		if (canonicalRawMatch) {
			return canonicalRawMatch;
		}
	}

	return milestones.find((item) => milestoneIdMatchesAlias(item.id, aliasKeys));
}

function findUniqueTitleMatch(input: string, milestones: MilestoneRef[]): MilestoneRef | null {
	const inputKey = milestoneStorageKey(input);
	const titleMatches = milestones.filter((item) => milestoneStorageKey(item.title) === inputKey);
	return titleMatches.length === 1 ? (titleMatches[0] ?? null) : null;
}

export function resolveMilestoneInputForStorage(
	milestone: string,
	activeMilestones: MilestoneRef[],
	archivedMilestones: MilestoneRef[] = [],
): string {
	const normalized = milestone.trim();
	if (!normalized) {
		return normalized;
	}

	const aliasKeys = collectMilestoneAliasKeys(normalized);
	const looksLikeMilestoneId = /^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized);
	const resolveByAlias = (milestones: MilestoneRef[]): string | null => {
		const idMatch = findIdMatch(normalized, milestones, aliasKeys);
		const titleMatch = findUniqueTitleMatch(normalized, milestones);
		if (looksLikeMilestoneId) {
			return idMatch?.id ?? null;
		}
		return titleMatch?.id ?? idMatch?.id ?? null;
	};

	const inputKey = milestoneStorageKey(normalized);
	const activeTitleMatches = activeMilestones.filter((item) => milestoneStorageKey(item.title) === inputKey);
	const hasAmbiguousActiveTitle = activeTitleMatches.length > 1;
	if (looksLikeMilestoneId) {
		const activeIdMatch = findIdMatch(normalized, activeMilestones, aliasKeys);
		if (activeIdMatch) {
			return activeIdMatch.id;
		}
		const archivedIdMatch = findIdMatch(normalized, archivedMilestones, aliasKeys);
		if (archivedIdMatch) {
			return archivedIdMatch.id;
		}
		if (activeTitleMatches.length === 1) {
			return activeTitleMatches[0]?.id ?? normalized;
		}
		if (hasAmbiguousActiveTitle) {
			return normalized;
		}
		const archivedTitleMatch = findUniqueTitleMatch(normalized, archivedMilestones);
		return archivedTitleMatch?.id ?? normalized;
	}

	const activeMatch = resolveByAlias(activeMilestones);
	if (activeMatch) {
		return activeMatch;
	}
	if (hasAmbiguousActiveTitle) {
		return normalized;
	}

	return resolveByAlias(archivedMilestones) ?? normalized;
}
