import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { MilestoneAddArgs, MilestoneArchiveArgs, MilestoneEditArgs, MilestoneRemoveArgs } from "./handlers.ts";
import { MilestoneHandlers } from "./handlers.ts";
import {
	milestoneAddSchema,
	milestoneArchiveSchema,
	milestoneEditSchema,
	milestoneListSchema,
	milestoneRemoveSchema,
} from "./schemas.ts";

export function registerMilestoneTools(server: McpServer): void {
	const handlers = new MilestoneHandlers(server);

	const listTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_list",
			description: "List milestones from milestone files and task-only milestone values found on local tasks",
			inputSchema: milestoneListSchema,
			annotations: { title: "List Milestones", readOnlyHint: true, destructiveHint: false },
		},
		milestoneListSchema,
		async () => handlers.listMilestones(),
	);

	const addTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_add",
			description: "Add a milestone by creating a milestone file",
			inputSchema: milestoneAddSchema,
			annotations: { title: "Add Milestone", destructiveHint: false },
		},
		milestoneAddSchema,
		async (input) => handlers.addMilestone(input as MilestoneAddArgs),
	);

	const editTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_edit",
			description: "Edit a milestone: rename, update dates, or both. Pass empty string to clear a date.",
			inputSchema: milestoneEditSchema,
			annotations: { title: "Edit Milestone", destructiveHint: false },
		},
		milestoneEditSchema,
		async (input) => handlers.editMilestone(input as MilestoneEditArgs),
	);

	const removeTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_remove",
			description: "Remove an active milestone file and optionally clear/reassign tasks",
			inputSchema: milestoneRemoveSchema,
			annotations: { title: "Remove Milestone", destructiveHint: true },
		},
		milestoneRemoveSchema,
		async (input) => handlers.removeMilestone(input as MilestoneRemoveArgs),
	);

	const archiveTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_archive",
			description: "Archive a milestone by moving it to backlog/archive/milestones",
			inputSchema: milestoneArchiveSchema,
			annotations: { title: "Archive Milestone", destructiveHint: true },
		},
		milestoneArchiveSchema,
		async (input) => handlers.archiveMilestone(input as MilestoneArchiveArgs),
	);

	server.addTool(listTool);
	server.addTool(addTool);
	server.addTool(editTool);
	server.addTool(removeTool);
	server.addTool(archiveTool);
}
