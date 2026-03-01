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
