import type { Document } from "../../types/index.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult } from "../types.ts";

/**
 * Helper function to format document_create operation results as markdown
 */
function formatDocumentCreateMarkdown(id: string, title: string): string {
	const lines = ["# Document Created", ""];

	lines.push(`✅ Successfully created **${id}**`);
	lines.push("");

	// Get the file path for the created document
	const documentFileName = `${id} - ${title
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.toLowerCase()}.md`;

	lines.push(`**File path:** \`/docs/${documentFileName}\``);
	lines.push(`**Title:** ${title}`);
	lines.push("");
	lines.push("Document created successfully and ready for editing.");

	return lines.join("\n");
}

/**
 * Helper function to format document list as markdown
 */
function formatDocumentListMarkdown(documents: Document[]): string {
	if (documents.length === 0) {
		return "# Documents\n\nNo documents found.";
	}

	const lines = ["# Documents", ""];
	lines.push(`Found ${documents.length} document${documents.length === 1 ? "" : "s"}:`);
	lines.push("");

	for (const doc of documents) {
		lines.push(`- **${doc.id}** - ${doc.title}`);
	}

	return lines.join("\n");
}

/**
 * Helper function to format document view as markdown
 */
function formatDocumentViewMarkdown(document: Document): string {
	const lines = [`# Document: ${document.title}`, ""];

	lines.push("## Metadata");
	lines.push("");
	lines.push(`**ID:** ${document.id}`);
	lines.push(`**Type:** ${document.type}`);
	lines.push(`**Created:** ${document.createdDate}`);
	if (document.updatedDate) {
		lines.push(`**Updated:** ${document.updatedDate}`);
	}
	if (document.tags && document.tags.length > 0) {
		lines.push(`**Tags:** ${document.tags.join(", ")}`);
	}

	lines.push("");
	lines.push("## Content");
	lines.push("");
	lines.push(document.rawContent);

	return lines.join("\n");
}

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
				rawContent: content,
				tags: tags.length > 0 ? tags : undefined,
			};

			await this.server.createDocument(document);

			return {
				content: [
					{
						type: "text",
						text: formatDocumentCreateMarkdown(id, title),
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

			return {
				content: [
					{
						type: "text",
						text: formatDocumentListMarkdown(allDocuments),
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
			const document = await this.server.filesystem.loadDocument(id);

			return {
				content: [
					{
						type: "text",
						text: formatDocumentViewMarkdown(document),
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
