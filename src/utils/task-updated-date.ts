import { isDeepStrictEqual } from "node:util";
import { CST, isMap, isNode, isScalar, parseDocument } from "yaml";
import { FrontmatterReferenceError, parseFrontmatter, preprocessFrontmatter } from "../markdown/frontmatter.ts";
import { normalizeStoredTimestamp } from "./utc-timestamp.ts";

function readFields(source: string): Record<string, unknown> {
	return parseFrontmatter(`---\n${preprocessFrontmatter(source)}---`, ["created_date", "updated_date"]).data;
}

/** Stamp a raw editor save without rewriting unrelated YAML, Markdown or line endings. */
export function upsertTaskUpdatedDate(content: string, updatedDate: string): string {
	const opening = /^\uFEFF?---[ \t]*(?:yaml[ \t]*)?(\r?\n)/.exec(content);
	if (!opening || !updatedDate) return content;
	const closing = content.indexOf("\n---", opening[0].length - 1);
	if (closing < 0) return content;
	const source = content.slice(opening[0].length, closing + 1);
	const newline = opening[1] ?? "\n";

	let original: Record<string, unknown>;
	try {
		original = readFields(source);
	} catch {
		// The editor's caller reports unreadable Markdown and keeps what the user saved.
		return content;
	}
	// YAML source ranges locate top-level values even with a quoted key, nested metadata or an alias.
	// The existing frontmatter reader above determines what Backlog accepts, including @assignee.
	const mapping = parseDocument(source, { keepSourceTokens: true }).contents;
	if (!isMap(mapping) || !mapping.range) return content;
	const rootStart = mapping.range[0];
	const indent = source.slice(source.lastIndexOf("\n", rootStart - 1) + 1, rootStart);
	const created = mapping.get("created_date", true);
	const writtenCreation = original.created_date;
	const updates: Record<string, string> = { updated_date: updatedDate };
	if (typeof writtenCreation === "string") {
		const normalized = normalizeStoredTimestamp(writtenCreation);
		if (normalized !== writtenCreation) updates.created_date = normalized;
	}
	const edits: { start: number; end: number; text: string }[] = [];
	for (const [key, stamp] of Object.entries(updates)) {
		if (original[key] === stamp) continue;
		const pair = mapping.items.find((entry) => isScalar(entry.key) && entry.key.value === key);
		const node = pair?.value;
		const token = isNode(node) ? node.srcToken : undefined;
		if (token) {
			const start = token.offset;
			const end = start + CST.stringify(token).length;
			CST.setScalarValue(token, stamp, token.type === "block-scalar" ? { type: "PLAIN" } : {});
			edits.push({ start, end, text: CST.stringify(token) });
		} else if (isNode(node) && node.range) {
			// A colon without a value has no source token. Keep any trailing comment.
			const at = node.range[0];
			const before = source[at - 1] === ":" ? " " : "";
			const after = source[at] === "#" ? " " : "";
			edits.push({ start: at, end: at, text: `${before}'${stamp}'${after}` });
		} else if (isNode(pair?.key) && pair.key.range) {
			// An explicit empty key (`? updated_date`) still needs its value separator.
			const at = pair.key.range[1];
			const prefix = mapping.flow ? "" : newline + indent;
			edits.push({ start: at, end: at, text: `${prefix}: '${stamp}'` });
		} else if (mapping.flow) {
			edits.push({ start: rootStart + 1, end: rootStart + 1, text: `${key}: '${stamp}', ` });
		} else {
			let at = isNode(created) && created.range ? created.range[2] : source.length;
			if (at > 0 && source[at - 1] !== "\n") at = source.indexOf("\n", at) + 1;
			edits.push({ start: at, end: at, text: `${indent}${key}: '${stamp}'${newline}` });
		}
	}
	let updated = source;
	for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
		updated = updated.slice(0, start) + text + updated.slice(end);
	}
	try {
		if (isDeepStrictEqual(readFields(updated), { ...original, ...updates })) {
			return opening[0] + updated + content.slice(closing + 1);
		}
	} catch {
		// An edit must not invalidate a reference or change the value of other metadata.
	}
	throw new FrontmatterReferenceError(
		original.id,
		"the update would change preserved metadata or break a YAML reference",
	);
}
