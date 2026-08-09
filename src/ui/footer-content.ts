/**
 * Footer shortcut hints for the two task views.
 *
 * Letters are shown exactly as they must be typed. A bare uppercase binding such as
 * `screen.key(["t", "T"])` never fires, because Shift+T is delivered as `S-t`, so an
 * uppercase filter hint would advertise a key that does nothing. Filter letters are
 * listed in the same order the filter header renders its controls
 * (status, type, priority, milestone, labels).
 */
export const BOARD_FOOTER_CONTENT =
	" {cyan-fg}[Tab]{/} View | {cyan-fg}[N]{/} New | {cyan-fg}[/]{/} Search | {cyan-fg}[t/p/i/f]{/} Filter | {cyan-fg}[←→/↑↓]{/} Nav | {cyan-fg}[Enter]{/} Details | {cyan-fg}[E/M/C/A]{/} Edit/Move/Comp/Arch | {cyan-fg}[Y]{/} Yank | {cyan-fg}[?]{/} Help | {cyan-fg}[q]{/} Quit";

export const TASK_LIST_FOOTER_CONTENT =
	" {cyan-fg}[Tab]{/} View | {cyan-fg}[/]{/} Search | {cyan-fg}[s/t/p/i/l]{/} Filter | {cyan-fg}[↑↓]{/} Nav | {cyan-fg}[E/C/A]{/} Edit/Comp/Arch | {cyan-fg}[Y]{/} Yank | {cyan-fg}[?]{/} Help | {cyan-fg}[q]{/} Quit";

function visibleLength(value: string): number {
	return value.replace(/\{[^{}]+\}/g, "").length;
}

function joinSegments(segments: string[], leadingSpace: boolean): string {
	const joined = segments.join(" | ");
	return leadingSpace ? ` ${joined}` : joined;
}

export function formatFooterContent(
	content: string,
	terminalWidth: number,
): {
	content: string;
	height: 1 | 2;
} {
	const trimmed = content.trim();
	if (!trimmed) {
		return { content: "", height: 1 };
	}

	const segments = trimmed.split(/\s+\|\s+/).filter((segment) => segment.length > 0);
	if (segments.length <= 1) {
		return { content, height: 1 };
	}

	const availableWidth = Math.max(20, terminalWidth - 1);
	const leadingSpace = content.startsWith(" ");
	const singleLine = joinSegments(segments, leadingSpace);

	if (visibleLength(singleLine) <= availableWidth) {
		return { content: singleLine, height: 1 };
	}

	// Progressive wrapping: keep extending line 1 until adding the next section
	// would overflow available width, then place all remaining sections on line 2.
	let splitAt = 1;
	let firstLine = joinSegments(segments.slice(0, splitAt), leadingSpace);
	for (let index = 1; index < segments.length; index += 1) {
		const candidate = joinSegments(segments.slice(0, index + 1), leadingSpace);
		if (visibleLength(candidate) > availableWidth) {
			break;
		}
		splitAt = index + 1;
		firstLine = candidate;
	}

	if (splitAt >= segments.length) {
		return { content: firstLine, height: 1 };
	}

	const secondLine = joinSegments(segments.slice(splitAt), leadingSpace);
	return { content: `${firstLine}\n${secondLine}`, height: 2 };
}
