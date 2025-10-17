import type { BacklogConfig } from "../../../types/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type {
	DocumentCreateArgs,
	DocumentListArgs,
	DocumentSearchArgs,
	DocumentUpdateArgs,
	DocumentViewArgs,
} from "./handlers.ts";
import { DocumentHandlers } from "./handlers.ts";
import {
	documentCreateSchema,
	documentListSchema,
	documentSearchSchema,
	documentUpdateSchema,
	documentViewSchema,
} from "./schemas.ts";

export function registerDocumentTools(server: McpServer, _config: BacklogConfig): void {
	const handlers = new DocumentHandlers(server);

	const listDocumentsTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_list",
			description: "List Backlog.md documents with optional substring filtering",
			inputSchema: documentListSchema,
		},
		documentListSchema,
		async (input) => handlers.listDocuments(input as DocumentListArgs),
	);

	const viewDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_view",
			description: "View a Backlog.md document including metadata and markdown content",
			inputSchema: documentViewSchema,
		},
		documentViewSchema,
		async (input) => handlers.viewDocument(input as DocumentViewArgs),
	);

	const createDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_create",
			description: "Create a Backlog.md document using the shared ID generator",
			inputSchema: documentCreateSchema,
		},
		documentCreateSchema,
		async (input) => handlers.createDocument(input as DocumentCreateArgs),
	);

	const updateDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_update",
			description: "Update an existing Backlog.md document's content and optional title",
			inputSchema: documentUpdateSchema,
		},
		documentUpdateSchema,
		async (input) => handlers.updateDocument(input as DocumentUpdateArgs),
	);

	const searchDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_search",
			description: "Search Backlog.md documents using the shared fuzzy index",
			inputSchema: documentSearchSchema,
		},
		documentSearchSchema,
		async (input) => handlers.searchDocuments(input as DocumentSearchArgs),
	);

	server.addTool(listDocumentsTool);
	server.addTool(viewDocumentTool);
	server.addTool(createDocumentTool);
	server.addTool(updateDocumentTool);
	server.addTool(searchDocumentTool);
}

export type {
	DocumentCreateArgs,
	DocumentListArgs,
	DocumentSearchArgs,
	DocumentUpdateArgs,
	DocumentViewArgs,
} from "./handlers.ts";
export {
	documentCreateSchema,
	documentListSchema,
	documentSearchSchema,
	documentUpdateSchema,
	documentViewSchema,
} from "./schemas.ts";
