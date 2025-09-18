import type { AgentInstructionFile } from "../agent-instructions.ts";

export type AgentSelectionValue = AgentInstructionFile | "none";

export interface AgentSelectionInput {
	selected?: AgentSelectionValue[] | null;
	highlighted?: AgentSelectionValue | null;
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

export function processAgentSelection({ selected, highlighted }: AgentSelectionInput): AgentSelectionOutcome {
	const normalizedSelected = Array.isArray(selected) ? [...selected] : [];

	if (normalizedSelected.length === 0 && highlighted) {
		normalizedSelected.push(highlighted);
	}

	const ordered = uniqueOrder(normalizedSelected);
	const agentFiles = ordered.filter((value): value is AgentInstructionFile => value !== "none");

	if (agentFiles.length === 0) {
		return { files: [], needsRetry: true };
	}

	return { files: agentFiles, needsRetry: false };
}
