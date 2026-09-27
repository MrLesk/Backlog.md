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
const COMMENT_DELIMITER = "---";
const KNOWN_SECTION_TITLES = new Set<string>([
	...getStructuredSectionTitles(),
	ACCEPTANCE_CRITERIA_TITLE,
	"Acceptance Criteria (Optional)",
]);

interface ChecklistSectionDefinition {
	sectionHeader: string;
	title: string;
	markerId: string;
	beginMarker: string;
	endMarker: string;
}

const ACCEPTANCE_CRITERIA_DEFINITION: ChecklistSectionDefinition = {
	sectionHeader: ACCEPTANCE_CRITERIA_SECTION_HEADER,
	title: ACCEPTANCE_CRITERIA_TITLE,
	markerId: "AC",
	beginMarker: ACCEPTANCE_CRITERIA_BEGIN_MARKER,
	endMarker: ACCEPTANCE_CRITERIA_END_MARKER,
};

const DEFINITION_OF_DONE_DEFINITION: ChecklistSectionDefinition = {
	sectionHeader: DEFINITION_OF_DONE_SECTION_HEADER,
	title: DEFINITION_OF_DONE_TITLE,
	markerId: "DOD",
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

const FENCE_OPENING_REGEX = /^(`{3,}|~{3,})(.*)$/;
const SECTION_SENTINEL_LINE_REGEX = /^<!-- SECTION:[A-Z][A-Z0-9_]*:(BEGIN|END) -->$/;
const LIST_ITEM_MARKER_REGEX = /^( *)([-+*]|\d{1,9}[.)])(?:[\t ]+|$)/;
const HTML_BLOCK_TAG_NAMES =
	"address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
const HTML_TYPE1_OPENING_REGEX = /^ {0,3}<(script|pre|style|textarea)(?=[\t />]|$)/i;
const HTML_COMMENT_OPENING_REGEX = /^ {0,3}<!--/;
const HTML_COMMENT_END_REGEX = /--!?>/;
const HTML_PROCESSING_INSTRUCTION_OPENING_REGEX = /^ {0,3}<\?/;
const HTML_DECLARATION_OPENING_REGEX = /^ {0,3}<![a-zA-Z]/;
const HTML_CDATA_OPENING_REGEX = /^ {0,3}<!\[CDATA\[/;
const HTML_BLOCK_TAG_OPENING_REGEX = new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_TAG_NAMES})(?=[\t />]|$)`, "i");
const HTML_COMPLETE_TAG_LINE_REGEX = /^ {0,3}<\/?[a-zA-Z][a-zA-Z0-9-]*(?:[\t ][^<>]*)?\/?>[\t ]*$/;

interface FenceSpec {
	character: string;
	minLength: number;
}

interface HtmlBlockState {
	endRegex?: RegExp;
	endsOnBlankLine: boolean;
}

/**
 * Collapses runs of two or more blank lines to a single blank line in prose
 * and leaves every newline inside fences untouched. Fence tracking follows
 * CommonMark: ``` or ~~~ openers indented up to three spaces past the content
 * column of any enclosing list container, backtick openers whose info string
 * contains a backtick are prose, closings repeat the same character with at
 * least the opening length, and raw HTML blocks never open or close fences.
 * Marker-shaped lines inside an open fence stay fence content. Callers that
 * must keep unterminated fences from leaking across sections collapse each
 * section body independently.
 */
function collapseBlankLines(text: string): string {
	const lines: string[] = [];
	let pendingBlankLines = 0;
	let fence: FenceSpec | undefined;
	let htmlBlock: HtmlBlockState | undefined;
	const containerColumns: number[] = [];
	for (const line of text.split("\n")) {
		if (fence) {
			lines.push(line);
			if (closesFence(line, fence, containerColumns)) fence = undefined;
			continue;
		}
		if (SECTION_SENTINEL_LINE_REGEX.test(line)) {
			htmlBlock = undefined;
			containerColumns.length = 0;
		}
		if (line === "") {
			if (htmlBlock?.endsOnBlankLine) htmlBlock = undefined;
			pendingBlankLines += 1;
			continue;
		}
		if (pendingBlankLines > 0) {
			lines.push("");
			pendingBlankLines = 0;
		}
		lines.push(line);
		if (htmlBlock) {
			if (htmlBlock.endRegex?.test(line)) htmlBlock = undefined;
			continue;
		}
		updateListContainers(line, containerColumns);
		fence = matchFenceOpener(line, containerColumns);
		if (!fence) htmlBlock = matchHtmlBlockStart(line, containerColumns);
	}
	if (pendingBlankLines > 0) lines.push("");
	return lines.join("\n");
}

function leadingSpaceCount(line: string): number {
	let count = 0;
	while (line.charAt(count) === " ") count += 1;
	return count;
}

function listItemContentColumn(line: string): number | undefined {
	const match = LIST_ITEM_MARKER_REGEX.exec(line);
	if (!match) return undefined;
	const markerIndent = match[1]?.length ?? 0;
	const marker = String(match[2] ?? "");
	const trailingWhitespace = match[0].length - markerIndent - marker.length;
	return markerIndent + marker.length + trailingWhitespace;
}

function updateListContainers(line: string, containerColumns: number[]): void {
	while ((containerColumns.at(-1) ?? 0) > leadingSpaceCount(line)) containerColumns.pop();
	const column = listItemContentColumn(line);
	if (column === undefined) return;
	containerColumns.push(column);
}

function isWithinContainerIndent(indent: number, containerColumns: number[]): boolean {
	return indent <= 3 || containerColumns.some((base) => indent - base >= 0 && indent - base <= 3);
}

function matchFenceOpener(line: string, containerColumns: number[]): FenceSpec | undefined {
	const indent = leadingSpaceCount(line);
	if (!isWithinContainerIndent(indent, containerColumns)) return undefined;
	const remainder = line.slice(indent);
	const opening = FENCE_OPENING_REGEX.exec(remainder);
	const run = opening?.[1] ?? "";
	const info = opening?.[2] ?? "";
	if (!run || (run.charAt(0) === "`" && info.includes("`"))) return undefined;
	return { character: run.charAt(0), minLength: run.length };
}

function closesFence(line: string, fence: FenceSpec, containerColumns: number[]): boolean {
	const indent = leadingSpaceCount(line);
	if (!isWithinContainerIndent(indent, containerColumns)) return false;
	const remainder = line.slice(indent);
	let runLength = 0;
	while (remainder.charAt(runLength) === fence.character) runLength += 1;
	return runLength >= fence.minLength && /^[\t ]*$/.test(remainder.slice(runLength));
}

function matchHtmlBlockStart(line: string, containerColumns: number[]): HtmlBlockState | undefined {
	const base = containerColumns.at(-1) ?? 0;
	const relative = base > 0 && leadingSpaceCount(line) >= base ? line.slice(base) : line;
	const type1Match = HTML_TYPE1_OPENING_REGEX.exec(relative);
	if (type1Match) {
		const endRegex = new RegExp(`</${type1Match[1]}>`, "i");
		return endRegex.test(relative) ? undefined : { endRegex, endsOnBlankLine: false };
	}
	if (HTML_COMMENT_OPENING_REGEX.test(relative)) {
		return HTML_COMMENT_END_REGEX.test(relative)
			? undefined
			: { endRegex: HTML_COMMENT_END_REGEX, endsOnBlankLine: false };
	}
	if (HTML_PROCESSING_INSTRUCTION_OPENING_REGEX.test(relative)) {
		return relative.includes("?>") ? undefined : { endRegex: /\?>/, endsOnBlankLine: false };
	}
	if (HTML_DECLARATION_OPENING_REGEX.test(relative)) {
		return relative.includes(">") ? undefined : { endRegex: />/, endsOnBlankLine: false };
	}
	if (HTML_CDATA_OPENING_REGEX.test(relative)) {
		return relative.includes("]]>") ? undefined : { endRegex: /\]\]>/, endsOnBlankLine: false };
	}
	if (HTML_BLOCK_TAG_OPENING_REGEX.test(relative) || HTML_COMPLETE_TAG_LINE_REGEX.test(relative)) {
		return { endsOnBlankLine: true };
	}
	return undefined;
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
	const normalized = collapseBlankLines(body.replace(/\r\n/g, "\n").replace(/\s+$/g, ""));
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

