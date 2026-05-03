export function getTerminalStatus(statuses: readonly string[]): string | null {
	if (statuses.length === 0) return null;
	const terminalStatus = statuses[statuses.length - 1];
	return terminalStatus && terminalStatus.trim().length > 0 ? terminalStatus : null;
}

export function isTerminalStatus(status: string | null | undefined, statuses: readonly string[]): boolean {
	const terminalStatus = getTerminalStatus(statuses);
	return terminalStatus !== null && status === terminalStatus;
}
