import type { BacklogConfig } from "../../../types/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type {
	DecisionCreateArgs,
	DecisionListArgs,
	DecisionSearchArgs,
	DecisionUpdateArgs,
	DecisionViewArgs,
} from "./handlers.ts";
import { DecisionHandlers } from "./handlers.ts";
import {
	decisionCreateSchema,
	decisionListSchema,
	decisionSearchSchema,
	decisionUpdateSchema,
	decisionViewSchema,
} from "./schemas.ts";

export function registerDecisionTools(server: McpServer, _config: BacklogConfig): void {
	const handlers = new DecisionHandlers(server);

	const listDecisionsTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_list",
			description: "List Backlog.md decisions with optional substring filtering",
			inputSchema: decisionListSchema,
			annotations: { title: "List decisions", readOnlyHint: true, destructiveHint: false },
		},
		decisionListSchema,
		async (input) => handlers.listDecisions(input as DecisionListArgs),
	);

	const viewDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_view",
			description: "View a Backlog.md decision including metadata and markdown content",
			inputSchema: decisionViewSchema,
			annotations: { title: "View decision", readOnlyHint: true, destructiveHint: false },
		},
		decisionViewSchema,
		async (input) => handlers.viewDecision(input as DecisionViewArgs),
	);

	const createDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_create",
			description: "Create a Backlog.md decisions using the shared ID generator",
			inputSchema: decisionCreateSchema,
			annotations: { title: "Create decision", destructiveHint: false },
		},
		decisionCreateSchema,
		async (input) => handlers.createDecision(input as DecisionCreateArgs),
	);

	const updateDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_update",
			description: "Update an existing Backlog.md decision's content and optional title",
			inputSchema: decisionUpdateSchema,
			annotations: { title: "Update decision", destructiveHint: false },
		},
		decisionUpdateSchema,
		async (input) => handlers.updateDecision(input as DecisionUpdateArgs),
	);

	const searchDecisionTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "decision_search",
			description: "Search Backlog.md decisions using the shared fuzzy index",
			inputSchema: decisionSearchSchema,
			annotations: { title: "Search decisions", readOnlyHint: true, destructiveHint: false },
		},
		decisionSearchSchema,
		async (input) => handlers.searchDecisions(input as DecisionSearchArgs),
	);

	server.addTool(listDecisionsTool);
	server.addTool(viewDecisionTool);
	server.addTool(createDecisionTool);
	server.addTool(updateDecisionTool);
	server.addTool(searchDecisionTool);
}

export type {
	DecisionCreateArgs,
	DecisionListArgs,
	DecisionSearchArgs,
	DecisionUpdateArgs,
	DecisionViewArgs,
} from "./handlers.ts";
export {
	decisionCreateSchema,
	decisionListSchema,
	decisionSearchSchema,
	decisionUpdateSchema,
	decisionViewSchema,
} from "./schemas.ts";
