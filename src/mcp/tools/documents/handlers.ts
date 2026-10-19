import { type ContentRecordChangeResult, describeContentRecordChange } from "../../../core/backlog.ts";
import type { Document, DocumentSearchResult } from "../../../types/index.ts";
import { documentNotFoundMessage } from "../../../utils/document-id.ts";
import { isAmbiguousIdError } from "../../../utils/entity-id.ts";
import { formatUtcDateForDisplay } from "../../../utils/utc-date-display.ts";
import { BacklogToolError, runCoreOperation } from "../../errors/mcp-errors.ts";
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
	type?: Document["type"];
	path?: string;
	tags?: string[];
};

export type DocumentUpdateArgs = {
	id: string;
	title?: string;
	content: string;
	type?: Document["type"];
	path?: string;
	tags?: string[];
};

export type DocumentSearchArgs = {
	query: string;
	limit?: number;
};

export class DocumentHandlers {
	constructor(private readonly core: McpServer) {}

	private formatDocumentSummaryLine(document: Document): string {
		const metadata: string[] = [
			`type: ${document.type}`,
			`path: ${document.path ?? "(unknown)"}`,
			`created: ${formatUtcDateForDisplay(document.createdDate, { appendUtcLabel: true })}`,
		];
		if (document.updatedDate) {
			metadata.push(`updated: ${formatUtcDateForDisplay(document.updatedDate, { appendUtcLabel: true })}`);
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
			throw new BacklogToolError(documentNotFoundMessage(id), "DOCUMENT_NOT_FOUND");
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

	/**
	 * Run a core operation that changes a document: create, update, archive, restore and delete all
	 * go through here. `runCoreOperation` reports a refusal, and a commit that failed after the
	 * change, in core's words. An ambiguous ID keeps its own error. Any other failure is reported as
	 * `<failure>: <reason>`.
	 */
	private async changeDocument<T>(failure: string, operation: () => Promise<T>): Promise<T> {
		try {
			return await runCoreOperation(operation);
		} catch (error) {
			if (error instanceof BacklogToolError || isAmbiguousIdError(error)) throw error;
			throw new BacklogToolError(
				error instanceof Error ? `${failure}: ${error.message}` : `${failure}.`,
				"OPERATION_FAILED",
			);
		}
	}

	async createDocument(args: DocumentCreateArgs): Promise<CallToolResult> {
		const document = await this.changeDocument("Failed to create document", () =>
			this.core.createDocumentFromInput({
				title: args.title,
				content: args.content,
				type: args.type,
				path: args.path,
				tags: args.tags,
			}),
		);
		return await formatDocumentCallResult(document, {
			summaryLines: ["Document created successfully."],
		});
	}

	async updateDocument(args: DocumentUpdateArgs): Promise<CallToolResult> {
		await this.loadDocumentOrThrow(args.id);

		const document = await this.changeDocument("Failed to update document", () =>
			this.core.updateDocumentFromInput({
				id: args.id,
				content: args.content,
				title: args.title,
				type: args.type,
				path: args.path,
				tags: args.tags,
			}),
		);
		return await formatDocumentCallResult(document, {
			summaryLines: ["Document updated successfully."],
		});
	}

	async archiveDocument(args: DocumentViewArgs): Promise<CallToolResult> {
		const result = await this.changeDocument("Failed to archive document", () =>
			this.core.archiveContentRecord("document", args.id),
		);
		return this.reportDocumentChange("archive", args.id, result);
	}

	async restoreDocument(args: DocumentViewArgs): Promise<CallToolResult> {
		const result = await this.changeDocument("Failed to restore document", () =>
			this.core.restoreContentRecord("document", args.id),
		);
		return this.reportDocumentChange("restore", args.id, result);
	}

	async deleteDocument(args: DocumentViewArgs): Promise<CallToolResult> {
		const result = await this.changeDocument("Failed to delete document", () =>
			this.core.deleteContentRecord("document", args.id),
		);
		return this.reportDocumentChange("delete", args.id, result);
	}

	/**
	 * What `document_archive`, `document_restore` and `document_delete` return: the lines core
	 * describes for the change, each closed with a period as the task tools do. `result` is null when
	 * no document claims the ID. MCP offers these operations for documents only.
	 */
	private reportDocumentChange(
		operation: "archive" | "restore" | "delete",
		id: string,
		result: ContentRecordChangeResult | null,
	): CallToolResult {
		if (!result) {
			throw new BacklogToolError(documentNotFoundMessage(id), "DOCUMENT_NOT_FOUND");
		}
		const lines = describeContentRecordChange("document", operation, result).map((line) => `${line}.`);
		return { content: [{ type: "text", text: lines.join("\n") }] };
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
			lines.push(`  ${document.id} - ${document.title} (${document.path ?? "(unknown)"})${scoreText}`);
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
