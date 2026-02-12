import type { Milestone, Task } from "../../types";
import { getMilestoneLabel, milestoneKey, normalizeMilestoneName } from "../utils/milestones";

export type LaneMode = "none" | "milestone";

export interface LaneDefinition {
	key: string;
	label: string;
	milestone?: string;
	isNoMilestone?: boolean;
}

export const DEFAULT_LANE_KEY = "lane:none";
export const NO_MILESTONE_LABEL = "No milestone";

export const laneKeyFromMilestone = (milestone?: string | null): string => {
	const key = milestoneKey(milestone);
	return key.length > 0 ? `lane:milestone:${key}` : "lane:milestone:__none";
};

function buildMilestoneAliasMap(
	milestoneEntities: Milestone[],
	archivedMilestones: Milestone[] = [],
): Map<string, string> {
	const aliasMap = new Map<string, string>();
	const collectIdAliasKeys = (value: string): string[] => {
		const normalized = normalizeMilestoneName(value);
		const idKey = milestoneKey(normalized);
		if (!idKey) return [];
		const keys = new Set<string>([idKey]);
		if (/^\d+$/.test(normalized)) {
			const numericAlias = String(Number.parseInt(normalized, 10));
			keys.add(numericAlias);
			keys.add(`m-${numericAlias}`);
			return Array.from(keys);
		}
		const idMatch = normalized.match(/^m-(\d+)$/i);
		if (idMatch?.[1]) {
			const numericAlias = String(Number.parseInt(idMatch[1], 10));
			keys.add(`m-${numericAlias}`);
			keys.add(numericAlias);
		}
		return Array.from(keys);
	};
	const reservedIdKeys = new Set<string>();
	for (const milestone of [...milestoneEntities, ...archivedMilestones]) {
		for (const key of collectIdAliasKeys(milestone.id)) {
			reservedIdKeys.add(key);
		}
	}
	const setAlias = (aliasKey: string, normalizedId: string, allowOverwrite: boolean): void => {
		const existing = aliasMap.get(aliasKey);
		if (!existing) {
			aliasMap.set(aliasKey, normalizedId);
			return;
		}
		if (!allowOverwrite) {
			return;
		}
		const existingKey = existing.toLowerCase();
		const nextKey = normalizedId.toLowerCase();
		const preferredRawId = /^\d+$/.test(aliasKey) ? `m-${aliasKey}` : /^m-\d+$/.test(aliasKey) ? aliasKey : null;
		if (preferredRawId) {
			const existingIsPreferred = existingKey === preferredRawId;
			const nextIsPreferred = nextKey === preferredRawId;
			if (existingIsPreferred && !nextIsPreferred) {
				return;
			}
			if (nextIsPreferred && !existingIsPreferred) {
				aliasMap.set(aliasKey, normalizedId);
			}
			return;
		}
		aliasMap.set(aliasKey, normalizedId);
	};
	const addIdAliases = (normalizedId: string, allowOverwrite = true) => {
		const idKey = milestoneKey(normalizedId);
		if (idKey) {
			setAlias(idKey, normalizedId, allowOverwrite);
		}
		const idMatch = normalizedId.match(/^m-(\d+)$/i);
		if (!idMatch?.[1]) {
			return;
		}
		const numericAlias = String(Number.parseInt(idMatch[1], 10));
		const canonicalId = `m-${numericAlias}`;
		setAlias(canonicalId, normalizedId, allowOverwrite);
		setAlias(numericAlias, normalizedId, allowOverwrite);
	};
	const titleCounts = new Map<string, number>();
	for (const milestone of milestoneEntities) {
		const titleKey = milestoneKey(milestone.title);
		if (!titleKey) continue;
		titleCounts.set(titleKey, (titleCounts.get(titleKey) ?? 0) + 1);
	}
	const activeTitleKeys = new Set(titleCounts.keys());
	for (const milestone of milestoneEntities) {
		const normalizedId = normalizeMilestoneName(milestone.id);
		const normalizedTitle = normalizeMilestoneName(milestone.title);
		if (!normalizedId) continue;
		addIdAliases(normalizedId);
		const titleKey = milestoneKey(normalizedTitle);
		if (titleKey && !reservedIdKeys.has(titleKey) && titleCounts.get(titleKey) === 1) {
			if (!aliasMap.has(titleKey)) {
				aliasMap.set(titleKey, normalizedId);
			}
		}
	}

	const archivedTitleCounts = new Map<string, number>();
	for (const milestone of archivedMilestones) {
		const titleKey = milestoneKey(milestone.title);
		if (!titleKey || activeTitleKeys.has(titleKey)) continue;
		archivedTitleCounts.set(titleKey, (archivedTitleCounts.get(titleKey) ?? 0) + 1);
	}
	for (const milestone of archivedMilestones) {
		const normalizedId = normalizeMilestoneName(milestone.id);
		const normalizedTitle = normalizeMilestoneName(milestone.title);
		if (!normalizedId) continue;
		addIdAliases(normalizedId, false);
		const titleKey = milestoneKey(normalizedTitle);
		if (!titleKey || activeTitleKeys.has(titleKey) || reservedIdKeys.has(titleKey)) continue;
		if (archivedTitleCounts.get(titleKey) === 1) {
			if (!aliasMap.has(titleKey)) {
				aliasMap.set(titleKey, normalizedId);
			}
		}
	}
	return aliasMap;
}

