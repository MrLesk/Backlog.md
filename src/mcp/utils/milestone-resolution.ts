import type { Milestone } from "../../types/index.ts";

export function normalizeMilestoneName(name: string): string {
	return name.trim();
}

export function milestoneKey(name: string): string {
	return normalizeMilestoneName(name).toLowerCase();
}

function buildMilestoneLookupKeys(name: string): string[] {
	const normalized = normalizeMilestoneName(name);
	const baseKey = milestoneKey(normalized);
	if (!baseKey) {
		return [];
	}

	const keys: string[] = [baseKey];
	const addKey = (key: string) => {
		if (!keys.includes(key)) {
			keys.push(key);
		}
	};

	if (/^\d+$/.test(normalized)) {
		const numeric = String(Number.parseInt(normalized, 10));
		addKey(numeric);
		addKey(`m-${numeric}`);
		return keys;
	}

	const milestoneIdMatch = normalized.match(/^m-(\d+)$/i);
	if (milestoneIdMatch?.[1]) {
		const numeric = String(Number.parseInt(milestoneIdMatch[1], 10));
		addKey(`m-${numeric}`);
		addKey(numeric);
	}

	return keys;
}

function milestoneIdMatchesLookupKeys(milestoneId: string, lookupKeys: Set<string>): boolean {
	for (const key of buildMilestoneLookupKeys(milestoneId)) {
		if (lookupKeys.has(key)) {
			return true;
		}
	}
	return false;
}

function canonicalMilestoneId(value: string): string | null {
	const normalized = normalizeMilestoneName(value);
	if (!normalized) {
		return null;
	}
	if (/^\d+$/.test(normalized)) {
		const numeric = String(Number.parseInt(normalized, 10));
		return `m-${numeric}`;
	}
	const milestoneIdMatch = normalized.match(/^m-(\d+)$/i);
	if (milestoneIdMatch?.[1]) {
		const numeric = String(Number.parseInt(milestoneIdMatch[1], 10));
		return `m-${numeric}`;
	}
	return null;
}

function findMatchingMilestoneId(name: string, milestones: Milestone[]): Milestone | undefined {
	const normalized = normalizeMilestoneName(name);
	const inputKey = milestoneKey(normalized);
	const rawExactMatch = milestones.find((milestone) => milestoneKey(milestone.id) === inputKey);
	if (rawExactMatch) {
		return rawExactMatch;
	}
	const canonicalInputId = canonicalMilestoneId(normalized);
	if (canonicalInputId) {
		const canonicalRawMatch = milestones.find((milestone) => milestoneKey(milestone.id) === canonicalInputId);
		if (canonicalRawMatch) {
			return canonicalRawMatch;
		}
	}
	const lookupKeys = new Set(buildMilestoneLookupKeys(normalized));
	return milestones.find((milestone) => milestoneIdMatchesLookupKeys(milestone.id, lookupKeys));
}

function findMatchingMilestone(name: string, milestones: Milestone[]): Milestone | undefined {
	const normalized = normalizeMilestoneName(name);
	const lookupKeys = buildMilestoneLookupKeys(normalized);
	if (lookupKeys.length === 0) {
		return undefined;
	}
	const inputKey = lookupKeys[0];
	if (!inputKey) {
		return undefined;
	}
	const looksLikeMilestoneId = /^m-\d+$/i.test(normalized) || /^\d+$/.test(normalized);
	const idMatch = findMatchingMilestoneId(normalized, milestones);
	const titleMatches = milestones.filter((milestone) => milestoneKey(milestone.title) === inputKey);
	const uniqueTitleMatch = titleMatches.length === 1 ? titleMatches[0] : undefined;
	if (looksLikeMilestoneId) {
		return idMatch ?? uniqueTitleMatch;
	}
	return uniqueTitleMatch ?? idMatch;
}

export function resolveMilestoneStorageValue(name: string, milestones: Milestone[]): string {
	const normalized = normalizeMilestoneName(name);
	if (!normalized) {
		return normalized;
	}
	return findMatchingMilestone(normalized, milestones)?.id ?? normalized;
}

export function buildMilestoneMatchKeys(name: string, milestones: Milestone[]): Set<string> {
	const normalized = normalizeMilestoneName(name);
	const keys = new Set<string>();
	const lookupKeys = buildMilestoneLookupKeys(normalized);
	for (const key of lookupKeys) {
		keys.add(key);
	}
	const inputKey = lookupKeys[0] ?? "";

	if (!inputKey) {
		return keys;
	}

	const idMatch = findMatchingMilestoneId(normalized, milestones);
	if (idMatch) {
		return keys;
	}

	const titleMatches = milestones.filter((milestone) => milestoneKey(milestone.title) === inputKey);
	const titleMatch = titleMatches.length === 1 ? titleMatches[0] : undefined;
	if (titleMatch) {
		for (const key of buildMilestoneLookupKeys(titleMatch.id)) {
			keys.add(key);
		}
	}

	return keys;
}

export function keySetsIntersect(left: Set<string>, right: Set<string>): boolean {
	for (const key of left) {
		if (right.has(key)) {
			return true;
		}
	}
	return false;
}
