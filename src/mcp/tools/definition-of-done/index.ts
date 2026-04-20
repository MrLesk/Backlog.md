import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import { type DefinitionOfDoneDefaultsUpsertArgs, DefinitionOfDoneHandlers } from "./handlers.ts";
import { definitionOfDoneDefaultsGetSchema, definitionOfDoneDefaultsUpsertSchema } from "./schemas.ts";

export function registerDefinitionOfDoneTools(server: McpServer): void {
	const handlers = new DefinitionOfDoneHandlers(server);

	const getDefaultsTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "definition_of_done_defaults_get",
			description: "Get project Definition of Done default checklist items from config",
			inputSchema: definitionOfDoneDefaultsGetSchema,
			annotations: { title: "Get DoD Defaults", readOnlyHint: true, destructiveHint: false },
		},
		definitionOfDoneDefaultsGetSchema,
		async (input) => handlers.getDefaults(input as { project?: string }),
	);

	const upsertDefaultsTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "definition_of_done_defaults_upsert",
			description: "Replace project Definition of Done default checklist items in config",
			inputSchema: definitionOfDoneDefaultsUpsertSchema,
			annotations: { title: "Set DoD Defaults", idempotentHint: true, destructiveHint: false },
		},
		definitionOfDoneDefaultsUpsertSchema,
		async (input) => handlers.upsertDefaults(input as DefinitionOfDoneDefaultsUpsertArgs),
	);

	server.addTool(getDefaultsTool);
	server.addTool(upsertDefaultsTool);
}

export type { DefinitionOfDoneDefaultsUpsertArgs } from "./handlers.ts";
export { definitionOfDoneDefaultsGetSchema, definitionOfDoneDefaultsUpsertSchema } from "./schemas.ts";
