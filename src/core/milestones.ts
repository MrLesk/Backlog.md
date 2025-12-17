import type { Milestone, MilestoneBucket, MilestoneSummary, Task } from "../types/index.ts";

const NO_MILESTONE_KEY = "__none";

/**
 * Normalize a milestone name/ID by trimming whitespace
 */
export function normalizeMilestoneName(name: string): string {
	return name.trim();
}

/**
 * Get a lowercase key for milestone comparison
 */
export function milestoneKey(name?: string | null): string {
	return normalizeMilestoneName(name ?? "").toLowerCase();
}

/**
 * Validate a milestone name for creation
 */
export function validateMilestoneName(name: string, existingMilestones: string[]): string | null {
	const normalizedName = normalizeMilestoneName(name);
	if (!normalizedName) {
		return "Milestone name cannot be empty.";
	}

	const normalizedExisting = existingMilestones.map((milestone) => milestoneKey(milestone)).filter(Boolean);

	if (normalizedExisting.includes(milestoneKey(normalizedName))) {
		return "Milestone already exists.";
	}

	return null;
}

/**
 * Collect all unique milestone IDs from tasks and milestone entities
 */
export function collectMilestoneIds(tasks: Task[], milestoneEntities: Milestone[]): string[] {
	const merged: string[] = [];
	const seen = new Set<string>();

	const addMilestone = (value: string) => {
		const normalized = normalizeMilestoneName(value);
		if (!normalized) return;
		const key = milestoneKey(normalized);
		if (seen.has(key)) return;
		seen.add(key);
		merged.push(normalized);
	};

	// Add milestone entities first (they have priority for ordering)
	for (const entity of milestoneEntities) {
		addMilestone(entity.id);
	}

	// Then add any milestones from tasks that aren't in entities
	for (const task of tasks) {
		addMilestone(task.milestone ?? "");
	}

	return merged;
}

/**
 * Legacy function for backward compatibility - collects from config milestones
 */
export function collectMilestones(tasks: Task[], configMilestones: string[]): string[] {
	const merged: string[] = [];
	const seen = new Set<string>();

	const addMilestone = (value: string) => {
		const normalized = normalizeMilestoneName(value);
		if (!normalized) return;
		const key = milestoneKey(normalized);
		if (seen.has(key)) return;
		seen.add(key);
		merged.push(normalized);
	};

	for (const m of configMilestones) {
		addMilestone(m);
	}
	for (const task of tasks) {
		addMilestone(task.milestone ?? "");
	}

	return merged;
}

/**
 * Get the display label for a milestone
 * Uses the milestone entity title if available, otherwise returns the ID
 */
export function getMilestoneLabel(milestoneId: string | undefined, milestoneEntities: Milestone[]): string {
	if (!milestoneId) {
		return "Tasks without milestone";
	}
	const entity = milestoneEntities.find((m) => milestoneKey(m.id) === milestoneKey(milestoneId));
	return entity?.title || milestoneId;
}

/**
 * Check if a status represents a "done" state
 */
export function isDoneStatus(status?: string | null): boolean {
	const normalized = (status ?? "").toLowerCase();
	return normalized.includes("done") || normalized.includes("complete");
}

/**
 * Create a milestone bucket for a given milestone
 */
function createBucket(
	milestoneId: string | undefined,
	tasks: Task[],
	statuses: string[],
	milestoneEntities: Milestone[],
	isNoMilestone: boolean,
): MilestoneBucket {
	const bucketMilestoneKey = milestoneKey(milestoneId);
	const bucketTasks = tasks.filter((task) => {
		const taskMilestoneKey = milestoneKey(task.milestone);
		return bucketMilestoneKey ? taskMilestoneKey === bucketMilestoneKey : !taskMilestoneKey;
	});

	const counts: Record<string, number> = {};
	for (const status of statuses) {
		counts[status] = 0;
	}
	for (const task of bucketTasks) {
		const status = task.status ?? "";
		counts[status] = (counts[status] ?? 0) + 1;
	}

	const doneCount = bucketTasks.filter((t) => isDoneStatus(t.status)).length;
	const progress = bucketTasks.length > 0 ? Math.round((doneCount / bucketTasks.length) * 100) : 0;

	const key = bucketMilestoneKey ? bucketMilestoneKey : NO_MILESTONE_KEY;
	const label = getMilestoneLabel(milestoneId, milestoneEntities);

	return {
		key,
		label,
		milestone: milestoneId,
		isNoMilestone,
		tasks: bucketTasks,
		statusCounts: counts,
		total: bucketTasks.length,
		doneCount,
		progress,
	};
}

/**
 * Build milestone buckets from tasks and milestone entities
 */
export function buildMilestoneBuckets(
	tasks: Task[],
	milestoneEntities: Milestone[],
	statuses: string[],
): MilestoneBucket[] {
	const allMilestoneIds = collectMilestoneIds(tasks, milestoneEntities);

	const buckets: MilestoneBucket[] = [
		createBucket(undefined, tasks, statuses, milestoneEntities, true),
		...allMilestoneIds.map((m) => createBucket(m, tasks, statuses, milestoneEntities, false)),
	];

	return buckets;
}

/**
 * Legacy version: Build milestone buckets using config milestone strings
 * @deprecated Use buildMilestoneBuckets with Milestone entities instead
 */
export function buildMilestoneBucketsFromConfig(
	tasks: Task[],
	configMilestones: string[],
	statuses: string[],
): MilestoneBucket[] {
	// Convert config milestone strings to minimal Milestone entities
	const milestoneEntities: Milestone[] = configMilestones.map((id) => ({
		id,
		title: id,
		description: "",
		rawContent: "",
	}));

	return buildMilestoneBuckets(tasks, milestoneEntities, statuses);
}

/**
 * Build a complete milestone summary
 */
export function buildMilestoneSummary(
	tasks: Task[],
	milestoneEntities: Milestone[],
	statuses: string[],
): MilestoneSummary {
	const milestones = collectMilestoneIds(tasks, milestoneEntities);
	const buckets = buildMilestoneBuckets(tasks, milestoneEntities, statuses);

	return {
		milestones,
		buckets,
	};
}
