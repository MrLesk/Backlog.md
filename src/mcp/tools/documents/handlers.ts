import type { Document, DocumentSearchResult } from "../../../types/index.ts";
import { McpError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";
import { formatDocumentCallResult } from "../../utils/document-response.ts";

export type DocumentListArgs = {
	search?: string;
};

export type DocumentViewArgs = {
	id: string;
};

export type DocumentCreateArgs = {
	title: string;
	content: string;
};

export type DocumentUpdateArgs = {
	id: string;
	title?: string;
	content: string;
};

export type DocumentSearchArgs = {
	query: string;
	limit?: number;
};

export class DocumentHandlers {
	constructor(private readonly core: McpServer) {}

	private formatDocumentSummaryLine(document: Document): string {
		const metadata: string[] = [`type: ${document.type}`, `created: ${document.createdDate}`];
		if (document.updatedDate) {
			metadata.push(`updated: ${document.updatedDate}`);
		}
		if (document.tags && document.tags.length > 0) {
			metadata.push(`tags: ${document.tags.join(", ")}`);
		} else {
			metadata.push("tags: (none)");
		}
		return `  ${document.id} - ${document.title} (${metadata.join(", ")})`;
	}

	private formatScore(score: number | null): string {
		if (score === null || score === undefined) {
			return "";
		}
		const invertedScore = 1 - score;
		return ` [score ${invertedScore.toFixed(3)}]`;
	}

	private async loadDocumentOrThrow(id: string): Promise<Document> {
		const document = await this.core.getDocument(id);
		if (!document) {
			throw new McpError(`Document not found: ${id}`, "DOCUMENT_NOT_FOUND");
		}
		return document;
	}

	async listDocuments(args: DocumentListArgs = {}): Promise<CallToolResult> {
		const search = args.search?.toLowerCase();
		const documents = await this.core.filesystem.listDocuments();

		const filtered =
			search && search.length > 0
				? documents.filter((document) => {
						const haystacks = [document.id, document.title];
						return haystacks.some((value) => value.toLowerCase().includes(search));
					})
				: documents;

		if (filtered.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "No documents found.",
					},
				],
			};
		}

		const lines: string[] = ["Documents:"];
		for (const document of filtered) {
			lines.push(this.formatDocumentSummaryLine(document));
		}

		return {
			content: [
				{
					type: "text",
					text: lines.join("\n"),
				},
			],
		};
	}

	async viewDocument(args: DocumentViewArgs): Promise<CallToolResult> {
		const document = await this.loadDocumentOrThrow(args.id);
		return await formatDocumentCallResult(document);
	}

	async createDocument(args: DocumentCreateArgs): Promise<CallToolResult> {
		try {
			const document = await this.core.createDocumentWithId(args.title, args.content);
			return await formatDocumentCallResult(document, {
				summaryLines: ["Document created successfully."],
			});
		} catch (error) {
			if (error instanceof Error) {
				throw new McpError(`Failed to create document: ${error.message}`, "OPERATION_FAILED");
			}
			throw new McpError("Failed to create document.", "OPERATION_FAILED");
		}
	}

	async updateDocument(args: DocumentUpdateArgs): Promise<CallToolResult> {
		const existing = await this.loadDocumentOrThrow(args.id);
		const nextDocument = args.title ? { ...existing, title: args.title } : existing;

		try {
			await this.core.updateDocument(nextDocument, args.content);
			const refreshed = await this.core.getDocument(existing.id);
			if (!refreshed) {
				throw new McpError(`Document not found: ${args.id}`, "DOCUMENT_NOT_FOUND");
			}
			return await formatDocumentCallResult(refreshed, {
				summaryLines: ["Document updated successfully."],
			});
		} catch (error) {
			if (error instanceof Error) {
				throw new McpError(`Failed to update document: ${error.message}`, "OPERATION_FAILED");
			}
			throw new McpError("Failed to update document.", "OPERATION_FAILED");
		}
	}

	async searchDocuments(args: DocumentSearchArgs): Promise<CallToolResult> {
		const searchService = await this.core.getSearchService();
		const results = searchService.search({
			query: args.query,
			limit: args.limit,
			types: ["document"],
		});

		const documents = results.filter((result): result is DocumentSearchResult => result.type === "document");
		if (documents.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: `No documents found for "${args.query}".`,
					},
				],
			};
		}

		const lines: string[] = ["Documents:"];
		for (const result of documents) {
			const { document } = result;
			const scoreText = this.formatScore(result.score);
			lines.push(`  ${document.id} - ${document.title}${scoreText}`);
		}

		return {
			content: [
				{
					type: "text",
					text: lines.join("\n"),
				},
			],
		};
	}
}
