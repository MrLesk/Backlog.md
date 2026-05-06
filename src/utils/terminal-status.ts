export function getTerminalStatus(
	statuses: readonly string[],
	terminalStatuses?: readonly string[] | null,
): string | null {
	if (terminalStatuses && terminalStatuses.length > 0) {
		const primary = terminalStatuses[0];
		return primary && primary.trim().length > 0 ? primary : null;
	}
	if (statuses.length === 0) return null;
	const terminalStatus = statuses[statuses.length - 1];
	return terminalStatus && terminalStatus.trim().length > 0 ? terminalStatus : null;
}

function normalizeStatusForComparison(status: string | null | undefined): string {
	return (status ?? "").trim().toLowerCase();
}

export function isTerminalStatus(
	status: string | null | undefined,
	statuses: readonly string[],
	terminalStatuses?: readonly string[] | null,
): boolean {
	if (terminalStatuses && terminalStatuses.length > 0) {
		const normalized = normalizeStatusForComparison(status);
		return terminalStatuses.some((ts) => normalizeStatusForComparison(ts) === normalized);
	}
	const terminalStatus = getTerminalStatus(statuses);
	return (
		terminalStatus !== null && normalizeStatusForComparison(status) === normalizeStatusForComparison(terminalStatus)
	);
}
