import type { Snapshot } from "../state/store.ts";
import { logger } from "./logger.ts";

/**
 * Sync state classification
 */
export type SyncState =
	| "InSync" // Both sides match the last snapshot
	| "NeedsPush" // Backlog changed, Jira unchanged
	| "NeedsPull" // Jira changed, Backlog unchanged
	| "Conflict" // Both sides changed
	| "Unknown"; // No snapshot exists yet

export interface SyncStateResult {
	state: SyncState;
	backlogHash: string;
	jiraHash: string;
	baseBacklogHash?: string;
	baseJiraHash?: string;
	changedFields?: string[];
}

/**
 * Classify the sync state using 3-way merge logic
 *
 * Given current hashes and base snapshots, determines what action is needed:
 * - InSync: No changes on either side
 * - NeedsPush: Backlog changed, Jira didn't
 * - NeedsPull: Jira changed, Backlog didn't
 * - Conflict: Both changed
 * - Unknown: No baseline exists
 */
export function classifySyncState(
	currentBacklogHash: string,
	currentJiraHash: string,
	backlogSnapshot: Snapshot | null,
	jiraSnapshot: Snapshot | null,
): SyncStateResult {
	logger.debug(
		{
			currentBacklogHash,
			currentJiraHash,
			hasBacklogSnapshot: !!backlogSnapshot,
			hasJiraSnapshot: !!jiraSnapshot,
		},
		"Classifying sync state",
	);

	// If no snapshots exist, we can't determine state
	if (!backlogSnapshot || !jiraSnapshot) {
		return {
			state: "Unknown",
			backlogHash: currentBacklogHash,
			jiraHash: currentJiraHash,
		};
	}

	const baseBacklogHash = backlogSnapshot.hash;
	const baseJiraHash = jiraSnapshot.hash;

	// Check if either side changed
	const backlogChanged = currentBacklogHash !== baseBacklogHash;
	const jiraChanged = currentJiraHash !== baseJiraHash;

	logger.debug(
		{
			backlogChanged,
			jiraChanged,
			baseBacklogHash,
			baseJiraHash,
		},
		"Change detection",
	);

	// Determine state
	let state: SyncState;
	if (!backlogChanged && !jiraChanged) {
		state = "InSync";
	} else if (backlogChanged && !jiraChanged) {
		state = "NeedsPush";
	} else if (!backlogChanged && jiraChanged) {
		state = "NeedsPull";
	} else {
		// Both changed
		state = "Conflict";
	}

	return {
		state,
		backlogHash: currentBacklogHash,
		jiraHash: currentJiraHash,
		baseBacklogHash,
		baseJiraHash,
	};
}

/**
 * Determine if a conflict can be auto-resolved
 * Returns the resolution strategy if possible, null otherwise
 */
export function canAutoResolveConflict(
	backlogPayload: unknown,
	jiraPayload: unknown,
	baseBacklogPayload: unknown,
	baseJiraPayload: unknown,
): { canResolve: boolean; strategy?: "use_backlog" | "use_jira" | "merge" } {
	// Simple heuristics for auto-resolution:
	// 1. If changes don't overlap fields, can merge
	// 2. If one side has more complete data, prefer it
	// 3. Otherwise, requires manual resolution

	// For now, be conservative and require manual resolution
	// This can be enhanced later with field-level merge logic

	logger.debug("Auto-resolution not yet implemented, defaulting to manual resolution");

	return { canResolve: false };
}
