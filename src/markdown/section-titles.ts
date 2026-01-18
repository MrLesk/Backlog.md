const BASE_SECTION_TITLES = [
	"Description",
	"Acceptance Criteria",
	"Definition of Done",
	"Implementation Plan",
	"Implementation Notes",
] as const;

const SECTION_TITLE_VARIANTS: Record<string, string[]> = {
	"Acceptance Criteria": ["Acceptance Criteria (Optional)"],
	"Implementation Plan": ["Implementation Plan (Optional)"],
	"Implementation Notes": ["Implementation Notes (Optional)", "Notes", "Notes & Comments (Optional)"],
};

export function getStructuredSectionTitles(): string[] {
	const titles = new Set<string>();
	for (const base of BASE_SECTION_TITLES) {
		titles.add(base);
		const variants = SECTION_TITLE_VARIANTS[base];
		if (variants) {
			for (const variant of variants) {
				titles.add(variant);
			}
		}
	}
	return Array.from(titles);
}

export function getBaseStructuredSectionTitles(): string[] {
	return Array.from(BASE_SECTION_TITLES);
}
