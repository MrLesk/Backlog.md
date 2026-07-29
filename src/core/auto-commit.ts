import type { GitCommitResult } from "../git/operations.ts";

export interface AutoCommitOptions {
	enabled?: boolean;
	forceNew?: boolean;
	results?: GitCommitResult[];
	onResult?: (result: GitCommitResult) => void;
}

export type AutoCommitInput = boolean | AutoCommitOptions;

export function createAutoCommitOptions(enabled?: boolean, forceNew = false): AutoCommitOptions {
	return { enabled, forceNew, results: [] };
}

export function recordAutoCommitResult(input: AutoCommitInput | undefined, result: GitCommitResult | null): void {
	if (!result || typeof input === "boolean" || !input?.results) return;
	input.results.push(result);
	input.onResult?.(result);
}

export function formatAutoCommitNotices(input: AutoCommitInput | undefined): string[] {
	if (typeof input === "boolean" || !input?.results) return [];
	return input.results.flatMap((result) =>
		result.amended && result.previousCommitId
			? [`Amended Backlog commit ${result.previousCommitId.slice(0, 12)} as ${result.commitId.slice(0, 12)}.`]
			: [],
	);
}

export function summarizeAutoCommitNotices(notices: readonly string[], maxLength = 1024): string | null {
	if (notices.length === 0) return null;
	const joined = notices.join(" ");
	if (joined.length <= maxLength) return joined;
	const lastNotice = notices.at(-1) ?? "";
	const summary = `${notices.length} Backlog automatic commit replacements. Last: ${lastNotice}`;
	return summary.length <= maxLength ? summary : `${summary.slice(0, Math.max(0, maxLength - 1))}…`;
}
