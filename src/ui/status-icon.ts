import { DEFAULT_STATUSES } from "../constants/index.ts";
import { isTerminalStatus } from "../utils/terminal-status.ts";

export interface StatusStyle {
	icon: string;
	color: string;
}

/**
 * Get the icon and color for a given status
 * @param status - The task status
 * @returns The icon and color for the status
 */
export function getStatusStyle(status: string, completed = isTerminalStatus(status, DEFAULT_STATUSES)): StatusStyle {
	if (completed) return { icon: "✔", color: "green" };
	const statusMap: Record<string, StatusStyle> = {
		"in progress": { icon: "◒", color: "yellow" },
		blocked: { icon: "●", color: "red" },
		"to do": { icon: "○", color: "default" },
		review: { icon: "◆", color: "blue" },
		testing: { icon: "▣", color: "cyan" },
	};

	// Return the mapped style or default for unknown statuses
	return statusMap[status.trim().toLowerCase()] || { icon: "○", color: "default" };
}

/**
 * Get just the icon for a status
 * @param status - The task status
 * @returns The icon for the status
 */
export function getStatusIcon(status: string, completed?: boolean): string {
	return getStatusStyle(status, completed).icon;
}

/**
 * Wrap text in blessed color tags. "default" emits {default-fg} (SGR 39 = terminal default).
 * Returns text as-is if color is empty.
 */
export function wrapStatusColor(text: string, color: string): string {
	return color ? `{${color}-fg}${text}{/}` : text;
}

/**
 * Format a status with its icon
 * @param status - The task status
 * @returns The formatted status string with icon
 */
export function formatStatusWithIcon(status: string, completed?: boolean): string {
	const style = getStatusStyle(status, completed);
	return `${style.icon} ${status}`;
}

export function formatColoredStatus(status: string, completed: boolean): string {
	const { icon, color } = getStatusStyle(status, completed);
	return wrapStatusColor(`${icon} ${status}`, color);
}
