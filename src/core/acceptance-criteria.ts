import type { AcceptanceCriterion } from "../types/index.ts";

/* biome-ignore lint/complexity/noStaticOnlyClass: Utility methods grouped for clarity */
export class AcceptanceCriteriaManager {
	static readonly BEGIN_MARKER = "<!-- AC:BEGIN -->";
	static readonly END_MARKER = "<!-- AC:END -->";
	static readonly SECTION_HEADER = "## Acceptance Criteria";

	private static parseOldFormat(content: string): AcceptanceCriterion[] {
		const src = content.replace(/\r\n/g, "\n");
		const criteriaRegex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
		const match = src.match(criteriaRegex);
		if (!match || !match[1]) {
			return [];
		}
		const lines = match[1].split("\n").filter((line) => line.trim());
		const criteria: AcceptanceCriterion[] = [];
		let index = 1;
		for (const line of lines) {
			const checkboxMatch = line.match(/^- \[([ x])\] (.+)$/);
			if (checkboxMatch?.[1] && checkboxMatch?.[2]) {
				criteria.push({
					checked: checkboxMatch[1] === "x",
					text: checkboxMatch[2],
					index: index++,
				});
			}
		}
		return criteria;
	}

	static parseAcceptanceCriteria(content: string): AcceptanceCriterion[] {
		const src = content.replace(/\r\n/g, "\n");
		const beginIndex = src.indexOf(AcceptanceCriteriaManager.BEGIN_MARKER);
		const endIndex = src.indexOf(AcceptanceCriteriaManager.END_MARKER);
		if (beginIndex === -1 || endIndex === -1) {
			return AcceptanceCriteriaManager.parseOldFormat(src);
		}
		const acContent = src.substring(beginIndex + AcceptanceCriteriaManager.BEGIN_MARKER.length, endIndex);
		const lines = acContent.split("\n").filter((line) => line.trim());
		const criteria: AcceptanceCriterion[] = [];
		for (const line of lines) {
			const match = line.match(/^- \[([ x])\] #(\d+) (.+)$/);
			if (match?.[1] && match?.[2] && match?.[3]) {
				criteria.push({
					checked: match[1] === "x",
					text: match[3],
					index: Number.parseInt(match[2], 10),
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
		// Normalize to LF while computing, preserve original EOL at return
		const useCRLF = /\r\n/.test(content);
		const src = content.replace(/\r\n/g, "\n");
		const newSection = AcceptanceCriteriaManager.formatAcceptanceCriteria(criteria);

		// Remove ALL existing Acceptance Criteria sections (legacy header blocks)
		const legacyBlockRegex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/gi;
		const matches = Array.from(src.matchAll(legacyBlockRegex));
		let insertionIndex: number | null = null;
		const firstMatch = matches[0];
		if (firstMatch && firstMatch.index !== undefined) {
			insertionIndex = firstMatch.index;
		}

		let stripped = src.replace(legacyBlockRegex, "").trimEnd();
		// Also remove any stray marker-only blocks (defensive)
		const markerBlockRegex = new RegExp(
			`${AcceptanceCriteriaManager.BEGIN_MARKER.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}[\\s\\S]*?${AcceptanceCriteriaManager.END_MARKER.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`,
			"gi",
		);
		stripped = stripped.replace(markerBlockRegex, "").trimEnd();

		if (!newSection) {
			// If criteria is empty, return stripped content (all AC sections removed)
			return stripped;
		}

		// Insert the single consolidated section
		if (insertionIndex !== null) {
			const before = stripped.slice(0, insertionIndex).trimEnd();
			const after = stripped.slice(insertionIndex);
			const out = `${before}${before ? "\n\n" : ""}${newSection}${after ? `\n\n${after}` : ""}`;
			return useCRLF ? out.replace(/\n/g, "\r\n") : out;
		}

		// No existing section found: append at end
		{
			const out = `${stripped}${stripped ? "\n\n" : ""}${newSection}`;
			return useCRLF ? out.replace(/\n/g, "\r\n") : out;
		}
	}

	private static parseAllBlocks(content: string): AcceptanceCriterion[] {
		const marked: AcceptanceCriterion[] = [];
		const legacy: AcceptanceCriterion[] = [];
		// Normalize to LF to make matching platform-agnostic
		const src = content.replace(/\r\n/g, "\n");
		// Find all Acceptance Criteria blocks (legacy header blocks)
		const blockRegex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/gi;
		let m: RegExpExecArray | null = blockRegex.exec(src);
		while (m !== null) {
			const block = m[1] || "";
			if (
				block.includes(AcceptanceCriteriaManager.BEGIN_MARKER) &&
				block.includes(AcceptanceCriteriaManager.END_MARKER)
			) {
				// Capture lines within each marked pair
				const markedBlockRegex = new RegExp(
					`${AcceptanceCriteriaManager.BEGIN_MARKER.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}([\\s\\S]*?)${AcceptanceCriteriaManager.END_MARKER.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`,
					"gi",
				);
				let mm: RegExpExecArray | null = markedBlockRegex.exec(block);
				while (mm !== null) {
					const inside = mm[1] || "";
					const lineRegex = /^- \[([ x])\] (?:#\d+ )?(.+)$/gm;
					let lm: RegExpExecArray | null = lineRegex.exec(inside);
					while (lm !== null) {
						marked.push({ checked: lm[1] === "x", text: String(lm?.[2] ?? ""), index: marked.length + 1 });
						lm = lineRegex.exec(inside);
					}
					mm = markedBlockRegex.exec(block);
				}
			} else {
				// Legacy: parse checkbox lines without markers
				const lineRegex = /^- \[([ x])\] (.+)$/gm;
				let lm: RegExpExecArray | null = lineRegex.exec(block);
				while (lm !== null) {
					legacy.push({ checked: lm[1] === "x", text: String(lm?.[2] ?? ""), index: legacy.length + 1 });
					lm = lineRegex.exec(block);
				}
			}
			m = blockRegex.exec(src);
		}
		// Prefer marked content when present; otherwise fall back to legacy
		return marked.length > 0 ? marked : legacy;
	}

	/**
	 * Parse acceptance criteria from ALL sections (both legacy and marked),
	 * normalizing into a single ordered list.
	 */
	static parseAllCriteria(content: string): AcceptanceCriterion[] {
		const list = AcceptanceCriteriaManager.parseAllBlocks(content);
		return list.map((c, i) => ({ ...c, index: i + 1 }));
	}

	static addCriteria(content: string, newCriteria: string[]): string {
		const existing = AcceptanceCriteriaManager.parseAllCriteria(content);
		let nextIndex = existing.length > 0 ? Math.max(...existing.map((c) => c.index)) + 1 : 1;
		for (const text of newCriteria) {
			existing.push({ checked: false, text: text.trim(), index: nextIndex++ });
		}
		return AcceptanceCriteriaManager.updateContent(content, existing);
	}

	static removeCriterionByIndex(content: string, index: number): string {
		const criteria = AcceptanceCriteriaManager.parseAllCriteria(content);
		const filtered = criteria.filter((c) => c.index !== index);
		if (filtered.length === criteria.length) {
			throw new Error(`Acceptance criterion #${index} not found`);
		}
		const renumbered = filtered.map((c, i) => ({ ...c, index: i + 1 }));
		return AcceptanceCriteriaManager.updateContent(content, renumbered);
	}

	static checkCriterionByIndex(content: string, index: number, checked: boolean): string {
		const criteria = AcceptanceCriteriaManager.parseAllCriteria(content);
		const criterion = criteria.find((c) => c.index === index);
		if (!criterion) {
			throw new Error(`Acceptance criterion #${index} not found`);
		}
		criterion.checked = checked;
		return AcceptanceCriteriaManager.updateContent(content, criteria);
	}

	static migrateToStableFormat(content: string): string {
		const criteria = AcceptanceCriteriaManager.parseAllCriteria(content);
		if (criteria.length === 0) {
			return content;
		}
		if (
			content.includes(AcceptanceCriteriaManager.BEGIN_MARKER) &&
			content.includes(AcceptanceCriteriaManager.END_MARKER)
		) {
			return content;
		}
		return AcceptanceCriteriaManager.updateContent(content, criteria);
	}
}
