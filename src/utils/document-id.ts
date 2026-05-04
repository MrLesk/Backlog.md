import { DEFAULT_FILE_PREFIXES } from "../constants/index.ts";

function ensureDocumentPrefix(value: string): string {
	const trimmed = value.trim();
	const match = trimmed.match(/^doc-(.+)$/i);
	const body = match ? match[1] : trimmed;
	return `${DEFAULT_FILE_PREFIXES.DOC}${body}`;
}

function extractDocumentNumber(value: string): string | null {
	const trimmed = value.trim();
	const match = trimmed.match(/^(?:doc-)?0*([0-9]+)$/i);
	return match?.[1] ?? null;
}

export function normalizeDocumentId(id: string): string {
	return ensureDocumentPrefix(id);
}

export function documentIdsEqual(left: string, right: string): boolean {
	const leftNumber = extractDocumentNumber(left);
	const rightNumber = extractDocumentNumber(right);
	if (leftNumber !== null && rightNumber !== null) {
		return leftNumber === rightNumber;
	}
	return normalizeDocumentId(left).toLowerCase() === normalizeDocumentId(right).toLowerCase();
}

function ensureDecisionPrefix(value: string): string {
	const trimmed = value.trim();
	const match = trimmed.match(/^decision-(.+)$/i);
	const body = match ? match[1] : trimmed;
	return `${DEFAULT_FILE_PREFIXES.DECISION}${body}`;
}

export function extractDecisionNumber(value: string): string | null {
	const trimmed = value.trim();
	const match = trimmed.match(/^(?:decision-)?0*([0-9]+)$/i);
	return match?.[1] ?? null;
}

export function normalizeDecisionId(id: string): string {
	return ensureDecisionPrefix(id);
}

export function decisionIdsEqual(left: string, right: string): boolean {
	const leftNumber = extractDecisionNumber(left);
	const rightNumber = extractDecisionNumber(right);
	if (leftNumber !== null && rightNumber !== null) {
		return leftNumber === rightNumber;
	}
	return normalizeDecisionId(left).toLowerCase() === normalizeDecisionId(right).toLowerCase();
}
