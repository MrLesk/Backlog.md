import type { Milestone } from "../../types/index.ts";

export function normalizeMilestoneName(name: string): string {
	return name.trim();
}

export function milestoneKey(name: string): string {
	return normalizeMilestoneName(name).toLowerCase();
}

function findMatchingMilestone(name: string, milestones: Milestone[]): Milestone | undefined {
	const key = milestoneKey(name);
	if (!key) {
		return undefined;
	}
	return (
		milestones.find((milestone) => milestoneKey(milestone.id) === key) ??
		milestones.find((milestone) => milestoneKey(milestone.title) === key)
	);
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
	const inputKey = milestoneKey(normalized);
	if (inputKey) {
		keys.add(inputKey);
	}

	if (!inputKey) {
		return keys;
	}

	const idMatch = milestones.find((milestone) => milestoneKey(milestone.id) === inputKey);
	if (idMatch) {
		return keys;
	}

	const titleMatch = milestones.find((milestone) => milestoneKey(milestone.title) === inputKey);
	if (titleMatch) {
		const idKey = milestoneKey(titleMatch.id);
		if (idKey) {
			keys.add(idKey);
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
