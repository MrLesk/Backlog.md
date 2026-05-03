export function getTerminalStatus(statuses: readonly string[]): string | null {
	if (statuses.length === 0) return null;
	const terminalStatus = statuses[statuses.length - 1];
	return terminalStatus && terminalStatus.trim().length > 0 ? terminalStatus : null;
}

function normalizeStatusForComparison(status: string | null | undefined): string {
	return (status ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export function isTerminalStatus(status: string | null | undefined, statuses: readonly string[]): boolean {
	const terminalStatus = getTerminalStatus(statuses);
	return (
		terminalStatus !== null && normalizeStatusForComparison(status) === normalizeStatusForComparison(terminalStatus)
	);
}
