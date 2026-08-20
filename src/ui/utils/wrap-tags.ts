/**
 * Blessed-tag-aware line wrapping.
 *
 * Blessed list items are single rows and overflow is clipped, so long content
 * has to be split into several rows by hand. Wrapping on raw character counts
 * would slice through markup like `{bold}` or `{cyan-fg}`, so this walks the
 * string tag-by-tag, measures only visible characters, and re-opens any tags
 * that were still active when a line broke.
 */

const TAG_PATTERN = /\{\/?[^{}]*\}/g;

type Token = { type: "tag"; value: string } | { type: "text"; value: string };

function tokenize(value: string): Token[] {
	const tokens: Token[] = [];
	let cursor = 0;

	for (const match of value.matchAll(TAG_PATTERN)) {
		const start = match.index ?? 0;
		if (start > cursor) {
			tokens.push({ type: "text", value: value.slice(cursor, start) });
		}
		tokens.push({ type: "tag", value: match[0] });
		cursor = start + match[0].length;
	}

	if (cursor < value.length) {
		tokens.push({ type: "text", value: value.slice(cursor) });
	}

	return tokens;
}

function isCloseTag(tag: string): boolean {
	return tag.startsWith("{/");
}

/**
 * Splits text into chunks that can each start a line: words plus their
 * trailing whitespace, so a break never lands mid-word when it can be helped.
 */
function splitWords(value: string): string[] {
	return value.match(/\s+|\S+/g) ?? [];
}

/** Length of a string counting only characters the terminal actually prints. */
export function visibleLength(value: string): number {
	return value.replace(TAG_PATTERN, "").length;
}

export function wrapBlessedText(value: string, width: number, continuationIndent = ""): string[] {
	if (width <= 0) {
		return [value];
	}

	const lines: string[] = [];
	// Tags still open at the current cursor, so a break can close and re-open them.
	let openTags: string[] = [];
	let lineOpenTags: string[] = [];
	let line = "";
	let visible = 0;
	let isFirstLine = true;

	const limit = () => (isFirstLine ? width : Math.max(1, width - continuationIndent.length));

	// Whitespace at a line break would otherwise survive as a ragged trailing gap.
	const trimLineEnd = (entry: string) => entry.replace(/[ \t]+(?=(?:\{\/?[^{}]*\})*$)/g, "");

	const flush = () => {
		if (line.length === 0 && visible === 0 && lines.length > 0) {
			return;
		}
		const closing = "{/}".repeat(lineOpenTags.length);
		lines.push((isFirstLine ? "" : continuationIndent) + trimLineEnd(line) + closing);
		isFirstLine = false;
		line = openTags.join("");
		lineOpenTags = [...openTags];
		visible = 0;
	};

	const pushChunk = (chunk: string) => {
		// Leading whitespace on a wrapped line reads as ragged indentation.
		if (visible === 0 && lines.length > 0 && /^\s+$/.test(chunk)) {
			return;
		}
		if (visible > 0 && visible + chunk.length > limit()) {
			flush();
			if (/^\s+$/.test(chunk)) {
				return;
			}
		}
		// A single chunk longer than the line has to be cut mid-word.
		if (chunk.length > limit()) {
			let remaining = chunk;
			while (remaining.length > 0) {
				const room = limit() - visible;
				if (room <= 0) {
					flush();
					continue;
				}
				line += remaining.slice(0, room);
				visible += Math.min(room, remaining.length);
				remaining = remaining.slice(room);
				if (remaining.length > 0) {
					flush();
				}
			}
			return;
		}
		line += chunk;
		visible += chunk.length;
	};

	for (const token of tokenize(value)) {
		if (token.type === "tag") {
			line += token.value;
			if (isCloseTag(token.value)) {
				openTags.pop();
				lineOpenTags.pop();
			} else {
				openTags.push(token.value);
				lineOpenTags.push(token.value);
			}
			continue;
		}

		for (const chunk of splitWords(token.value)) {
			pushChunk(chunk);
		}
	}

	if (line.length > 0 || lines.length === 0) {
		const closing = "{/}".repeat(lineOpenTags.length);
		lines.push((isFirstLine ? "" : continuationIndent) + trimLineEnd(line) + closing);
	}

	// Guard against trailing rows that carry only re-opened markup.
	openTags = [];
	return lines.filter((entry, index) => index === 0 || entry.replace(TAG_PATTERN, "").trim().length > 0);
}
