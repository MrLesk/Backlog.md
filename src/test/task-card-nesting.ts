import { createUnfilteredNesting } from "../web/lib/task-nesting.ts";

/**
 * The nesting props of a Board card that a test draws without its board: there are no other tasks, so the card has
 * no subtask bar, and a parent shows only as its ID.
 */
export const STANDALONE_CARD_NESTING = {
	nesting: createUnfilteredNesting([]),
	statuses: [],
	subtaskLevels: { recorded: {}, setOpen: () => {} },
};
