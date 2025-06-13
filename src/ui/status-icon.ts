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
export function getStatusStyle(status: string): StatusStyle {
	const statusMap: Record<string, StatusStyle> = {
		Done: { icon: "✔", color: "green" },
		"In Progress": { icon: "◒", color: "yellow" },
		Blocked: { icon: "●", color: "red" },
		"To Do": { icon: "○", color: "white" },
		Review: { icon: "◆", color: "blue" },
		Testing: { icon: "▣", color: "cyan" },
	};

	// Return the mapped style or default for unknown statuses
	return statusMap[status] || { icon: "○", color: "white" };
}

/**
 * Get just the color for a status (for backward compatibility)
 * @param status - The task status
 * @returns The color for the status
 */
export function getStatusColor(status: string): string {
	return getStatusStyle(status).color;
}

/**
 * Get just the icon for a status
 * @param status - The task status
 * @returns The icon for the status
 */
export function getStatusIcon(status: string): string {
	return getStatusStyle(status).icon;
}

/**
 * Format a status with its icon
 * @param status - The task status
 * @returns The formatted status string with icon
 */
export function formatStatusWithIcon(status: string): string {
	const style = getStatusStyle(status);
	return `${style.icon} ${status}`;
}
