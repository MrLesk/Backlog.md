/* Heading helper component for consistent terminal UI styling */
import { box } from "neo-neo-bblessed";

export type HeadingLevel = 1 | 2 | 3;

/** Map heading level → colour + bold flag */
export function getHeadingStyle(level: HeadingLevel): { color: string; bold: boolean } {
	switch (level) {
		case 1:
			return { color: "bright-white", bold: true };
		case 2:
			return { color: "cyan", bold: false };
		default:
			return { color: "white", bold: false };
	}
}

/** Wrap plain text with blessed colour / bold tags */
export function formatHeading(text: string, level: HeadingLevel): string {
	const { color, bold } = getHeadingStyle(level);
	const tagColour = color.replace("-", "");
	return bold
		? `{bold}{${tagColour}-fg}${text}{/${tagColour}-fg}{/bold}`
		: `{${tagColour}-fg}${text}{/${tagColour}-fg}`;
}

/**
 * Create a heading element (one line).
 * Stays compatible with previous async API by returning a resolved Promise.
 */
export async function createHeading(
	parent: unknown,
	text: string,
	level: HeadingLevel,
	opts: { top?: number | string; left?: number | string; width?: number | string } = {},
): Promise<unknown> {
	return box({
		parent,
		content: formatHeading(text, level),
		top: opts.top ?? 0,
		left: opts.left ?? 0,
		width: opts.width ?? "100%",
		height: 1,
		tags: true,
		style: { fg: getHeadingStyle(level).color, bold: getHeadingStyle(level).bold },
	});
}

/**
 * Add a heading and return the next free row (with a blank line before it,
 * except when at the very top).
 */
export async function addHeadingWithSpacing(
	parent: unknown,
	text: string,
	level: HeadingLevel,
	currentTop: number,
	opts: { left?: number | string; width?: number | string } = {},
): Promise<{ element: unknown; nextTop: number }> {
	const actualTop = currentTop === 0 ? 0 : currentTop + 1;
	const element = await createHeading(parent, text, level, { top: actualTop, ...opts });
	return { element, nextTop: actualTop + 1 };
}
