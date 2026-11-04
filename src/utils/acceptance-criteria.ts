/** Validate before trimming so leading and trailing line breaks are rejected too. */
export function normalizeAcceptanceCriterionText(text: string): string {
	if (/[\r\n]/.test(text)) {
		throw new Error("Acceptance criteria must be a single line. Add separate criteria for separate items.");
	}
	return text.trim();
}
