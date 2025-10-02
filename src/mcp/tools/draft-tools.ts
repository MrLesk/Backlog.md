import type { BacklogConfig } from "../../types/index.ts";
import { getCanonicalStatus, getValidStatuses } from "../../utils/status.ts";
import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { generateDraftPromoteSchema } from "../utils/schema-generators.ts";
import {
	createAsyncValidatedTool,
	createSimpleValidatedTool,
	type ValidationContext,
} from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { DraftToolHandlers } from "./draft-handlers.ts";

/**
 * Draft creation tool schema
 */
const draftCreateSchema: JsonSchema = {
	type: "object",
	properties: {
		title: {
			type: "string",
			minLength: 1,
			maxLength: 200,
		},
		description: {
			type: "string",
			maxLength: 10000,
		},
		labels: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
		assignee: {
			type: "array",
			items: { type: "string", maxLength: 100 },
		},
		priority: {
			type: "string",
			enum: ["high", "medium", "low"],
		},
	},
	required: ["title"],
};

/**
 * Draft listing tool schema
 */
const draftListSchema: JsonSchema = {
	type: "object",
	properties: {
		assignee: {
			type: "string",
			maxLength: 100,
		},
		labels: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
		search: {
			type: "string",
			maxLength: 200,
		},
		limit: {
			type: "number",
			minimum: 1,
			maximum: 1000,
		},
	},
	required: [],
};

/**
 * Draft view tool schema
 */
const draftViewSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
	},
	required: ["id"],
};

/**
 * Draft archive tool schema
 */
const draftArchiveSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
	},
	required: ["id"],
};

/**
 * Status validator for draft promotion
 */
async function validatePromoteStatus(input: Record<string, unknown>, context?: ValidationContext): Promise<string[]> {
	const errors: string[] = [];

	if (input.status && context?.core) {
		const inputStatus = input.status as string;
		const canonicalStatus = await getCanonicalStatus(inputStatus, context.core);

		if (!canonicalStatus) {
			// Status not found even with case-insensitive matching
			const validStatuses = await getValidStatuses(context.core);
			errors.push(
				`Status '${inputStatus}' is not valid. Valid statuses: ${validStatuses.join(", ")} ` +
					"(case-insensitive matching supported)",
			);
		} else {
			// Normalize to canonical casing from config
			input.status = canonicalStatus;
		}
	}

	return errors;
}

/**
 * Create draft creation tool handler
 */
const createDraftCreateTool = (handlers: DraftToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "draft_create",
			description: "Create a new draft in the backlog",
			inputSchema: draftCreateSchema,
		},
		draftCreateSchema,
		async (input, _context) => {
			return handlers.createDraft({
				title: input.title as string,
				description: input.description as string,
				labels: (input.labels as string[]) || [],
				assignee: (input.assignee as string[]) || [],
				priority: input.priority as "high" | "medium" | "low",
			});
		},
	);

/**
 * List drafts tool handler
 */
const createDraftListTool = (handlers: DraftToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "draft_list",
			description: "List drafts with optional filtering",
			inputSchema: draftListSchema,
		},
		draftListSchema,
		async (input, _context) => {
			return handlers.listDrafts({
				assignee: input.assignee as string,
				labels: input.labels as string[],
				search: input.search as string,
				limit: (input.limit as number) || 50,
			});
		},
	);

/**
 * View draft tool handler
 */
const createDraftViewTool = (handlers: DraftToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "draft_view",
			description: "View a single draft by ID",
			inputSchema: draftViewSchema,
		},
		draftViewSchema,
		async (input, _context) => {
			return handlers.viewDraft({
				id: input.id as string,
			});
		},
	);

/**
 * Promote draft tool handler
 */
const createDraftPromoteTool = (handlers: DraftToolHandlers, server: McpServer, schema: JsonSchema): McpToolHandler =>
	createAsyncValidatedTool(
		{
			name: "draft_promote",
			description: `Promote a draft to a task.

Status parameter is case-insensitive. Valid values are shown in the tool schema enum or via config_get({"key": "statuses"}).`,
			inputSchema: schema,
		},
		schema,
		async (input, context) => {
			const newContext = { ...context, core: server, timestamp: context?.timestamp || Date.now() };
			return validatePromoteStatus(input, newContext);
		},
		async (input, _context) => {
			return handlers.promoteDraft({
				id: input.id as string,
				status: input.status as string,
			});
		},
	);

/**
 * Archive draft tool handler
 */
const createDraftArchiveTool = (handlers: DraftToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "draft_archive",
			description: "Archive a draft",
			inputSchema: draftArchiveSchema,
		},
		draftArchiveSchema,
		async (input, _context) => {
			return handlers.archiveDraft({
				id: input.id as string,
			});
		},
	);

/**
 * Register all draft management tools with the MCP server
 * @param server The McpServer instance to register tools with
 * @param config The backlog configuration for dynamic schema generation
 */
export function registerDraftTools(server: McpServer, config: BacklogConfig): void {
	// Generate dynamic schema based on config
	const draftPromoteSchema = generateDraftPromoteSchema(config);

	const handlers = new DraftToolHandlers(server);

	server.addTool(createDraftCreateTool(handlers));
	server.addTool(createDraftListTool(handlers));
	server.addTool(createDraftViewTool(handlers));
	server.addTool(createDraftPromoteTool(handlers, server, draftPromoteSchema));
	server.addTool(createDraftArchiveTool(handlers));
}

// Export tool creators and schemas for testing
export {
	createDraftCreateTool,
	createDraftListTool,
	createDraftViewTool,
	createDraftPromoteTool,
	createDraftArchiveTool,
	draftCreateSchema,
	draftListSchema,
	draftViewSchema,
	draftArchiveSchema,
};