function legacySectionRegex(title: string, flags: string): RegExp {
	return new RegExp(`(\\n|^)## ${escapeForRegex(title)}\\s*\\n([\\s\\S]*?)${structuredSectionLookahead(title)}`, flags);
}

type SentinelKind = "BEGIN" | "END";

interface SentinelToken {
	family: string;
	kind: SentinelKind;
	start: number;
	end: number;
}

interface TextRange {
	start: number;
	end: number;
}

interface ChecklistSentinelPair extends TextRange {
	begin: SentinelToken;
	endToken: SentinelToken;
}

interface ChecklistSentinelResolution {
	foreignRanges: TextRange[];
	targetPairs: ChecklistSentinelPair[];
	targetState: "none" | "balanced" | "ambiguous";
	targetIssue?: "unexpected-end" | "repeated-begin" | "unclosed-begin";
}

function tokenizeKnownSentinels(content: string): SentinelToken[] {
	// Anchored to whole lines: content that merely mentions a marker inline must
	// never count as a structural sentinel (GitHub issue #932).
	const markerRegex = /^<!-- (SECTION:[A-Z][A-Z0-9_]*|COMMENTS|COMMENT|AC|DOD):(BEGIN|END) -->[\t ]*$/gm;
	const tokens: SentinelToken[] = [];
	for (const match of content.matchAll(markerRegex)) {
		const start = match.index ?? 0;
		tokens.push({
			family: String(match[1]),
			kind: match[2] as SentinelKind,
			start,
			end: start + match[0].length,
		});
	}
	return tokens;
}

