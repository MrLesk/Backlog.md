import type { Decision } from "../../types/index.ts";
import type { CallToolResult } from "../types.ts";

function formatTags(tags?: string[]): string {
	if (!tags || tags.length === 0) {
		return "Tags: (none)";
	}
	return `Tags: ${tags.join(", ")}`;
}

function buildDecisionText(decision: Decision, options?: { includeContent?: boolean }): string {
	const lines: string[] = [
		`Decision ${decision.id} - ${decision.title}`,
		`Status: ${decision.status}`,
		`Created: ${decision.date}`,
	];

	lines.push(formatTags(decision.tags));

	if (options?.includeContent !== false) {
		lines.push("");
		lines.push(decision.rawContent && decision.rawContent.trim().length > 0 ? decision.rawContent : "(empty decision)");
	}

	return lines.join("\n");
}

export async function formatDecisionCallResult(
	decision: Decision,
	options: { includeContent?: boolean; summaryLines?: string[] } = {},
): Promise<CallToolResult> {
	const summary = options.summaryLines?.filter((line) => line.trim().length > 0).join("\n");
	const decisionText = buildDecisionText(decision, { includeContent: options.includeContent });
	const text = summary ? `${summary}\n\n${decisionText}` : decisionText;

	return {
		content: [
			{
				type: "text",
				text,
			},
		],
	};
}
