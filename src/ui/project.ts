export function formatProjectBadge(project: string | null | undefined, configuredProjects?: string[]): string {
	const value = project?.trim();
	if (!value || !configuredProjects?.length) {
		return "";
	}
	return `{blue-fg}[${value}]{/}`;
}
