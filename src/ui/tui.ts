/*
 * Lightweight wrapper around the `blessed` terminal UI library.
 *
 * With Bun's `--compile` the dependency is bundled, so we import it
 * directly and only fall back to plain text when not running in a TTY.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdin as input, stdout as output } from "node:process";
import blessed from "blessed";
import { formatHeading } from "./heading.ts";

// Ask the user for a single line of input.  Falls back to readline.
export async function promptText(message: string, defaultValue = ""): Promise<string> {
	// Always use readline for simple text input to avoid blessed rendering quirks
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input, output });
	const answer = (await rl.question(`${message} `)).trim();
	rl.close();
	return answer || defaultValue;
}

// Multi-select check-box style prompt.  Returns the values selected by the user.
export async function multiSelect<T extends string>(message: string, options: T[]): Promise<T[]> {
	// Use simple console-based interface for reliability
	console.log(`\n${message}`);
	console.log("Use ↑/↓ to navigate, SPACE to select/deselect, ENTER to confirm\n");

	const selected = new Set<number>();
	let currentIndex = 0;

	const renderOptions = () => {
		// Clear previous output
		process.stdout.write("\x1B[2J\x1B[0f");
		console.log(`\n${message}`);
		console.log("Use ↑/↓ to navigate, SPACE to select/deselect, ENTER to confirm\n");

		options.forEach((option, index) => {
			const isSelected = selected.has(index);
			const isCurrent = index === currentIndex;
			const checkbox = isSelected ? "[✓]" : "[ ]";
			const pointer = isCurrent ? "❯" : " ";
			const highlight = isCurrent ? "\x1b[36m" : ""; // cyan for current
			const reset = isCurrent ? "\x1b[0m" : "";

			console.log(`${pointer} ${highlight}${checkbox} ${option}${reset}`);
		});

		console.log("\nPress ENTER to continue...");
	};

	return new Promise<T[]>((resolve) => {
		if (options.length === 0) {
			resolve([]);
			return;
		}

		renderOptions();

		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.setEncoding("utf8");

		const onKeyPress = (key: string) => {
			switch (key) {
				case "\u001b[A": // Up arrow
					currentIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
					renderOptions();
					break;
				case "\u001b[B": // Down arrow
					currentIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
					renderOptions();
					break;
				case " ": // Space
					if (selected.has(currentIndex)) {
						selected.delete(currentIndex);
					} else {
						selected.add(currentIndex);
					}
					renderOptions();
					break;
				case "\r": // Enter
				case "\n": {
					process.stdin.setRawMode(false);
					process.stdin.pause();
					process.stdin.removeListener("data", onKeyPress);
					const selectedOptions = Array.from(selected).map((i) => options[i]);
					console.log(`\nSelected: ${selectedOptions.length > 0 ? selectedOptions.join(", ") : "none"}\n`);
					resolve(selectedOptions);
					break;
				}
				case "\u0003": // Ctrl+C
				case "\u001b": // Escape
					process.stdin.setRawMode(false);
					process.stdin.pause();
					process.stdin.removeListener("data", onKeyPress);
					console.log("\nCancelled.\n");
					resolve([]);
					break;
			}
		};

		process.stdin.on("data", onKeyPress);
	});
}

// Display long content in a scrollable viewer.
export async function scrollableViewer(content: string): Promise<void> {
	if (output.isTTY === false) {
		console.log(content);
		return;
	}

	return new Promise<void>((resolve) => {
		const screen = blessed.screen({
			smartCSR: true,
			style: { fg: "white", bg: "black" },
		});

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
	if (output.isTTY === false || items.length === 0) {
		return null;
	}

	return new Promise<T | null>((resolve) => {
		const screen = blessed.screen({
			smartCSR: true,
			style: { fg: "white", bg: "black" },
		});

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
				item: { fg: "white", bg: "black" },
				selected: { bg: "blue", fg: "white" },
				border: { fg: "white" },
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
