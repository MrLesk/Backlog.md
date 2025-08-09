export interface AcceptanceCriterion {
	checked: boolean;
	text: string;
	index: number;
}

export class AcceptanceCriteriaManager {
	private static readonly BEGIN_MARKER = "<!-- AC:BEGIN -->";
	private static readonly END_MARKER = "<!-- AC:END -->";
	private static readonly SECTION_HEADER = "## Acceptance Criteria";

	static parseAcceptanceCriteria(content: string): AcceptanceCriterion[] {
		const beginIndex = content.indexOf(AcceptanceCriteriaManager.BEGIN_MARKER);
		const endIndex = content.indexOf(AcceptanceCriteriaManager.END_MARKER);

		if (beginIndex === -1 || endIndex === -1) {
			// Fallback to old format without markers
			return AcceptanceCriteriaManager.parseOldFormat(content);
		}

		const acContent = content.substring(beginIndex + AcceptanceCriteriaManager.BEGIN_MARKER.length, endIndex);
		const lines = acContent.split("\n").filter((line) => line.trim());

		const criteria: AcceptanceCriterion[] = [];
		for (const line of lines) {
			const match = line.match(/^- \[([ x])\] #(\d+) (.+)$/);
			if (match && match[1] && match[2] && match[3]) {
				criteria.push({
					checked: match[1] === "x",
					text: match[3],
					index: Number.parseInt(match[2], 10),
				});
			}
		}

		return criteria;
	}

	private static parseOldFormat(content: string): AcceptanceCriterion[] {
		const criteriaRegex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
		const match = content.match(criteriaRegex);

		if (!match || !match[1]) {
			return [];
		}

		const lines = match[1].split("\n").filter((line) => line.trim());
		const criteria: AcceptanceCriterion[] = [];
		let index = 1;

		for (const line of lines) {
			const checkboxMatch = line.match(/^- \[([ x])\] (.+)$/);
			if (checkboxMatch && checkboxMatch[1] && checkboxMatch[2]) {
				criteria.push({
					checked: checkboxMatch[1] === "x",
					text: checkboxMatch[2],
					index: index++,
				});
			}
		}

		return criteria;
	}

	static formatAcceptanceCriteria(criteria: AcceptanceCriterion[]): string {
		if (criteria.length === 0) {
			return "";
		}

		const lines = [AcceptanceCriteriaManager.SECTION_HEADER, AcceptanceCriteriaManager.BEGIN_MARKER];

		// Sort by index and renumber to ensure consistency
		const sorted = [...criteria].sort((a, b) => a.index - b.index);
		for (let i = 0; i < sorted.length; i++) {
			const criterion = sorted[i];
			if (criterion) {
				const checkbox = criterion.checked ? "x" : " ";
				lines.push(`- [${checkbox}] #${i + 1} ${criterion.text}`);
			}
		}

		lines.push(AcceptanceCriteriaManager.END_MARKER);
		return lines.join("\n");
	}

	static updateContent(content: string, criteria: AcceptanceCriterion[]): string {
		const beginIndex = content.indexOf(AcceptanceCriteriaManager.BEGIN_MARKER);
		const endIndex = content.indexOf(AcceptanceCriteriaManager.END_MARKER);

		const newSection = AcceptanceCriteriaManager.formatAcceptanceCriteria(criteria);

		if (beginIndex !== -1 && endIndex !== -1) {
			// Replace existing section with markers
			const before = content.substring(0, content.lastIndexOf(AcceptanceCriteriaManager.SECTION_HEADER, beginIndex));
			const after = content.substring(endIndex + AcceptanceCriteriaManager.END_MARKER.length);
			return before.trimEnd() + (newSection ? `\n\n${newSection}` : "") + after;
		}

		// Check for old format
		const criteriaRegex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
		const match = content.match(criteriaRegex);

		if (match) {
			// Replace old format with new format
			return content.replace(criteriaRegex, newSection);
		}

		// Add new section at the end
		return newSection ? `${content.trimEnd()}\n\n${newSection}` : content;
	}

	static addCriteria(content: string, newCriteria: string[]): string {
		const existing = AcceptanceCriteriaManager.parseAcceptanceCriteria(content);
		let nextIndex = existing.length > 0 ? Math.max(...existing.map((c) => c.index)) + 1 : 1;

		for (const text of newCriteria) {
			existing.push({
				checked: false,
				text: text.trim(),
				index: nextIndex++,
			});
		}

		return AcceptanceCriteriaManager.updateContent(content, existing);
	}

	static removeCriterionByIndex(content: string, index: number): string {
		const criteria = AcceptanceCriteriaManager.parseAcceptanceCriteria(content);
		const filtered = criteria.filter((c) => c.index !== index);

		if (filtered.length === criteria.length) {
			throw new Error(`Acceptance criterion #${index} not found`);
		}

		// Renumber remaining criteria
		const renumbered = filtered.map((c, i) => ({
			...c,
			index: i + 1,
		}));

		return AcceptanceCriteriaManager.updateContent(content, renumbered);
	}

	static checkCriterionByIndex(content: string, index: number, checked: boolean): string {
		const criteria = AcceptanceCriteriaManager.parseAcceptanceCriteria(content);
		const criterion = criteria.find((c) => c.index === index);

		if (!criterion) {
			throw new Error(`Acceptance criterion #${index} not found`);
		}

		criterion.checked = checked;
		return AcceptanceCriteriaManager.updateContent(content, criteria);
	}

	static migrateToStableFormat(content: string): string {
		const criteria = AcceptanceCriteriaManager.parseAcceptanceCriteria(content);
		if (criteria.length === 0) {
			return content;
		}

		// Check if already using stable format
		if (
			content.includes(AcceptanceCriteriaManager.BEGIN_MARKER) &&
			content.includes(AcceptanceCriteriaManager.END_MARKER)
		) {
			return content;
		}

		return AcceptanceCriteriaManager.updateContent(content, criteria);
	}
}
