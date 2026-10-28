import { stripDecisionSectionMarkers } from "../markdown/structured-sections.ts";
import type { Decision } from "../types/index.ts";

/** Human-readable decision metadata followed by its full Markdown body. */
export function formatDecisionPlainText(decision: Decision): string {
	const lines = [
		`${decision.id} - ${decision.title}`,
		...(decision.archived ? ["Archived — read-only. Restore before editing."] : []),
		`Date: ${decision.date}`,
		`Status: ${decision.status}`,
	];
	if (decision.supersededBy) lines.push(`Superseded by: ${decision.supersededBy}`);
	if (decision.updatedDate) lines.push(`Updated: ${decision.updatedDate}`);
	return `${lines.join("\n")}\n\n${stripDecisionSectionMarkers(decision.rawContent)}`;
}
