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
	documentArchiveSchema,
	documentCreateSchema,
	documentDeleteSchema,
	documentListSchema,
	documentRestoreSchema,
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
			annotations: { title: "List Documents", readOnlyHint: true, destructiveHint: false },
		},
		documentListSchema,
		async (input) => handlers.listDocuments(input as DocumentListArgs),
	);

	const viewDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_view",
			description: "View a Backlog.md document including metadata and markdown content",
			inputSchema: documentViewSchema,
			annotations: { title: "View Document", readOnlyHint: true, destructiveHint: false },
		},
		documentViewSchema,
		async (input) => handlers.viewDocument(input as DocumentViewArgs),
	);

	const createDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_create",
			description:
				"Create a Backlog.md document using the shared core document pipeline, with optional docs subdirectory path",
			inputSchema: documentCreateSchema,
			annotations: { title: "Create Document", destructiveHint: false },
		},
		documentCreateSchema,
		async (input) => handlers.createDocument(input as DocumentCreateArgs),
	);

	const updateDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_update",
			description:
				"Update an existing Backlog.md document's content, optional title, metadata, and optional docs subdirectory path",
			inputSchema: documentUpdateSchema,
			annotations: { title: "Update Document", destructiveHint: false },
		},
		documentUpdateSchema,
		async (input) => handlers.updateDocument(input as DocumentUpdateArgs),
	);

	const archiveDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_archive",
			description:
				"Move a Backlog.md document into the archive; keeps its ID reserved and its file unchanged. The document stays viewable, becomes read-only, and leaves lists and search. Tasks and drafts that list the file as documentation are named, not changed",
			inputSchema: documentArchiveSchema,
			annotations: { title: "Archive Document", destructiveHint: true },
		},
		documentArchiveSchema,
		async (input) => handlers.archiveDocument(input as DocumentViewArgs),
	);

	const restoreDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_restore",
			description:
				"Move an archived Backlog.md document back to the docs folder, to the same relative path; its file and ID are unchanged. A file already at that path is never replaced",
			inputSchema: documentRestoreSchema,
			annotations: { title: "Restore Document", destructiveHint: false },
		},
		documentRestoreSchema,
		async (input) => handlers.restoreDocument(input as DocumentViewArgs),
	);

	const deleteDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_delete",
			description:
				"Permanently delete an archived Backlog.md document; works only on archived documents and asks no question. Its ID is released once no other file and no committed file on any branch uses the number. Tasks and drafts that list the file as documentation are named, not changed",
			inputSchema: documentDeleteSchema,
			annotations: { title: "Delete Document", destructiveHint: true },
		},
		documentDeleteSchema,
		async (input) => handlers.deleteDocument(input as DocumentViewArgs),
	);

	const searchDocumentTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "document_search",
			description: "Search Backlog.md documents using the shared fuzzy index",
			inputSchema: documentSearchSchema,
			annotations: { title: "Search Documents", readOnlyHint: true, destructiveHint: false },
		},
		documentSearchSchema,
		async (input) => handlers.searchDocuments(input as DocumentSearchArgs),
	);

	server.addTool(listDocumentsTool);
	server.addTool(viewDocumentTool);
	server.addTool(createDocumentTool);
	server.addTool(updateDocumentTool);
	server.addTool(archiveDocumentTool);
	server.addTool(restoreDocumentTool);
	server.addTool(deleteDocumentTool);
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
