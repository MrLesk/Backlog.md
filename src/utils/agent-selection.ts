import type { AgentInstructionFile } from "../agent-instructions.ts";

export const PLACEHOLDER_AGENT_VALUE = "__agent_selection_placeholder__" as const;

export type AgentSelectionValue = AgentInstructionFile | "none" | typeof PLACEHOLDER_AGENT_VALUE;

export interface AgentSelectionInput {
	selected?: AgentSelectionValue[] | null;
	highlighted?: AgentSelectionValue | null;
	useHighlightFallback?: boolean;
}

export interface AgentSelectionOutcome {
	files: AgentInstructionFile[];
	needsRetry: boolean;
}

function uniqueOrder(values: AgentSelectionValue[]): AgentSelectionValue[] {
	const seen = new Set<AgentSelectionValue>();
	const ordered: AgentSelectionValue[] = [];
	for (const value of values) {
		if (!value) continue;
		if (seen.has(value)) continue;
		seen.add(value);
		ordered.push(value);
	}
	return ordered;
}

export function processAgentSelection({
	selected,
	highlighted,
	useHighlightFallback,
}: AgentSelectionInput): AgentSelectionOutcome {
	const normalizedSelected = Array.isArray(selected) ? [...selected] : [];

	if (
		normalizedSelected.length === 0 &&
		highlighted &&
		highlighted !== "none" &&
		highlighted !== PLACEHOLDER_AGENT_VALUE &&
		useHighlightFallback
	) {
		normalizedSelected.push(highlighted);
	}

	const ordered = uniqueOrder(normalizedSelected);
	const agentFiles = ordered.filter(
		(value): value is AgentInstructionFile => value !== "none" && value !== PLACEHOLDER_AGENT_VALUE,
	);

	if (agentFiles.length === 0) {
		return { files: [], needsRetry: true };
	}

	return { files: agentFiles, needsRetry: false };
}