function mergeRanges(ranges: TextRange[]): TextRange[] {
	const merged: TextRange[] = [];
	for (const range of [...ranges].sort((left, right) => left.start - right.start || left.end - right.end)) {
		const previous = merged[merged.length - 1];
		if (previous && range.start <= previous.end) {
			previous.end = Math.max(previous.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}
	return merged;
}

function pairForeignFamily(tokens: SentinelToken[]): TextRange[] {
	const pending: SentinelToken[] = [];
	const ranges: TextRange[] = [];
	for (const token of tokens) {
		if (token.kind === "BEGIN") {
			pending.push(token);
			continue;
		}
		const begin = pending.pop();
		if (begin) ranges.push({ start: begin.start, end: token.end });
	}
	return ranges;
}

function resolveKnownSentinelRanges(tokens: SentinelToken[]): TextRange[] {
	const families = new Set(tokens.map((token) => token.family));
	const ranges: TextRange[] = [];
	for (const family of families) {
		ranges.push(...pairForeignFamily(tokens.filter((token) => token.family === family)));
	}
	return mergeRanges(ranges);
}

function resolveChecklistSentinels(
	content: string,
	definition: ChecklistSectionDefinition,
): ChecklistSentinelResolution {
	const tokens = tokenizeKnownSentinels(content);
	const foreignRanges = resolveKnownSentinelRanges(tokens.filter((token) => token.family !== definition.markerId));
	const targetTokens = tokens.filter(
		(token) => token.family === definition.markerId && !isIndexWithinRanges(token.start, foreignRanges),
	);
	if (targetTokens.length === 0) {
		return { foreignRanges, targetPairs: [], targetState: "none" };
	}

	const targetPairs: ChecklistSentinelPair[] = [];
	let begin: SentinelToken | undefined;
	for (const token of targetTokens) {
		if (token.kind === "BEGIN") {
			if (begin) {
				return { foreignRanges, targetPairs: [], targetState: "ambiguous", targetIssue: "repeated-begin" };
			}
			begin = token;
			continue;
		}
		if (!begin) {
			return { foreignRanges, targetPairs: [], targetState: "ambiguous", targetIssue: "unexpected-end" };
		}
		targetPairs.push({ start: begin.start, end: token.end, begin, endToken: token });
		begin = undefined;
	}

	return begin
		? { foreignRanges, targetPairs: [], targetState: "ambiguous", targetIssue: "unclosed-begin" }
		: { foreignRanges, targetPairs, targetState: "balanced" };
}

function assertUnambiguousChecklistSentinels(
	resolution: ChecklistSentinelResolution,
	definition: ChecklistSectionDefinition,
): void {
	if (resolution.targetState !== "ambiguous") return;

	const detail =
		resolution.targetIssue === "unexpected-end"
			? `found ${definition.endMarker} without a preceding ${definition.beginMarker}`
			: resolution.targetIssue === "repeated-begin"
				? `found a second ${definition.beginMarker} before the matching ${definition.endMarker}`
				: `found ${definition.beginMarker} without a following ${definition.endMarker}`;
	throw new Error(`Malformed ${definition.title} markers: ${detail}.`);
}

function findSectionEndIndex(content: string, title: string): number | undefined {
	const normalizedTitle = title.trim();
	if (normalizedTitle.toLowerCase() === ACCEPTANCE_CRITERIA_TITLE.toLowerCase()) {
		return findChecklistSectionRanges(content, ACCEPTANCE_CRITERIA_DEFINITION)[0]?.end;
	}
	if (normalizedTitle.toLowerCase() === DEFINITION_OF_DONE_TITLE.toLowerCase()) {
		return findChecklistSectionRanges(content, DEFINITION_OF_DONE_DEFINITION)[0]?.end;
	}
	const sentinelRanges = resolveKnownSentinelRanges(tokenizeKnownSentinels(content));
	if (normalizedTitle.toLowerCase() === COMMENTS_TITLE.toLowerCase()) {
		const sentinelMatch = findMatchOutsideRanges(commentsSentinelRegex(), content, sentinelRanges);
		if (sentinelMatch) {
			return sentinelMatch.index + sentinelMatch[0].length;
		}
	} else {
		const block = findSentinelBlockForTitle(content, normalizedTitle, sentinelRanges);
		if (block) {
			return block.end;
		}
	}

	const legacyRegex =
		normalizedTitle.toLowerCase() === COMMENTS_TITLE.toLowerCase()
			? commentsLegacyRegex("i")
			: legacySectionRegex(normalizedTitle, "i");
	const legacyMatch = findMatchOutsideRanges(legacyRegex, content, sentinelRanges);
	if (legacyMatch) {
		return legacyMatch.index + legacyMatch[0].length;
	}
	return undefined;
}

function findSentinelBlockForTitle(
	content: string,
	normalizedTitle: string,
	maskedRanges: TextRange[],
): SentinelBlock | undefined {
	const keyEntry = Object.entries(SECTION_CONFIG).find(
		([, config]) => config.title.toLowerCase() === normalizedTitle.toLowerCase(),
	);
	if (!keyEntry) return undefined;
	const key = keyEntry[0] as StructuredSectionKey;
	return findSentinelBlocks(content, key).find((candidate) => !isIndexWithinRanges(candidate.start, maskedRanges));
}

function findSectionStartIndex(content: string, title: string): number | undefined {
	const normalizedTitle = title.trim();
	if (normalizedTitle.toLowerCase() === ACCEPTANCE_CRITERIA_TITLE.toLowerCase()) {
		return findChecklistSectionRanges(content, ACCEPTANCE_CRITERIA_DEFINITION)[0]?.start;
	}
	if (normalizedTitle.toLowerCase() === DEFINITION_OF_DONE_TITLE.toLowerCase()) {
		return findChecklistSectionRanges(content, DEFINITION_OF_DONE_DEFINITION)[0]?.start;
	}
	const sentinelRanges = resolveKnownSentinelRanges(tokenizeKnownSentinels(content));
	if (normalizedTitle.toLowerCase() === COMMENTS_TITLE.toLowerCase()) {
		const sentinelMatch = findMatchOutsideRanges(commentsSentinelRegex(), content, sentinelRanges);
		if (sentinelMatch) {
			return sentinelMatch.index;
		}
	} else {
		const block = findSentinelBlockForTitle(content, normalizedTitle, sentinelRanges);
		if (block) {
			return block.start;
		}
	}

	const legacyRegex =
		normalizedTitle.toLowerCase() === COMMENTS_TITLE.toLowerCase()
			? commentsLegacyRegex("i")
			: legacySectionRegex(normalizedTitle, "i");
	const legacyMatch = findMatchOutsideRanges(legacyRegex, content, sentinelRanges);
	return legacyMatch?.index;
}

interface SentinelBlock {
	start: number;
	bodyStart: number;
	bodyEnd: number;
	end: number;
}

/**
 * Locates `## Title` + BEGIN...END sentinel blocks for a structured section.
 * Markers count only as whole lines (trailing whitespace tolerated), so a body
 * that merely mentions a marker inline can never terminate the block early.
 * Same-family BEGIN lines inside the block are depth-counted, so a file whose
 * markers were nested by pre-fix writes still resolves to one block containing
 * its full interior instead of hiding everything after the first END line.
 */
function findSentinelBlocks(content: string, key: StructuredSectionKey): SentinelBlock[] {
	const heading = `## ${getConfig(key).title}`.toLowerCase();
	const begin = getBeginMarker(key);
	const end = getEndMarker(key);
	const lines = content.split("\n");
	let offset = 0;
	const offsets = lines.map((line) => {
		const start = offset;
		offset += line.length + 1;
		return start;
	});
	const blocks: SentinelBlock[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		if ((lines[index] ?? "").trimEnd().toLowerCase() !== heading) continue;
		let beginIndex = index + 1;
		while (beginIndex < lines.length && (lines[beginIndex] ?? "").trim() === "") beginIndex += 1;
		if ((lines[beginIndex] ?? "").trimEnd() !== begin) continue;
		let depth = 1;
		let endIndex = beginIndex + 1;
		while (endIndex < lines.length) {
			const candidate = (lines[endIndex] ?? "").trimEnd();
			if (candidate === begin) depth += 1;
			else if (candidate === end) {
				depth -= 1;
				if (depth === 0) break;
			}
			endIndex += 1;
		}
		if (depth !== 0) continue;
		blocks.push({
			start: offsets[index] ?? 0,
			bodyStart: Math.min((offsets[beginIndex] ?? 0) + (lines[beginIndex] ?? "").length + 1, content.length),
			bodyEnd: offsets[endIndex] ?? content.length,
			end: (offsets[endIndex] ?? 0) + (lines[endIndex] ?? "").length,
		});
		index = endIndex;
	}
	return blocks;
}

/**
 * Rejects section input that contains the target section's own sentinel marker
 * as a whole line: wrapping such a payload would nest markers and hide content
 * from every reader. Inline mentions and other sections' markers stay legal.
 */
export function assertSectionInputHasNoMarkerLines(value: string | undefined, key: StructuredSectionKey): void {
	if (typeof value !== "string" || value.length === 0) return;
	const begin = getBeginMarker(key);
	const end = getEndMarker(key);
	for (const line of value.replace(/\r\n/g, "\n").split("\n")) {
		const trimmed = line.trimEnd();
		if (trimmed !== begin && trimmed !== end) continue;
		throw new Error(
			`${getConfig(key).title} content cannot contain the reserved marker line "${trimmed}". Indent it with a space to include it as literal text.`,
		);
	}
}

interface SectionRange {
	key: StructuredSectionKey;
	start: number;
	end: number;
	kind: "sentinel" | "legacy";
}

interface ChecklistSectionRange {
	start: number;
	end: number;
	body: string;
	maskedRanges: TextRange[];
	marked: boolean;
	hasChecklistItems: boolean;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
	return aStart < bEnd && bStart < aEnd;
}

function isIndexWithinRanges(index: number, ranges: Array<{ start: number; end: number }>): boolean {
	return ranges.some((range) => index >= range.start && index < range.end);
}

function findMatchOutsideRanges(
	regex: RegExp,
	content: string,
	ranges: Array<{ start: number; end: number }>,
): RegExpExecArray | undefined {
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
		for (const block of findSentinelBlocks(content, key)) {
			ranges.push({ key, start: block.start, end: block.end, kind: "sentinel" });
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

function parseChecklistBody(body: string, marked: boolean, maskedRanges: TextRange[]): AcceptanceCriterion[] {
	const lineRegex = marked ? /^- \[([ x])\] (?:#\d+ )?(.+)$/gm : /^- \[([ x])\] (.+)$/gm;
	const items: AcceptanceCriterion[] = [];
	for (const match of body.matchAll(lineRegex)) {
		const start = match.index ?? 0;
		if (isIndexWithinRanges(start, maskedRanges)) continue;
		items.push({ checked: match[1] === "x", text: String(match[2] ?? ""), index: items.length + 1 });
	}
	return items;
}

function findChecklistHeaderStart(
	content: string,
	markerStart: number,
	definition: ChecklistSectionDefinition,
): number | undefined {
	const prefix = content.slice(0, markerStart);
	const headerRegex = new RegExp(
		`(?:^|\\n)(${escapeForRegex(definition.sectionHeader)})[\\t ]*\\n(?:[\\t ]*\\n)*[\\t ]*$`,
		"i",
	);
	const match = headerRegex.exec(prefix);
	if (!match?.[1] || match.index === undefined) return undefined;
	return match.index + match[0].indexOf(match[1]);
}

function findTopLevelHeadings(content: string, sentinelRanges: TextRange[]) {
	const headings: Array<{ start: number; bodyStart: number; title: string }> = [];
	for (const match of content.matchAll(/^##[\t ]+(.+?)[\t ]*$/gm)) {
		const start = match.index ?? 0;
		if (isIndexWithinRanges(start, sentinelRanges)) continue;
		const lineEnd = start + match[0].length;
		headings.push({
			start,
			bodyStart: content[lineEnd] === "\n" ? lineEnd + 1 : lineEnd,
			title: String(match[1] ?? "").trim(),
		});
	}
	return headings;
}

function rangesRelativeToBody(ranges: TextRange[], bodyStart: number, bodyEnd: number): TextRange[] {
	return ranges
		.filter((range) => rangesOverlap(range.start, range.end, bodyStart, bodyEnd))
		.map((range) => ({
			start: Math.max(range.start, bodyStart) - bodyStart,
			end: Math.min(range.end, bodyEnd) - bodyStart,
		}));
}

function findChecklistSectionRanges(
	content: string,
	definition: ChecklistSectionDefinition,
	resolution = resolveChecklistSentinels(content, definition),
	includeLegacyWithMarked = false,
): ChecklistSectionRange[] {
	if (resolution.targetState === "ambiguous") return [];
	const ranges: ChecklistSectionRange[] = [];

	for (const pair of resolution.targetPairs) {
		const start = findChecklistHeaderStart(content, pair.begin.start, definition);
		if (start === undefined || isIndexWithinRanges(start, resolution.foreignRanges)) continue;
		const rawBody = content.slice(pair.begin.end, pair.endToken.start);
		const leadingWhitespace = rawBody.match(/^[\t ]*\n/)?.[0].length ?? 0;
		const bodyStart = pair.begin.end + leadingWhitespace;
		const bodyEnd = pair.endToken.start;
		const body = content.slice(bodyStart, bodyEnd);
		const maskedRanges = rangesRelativeToBody(resolution.foreignRanges, bodyStart, bodyEnd);
		ranges.push({
			start,
			end: pair.end,
			body,
			maskedRanges,
			marked: true,
			hasChecklistItems: parseChecklistBody(body, true, maskedRanges).length > 0,
		});
	}

	// Balanced markers with no attached section header (e.g. a stray pair in prose)
	// must not hide legacy sections, or reads would miss criteria that writes still strip.
	if (ranges.length > 0 && !includeLegacyWithMarked) {
		return ranges.sort((left, right) => left.start - right.start);
	}

	const headings = findTopLevelHeadings(content, resolution.foreignRanges);
	for (let index = 0; index < headings.length; index += 1) {
		const heading = headings[index];
		if (!heading || heading.title.toLowerCase() !== definition.title.toLowerCase()) continue;
		const end = headings[index + 1]?.start ?? content.length;
		if (ranges.some((range) => rangesOverlap(range.start, range.end, heading.start, end))) continue;
		const body = content.slice(heading.bodyStart, end);
		const maskedRanges = rangesRelativeToBody(resolution.foreignRanges, heading.bodyStart, end);
		const hasChecklistItems = parseChecklistBody(body, false, maskedRanges).length > 0;
		ranges.push({ start: heading.start, end, body, maskedRanges, marked: false, hasChecklistItems });
	}

	return ranges.sort((left, right) => left.start - right.start);
}

function stripSectionInstances(content: string, key: StructuredSectionKey): string {
	let stripped = content;
	for (const block of findSentinelBlocks(content, key).sort((left, right) => right.start - left.start)) {
		stripped = `${stripped.slice(0, block.start)}${stripped.slice(block.end)}`;
	}

	const legacyRegex = legacySectionRegex(getConfig(key).title, "gi");
	stripped = stripped.replace(legacyRegex, "\n");

	return collapseBlankLines(stripped).trimEnd();
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
	const block = findSentinelBlocks(src, key).find((candidate) => !isIndexWithinRanges(candidate.start, otherRanges));
	if (block) {
		return src.slice(block.bodyStart, block.bodyEnd).trim() || undefined;
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
		let res = insertAfterSection(tail, DEFINITION_OF_DONE_TITLE, planBlock);
		if (!res.inserted) {
			res = insertAfterSection(tail, ACCEPTANCE_CRITERIA_TITLE, planBlock);
		}
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
			res = insertAfterSection(tail, DEFINITION_OF_DONE_TITLE, notesBlock);
		}
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
			res = insertAfterSection(tail, DEFINITION_OF_DONE_TITLE, finalBlock);
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

	const finalOutput = collapseBlankLines(output).trim();
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

function parseChecklist(content: string, definition: ChecklistSectionDefinition): AcceptanceCriterion[] {
	const src = content.replace(/\r\n/g, "\n");
	const resolution = resolveChecklistSentinels(src, definition);
	if (resolution.targetState === "ambiguous") return [];
	const ranges = findChecklistSectionRanges(src, definition, resolution);
	const range = ranges.find((candidate) => candidate.marked) ?? ranges.find((candidate) => !candidate.marked);
	if (!range) return [];
	if (!range.marked) return parseChecklistBody(range.body, false, range.maskedRanges);

	const criteria: AcceptanceCriterion[] = [];
	for (const match of range.body.matchAll(/^- \[([ x])\] #(\d+) (.+)$/gm)) {
		const start = match.index ?? 0;
		if (isIndexWithinRanges(start, range.maskedRanges)) continue;
		criteria.push({
			checked: match[1] === "x",
			text: String(match[3] ?? ""),
			index: Number.parseInt(String(match[2]), 10),
		});
	}
	return criteria;
}

function composeChecklistBody(
	criteria: AcceptanceCriterion[],
	existingBody?: string,
	maskedRanges: TextRange[] = [],
): string {
	const sorted = [...criteria].sort((a, b) => a.index - b.index);
	const queue = [...sorted];
	const lines: string[] = [];
	let nextNumber = 1;
	const sourceLines = existingBody ? existingBody.replace(/\r\n/g, "\n").split("\n") : [];
	let sourceOffset = 0;

	if (sourceLines.length > 0) {
		for (const line of sourceLines) {
			const lineStart = sourceOffset;
			sourceOffset += line.length + 1;
			const trimmed = line.trim();
			const checkboxMatch = isIndexWithinRanges(lineStart, maskedRanges)
				? null
				: trimmed.match(/^- \[([ x])\] (?:#\d+ )?(.*)$/);
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

	while (lines.length > 0 && lines[0]?.trim() === "") {
		lines.shift();
	}
	while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
		lines.pop();
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

	return lines.join("\n");
}

function formatChecklistSection(
	criteria: AcceptanceCriterion[],
	definition: ChecklistSectionDefinition,
	existingBody?: string,
	maskedRanges?: TextRange[],
): string {
	const effectiveMasks =
		maskedRanges ?? (existingBody ? resolveChecklistSentinels(existingBody, definition).foreignRanges : []);
	const body = composeChecklistBody(criteria, existingBody, effectiveMasks);
	if (body.trim() === "") {
		return "";
	}
	const lines = [definition.sectionHeader, definition.beginMarker];
	lines.push(...body.split("\n"));
	lines.push(definition.endMarker);
	return lines.join("\n");
}

function updateChecklistContent(
	content: string,
	criteria: AcceptanceCriterion[],
	definition: ChecklistSectionDefinition,
): string {
	const { text: src, useCRLF } = normalizeToLF(content);
	const resolution = resolveChecklistSentinels(src, definition);
	assertUnambiguousChecklistSentinels(resolution, definition);
	const existingRanges = findChecklistSectionRanges(src, definition, resolution, true);
	const mutableRanges = existingRanges.filter((range) => range.marked || range.hasChecklistItems);
	if (criteria.length === 0 && mutableRanges.length === 0) {
		return content;
	}
	const existingRange = mutableRanges[0];
	const newSection = formatChecklistSection(criteria, definition, existingRange?.body, existingRange?.maskedRanges);
	let stripped = src;
	for (const range of mutableRanges.sort((left, right) => right.start - left.start)) {
		const before = stripped.slice(0, range.start).trimEnd();
		const after = stripped.slice(range.end).replace(/^\s+/, "");
		stripped = before && after ? `${before}\n\n${after}` : `${before}${after}`;
	}
	stripped = stripped.trim();

	if (!newSection) {
		return restoreLineEndings(stripped, useCRLF);
	}

	const precedingTitles =
		definition === ACCEPTANCE_CRITERIA_DEFINITION
			? [getConfig("description").title]
			: [ACCEPTANCE_CRITERIA_TITLE, getConfig("description").title];
	for (const title of precedingTitles) {
		const result = insertAfterSection(stripped, title, newSection);
		if (result.inserted) {
			return restoreLineEndings(result.content.trim(), useCRLF);
		}
	}

	const followingTitles =
		definition === ACCEPTANCE_CRITERIA_DEFINITION
			? [
					DEFINITION_OF_DONE_TITLE,
					getConfig("implementationPlan").title,
					getConfig("implementationNotes").title,
					COMMENTS_TITLE,
					getConfig("finalSummary").title,
				]
			: [
					getConfig("implementationPlan").title,
					getConfig("implementationNotes").title,
					COMMENTS_TITLE,
					getConfig("finalSummary").title,
				];
	for (const title of followingTitles) {
		const result = insertBeforeSection(stripped, title, newSection);
		if (result.inserted) {
			return restoreLineEndings(result.content.trim(), useCRLF);
		}
	}

	return restoreLineEndings(appendBlock(stripped, newSection).trim(), useCRLF);
}

function parseAllChecklistItems(content: string, definition: ChecklistSectionDefinition): AcceptanceCriterion[] {
	const marked: AcceptanceCriterion[] = [];
	const legacy: AcceptanceCriterion[] = [];
	const src = content.replace(/\r\n/g, "\n");
	const resolution = resolveChecklistSentinels(src, definition);
	if (resolution.targetState === "ambiguous") return [];
	for (const range of findChecklistSectionRanges(src, definition, resolution)) {
		const target = range.marked ? marked : legacy;
		for (const item of parseChecklistBody(range.body, range.marked, range.maskedRanges)) {
			target.push({ ...item, index: target.length + 1 });
		}
	}
	return marked.length > 0 ? marked : legacy;
}

function migrateChecklistToStableFormat(content: string, definition: ChecklistSectionDefinition): string {
	const { text: src } = normalizeToLF(content);
	const resolution = resolveChecklistSentinels(src, definition);
	if (resolution.targetState !== "none") return content;
	const criteria = parseAllChecklistItems(src, definition);
	return criteria.length > 0 ? updateChecklistContent(content, criteria, definition) : content;
}

function normalizeCommentMetadata(value: string | undefined): string | undefined {
	const normalized = value?.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
	return normalized && normalized.length > 0 ? normalized : undefined;
}

function containsCommentMarker(value: string | undefined): boolean {
	return /<!--\s*COMMENTS?:/i.test(value ?? "");
}

function containsCommentDelimiter(value: string | undefined): boolean {
	return /^\s*---\s*$/m.test((value ?? "").replace(/\r\n/g, "\n"));
}

function parseCommentMetadata(
	lines: string[],
	fallbackIndex: number,
): {
	index: number;
	author?: string;
	createdDate: string;
} {
	let index = fallbackIndex;
	let author: string | undefined;
	let createdDate = "";
	for (const line of lines) {
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
	return { index, ...(author && { author }), createdDate };
}

function parseLegacyCommentBlock(block: string, fallbackIndex: number): TaskComment | undefined {
	const normalized = block.replace(/\r\n/g, "\n").trim();
	if (!normalized) return undefined;

	const separatorIndex = normalized.search(/\n\s*\n/);
	const metadataText = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : "";
	const body = separatorIndex >= 0 ? normalized.slice(separatorIndex).replace(/^\s+/, "").trim() : normalized;
	if (!body) return undefined;

	const { index, author, createdDate } = parseCommentMetadata(metadataText.split("\n"), fallbackIndex);
	return {
		index,
		body,
		createdDate,
		...(author && { author }),
	};
}

function parseDelimitedComments(sectionBody: string): TaskComment[] {
	const lines = sectionBody.replace(/\r\n/g, "\n").split("\n");
	const comments: TaskComment[] = [];
	let lineIndex = 0;

	const isDelimiter = (line: string): boolean => line.trim() === COMMENT_DELIMITER;
	const skipBlankLines = () => {
		while (lineIndex < lines.length && lines[lineIndex]?.trim() === "") {
			lineIndex += 1;
		}
	};

	while (lineIndex < lines.length) {
		skipBlankLines();
		if (lineIndex >= lines.length) break;

		const metadataLines: string[] = [];
		while (lineIndex < lines.length && !isDelimiter(lines[lineIndex] ?? "")) {
			metadataLines.push(lines[lineIndex] ?? "");
			lineIndex += 1;
		}
		if (lineIndex >= lines.length) break;
		lineIndex += 1;

		const bodyLines: string[] = [];
		while (lineIndex < lines.length && !isDelimiter(lines[lineIndex] ?? "")) {
			bodyLines.push(lines[lineIndex] ?? "");
			lineIndex += 1;
		}
		if (lineIndex >= lines.length) break;
		lineIndex += 1;

		const body = bodyLines.join("\n").trim();
		if (!body) continue;
		const { author, createdDate } = parseCommentMetadata(metadataLines, comments.length + 1);
		comments.push({
			index: comments.length + 1,
			body,
			createdDate,
			...(author && { author }),
		});
	}

	return comments;
}

function parseComments(content: string): TaskComment[] {
	const src = content.replace(/\r\n/g, "\n");
	const sentinelMatch = findMatchOutsideRanges(commentsSentinelRegex("i"), src, getStructuredSectionRanges(src));
	const sectionBody = sentinelMatch?.[2];
	if (sectionBody === undefined) {
		return [];
	}

	if (!sectionBody.includes(COMMENT_BEGIN_MARKER)) {
		return parseDelimitedComments(sectionBody);
	}

	const blockRegex = new RegExp(
		`${escapeForRegex(COMMENT_BEGIN_MARKER)}\\s*\\n([\\s\\S]*?)${escapeForRegex(COMMENT_END_MARKER)}`,
		"gi",
	);
	const comments: TaskComment[] = [];
	let match: RegExpExecArray | null = blockRegex.exec(sectionBody);
	while (match !== null) {
		const parsed = parseLegacyCommentBlock(match[1] ?? "", comments.length + 1);
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

function formatCommentBlock(comment: TaskComment): string {
	const body = String(comment.body ?? "")
		.replace(/\r\n/g, "\n")
		.trim();
	if (containsCommentMarker(body)) {
		throw new Error("Comment body cannot contain Backlog comment markers.");
	}
	if (containsCommentDelimiter(body)) {
		throw new Error("Comment body cannot contain standalone '---' delimiter lines.");
	}
	const lines: string[] = [];
	const author = normalizeCommentMetadata(comment.author);
	if (author) {
		if (containsCommentMarker(author)) {
			throw new Error("Comment author cannot contain Backlog comment markers.");
		}
		if (containsCommentDelimiter(author)) {
			throw new Error("Comment author cannot contain standalone '---' delimiter lines.");
		}
		lines.push(`author: ${author}`);
	}
	const createdDate = String(comment.createdDate ?? "").trim();
	if (containsCommentMarker(createdDate)) {
		throw new Error("Comment created date cannot contain Backlog comment markers.");
	}
	if (containsCommentDelimiter(createdDate)) {
		throw new Error("Comment created date cannot contain standalone '---' delimiter lines.");
	}
	if (createdDate) {
		lines.push(`created: ${createdDate}`);
	}
	lines.push(COMMENT_DELIMITER, body, COMMENT_DELIMITER);
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

	const lines = [COMMENTS_SECTION_HEADER, "", COMMENTS_BEGIN_MARKER];
	normalizedComments.forEach((comment, index) => {
		if (index > 0) {
			lines.push("");
		}
		lines.push(formatCommentBlock(comment));
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
	return collapseBlankLines(stripped).trimEnd();
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
	return restoreLineEndings(collapseBlankLines(output).trim(), useCRLF);
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
		return migrateChecklistToStableFormat(content, ACCEPTANCE_CRITERIA_DEFINITION);
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
		return migrateChecklistToStableFormat(content, DEFINITION_OF_DONE_DEFINITION);
	}
}
