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

export function buildLanes(
	mode: LaneMode,
	tasks: Task[],
	configMilestones: string[],
	milestoneEntities: Milestone[] = [],
	options?: { archivedMilestoneIds?: string[] },
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
	const milestonesByKey = new Map<string, string>();
	const addMilestone = (value: string) => {
		const normalized = normalizeMilestoneName(value);
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
	options?: { archivedMilestoneIds?: string[] },
): Map<string, Map<string, Task[]>> {
	const result = new Map<string, Map<string, Task[]>>();
	const archivedKeys = new Set((options?.archivedMilestoneIds ?? []).map((id) => milestoneKey(id)));
	const normalizedTasks =
		archivedKeys.size > 0
			? tasks.map((task) => {
					const key = milestoneKey(task.milestone);
					if (!key || !archivedKeys.has(key)) {
						return task;
					}
					return { ...task, milestone: undefined };
				})
			: tasks;

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
