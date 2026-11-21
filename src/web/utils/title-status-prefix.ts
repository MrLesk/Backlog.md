/**
 * Optional status-in-title convention. It is off by default; when off, titles are returned
 * untouched so no existing task or file name changes.
 */
export function withStatusPrefix(title: string, status: string, statuses: string[], enabled: boolean): string {
	if (!enabled) return title;
	const base = stripStatusPrefix(title, statuses);
	const marker = status.trim();
	return marker ? `[${marker}] ${base}` : base;
}

function stripStatusPrefix(title: string, statuses: string[]): string {
	const match = /^\[([^\]]+)\]\s*/.exec(title);
	const prefix = match?.[1]?.trim().toLowerCase();
	if (!match || !prefix) return title;
	// Only a configured status is ours to replace; a user's own [feature] marker stays intact.
	const isStatus = statuses.some((status) => status.trim().toLowerCase() === prefix);
	return isStatus ? title.slice(match[0].length) : title;
}
