/* Checklist alignment utilities for consistent checkbox display */

export interface ChecklistItem {
	text: string;
	checked: boolean;
}

/**
 * Regex patterns for detecting checkbox markdown
 */
export const CHECKBOX_PATTERNS = {
	// Matches "- [ ] text" or "- [x] text" with optional leading whitespace
	CHECKBOX_LINE: /^\s*-\s*\[([ x])\]\s*(.*)$/,
	// Matches just the checkbox part
	CHECKBOX_PREFIX: /^-\s*\[([ x])\]\s*/,
} as const;

/**
 * Parse a line to extract checkbox state and text
 */
export function parseCheckboxLine(line: string): ChecklistItem | null {
	const match = line.match(CHECKBOX_PATTERNS.CHECKBOX_LINE);
	if (!match) return null;

	const [, checkState, text] = match;
	return {
		text: text.trim(),
		checked: checkState === "x",
	};
}

/**
 * Format a checklist item with aligned checkbox display
 */
export function formatChecklistItem(
	item: ChecklistItem,
	options: {
		padding?: string;
		checkedSymbol?: string;
		uncheckedSymbol?: string;
	} = {},
): string {
	const { padding = " ", checkedSymbol = "[x]", uncheckedSymbol = "[ ]" } = options;

	const checkbox = item.checked ? checkedSymbol : uncheckedSymbol;
	return `${padding}${checkbox} ${item.text}`;
}

/**
 * Process acceptance criteria section and align checkboxes
 */
export function alignAcceptanceCriteria(criteriaSection: string): string[] {
	if (!criteriaSection) return [];

	return criteriaSection
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const item = parseCheckboxLine(line);
			if (item) {
				return formatChecklistItem(item);
			}
			// Return non-checkbox lines as-is with minimal padding
			return ` ${line}`;
		});
}

/**
 * Extract and format acceptance criteria from markdown content
 */
export function extractAndFormatAcceptanceCriteria(content: string): string[] {
	const criteriaSection = extractSection(content, "Acceptance Criteria");
	if (!criteriaSection) return [];

	return alignAcceptanceCriteria(criteriaSection);
}

/**
 * Extract a section from markdown content
 */
function extractSection(content: string, sectionTitle: string): string | undefined {
	const regex = new RegExp(`## ${sectionTitle}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
	const match = content.match(regex);
	return match?.[1]?.trim();
}

/**
 * Format multiple checklist items with consistent alignment
 */
export function formatChecklist(items: ChecklistItem[]): string[] {
	return items.map((item) => formatChecklistItem(item));
}

/**
 * Parse multiple checkbox lines from text
 */
export function parseCheckboxLines(text: string): ChecklistItem[] {
	return text
		.split("\n")
		.map((line) => parseCheckboxLine(line))
		.filter((item): item is ChecklistItem => item !== null);
}
