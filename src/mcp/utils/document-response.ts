import type { Document } from "../../types/index.ts";
import type { CallToolResult } from "../types.ts";

function formatTags(tags?: string[]): string {
	if (!tags || tags.length === 0) {
		return "Tags: (none)";
	}
	return `Tags: ${tags.join(", ")}`;
}

function buildDocumentText(document: Document, options?: { includeContent?: boolean }): string {
	const lines: string[] = [
		`Document ${document.id} - ${document.title}`,
		`Type: ${document.type}`,
		`Created: ${document.createdDate}`,
	];

	if (document.updatedDate) {
		lines.push(`Updated: ${document.updatedDate}`);
	}

	lines.push(formatTags(document.tags));

	if (options?.includeContent !== false) {
		lines.push("");
		lines.push(document.rawContent && document.rawContent.trim().length > 0 ? document.rawContent : "(empty document)");
	}

	return lines.join("\n");
}

export async function formatDocumentCallResult(
	document: Document,
	options: { includeContent?: boolean; summaryLines?: string[] } = {},
): Promise<CallToolResult> {
	const summary = options.summaryLines?.filter((line) => line.trim().length > 0).join("\n");
	const documentText = buildDocumentText(document, { includeContent: options.includeContent });
	const text = summary ? `${summary}\n\n${documentText}` : documentText;

	return {
		content: [
			{
				type: "text",
				text,
			},
		],
	};
}
