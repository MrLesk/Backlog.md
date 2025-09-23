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
			// Generate document ID using utility function with Core instance
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
	 * List documents (simple listing like CLI)
	 */
	async listDocuments(): Promise<CallToolResult> {
		try {
			// Get all documents using Core API
			const allDocuments = await this.server.filesystem.listDocuments();

			// Format as simple list matching CLI output: "${id} - ${title}"
			const documentList = allDocuments.map((doc) => `${doc.id} - ${doc.title}`).join("\n");

			return {
				content: [
					{
						type: "text",
						text: documentList,
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

			// Return document content in simple format matching CLI
			const documentContent = {
				id: document.id,
				title: document.title,
				type: document.type,
				createdDate: document.createdDate,
				updatedDate: document.updatedDate,
				tags: document.tags || [],
				content: document.body,
			};

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(documentContent, null, 2),
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