function canonicalizeMilestone(value: string | null | undefined, aliasMap: Map<string, string>): string {
	const normalized = normalizeMilestoneName(value ?? "");
	if (!normalized) return "";
	const normalizedKey = milestoneKey(normalized);
	const direct = aliasMap.get(normalizedKey);
	if (direct) {
		return direct;
	}
	const idMatch = normalized.match(/^m-(\d+)$/i);
	if (idMatch?.[1]) {
		const numericAlias = String(Number.parseInt(idMatch[1], 10));
		return aliasMap.get(`m-${numericAlias}`) ?? aliasMap.get(numericAlias) ?? normalized;
	}
	if (/^\d+$/.test(normalized)) {
		const numericAlias = String(Number.parseInt(normalized, 10));
		return aliasMap.get(`m-${numericAlias}`) ?? aliasMap.get(numericAlias) ?? normalized;
	}
	return normalized;
}

export function buildLanes(
	mode: LaneMode,
	tasks: Task[],
	configMilestones: string[],
	milestoneEntities: Milestone[] = [],
	options?: { archivedMilestoneIds?: string[]; archivedMilestones?: Milestone[] },
): LaneDefinition[] {
	if (mode !== "milestone") {
		return [
			{
				key: DEFAULT_LANE_KEY,
				label: "All tasks",
				isNoMilestone: true,
			},
		];
	}

	const archivedKeys = new Set((options?.archivedMilestoneIds ?? []).map((id) => milestoneKey(id)));
	const aliasMap = buildMilestoneAliasMap(milestoneEntities, options?.archivedMilestones ?? []);
	const milestonesByKey = new Map<string, string>();
	const addMilestone = (value: string) => {
		const normalized = canonicalizeMilestone(value, aliasMap);
		if (!normalized) return;
		const key = milestoneKey(normalized);
		if (!key) return;
		if (archivedKeys.has(key)) return;
		if (milestonesByKey.has(key)) return;
		milestonesByKey.set(key, normalized);
	};

	configMilestones.forEach(addMilestone);
	tasks.forEach((task) => {
		addMilestone(task.milestone ?? "");
	});

	const laneMilestones = Array.from(milestonesByKey.values());

	return [
		{
			key: laneKeyFromMilestone(undefined),
			label: NO_MILESTONE_LABEL,
			milestone: undefined,
			isNoMilestone: true,
		},
		...laneMilestones.map((milestone) => ({
			key: laneKeyFromMilestone(milestone),
			label: getMilestoneLabel(milestone, milestoneEntities),
			milestone,
			isNoMilestone: false,
		})),
	];
}

export function sortTasksForStatus(tasks: Task[], status: string): Task[] {
	const isDoneStatus = status.toLowerCase().includes("done") || status.toLowerCase().includes("complete");

	return tasks.slice().sort((a, b) => {
		// Tasks with ordinal come before tasks without
		if (a.ordinal !== undefined && b.ordinal === undefined) {
			return -1;
		}
		if (a.ordinal === undefined && b.ordinal !== undefined) {
			return 1;
		}

		// Both have ordinals - sort by ordinal value
		if (a.ordinal !== undefined && b.ordinal !== undefined && a.ordinal !== b.ordinal) {
			return a.ordinal - b.ordinal;
		}

		if (isDoneStatus) {
			const aDate = a.updatedDate || a.createdDate;
			const bDate = b.updatedDate || b.createdDate;
			return bDate.localeCompare(aDate);
		}

		return a.createdDate.localeCompare(b.createdDate);
	});
}

