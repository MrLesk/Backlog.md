import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { createSimpleValidatedTool } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { NotesToolHandlers } from "./notes-handlers.ts";

/**
 * Notes set tool schema
 */
const notesSetSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		content: {
			type: "string",
			maxLength: 50000,
		},
	},
	required: ["id", "content"],
};

/**
 * Notes append tool schema
 */
const notesAppendSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		content: {
			type: "string",
			maxLength: 50000,
		},
		separator: {
			type: "string",
			maxLength: 10,
		},
	},
	required: ["id", "content"],
};

/**
 * Notes get tool schema
 */
const notesGetSchema: JsonSchema = {
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
 * Notes clear tool schema
 */
const notesClearSchema: JsonSchema = {
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
 * Plan set tool schema
 */
const planSetSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		content: {
			type: "string",
			maxLength: 50000,
		},
	},
	required: ["id", "content"],
};

/**
 * Plan append tool schema
 */
const planAppendSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		content: {
			type: "string",
			maxLength: 50000,
		},
		separator: {
			type: "string",
			maxLength: 10,
		},
	},
	required: ["id", "content"],
};

/**
 * Plan get tool schema
 */
const planGetSchema: JsonSchema = {
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
 * Plan clear tool schema
 */
const planClearSchema: JsonSchema = {
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
 * Notes set tool handler
 */
const createNotesSetTool = (handlers: NotesToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "notes_set",
			description: "Replace entire implementation notes",
			inputSchema: notesSetSchema,
		},
		notesSetSchema,
		async (input, _context) => {
			return handlers.setNotes({
				id: input.id as string,
				content: input.content as string,
			});
		},
	);

/**
 * Notes append tool handler
 */
const createNotesAppendTool = (handlers: NotesToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "notes_append",
			description: "Append to implementation notes with configurable separator",
			inputSchema: notesAppendSchema,
		},
		notesAppendSchema,
		async (input, _context) => {
			return handlers.appendNotes({
				id: input.id as string,
				content: input.content as string,
				separator: (input.separator as string) || "\n\n",
			});
		},
	);

/**
 * Notes get tool handler
 */
const createNotesGetTool = (handlers: NotesToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "notes_get",
			description: "Retrieve current implementation notes",
			inputSchema: notesGetSchema,
		},
		notesGetSchema,
		async (input, _context) => {
			return handlers.getNotes({
				id: input.id as string,
			});
		},
	);

/**
 * Notes clear tool handler
 */
const createNotesClearTool = (handlers: NotesToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "notes_clear",
			description: "Clear implementation notes",
			inputSchema: notesClearSchema,
		},
		notesClearSchema,
		async (input, _context) => {
			return handlers.clearNotes({
				id: input.id as string,
			});
		},
	);

/**
 * Plan set tool handler
 */
const createPlanSetTool = (handlers: NotesToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "plan_set",
			description: "Replace entire implementation plan",
			inputSchema: planSetSchema,
		},
		planSetSchema,
		async (input, _context) => {
			return handlers.setPlan({
				id: input.id as string,
				content: input.content as string,
			});
		},
	);

/**
 * Plan append tool handler
 */
const createPlanAppendTool = (handlers: NotesToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "plan_append",
			description: "Append to implementation plan with configurable separator",
			inputSchema: planAppendSchema,
		},
		planAppendSchema,
		async (input, _context) => {
			return handlers.appendPlan({
				id: input.id as string,
				content: input.content as string,
				separator: (input.separator as string) || "\n\n",
			});
		},
	);

/**
 * Plan get tool handler
 */
const createPlanGetTool = (handlers: NotesToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "plan_get",
			description: "Retrieve current implementation plan",
			inputSchema: planGetSchema,
		},
		planGetSchema,
		async (input, _context) => {
			return handlers.getPlan({
				id: input.id as string,
			});
		},
	);

/**
 * Plan clear tool handler
 */
const createPlanClearTool = (handlers: NotesToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "plan_clear",
			description: "Clear implementation plan",
			inputSchema: planClearSchema,
		},
		planClearSchema,
		async (input, _context) => {
			return handlers.clearPlan({
				id: input.id as string,
			});
		},
	);

/**
 * Register all notes management tools with the MCP server
 * @param server The McpServer instance to register tools with
 */
export function registerNotesTools(server: McpServer): void {
	const handlers = new NotesToolHandlers(server);

	server.addTool(createNotesSetTool(handlers));
	server.addTool(createNotesAppendTool(handlers));
	server.addTool(createNotesGetTool(handlers));
	server.addTool(createNotesClearTool(handlers));
	server.addTool(createPlanSetTool(handlers));
	server.addTool(createPlanAppendTool(handlers));
	server.addTool(createPlanGetTool(handlers));
	server.addTool(createPlanClearTool(handlers));
}

// Export tool creators and schemas for testing
export {
	createNotesSetTool,
	createNotesAppendTool,
	createNotesGetTool,
	createNotesClearTool,
	createPlanSetTool,
	createPlanAppendTool,
	createPlanGetTool,
	createPlanClearTool,
	notesSetSchema,
	notesAppendSchema,
	notesGetSchema,
	notesClearSchema,
	planSetSchema,
	planAppendSchema,
	planGetSchema,
	planClearSchema,
};
