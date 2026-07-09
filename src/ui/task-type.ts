export function formatTaskTypeBadge(taskType: string | null | undefined): string {
	const value = taskType?.trim();
	return value ? `{magenta-fg}[${value}]{/}` : "";
}
