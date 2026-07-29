import type { GitCommitResult } from "../git/operations.ts";

export interface AutoCommitOptions {
	enabled?: boolean;
	forceNew?: boolean;
	results?: GitCommitResult[];
	onResult?: (result: GitCommitResult) => void;
}

export type AutoCommitInput = boolean | AutoCommitOptions;

export const MAX_AUTO_COMMIT_RESULTS = 100;
const resultState = new WeakMap<GitCommitResult[], { amendedCount: number }>();

export function createAutoCommitOptions(enabled?: boolean, forceNew = false): AutoCommitOptions {
	return { enabled, forceNew, results: [] };
}

export function recordAutoCommitResult(input: AutoCommitInput | undefined, result: GitCommitResult | null): void {
	if (!result || typeof input === "boolean" || !input?.results) return;
	const state = resultState.get(input.results) ?? {
		amendedCount: input.results.filter((entry) => entry.amended && entry.previousCommitId).length,
	};
	if (result.amended && result.previousCommitId) state.amendedCount += 1;
	resultState.set(input.results, state);
	input.results.push(result);
	if (input.results.length > MAX_AUTO_COMMIT_RESULTS) {
		input.results.splice(0, input.results.length - MAX_AUTO_COMMIT_RESULTS);
	}
	input.onResult?.(result);
}

export function formatAutoCommitNotices(input: AutoCommitInput | undefined): string[] {
	if (typeof input === "boolean" || !input?.results) return [];
	const notices = input.results.flatMap((result) =>
		result.amended && result.previousCommitId
			? [`Amended Backlog commit ${result.previousCommitId.slice(0, 12)} as ${result.commitId.slice(0, 12)}.`]
			: [],
	);
	const omittedCount = Math.max(0, (resultState.get(input.results)?.amendedCount ?? notices.length) - notices.length);
	return omittedCount > 0
		? [`${omittedCount} earlier Backlog automatic commit replacements omitted.`, ...notices]
		: notices;
}

export function clearAutoCommitResults(input: AutoCommitInput | undefined): void {
	if (typeof input === "boolean" || !input?.results) return;
	input.results.splice(0);
	resultState.delete(input.results);
}

export function summarizeAutoCommitNotices(notices: readonly string[], maxLength = 1024): string | null {
	if (notices.length === 0) return null;
	const joined = notices.join(" ");
	if (joined.length <= maxLength) return joined;
	const omittedCount = Number.parseInt(
		notices[0]?.match(/^(\d+) earlier Backlog automatic commit replacements omitted\.$/)?.[1] ?? "0",
		10,
	);
	const retainedCount = notices.slice(omittedCount > 0 ? 1 : 0).length;
	const totalCount = omittedCount + retainedCount;
	const lastNotice = notices.at(-1) ?? "";
	const summary = `${totalCount.toLocaleString("en-US")} Backlog automatic commit replacements. Last: ${lastNotice}`;
	return summary.length <= maxLength ? summary : `${summary.slice(0, Math.max(0, maxLength - 1))}…`;
}
