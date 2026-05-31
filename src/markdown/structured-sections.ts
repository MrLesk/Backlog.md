import type { AcceptanceCriterion, TaskComment } from "../types/index.ts";
import { getStructuredSectionTitles } from "./section-titles.ts";

export type StructuredSectionKey = "description" | "implementationPlan" | "implementationNotes" | "finalSummary";

export const STRUCTURED_SECTION_KEYS: Record<StructuredSectionKey, StructuredSectionKey> = {
	description: "description",
	implementationPlan: "implementationPlan",
	implementationNotes: "implementationNotes",
	finalSummary: "finalSummary",
};

interface SectionConfig {
	title: string;
	markerId: string;
}

const SECTION_CONFIG: Record<StructuredSectionKey, SectionConfig> = {
	description: { title: "Description", markerId: "DESCRIPTION" },
	implementationPlan: { title: "Implementation Plan", markerId: "PLAN" },
	implementationNotes: { title: "Implementation Notes", markerId: "NOTES" },
	finalSummary: { title: "Final Summary", markerId: "FINAL_SUMMARY" },
};

const SECTION_INSERTION_ORDER: StructuredSectionKey[] = [
	"description",
	"implementationPlan",
	"implementationNotes",
	"finalSummary",
];

const ACCEPTANCE_CRITERIA_SECTION_HEADER = "## Acceptance Criteria";
const ACCEPTANCE_CRITERIA_TITLE = ACCEPTANCE_CRITERIA_SECTION_HEADER.replace(/^##\s*/, "");
const DEFINITION_OF_DONE_SECTION_HEADER = "## Definition of Done";
const DEFINITION_OF_DONE_TITLE = DEFINITION_OF_DONE_SECTION_HEADER.replace(/^##\s*/, "");
const COMMENTS_SECTION_HEADER = "## Comments";
const COMMENTS_TITLE = COMMENTS_SECTION_HEADER.replace(/^##\s*/, "");
const ACCEPTANCE_CRITERIA_BEGIN_MARKER = "<!-- AC:BEGIN -->";
const ACCEPTANCE_CRITERIA_END_MARKER = "<!-- AC:END -->";
const DEFINITION_OF_DONE_BEGIN_MARKER = "<!-- DOD:BEGIN -->";
const DEFINITION_OF_DONE_END_MARKER = "<!-- DOD:END -->";
const COMMENTS_BEGIN_MARKER = "<!-- COMMENTS:BEGIN -->";
const COMMENTS_END_MARKER = "<!-- COMMENTS:END -->";
const COMMENT_BEGIN_MARKER = "<!-- COMMENT:BEGIN -->";
const COMMENT_END_MARKER = "<!-- COMMENT:END -->";
const KNOWN_SECTION_TITLES = new Set<string>([
	...getStructuredSectionTitles(),
	ACCEPTANCE_CRITERIA_TITLE,
	"Acceptance Criteria (Optional)",
]);

interface ChecklistSectionDefinition {
	sectionHeader: string;
	title: string;
	beginMarker: string;
	endMarker: string;
}

const ACCEPTANCE_CRITERIA_DEFINITION: ChecklistSectionDefinition = {
	sectionHeader: ACCEPTANCE_CRITERIA_SECTION_HEADER,
	title: ACCEPTANCE_CRITERIA_TITLE,
	beginMarker: ACCEPTANCE_CRITERIA_BEGIN_MARKER,
	endMarker: ACCEPTANCE_CRITERIA_END_MARKER,
};

const DEFINITION_OF_DONE_DEFINITION: ChecklistSectionDefinition = {
	sectionHeader: DEFINITION_OF_DONE_SECTION_HEADER,
	title: DEFINITION_OF_DONE_TITLE,
	beginMarker: DEFINITION_OF_DONE_BEGIN_MARKER,
	endMarker: DEFINITION_OF_DONE_END_MARKER,
};

function normalizeToLF(content: string): { text: string; useCRLF: boolean } {
	const useCRLF = /\r\n/.test(content);
	return { text: content.replace(/\r\n/g, "\n"), useCRLF };
}

function restoreLineEndings(text: string, useCRLF: boolean): string {
	return useCRLF ? text.replace(/\n/g, "\r\n") : text;
}

function escapeForRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getConfig(key: StructuredSectionKey): SectionConfig {
	return SECTION_CONFIG[key];
}

function getBeginMarker(key: StructuredSectionKey): string {
	return `<!-- SECTION:${getConfig(key).markerId}:BEGIN -->`;
}

function getEndMarker(key: StructuredSectionKey): string {
	return `<!-- SECTION:${getConfig(key).markerId}:END -->`;
}

function buildSectionBlock(key: StructuredSectionKey, body: string): string {
	const { title } = getConfig(key);
	const begin = getBeginMarker(key);
	const end = getEndMarker(key);
	const normalized = body.replace(/\r\n/g, "\n").replace(/\s+$/g, "");
	const content = normalized ? `${normalized}\n` : "";
	return `## ${title}\n\n${begin}\n${content}${end}`;
}

function structuredSectionLookahead(currentTitle: string): string {
	const otherTitles = Array.from(KNOWN_SECTION_TITLES).filter(
		(title) => title.toLowerCase() !== currentTitle.toLowerCase(),
	);
	if (otherTitles.length === 0) return "(?=\\n*$)";
	const pattern = otherTitles.map((title) => escapeForRegex(title)).join("|");
	return `(?=\\n+## (?:${pattern})(?:\\s|$)|\\n*$)`;
}

function sectionHeaderRegex(key: StructuredSectionKey): RegExp {
	const { title } = getConfig(key);
	return new RegExp(`## ${escapeForRegex(title)}\\s*\\n([\\s\\S]*?)${structuredSectionLookahead(title)}`, "i");
}

function checklistSentinelRegex(definition: ChecklistSectionDefinition, flags = "i"): RegExp {
	const header = escapeForRegex(definition.sectionHeader);
	const begin = escapeForRegex(definition.beginMarker);
	const end = escapeForRegex(definition.endMarker);
	return new RegExp(`(\\n|^)${header}\\s*\\n${begin}\\s*\\n([\\s\\S]*?)${end}`, flags);
}

function checklistLegacyRegex(definition: ChecklistSectionDefinition, flags: string): RegExp {
	return new RegExp(
		`(\\n|^)${escapeForRegex(definition.sectionHeader)}\\s*\\n([\\s\\S]*?)${structuredSectionLookahead(definition.title)}`,
		flags,
	);
}

function commentsSentinelRegex(flags = "i"): RegExp {
	const header = escapeForRegex(COMMENTS_SECTION_HEADER);
	const begin = escapeForRegex(COMMENTS_BEGIN_MARKER);
	const end = escapeForRegex(COMMENTS_END_MARKER);
	return new RegExp(`(\\n|^)${header}\\s*\\n${begin}\\s*\\n([\\s\\S]*?)${end}`, flags);
}

function commentsLegacyRegex(flags: string): RegExp {
	return new RegExp(
		`(\\n|^)${escapeForRegex(COMMENTS_SECTION_HEADER)}\\s*\\n(?!${escapeForRegex(COMMENTS_BEGIN_MARKER)})([\\s\\S]*?)(?=\\n+##\\s+|\\n*$)`,
		flags,
	);
}

function acceptanceCriteriaSentinelRegex(flags = "i"): RegExp {
	return checklistSentinelRegex(ACCEPTANCE_CRITERIA_DEFINITION, flags);
}

function legacySectionRegex(title: string, flags: string): RegExp {
	return new RegExp(`(\\n|^)## ${escapeForRegex(title)}\\s*\\n([\\s\\S]*?)${structuredSectionLookahead(title)}`, flags);
}

function findSectionEndIndex(content: string, title: string): number | undefined {
	const normalizedTitle = title.trim();
	let sentinelMatch: RegExpExecArray | null = null;
	if (normalizedTitle.toLowerCase() === ACCEPTANCE_CRITERIA_TITLE.toLowerCase()) {
		sentinelMatch = acceptanceCriteriaSentinelRegex().exec(content);
	} else if (normalizedTitle.toLowerCase() === DEFINITION_OF_DONE_TITLE.toLowerCase()) {
		sentinelMatch = checklistSentinelRegex(DEFINITION_OF_DONE_DEFINITION).exec(content);
	} else if (normalizedTitle.toLowerCase() === COMMENTS_TITLE.toLowerCase()) {
		sentinelMatch = commentsSentinelRegex().exec(content);
	} else {
		const keyEntry = Object.entries(SECTION_CONFIG).find(
			([, config]) => config.title.toLowerCase() === normalizedTitle.toLowerCase(),
		);
		if (keyEntry) {
			const key = keyEntry[0] as StructuredSectionKey;
			sentinelMatch = new RegExp(
				`## ${escapeForRegex(getConfig(key).title)}\\s*\\n${escapeForRegex(getBeginMarker(key))}\\s*\\n([\\s\\S]*?)${escapeForRegex(getEndMarker(key))}`,
				"i",
			).exec(content);
		}
	}

	if (sentinelMatch) {
		return sentinelMatch.index + sentinelMatch[0].length;
	}

	const legacyMatch =
		normalizedTitle.toLowerCase() === DEFINITION_OF_DONE_TITLE.toLowerCase()
			? checklistLegacyRegex(DEFINITION_OF_DONE_DEFINITION, "i").exec(content)
			: normalizedTitle.toLowerCase() === COMMENTS_TITLE.toLowerCase()
				? commentsLegacyRegex("i").exec(content)
				: legacySectionRegex(normalizedTitle, "i").exec(content);
	if (legacyMatch) {
		return legacyMatch.index + legacyMatch[0].length;
	}
	return undefined;
}

function findSectionStartIndex(content: string, title: string): number | undefined {
	const normalizedTitle = title.trim();
	let sentinelMatch: RegExpExecArray | null = null;
	if (normalizedTitle.toLowerCase() === ACCEPTANCE_CRITERIA_TITLE.toLowerCase()) {
		sentinelMatch = acceptanceCriteriaSentinelRegex().exec(content);
	} else if (normalizedTitle.toLowerCase() === DEFINITION_OF_DONE_TITLE.toLowerCase()) {
		sentinelMatch = checklistSentinelRegex(DEFINITION_OF_DONE_DEFINITION).exec(content);
	} else if (normalizedTitle.toLowerCase() === COMMENTS_TITLE.toLowerCase()) {
		sentinelMatch = commentsSentinelRegex().exec(content);
	} else {
		const keyEntry = Object.entries(SECTION_CONFIG).find(
			([, config]) => config.title.toLowerCase() === normalizedTitle.toLowerCase(),
		);
		if (keyEntry) {
			const key = keyEntry[0] as StructuredSectionKey;
			sentinelMatch = new RegExp(
				`(\\n|^)## ${escapeForRegex(getConfig(key).title)}\\s*\\n${escapeForRegex(getBeginMarker(key))}\\s*\\n([\\s\\S]*?)${escapeForRegex(getEndMarker(key))}`,
				"i",
			).exec(content);
		}
	}

	if (sentinelMatch) {
		return sentinelMatch.index;
	}

	const legacyMatch =
		normalizedTitle.toLowerCase() === DEFINITION_OF_DONE_TITLE.toLowerCase()
			? checklistLegacyRegex(DEFINITION_OF_DONE_DEFINITION, "i").exec(content)
			: normalizedTitle.toLowerCase() === COMMENTS_TITLE.toLowerCase()
				? commentsLegacyRegex("i").exec(content)
				: legacySectionRegex(normalizedTitle, "i").exec(content);
	return legacyMatch?.index;
}

function sentinelBlockRegex(key: StructuredSectionKey): RegExp {
	const { title } = getConfig(key);
	const begin = escapeForRegex(getBeginMarker(key));
	const end = escapeForRegex(getEndMarker(key));
	return new RegExp(`## ${escapeForRegex(title)}\\s*\\n${begin}\\s*\\n([\\s\\S]*?)${end}`, "i");
}

interface SectionRange {
	key: StructuredSectionKey;
	start: number;
	end: number;
	kind: "sentinel" | "legacy";
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
	return aStart < bEnd && bStart < aEnd;
}

function isIndexWithinRanges(index: number, ranges: SectionRange[]): boolean {
	return ranges.some((range) => index >= range.start && index < range.end);
}

function findMatchOutsideRanges(regex: RegExp, content: string, ranges: SectionRange[]): RegExpExecArray | undefined {
	const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
	const globalRegex = new RegExp(regex.source, flags);
	for (const match of content.matchAll(globalRegex)) {
		const index = match.index ?? 0;
		if (!isIndexWithinRanges(index, ranges)) return match;
	}
	return undefined;
}

function getStructuredSectionRanges(content: string): SectionRange[] {
	const ranges: SectionRange[] = [];
	for (const key of SECTION_INSERTION_ORDER) {
		const sentinelRegex = new RegExp(sentinelBlockRegex(key).source, "gi");
		for (const match of content.matchAll(sentinelRegex)) {
			const index = match.index ?? 0;
			ranges.push({ key, start: index, end: index + match[0].length, kind: "sentinel" });
		}

		const legacyRegex = legacySectionRegex(getConfig(key).title, "gi");
		for (const match of content.matchAll(legacyRegex)) {
			const index = match.index ?? 0;
			const end = index + match[0].length;
			if (ranges.some((range) => rangesOverlap(range.start, range.end, index, end))) continue;
			ranges.push({ key, start: index, end, kind: "legacy" });
		}
	}
	return ranges;
}

function stripSectionInstances(content: string, key: StructuredSectionKey): string {
	const beginEsc = escapeForRegex(getBeginMarker(key));
	const endEsc = escapeForRegex(getEndMarker(key));
	const { title } = getConfig(key);

	let stripped = content;
	const sentinelRegex = new RegExp(
		`(\n|^)## ${escapeForRegex(title)}\\s*\\n${beginEsc}\\s*\\n([\\s\\S]*?)${endEsc}(?:\\s*\n|$)`,
		"gi",
	);
	stripped = stripped.replace(sentinelRegex, "\n");

	const legacyRegex = legacySectionRegex(title, "gi");
	stripped = stripped.replace(legacyRegex, "\n");

	return stripped.replace(/\n{3,}/g, "\n\n").trimEnd();
}

function insertAfterSection(content: string, title: string, block: string): { inserted: boolean; content: string } {
	if (!block.trim()) return { inserted: false, content };
	const insertPos = findSectionEndIndex(content, title);
	if (insertPos === undefined) return { inserted: false, content };
	const before = content.slice(0, insertPos).trimEnd();
	const after = content.slice(insertPos).replace(/^\s+/, "");
	const newContent = `${before}${before ? "\n\n" : ""}${block}${after ? `\n\n${after}` : ""}`;
	return { inserted: true, content: newContent };
}

function insertBeforeSection(content: string, title: string, block: string): { inserted: boolean; content: string } {
	if (!block.trim()) return { inserted: false, content };
	const insertPos = findSectionStartIndex(content, title);
	if (insertPos === undefined) return { inserted: false, content };
	const before = content.slice(0, insertPos).trimEnd();
	const after = content.slice(insertPos).replace(/^\s+/, "");
	const newContent = `${before}${before ? "\n\n" : ""}${block}${after ? `\n\n${after}` : ""}`;
	return { inserted: true, content: newContent };
}

function insertAtStart(content: string, block: string): string {
	const trimmedBlock = block.trim();
	if (!trimmedBlock) return content;
	const trimmedContent = content.trim();
	if (!trimmedContent) return trimmedBlock;
	return `${trimmedBlock}\n\n${trimmedContent}`;
}

function appendBlock(content: string, block: string): string {
	const trimmedBlock = block.trim();
	if (!trimmedBlock) return content;
	const trimmedContent = content.trim();
	if (!trimmedContent) return trimmedBlock;
	return `${trimmedContent}\n\n${trimmedBlock}`;
}

export function extractStructuredSection(content: string, key: StructuredSectionKey): string | undefined {
	const src = content.replace(/\r\n/g, "\n");
	const otherRanges = getStructuredSectionRanges(src).filter((range) => range.key !== key);
	const sentinelMatch = findMatchOutsideRanges(sentinelBlockRegex(key), src, otherRanges);
	if (sentinelMatch?.[1]) {
		return sentinelMatch[1].trim() || undefined;
	}
	const legacyMatch = findMatchOutsideRanges(sectionHeaderRegex(key), src, otherRanges);
	return legacyMatch?.[1]?.trim() || undefined;
}

export interface StructuredSectionValues {
	description?: string;
	implementationPlan?: string;
	implementationNotes?: string;
	finalSummary?: string;
}

interface SectionValues extends StructuredSectionValues {}

export function updateStructuredSections(content: string, sections: SectionValues): string {
	const { text: src, useCRLF } = normalizeToLF(content);

	let working = src;
	for (const key of SECTION_INSERTION_ORDER) {
		working = stripSectionInstances(working, key);
	}
	working = working.trim();

	const description = sections.description?.trim() || "";
	const plan = sections.implementationPlan?.trim() || "";
	const notes = sections.implementationNotes?.trim() || "";
	const finalSummary = sections.finalSummary?.trim() || "";

	let tail = working;

	if (plan) {
		const planBlock = buildSectionBlock("implementationPlan", plan);
		let res = insertAfterSection(tail, ACCEPTANCE_CRITERIA_TITLE, planBlock);
		if (!res.inserted) {
			res = insertAfterSection(tail, getConfig("description").title, planBlock);
		}
		if (!res.inserted) {
			tail = insertAtStart(tail, planBlock);
		} else {
			tail = res.content;
		}
	}

	if (notes) {
		const notesBlock = buildSectionBlock("implementationNotes", notes);
		let res = insertAfterSection(tail, getConfig("implementationPlan").title, notesBlock);
		if (!res.inserted) {
			res = insertAfterSection(tail, ACCEPTANCE_CRITERIA_TITLE, notesBlock);
		}
		if (!res.inserted) {
			res = insertBeforeSection(tail, COMMENTS_TITLE, notesBlock);
		}
		if (!res.inserted) {
			res = insertBeforeSection(tail, getConfig("finalSummary").title, notesBlock);
		}
		if (!res.inserted) {
			tail = appendBlock(tail, notesBlock);
		} else {
			tail = res.content;
		}
	}

	if (finalSummary) {
		const finalBlock = buildSectionBlock("finalSummary", finalSummary);
		let res = insertAfterSection(tail, COMMENTS_TITLE, finalBlock);
		if (!res.inserted) {
			res = insertAfterSection(tail, getConfig("implementationNotes").title, finalBlock);
		}
		if (!res.inserted) {
			res = insertAfterSection(tail, getConfig("implementationPlan").title, finalBlock);
		}
		if (!res.inserted) {
			res = insertAfterSection(tail, ACCEPTANCE_CRITERIA_TITLE, finalBlock);
		}
		if (!res.inserted) {
			tail = appendBlock(tail, finalBlock);
		} else {
			tail = res.content;
		}
	}

	let output = tail;
	if (description) {
		const descriptionBlock = buildSectionBlock("description", description);
		output = insertAtStart(tail, descriptionBlock);
	}

	const finalOutput = output.replace(/\n{3,}/g, "\n\n").trim();
	return restoreLineEndings(finalOutput, useCRLF);
}

export function getStructuredSections(content: string): StructuredSectionValues {
	return {
		description: extractStructuredSection(content, "description") || undefined,
		implementationPlan: extractStructuredSection(content, "implementationPlan") || undefined,
		implementationNotes: extractStructuredSection(content, "implementationNotes") || undefined,
		finalSummary: extractStructuredSection(content, "finalSummary") || undefined,
	};
}

function extractExistingChecklistBody(
	content: string,
	definition: ChecklistSectionDefinition,
): { body: string; hasMarkers: boolean } | undefined {
	const src = content.replace(/\r\n/g, "\n");
	const sentinelMatch = checklistSentinelRegex(definition, "i").exec(src);
	if (sentinelMatch?.[2] !== undefined) {
		return { body: sentinelMatch[2], hasMarkers: true };
	}
	const legacyMatch = checklistLegacyRegex(definition, "i").exec(src);
	if (legacyMatch?.[2] !== undefined) {
		return { body: legacyMatch[2], hasMarkers: false };
	}
	return undefined;
}

function parseOldChecklistFormat(content: string, definition: ChecklistSectionDefinition): AcceptanceCriterion[] {
	const src = content.replace(/\r\n/g, "\n");
	const criteriaRegex = new RegExp(`${escapeForRegex(definition.sectionHeader)}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
	const match = src.match(criteriaRegex);
	if (!match?.[1]) {
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

function parseChecklist(content: string, definition: ChecklistSectionDefinition): AcceptanceCriterion[] {
	const src = content.replace(/\r\n/g, "\n");
	const beginIndex = src.indexOf(definition.beginMarker);
	const endIndex = src.indexOf(definition.endMarker);
	if (beginIndex === -1 || endIndex === -1) {
		return parseOldChecklistFormat(src, definition);
	}
	const checklistContent = src.substring(beginIndex + definition.beginMarker.length, endIndex);
	const lines = checklistContent.split("\n").filter((line) => line.trim());
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

function composeChecklistBody(criteria: AcceptanceCriterion[], existingBody?: string): string {
	const sorted = [...criteria].sort((a, b) => a.index - b.index);
	if (sorted.length === 0) {
		return "";
	}
	const queue = [...sorted];
	const lines: string[] = [];
	let nextNumber = 1;
	// trimEnd() removes trailing newlines from regex capture that would create empty sourceLines entries
	const sourceLines = existingBody ? existingBody.replace(/\r\n/g, "\n").trimEnd().split("\n") : [];

	if (sourceLines.length > 0) {
		for (const line of sourceLines) {
			const trimmed = line.trim();
			const checkboxMatch = trimmed.match(/^- \[([ x])\] (?:#\d+ )?(.*)$/);
			if (checkboxMatch) {
				const criterion = queue.shift();
				if (!criterion) {
					// Skip stale checklist entries when there are fewer criteria now
					continue;
				}
				const newLine = `- [${criterion.checked ? "x" : " "}] #${nextNumber++} ${criterion.text}`;
				lines.push(newLine);
			} else {
				lines.push(line);
			}
		}
	}

	while (queue.length > 0) {
		const criterion = queue.shift();
		if (!criterion) continue;
		const lastLine = lines.length > 0 ? lines[lines.length - 1] : undefined;
		if (lastLine && lastLine.trim() !== "" && !lastLine.trim().startsWith("- [")) {
			lines.push("");
		}
		lines.push(`- [${criterion.checked ? "x" : " "}] #${nextNumber++} ${criterion.text}`);
	}

	while (lines.length > 0) {
		const tail = lines[lines.length - 1];
		if (!tail || tail.trim() === "") {
			lines.pop();
		} else {
			break;
		}
	}

	return lines.join("\n");
}

function formatChecklistSection(
	criteria: AcceptanceCriterion[],
	definition: ChecklistSectionDefinition,
	existingBody?: string,
): string {
	if (criteria.length === 0) {
		return "";
	}
	const body = composeChecklistBody(criteria, existingBody);
	const lines = [definition.sectionHeader, definition.beginMarker];
	if (body.trim() !== "") {
		lines.push(...body.split("\n"));
	}
	lines.push(definition.endMarker);
	return lines.join("\n");
}

function updateChecklistContent(
	content: string,
	criteria: AcceptanceCriterion[],
	definition: ChecklistSectionDefinition,
): string {
	// Normalize to LF while computing, preserve original EOL at return
	const useCRLF = /\r\n/.test(content);
	const src = content.replace(/\r\n/g, "\n");
	const existingBodyInfo = extractExistingChecklistBody(src, definition);
	const newSection = formatChecklistSection(criteria, definition, existingBodyInfo?.body);

	// Remove ALL existing checklist sections (legacy header blocks)
	const legacyBlockRegex = checklistLegacyRegex(definition, "gi");
	const matches = Array.from(src.matchAll(legacyBlockRegex));
	let insertionIndex: number | null = null;
	const firstMatch = matches[0];
	if (firstMatch && firstMatch.index !== undefined) {
		insertionIndex = firstMatch.index;
	}

	let stripped = src.replace(legacyBlockRegex, "").trimEnd();
	// Also remove any stray marker-only blocks (defensive)
	const markerBlockRegex = new RegExp(
		`${escapeForRegex(definition.beginMarker)}[\\s\\S]*?${escapeForRegex(definition.endMarker)}`,
		"gi",
	);
	stripped = stripped.replace(markerBlockRegex, "").trimEnd();

	if (!newSection) {
		// If criteria is empty, return stripped content (all checklist sections removed)
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

function parseAllChecklistItems(content: string, definition: ChecklistSectionDefinition): AcceptanceCriterion[] {
	const marked: AcceptanceCriterion[] = [];
	const legacy: AcceptanceCriterion[] = [];
	// Normalize to LF to make matching platform-agnostic
	const src = content.replace(/\r\n/g, "\n");
	// Find all checklist blocks (legacy header blocks)
	const blockRegex = checklistLegacyRegex(definition, "gi");
	let m: RegExpExecArray | null = blockRegex.exec(src);
	while (m !== null) {
		const block = m[2] || "";
		if (block.includes(definition.beginMarker) && block.includes(definition.endMarker)) {
			// Capture lines within each marked pair
			const markedBlockRegex = new RegExp(
				`${escapeForRegex(definition.beginMarker)}([\\s\\S]*?)${escapeForRegex(definition.endMarker)}`,
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

function normalizeCommentMetadata(value: string | undefined): string | undefined {
	const normalized = value?.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
	return normalized && normalized.length > 0 ? normalized : undefined;
}

function containsCommentMarker(value: string | undefined): boolean {
	return /<!--\s*COMMENTS?:/i.test(value ?? "");
}

function parseCommentBlock(block: string, fallbackIndex: number): TaskComment | undefined {
	const normalized = block.replace(/\r\n/g, "\n").trim();
	if (!normalized) return undefined;

	const separatorIndex = normalized.search(/\n\s*\n/);
	const metadataText = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : "";
	const body = separatorIndex >= 0 ? normalized.slice(separatorIndex).replace(/^\s+/, "").trim() : normalized;
	if (!body) return undefined;

	let index = fallbackIndex;
	let author: string | undefined;
	let createdDate = "";
	for (const line of metadataText.split("\n")) {
		const match = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
		if (!match?.[1]) continue;
		const key = match[1].toLowerCase();
		const value = match[2] ?? "";
		if (key === "index") {
			const parsed = Number.parseInt(value, 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				index = parsed;
			}
		} else if (key === "author") {
			author = normalizeCommentMetadata(value);
		} else if (key === "created") {
			createdDate = value.trim();
		}
	}

	return {
		index,
		body,
		createdDate,
		...(author && { author }),
	};
}

function parseComments(content: string): TaskComment[] {
	const src = content.replace(/\r\n/g, "\n");
	const sentinelMatch = findMatchOutsideRanges(commentsSentinelRegex("i"), src, getStructuredSectionRanges(src));
	const sectionBody = sentinelMatch?.[2];
	if (sectionBody === undefined) {
		return [];
	}

	const blockRegex = new RegExp(
		`${escapeForRegex(COMMENT_BEGIN_MARKER)}\\s*\\n([\\s\\S]*?)${escapeForRegex(COMMENT_END_MARKER)}`,
		"gi",
	);
	const comments: TaskComment[] = [];
	let match: RegExpExecArray | null = blockRegex.exec(sectionBody);
	while (match !== null) {
		const parsed = parseCommentBlock(match[1] ?? "", comments.length + 1);
		if (parsed) {
			comments.push(parsed);
		}
		match = blockRegex.exec(sectionBody);
	}

	return comments.map((comment, index) => ({
		...comment,
		index: Number.isFinite(comment.index) && comment.index > 0 ? comment.index : index + 1,
	}));
}

function formatCommentBlock(comment: TaskComment, fallbackIndex: number): string {
	const index = Number.isFinite(comment.index) && comment.index > 0 ? comment.index : fallbackIndex;
	const body = String(comment.body ?? "")
		.replace(/\r\n/g, "\n")
		.trim();
	if (containsCommentMarker(body)) {
		throw new Error("Comment body cannot contain Backlog comment markers.");
	}
	const lines = [COMMENT_BEGIN_MARKER, `index: ${index}`];
	const author = normalizeCommentMetadata(comment.author);
	if (author) {
		if (containsCommentMarker(author)) {
			throw new Error("Comment author cannot contain Backlog comment markers.");
		}
		lines.push(`author: ${author}`);
	}
	const createdDate = String(comment.createdDate ?? "").trim();
	if (containsCommentMarker(createdDate)) {
		throw new Error("Comment created date cannot contain Backlog comment markers.");
	}
	lines.push(`created: ${createdDate}`, "", body, COMMENT_END_MARKER);
	return lines.join("\n");
}

function formatCommentsSection(comments: TaskComment[]): string {
	const normalizedComments = comments
		.map((comment, index) => ({
			...comment,
			index: Number.isFinite(comment.index) && comment.index > 0 ? comment.index : index + 1,
			body: String(comment.body ?? "").trim(),
		}))
		.filter((comment) => comment.body.length > 0);
	if (normalizedComments.length === 0) {
		return "";
	}

	const lines = [COMMENTS_SECTION_HEADER, COMMENTS_BEGIN_MARKER];
	normalizedComments.forEach((comment, index) => {
		if (index > 0) {
			lines.push("");
		}
		lines.push(formatCommentBlock(comment, index + 1));
	});
	lines.push(COMMENTS_END_MARKER);
	return lines.join("\n");
}

function findCommentSectionRanges(content: string): Array<{ start: number; end: number }> {
	const protectedRanges = getStructuredSectionRanges(content);
	const ranges: Array<{ start: number; end: number }> = [];
	const collectRanges = (regex: RegExp) => {
		for (const match of content.matchAll(regex)) {
			const start = match.index ?? 0;
			const end = start + match[0].length;
			if (isIndexWithinRanges(start, protectedRanges)) continue;
			if (ranges.some((range) => rangesOverlap(range.start, range.end, start, end))) continue;
			ranges.push({ start, end });
		}
	};

	collectRanges(commentsSentinelRegex("gi"));
	return ranges.sort((a, b) => b.start - a.start);
}

function stripCommentsSection(content: string): string {
	let stripped = content;
	for (const range of findCommentSectionRanges(content)) {
		stripped = `${stripped.slice(0, range.start)}\n${stripped.slice(range.end)}`;
	}
	return stripped.replace(/\n{3,}/g, "\n\n").trimEnd();
}

function updateCommentsContent(content: string, comments: TaskComment[]): string {
	const { text: src, useCRLF } = normalizeToLF(content);
	const stripped = stripCommentsSection(src).trim();
	const newSection = formatCommentsSection(comments);
	if (!newSection) {
		return restoreLineEndings(stripped, useCRLF);
	}

	let res = insertAfterSection(stripped, getConfig("implementationNotes").title, newSection);
	if (!res.inserted) {
		res = insertAfterSection(stripped, getConfig("implementationPlan").title, newSection);
	}
	if (!res.inserted) {
		res = insertBeforeSection(stripped, getConfig("finalSummary").title, newSection);
	}
	if (!res.inserted) {
		res = insertAfterSection(stripped, DEFINITION_OF_DONE_TITLE, newSection);
	}
	if (!res.inserted) {
		res = insertAfterSection(stripped, ACCEPTANCE_CRITERIA_TITLE, newSection);
	}
	if (!res.inserted) {
		res = insertAfterSection(stripped, getConfig("description").title, newSection);
	}
	const output = res.inserted ? res.content : appendBlock(stripped, newSection);
	return restoreLineEndings(output.replace(/\n{3,}/g, "\n\n").trim(), useCRLF);
}

/* biome-ignore lint/complexity/noStaticOnlyClass: Utility methods grouped for clarity */
export class CommentsManager {
	static readonly BEGIN_MARKER = COMMENTS_BEGIN_MARKER;
	static readonly END_MARKER = COMMENTS_END_MARKER;
	static readonly COMMENT_BEGIN_MARKER = COMMENT_BEGIN_MARKER;
	static readonly COMMENT_END_MARKER = COMMENT_END_MARKER;
	static readonly SECTION_HEADER = COMMENTS_SECTION_HEADER;

	static parseAllComments(content: string): TaskComment[] {
		return parseComments(content);
	}

	static updateContent(content: string, comments: TaskComment[]): string {
		return updateCommentsContent(content, comments);
	}
}

/* biome-ignore lint/complexity/noStaticOnlyClass: Utility methods grouped for clarity */
export class AcceptanceCriteriaManager {
	static readonly BEGIN_MARKER = ACCEPTANCE_CRITERIA_BEGIN_MARKER;
	static readonly END_MARKER = ACCEPTANCE_CRITERIA_END_MARKER;
	static readonly SECTION_HEADER = ACCEPTANCE_CRITERIA_SECTION_HEADER;

	static parseAcceptanceCriteria(content: string): AcceptanceCriterion[] {
		return parseChecklist(content, ACCEPTANCE_CRITERIA_DEFINITION);
	}

	static formatAcceptanceCriteria(criteria: AcceptanceCriterion[], existingBody?: string): string {
		return formatChecklistSection(criteria, ACCEPTANCE_CRITERIA_DEFINITION, existingBody);
	}

	static updateContent(content: string, criteria: AcceptanceCriterion[]): string {
		return updateChecklistContent(content, criteria, ACCEPTANCE_CRITERIA_DEFINITION);
	}

	static parseAllCriteria(content: string): AcceptanceCriterion[] {
		const list = parseAllChecklistItems(content, ACCEPTANCE_CRITERIA_DEFINITION);
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

/* biome-ignore lint/complexity/noStaticOnlyClass: Utility methods grouped for clarity */
export class DefinitionOfDoneManager {
	static readonly BEGIN_MARKER = DEFINITION_OF_DONE_BEGIN_MARKER;
	static readonly END_MARKER = DEFINITION_OF_DONE_END_MARKER;
	static readonly SECTION_HEADER = DEFINITION_OF_DONE_SECTION_HEADER;

	static parseDefinitionOfDone(content: string): AcceptanceCriterion[] {
		return parseChecklist(content, DEFINITION_OF_DONE_DEFINITION);
	}

	static formatDefinitionOfDone(criteria: AcceptanceCriterion[], existingBody?: string): string {
		return formatChecklistSection(criteria, DEFINITION_OF_DONE_DEFINITION, existingBody);
	}

	static updateContent(content: string, criteria: AcceptanceCriterion[]): string {
		return updateChecklistContent(content, criteria, DEFINITION_OF_DONE_DEFINITION);
	}

	static parseAllCriteria(content: string): AcceptanceCriterion[] {
		const list = parseAllChecklistItems(content, DEFINITION_OF_DONE_DEFINITION);
		return list.map((c, i) => ({ ...c, index: i + 1 }));
	}

	static addCriteria(content: string, newCriteria: string[]): string {
		const existing = DefinitionOfDoneManager.parseAllCriteria(content);
		let nextIndex = existing.length > 0 ? Math.max(...existing.map((c) => c.index)) + 1 : 1;
		for (const text of newCriteria) {
			existing.push({ checked: false, text: text.trim(), index: nextIndex++ });
		}
		return DefinitionOfDoneManager.updateContent(content, existing);
	}

	static removeCriterionByIndex(content: string, index: number): string {
		const criteria = DefinitionOfDoneManager.parseAllCriteria(content);
		const filtered = criteria.filter((c) => c.index !== index);
		if (filtered.length === criteria.length) {
			throw new Error(`Definition of Done item #${index} not found`);
		}
		const renumbered = filtered.map((c, i) => ({ ...c, index: i + 1 }));
		return DefinitionOfDoneManager.updateContent(content, renumbered);
	}

	static checkCriterionByIndex(content: string, index: number, checked: boolean): string {
		const criteria = DefinitionOfDoneManager.parseAllCriteria(content);
		const criterion = criteria.find((c) => c.index === index);
		if (!criterion) {
			throw new Error(`Definition of Done item #${index} not found`);
		}
		criterion.checked = checked;
		return DefinitionOfDoneManager.updateContent(content, criteria);
	}

	static migrateToStableFormat(content: string): string {
		const criteria = DefinitionOfDoneManager.parseAllCriteria(content);
		if (criteria.length === 0) {
			return content;
		}
		if (
			content.includes(DefinitionOfDoneManager.BEGIN_MARKER) &&
			content.includes(DefinitionOfDoneManager.END_MARKER)
		) {
			return content;
		}
		return DefinitionOfDoneManager.updateContent(content, criteria);
	}
}
