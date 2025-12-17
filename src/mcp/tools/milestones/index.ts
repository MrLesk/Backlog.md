import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { MilestoneAddArgs, MilestoneRemoveArgs, MilestoneRenameArgs } from "./handlers.ts";
import { MilestoneHandlers } from "./handlers.ts";
import { milestoneAddSchema, milestoneListSchema, milestoneRemoveSchema, milestoneRenameSchema } from "./schemas.ts";

export function registerMilestoneTools(server: McpServer): void {
	const handlers = new MilestoneHandlers(server);

	const listTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_list",
			description: "List milestones from config and milestones found on local tasks",
			inputSchema: milestoneListSchema,
		},
		milestoneListSchema,
		async () => handlers.listMilestones(),
	);

	const addTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_add",
			description: "Add a milestone to backlog config",
			inputSchema: milestoneAddSchema,
		},
		milestoneAddSchema,
		async (input) => handlers.addMilestone(input as MilestoneAddArgs),
	);

	const renameTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_rename",
			description: "Rename a milestone in config and optionally update local tasks",
			inputSchema: milestoneRenameSchema,
		},
		milestoneRenameSchema,
		async (input) => handlers.renameMilestone(input as MilestoneRenameArgs),
	);

	const removeTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "milestone_remove",
			description: "Remove a milestone from config and optionally clear/reassign tasks",
			inputSchema: milestoneRemoveSchema,
		},
		milestoneRemoveSchema,
		async (input) => handlers.removeMilestone(input as MilestoneRemoveArgs),
	);

	server.addTool(listTool);
	server.addTool(addTool);
	server.addTool(renameTool);
	server.addTool(removeTool);
}