function normalizeMilestoneValue(value: string | null): string | undefined {
	if (value === null) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function buildGlobalOrderedTaskIdsForMilestoneLaneReorder(params: {
	tasks: Task[];
	taskId: string;
	targetStatus: string;
	targetMilestone: string | null;
	laneOrderedTaskIds: string[];
}): string[] {
	const targetMilestoneValue = normalizeMilestoneValue(params.targetMilestone);
	const taskId = String(params.taskId || "").trim();
	const targetStatus = String(params.targetStatus || "").trim();

	if (!taskId || !targetStatus) {
		return params.laneOrderedTaskIds;
	}

	const nextTasks = params.tasks.map((task) => {
		if (task.id !== taskId) return task;
		return {
			...task,
			status: targetStatus,
			milestone: targetMilestoneValue,
		};
	});

	const statusTasks = nextTasks.filter((task) => (task.status ?? "") === targetStatus);
	const templateIds = sortTasksForStatus(statusTasks, targetStatus).map((task) => task.id);

	if (templateIds.length === 0) {
		return params.laneOrderedTaskIds;
	}

	const targetMilestoneKey = milestoneKey(targetMilestoneValue);
	const laneTaskIds = new Set(
		statusTasks.filter((task) => milestoneKey(task.milestone) === targetMilestoneKey).map((task) => task.id),
	);

	const laneOrder: string[] = [];
	const laneSeen = new Set<string>();
	for (const id of params.laneOrderedTaskIds) {
		if (!laneTaskIds.has(id)) continue;
		if (laneSeen.has(id)) continue;
		laneSeen.add(id);
		laneOrder.push(id);
	}

	for (const id of templateIds) {
		if (!laneTaskIds.has(id)) continue;
		if (laneSeen.has(id)) continue;
		laneSeen.add(id);
		laneOrder.push(id);
	}

	const merged: string[] = [];
	let laneIndex = 0;
	for (const id of templateIds) {
		if (laneTaskIds.has(id)) {
			const nextLaneId = laneOrder[laneIndex];
			if (nextLaneId) {
				merged.push(nextLaneId);
				laneIndex += 1;
			} else {
				merged.push(id);
			}
			continue;
		}
		merged.push(id);
	}

	if (!laneTaskIds.has(taskId) || !merged.includes(taskId)) {
		return templateIds;
	}

	if (merged.length !== templateIds.length) {
		return templateIds;
	}

	const mergedSet = new Set(merged);
	if (mergedSet.size !== merged.length) {
		return templateIds;
	}

	for (const id of templateIds) {
		if (!mergedSet.has(id)) {
			return templateIds;
		}
	}

	return merged;
}

export function groupTasksByLaneAndStatus(
	mode: LaneMode,
	lanes: LaneDefinition[],
	statuses: string[],
	tasks: Task[],
	options?: { archivedMilestoneIds?: string[]; milestoneEntities?: Milestone[]; archivedMilestones?: Milestone[] },
): Map<string, Map<string, Task[]>> {
	const result = new Map<string, Map<string, Task[]>>();
	const archivedKeys = new Set((options?.archivedMilestoneIds ?? []).map((id) => milestoneKey(id)));
	const aliasMap = buildMilestoneAliasMap(options?.milestoneEntities ?? [], options?.archivedMilestones ?? []);
	const normalizedTasks = tasks.map((task) => {
		const canonicalMilestone = canonicalizeMilestone(task.milestone, aliasMap);
		const key = milestoneKey(canonicalMilestone);
		if (!key || (archivedKeys.size > 0 && archivedKeys.has(key))) {
			if (task.milestone === undefined) {
				return task;
			}
			return { ...task, milestone: undefined };
		}
		if (task.milestone === canonicalMilestone) {
			return task;
		}
		return { ...task, milestone: canonicalMilestone };
	});

	const ensureStatusMap = (laneKey: string): Map<string, Task[]> => {
		const existing = result.get(laneKey);
		if (existing) return existing;
		const statusMap = new Map<string, Task[]>();
		for (const status of statuses) {
			statusMap.set(status, []);
		}
		result.set(laneKey, statusMap);
		return statusMap;
	};

	for (const lane of lanes) {
		ensureStatusMap(lane.key);
	}

	for (const task of normalizedTasks) {
		const statusKey = task.status ?? "";
		const laneKey = mode === "milestone" ? laneKeyFromMilestone(task.milestone) : DEFAULT_LANE_KEY;
		const statusMap = ensureStatusMap(laneKey);

		let bucket = statusMap.get(statusKey);
		if (!bucket) {
			bucket = [];
			statusMap.set(statusKey, bucket);
		}
		bucket.push(task);
	}

	for (const [, statusMap] of result) {
		for (const [status, list] of statusMap) {
			statusMap.set(status, sortTasksForStatus(list, status));
		}
	}

	return result;
}
