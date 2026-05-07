/* Status icon and color mappings for consistent UI display */

export interface StatusStyle {
	icon: string;
	color: string;
}

/**
 * Get the icon and color for a given status
 * @param status - The task status
 * @returns The icon and color for the status
 */
export function getStatusStyle(status: string, blockedStatuses?: string[]): StatusStyle {
	if (blockedStatuses && blockedStatuses.length > 0) {
		if (blockedStatuses.some((bs) => bs.toLowerCase() === status.toLowerCase())) {
			return { icon: "●", color: "red" };
		}
	}

	const statusMap: Record<string, StatusStyle> = {
		Done: { icon: "✔", color: "green" },
		"In Progress": { icon: "◒", color: "yellow" },
		Blocked: { icon: "●", color: "red" },
		"To Do": { icon: "○", color: "white" },
		Review: { icon: "◆", color: "blue" },
		Testing: { icon: "▣", color: "cyan" },
	};

	if (status.toLowerCase().includes("blocked")) {
		return { icon: "●", color: "red" };
	}

	return statusMap[status] || { icon: "○", color: "white" };
}

/**
 * Get just the color for a status (for backward compatibility)
 * @param status - The task status
 * @returns The color for the status
 */
export function getStatusColor(status: string, blockedStatuses?: string[]): string {
	return getStatusStyle(status, blockedStatuses).color;
}

/**
 * Get just the icon for a status
 * @param status - The task status
 * @returns The icon for the status
 */
export function getStatusIcon(status: string, blockedStatuses?: string[]): string {
	return getStatusStyle(status, blockedStatuses).icon;
}

/**
 * Format a status with its icon
 * @param status - The task status
 * @returns The formatted status string with icon
 */
export function formatStatusWithIcon(status: string, blockedStatuses?: string[]): string {
	const style = getStatusStyle(status, blockedStatuses);
	return `${style.icon} ${status}`;
}
