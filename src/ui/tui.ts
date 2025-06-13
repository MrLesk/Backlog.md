/*
 * Lightweight wrapper around the `bblessed` terminal UI library.
 *
 * The real dependency may not always be available in the runtime
 * (for example, in CI or when the user purposefully installs Backlog.md
 * without optional TUI support).  All exported helper functions therefore
 * attempt to load `bblessed` dynamically and will transparently fall back
 * to a simple non-interactive implementation when the import fails or
 * when the current process is not attached to a TTY.
 */

import { createRequire } from "node:module";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdin as input, stdout as output } from "node:process";
import { formatHeading } from "./heading.ts";

// Utility: load bblessed at runtime if present.
// biome-ignore lint/suspicious/noExplicitAny: bblessed is dynamically loaded
async function loadBlessed(): Promise<any | null> {
	// In Bun, isTTY might be undefined instead of false
	if (output.isTTY === false) return null;

	try {
		// Try using createRequire for better compatibility
		const require = createRequire(import.meta.url);
		const blessed = require("bblessed");
		return blessed;
	} catch {
		try {
			// Fallback to dynamic import
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore — module may not exist at runtime.
			const mod = await import("bblessed");
			return mod.default ?? mod;
		} catch {
			return null;
		}
	}
}

// Ask the user for a single line of input.  Falls back to readline.
export async function promptText(message: string, defaultValue = ""): Promise<string> {
	const blessed = await loadBlessed();
	if (!blessed) {
		// Fallback to readline prompt
		const { createInterface } = await import("node:readline/promises");
		const rl = createInterface({ input, output });
		const answer = (await rl.question(`${message} `)).trim();
		rl.close();
		return answer || defaultValue;
	}

	return new Promise<string>((resolve) => {
		const screen = blessed.screen({ smartCSR: true });

		const form = blessed.form({
			parent: screen,
			keys: true,
			left: "center",
			top: "center",
			width: "50%",
			height: 5,
			border: "line",
			label: ` ${message} `,
		});

		const textbox = blessed.textbox({
			parent: form,
			name: "input",
			inputOnFocus: true,
			top: 1,
			left: 1,
			width: "95%",
			height: 1,
			padding: { left: 1, right: 1 },
			border: "line",
			value: defaultValue,
		});

		textbox.focus();

		form.on("submit", (data: { input: string }) => {
			screen.destroy();
			resolve(data.input.trim());
		});

		screen.key(["enter"], () => {
			form.submit();
		});

		screen.key(["escape", "C-c"], () => {
			screen.destroy();
			resolve("");
		});

		screen.render();
	});
}

// Multi-select check-box style prompt.  Returns the values selected by the user.
export async function multiSelect<T extends string>(message: string, options: T[]): Promise<T[]> {
	const blessed = await loadBlessed();
	if (!blessed) {
		// Non-interactive fallback: nothing selected.
		return [];
	}

	return new Promise<T[]>((resolve) => {
		const screen = blessed.screen({ smartCSR: true });

		const list = blessed.list({
			parent: screen,
			label: ` ${message} `,
			width: "50%",
			height: "60%",
			top: "center",
			left: "center",
			border: "line",
			items: options.map((o) => `[ ] ${o}`),
			keys: true,
			vi: true,
			mouse: true,
		});

		const selected = new Set<number>();

		// biome-ignore lint/suspicious/noExplicitAny: blessed event handler
		list.on("select", (item: any, idx: number) => {
			if (selected.has(idx)) {
				selected.delete(idx);
			} else {
				selected.add(idx);
			}
			// Toggle indicator
			const prefix = selected.has(idx) ? "[x]" : "[ ]";
			list.setItem(idx, `${prefix} ${options[idx]}`);
			screen.render();
		});

		screen.key(["space"], () => {
			// emulate select event for current item
			const idx = list.selected ?? 0;
			list.emit("select", null, idx);
		});

		screen.key(["enter"], () => {
			const values = Array.from(selected).map((i) => options[i]);
			screen.destroy();
			resolve(values);
		});

		screen.key(["escape", "C-c"], () => {
			screen.destroy();
			resolve([]);
		});

		list.focus();
		screen.render();
	});
}

// Display long content in a scrollable viewer.
export async function scrollableViewer(content: string): Promise<void> {
	const blessed = await loadBlessed();
	if (!blessed) {
		console.log(content);
		return;
	}

	return new Promise<void>((resolve) => {
		const screen = blessed.screen({ smartCSR: true });

		const box = blessed.box({
			parent: screen,
			content,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			mouse: true,
			width: "100%",
			height: "100%",
			padding: { left: 1, right: 1 },
			wrap: true,
		});

		screen.key(["escape", "q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		box.focus();
		screen.render();
	});
}

// Display a list of items and allow selection. Returns selected item or null.
export async function selectList<T extends { id: string; title: string }>(
	title: string,
	items: T[],
	groupBy?: (item: T) => string,
): Promise<T | null> {
	const blessed = await loadBlessed();
	if (!blessed || items.length === 0) {
		return null;
	}

	return new Promise<T | null>((resolve) => {
		const screen = blessed.screen({ smartCSR: true });

		// Group items if groupBy is provided
		const groups = new Map<string, T[]>();
		if (groupBy) {
			for (const item of items) {
				const group = groupBy(item);
				if (!groups.has(group)) {
					groups.set(group, []);
				}
				const groupItems = groups.get(group);
				if (groupItems) {
					groupItems.push(item);
				}
			}
		}

		// Build display items
		const displayItems: string[] = [];
		const itemMap = new Map<number, T>();
		let index = 0;

		if (groupBy) {
			for (const [group, groupItems] of groups) {
				displayItems.push(formatHeading(group || "No Status", 2));
				itemMap.set(index++, null); // Group header
				for (const item of groupItems) {
					displayItems.push(`  ${item.id} - ${item.title}`);
					itemMap.set(index++, item);
				}
			}
		} else {
			for (const item of items) {
				displayItems.push(`${item.id} - ${item.title}`);
				itemMap.set(index++, item);
			}
		}

		const list = blessed.list({
			parent: screen,
			label: ` ${title} `,
			width: "90%",
			height: "90%",
			top: "center",
			left: "center",
			border: "line",
			items: displayItems,
			keys: true,
			vi: true,
			mouse: true,
			scrollable: true,
			alwaysScroll: true,
			tags: true,
			style: {
				selected: {
					bg: "blue",
					fg: "white",
				},
			},
		});

		// biome-ignore lint/suspicious/noExplicitAny: blessed event handler
		list.on("select", (item: any, idx: number) => {
			const selected = itemMap.get(idx);
			if (selected) {
				screen.destroy();
				resolve(selected);
			}
		});

		// Help text
		const help = blessed.box({
			parent: screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			content: " ↑/↓: Navigate | Enter: Select | q/Esc: Cancel ",
			style: {
				fg: "white",
				bg: "blue",
			},
		});

		screen.key(["escape", "q", "C-c"], () => {
			screen.destroy();
			resolve(null);
		});

		list.focus();
		screen.render();
	});
}
