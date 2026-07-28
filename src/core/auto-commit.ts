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
