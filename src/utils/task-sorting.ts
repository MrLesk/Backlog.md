/**
 * Parse a task ID into its numeric components for proper sorting.
 * Handles both simple IDs (task-5) and decimal IDs (task-5.2.1)
 */
export function parseTaskId(taskId: string): number[] {
	// Remove the "task-" prefix if present
	const numericPart = taskId.replace(/^task-/, "");

	// Split by dots to handle decimal task IDs like 5.2.1
	const parts = numericPart.split(".");

	// Convert each part to a number, defaulting to 0 if invalid
	return parts.map((part) => {
		const num = Number.parseInt(part, 10);
		return Number.isNaN(num) ? 0 : num;
	});
}

/**
 * Compare two task IDs numerically.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 *
 * Examples:
 * - task-2 comes before task-10
 * - task-2 comes before task-2.1
 * - task-2.1 comes before task-2.2
 * - task-2.2 comes before task-2.10
 */
export function compareTaskIds(a: string, b: string): number {
	const aParts = parseTaskId(a);
	const bParts = parseTaskId(b);

	// Compare each numeric part
	const maxLength = Math.max(aParts.length, bParts.length);

	for (let i = 0; i < maxLength; i++) {
		const aNum = aParts[i] ?? 0;
		const bNum = bParts[i] ?? 0;

		if (aNum !== bNum) {
			return aNum - bNum;
		}
	}

	// All parts are equal
	return 0;
}

/**
 * Sort an array of objects by their task ID property numerically.
 * Returns a new sorted array without mutating the original.
 */
export function sortByTaskId<T extends { id: string }>(items: T[]): T[] {
	return [...items].sort((a, b) => compareTaskIds(a.id, b.id));
}
