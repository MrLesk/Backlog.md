import type { Milestone } from "../types/index.ts";

const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * The one order every milestone view shows: milestones with a due date first, earliest first;
 * then milestones without one by title in natural order ("Sprint 2" before "Sprint 10"); the ID
 * breaks ties.
 */
export function compareMilestones(a: Milestone, b: Milestone): number {
	if (a.dueDate && b.dueDate) {
		if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
	} else if (a.dueDate || b.dueDate) {
		return a.dueDate ? -1 : 1;
	} else {
		const byTitle = naturalCompare(a.title, b.title);
		if (byTitle !== 0) return byTitle;
	}
	return naturalCompare(a.id, b.id);
}
