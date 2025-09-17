import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { createAsyncValidatedTool, createSimpleValidatedTool } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { DocumentToolHandlers } from "./document-handlers.ts";

/**
 * Document creation tool schema
 */
const docCreateSchema: JsonSchema = {
	type: "object",
	properties: {
		title: {
			type: "string",
			minLength: 1,
			maxLength: 200,
		},
		content: {
			type: "string",
			maxLength: 50000,
		},
		type: {
			type: "string",
			enum: ["readme", "guide", "specification", "other"],
		},
		tags: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
	},
	required: ["title", "content"],
};

/**
 * Document listing tool schema
 */
const docListSchema: JsonSchema = {
	type: "object",
	properties: {
		type: {
			type: "string",
			enum: ["readme", "guide", "specification", "other"],
		},
		tags: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
		limit: {
			type: "number",
			minimum: 1,
			maximum: 100,
		},
		offset: {
			type: "number",
			minimum: 0,
		},
	},
	required: [],
};

/**
 * Document view tool schema
 */
const docViewSchema: JsonSchema = {
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
 * Document creation tool handler
 */
const createDocCreateTool = (handlers: DocumentToolHandlers): McpToolHandler =>
	createAsyncValidatedTool(
		{
			name: "doc_create",
			description: "Create a new document with markdown content and frontmatter",
			inputSchema: docCreateSchema,
		},
		docCreateSchema,
		async (_input, _context) => [], // No additional validation needed
		async (input, _context) => {
			return handlers.createDocument({
				title: input.title as string,
				content: input.content as string,
				type: (input.type as "readme" | "guide" | "specification" | "other") || "other",
				tags: (input.tags as string[]) || [],
			});
		},
	);

/**
 * Document listing tool handler
 */
const createDocListTool = (handlers: DocumentToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "doc_list",
			description: "List documents with optional filtering by type and tags",
			inputSchema: docListSchema,
		},
		docListSchema,
		async (input, _context) => {
			return handlers.listDocuments({
				type: input.type as "readme" | "guide" | "specification" | "other" | undefined,
				tags: input.tags as string[] | undefined,
				limit: (input.limit as number) || 50,
				offset: (input.offset as number) || 0,
			});
		},
	);

/**
 * Document view tool handler
 */
const createDocViewTool = (handlers: DocumentToolHandlers): McpToolHandler =>
	createAsyncValidatedTool(
		{
			name: "doc_view",
			description: "Get complete document content and metadata by ID",
			inputSchema: docViewSchema,
		},
		docViewSchema,
		async (_input, _context) => [], // No additional validation needed
		async (input, _context) => {
			return handlers.viewDocument({
				id: input.id as string,
			});
		},
	);

/**
 * Register all document management tools with the MCP server
 * @param server The McpServer instance to register tools with
 */
export function registerDocumentTools(server: McpServer): void {
	const handlers = new DocumentToolHandlers(server);

	server.addTool(createDocCreateTool(handlers));
	server.addTool(createDocListTool(handlers));
	server.addTool(createDocViewTool(handlers));
}

// Export tool creators and schemas for testing
export { createDocCreateTool, createDocListTool, createDocViewTool, docCreateSchema, docListSchema, docViewSchema };
