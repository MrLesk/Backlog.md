export function getTerminalStatus(statuses: readonly string[]): string | null {
	if (statuses.length === 0) return null;
	const terminalStatus = statuses[statuses.length - 1];
	return terminalStatus && terminalStatus.trim().length > 0 ? terminalStatus : null;
}

function normalizeStatusForComparison(status: string | null | undefined): string {
	return (status ?? "").trim().toLowerCase();
}

/** Group existing task records under the current spelling of their configured column. */
export function createStatusResolver(statuses: readonly string[]): (status: string) => string {
	const names = new Map(statuses.map((status) => [normalizeStatusForComparison(status), status]));
	return (status) => names.get(normalizeStatusForComparison(status)) ?? status;
}

export function isTerminalStatus(status: string | null | undefined, statuses: readonly string[]): boolean {
	const terminalStatus = getTerminalStatus(statuses);
	return (
		terminalStatus !== null && normalizeStatusForComparison(status) === normalizeStatusForComparison(terminalStatus)
	);
}
