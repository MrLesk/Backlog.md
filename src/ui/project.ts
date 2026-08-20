export function formatProjectBadge(project: string | null | undefined): string {
	const value = project?.trim();
	return value ? `{blue-fg}[${value}]{/}` : "";
}
