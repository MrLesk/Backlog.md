import type { Document } from "../../types/index.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult } from "../types.ts";

/**
 * DocumentToolHandlers class containing all document management business logic
 */
export class DocumentToolHandlers {
	constructor(private server: McpServer) {}

	/**
	 * Create a new document
	 */
	async createDocument(args: {
		title: string;
		content: string;
		type: "readme" | "guide" | "specification" | "other";
		tags: string[];
	}): Promise<CallToolResult> {
		const { title, content, type, tags } = args;

		try {
			// Generate document ID using utility function
			const { generateNextDocId } = await import("../../utils/id-generators.js");
			const id = await generateNextDocId(this.server);

			const document: Document = {
				id,
				title,
				type,
				createdDate: new Date().toISOString().slice(0, 16).replace("T", " "),
				body: content,
				tags: tags.length > 0 ? tags : undefined,
			};

			await this.server.createDocument(document);

			return {
				content: [
					{
						type: "text",
						text: `Document created successfully with ID: ${id}`,
					},
				],
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
			return {
				content: [
					{
						type: "text",
						text: `Error creating document: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	}

	/**
	 * List documents with optional filtering
	 */
	async listDocuments(args: {
		type?: "readme" | "guide" | "specification" | "other";
		tags?: string[];
		limit: number;
		offset: number;
	}): Promise<CallToolResult> {
		const { type, tags, limit, offset } = args;

		try {
			// Get all documents from filesystem
			const allDocuments = await this.server.fs.listDocuments();

			// Apply filtering
			let filteredDocuments = allDocuments;

			if (type) {
				filteredDocuments = filteredDocuments.filter((doc) => doc.type === type);
			}

			if (tags && tags.length > 0) {
				filteredDocuments = filteredDocuments.filter((doc) => tags.some((tag) => doc.tags?.includes(tag)));
			}

			// Apply pagination
			const paginatedDocuments = filteredDocuments.slice(offset, offset + limit);

			// Create summary for each document
			const documentSummaries = paginatedDocuments.map((doc) => ({
				id: doc.id,
				title: doc.title,
				type: doc.type,
				createdDate: doc.createdDate,
				updatedDate: doc.updatedDate,
				tags: doc.tags || [],
				contentLength: doc.body.length,
				preview: doc.body.slice(0, 200) + (doc.body.length > 200 ? "..." : ""),
			}));

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								total: filteredDocuments.length,
								offset,
								limit,
								documents: documentSummaries,
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
			return {
				content: [
					{
						type: "text",
						text: `Error listing documents: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	}

	/**
	 * View complete document by ID
	 */
	async viewDocument(args: { id: string }): Promise<CallToolResult> {
		const { id } = args;

		try {
			const document = await this.server.getDocument(id);

			const documentWithMetadata = {
				id: document.id,
				title: document.title,
				type: document.type,
				createdDate: document.createdDate,
				updatedDate: document.updatedDate,
				tags: document.tags || [],
				content: document.body,
				metadata: {
					contentLength: document.body.length,
					lineCount: document.body.split("\n").length,
				},
			};

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(documentWithMetadata, null, 2),
					},
				],
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
			return {
				content: [
					{
						type: "text",
						text: `Error viewing document: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	}
}
