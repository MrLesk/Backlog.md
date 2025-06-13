/* Heading helper component for consistent terminal UI styling */

import { createRequire } from "node:module";

// Load blessed dynamically
// biome-ignore lint/suspicious/noExplicitAny: blessed is dynamically loaded
async function loadBlessed(): Promise<any | null> {
	try {
		const require = createRequire(import.meta.url);
		const blessed = require("blessed");
		return blessed;
	} catch {
		try {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic import
			const mod = (await import("blessed")) as any;
			return mod.default ?? mod;
		} catch {
			return null;
		}
	}
}

export type HeadingLevel = 1 | 2 | 3;

/**
 * Get the styling for a heading level
 */
export function getHeadingStyle(level: HeadingLevel): { color: string; bold: boolean } {
	switch (level) {
		case 1:
			return { color: "bright-white", bold: true };
		case 2:
			return { color: "cyan", bold: false };
		case 3:
			return { color: "white", bold: false };
		default:
			return { color: "white", bold: false };
	}
}

/**
 * Format heading text with appropriate blessed tags
 */
export function formatHeading(text: string, level: HeadingLevel): string {
	const style = getHeadingStyle(level);
	const colorTag = style.color.replace("-", "");

	if (style.bold) {
		return `{bold}{${colorTag}-fg}${text}{/${colorTag}-fg}{/bold}`;
	}
	return `{${colorTag}-fg}${text}{/${colorTag}-fg}`;
}

/**
 * Create a heading box with proper styling and spacing
 */
export async function createHeading(
	// biome-ignore lint/suspicious/noExplicitAny: blessed types
	parent: any,
	text: string,
	level: HeadingLevel,
	options: {
		top?: number | string;
		left?: number | string;
		width?: number | string;
	} = {},
	// biome-ignore lint/suspicious/noExplicitAny: blessed element type
): Promise<any | null> {
	const blessed = await loadBlessed();
	if (!blessed) return null;

	const style = getHeadingStyle(level);

	return blessed.box({
		parent,
		content: formatHeading(text, level),
		top: options.top || 0,
		left: options.left || 0,
		width: options.width || "100%",
		height: 1,
		tags: true,
		style: {
			fg: style.color,
			bold: style.bold,
		},
	});
}

/**
 * Add a heading with automatic spacing (blank line before)
 */
export async function addHeadingWithSpacing(
	// biome-ignore lint/suspicious/noExplicitAny: blessed types
	parent: any,
	text: string,
	level: HeadingLevel,
	currentTop: number,
	options: {
		left?: number | string;
		width?: number | string;
	} = {},
	// biome-ignore lint/suspicious/noExplicitAny: blessed element type
): Promise<{ element: any; nextTop: number }> {
	const blessed = await loadBlessed();
	if (!blessed) return { element: null, nextTop: currentTop };

	// Add blank line before heading (except if it's the very first element)
	const actualTop = currentTop === 0 ? 0 : currentTop + 1;

	const heading = await createHeading(parent, text, level, {
		top: actualTop,
		left: options.left,
		width: options.width,
	});

	// Return next available position (heading + 1 line for spacing after)
	return {
		element: heading,
		nextTop: actualTop + 1,
	};
}
