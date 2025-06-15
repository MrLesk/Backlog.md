/*
 * Lightweight wrapper around the `blessed` terminal UI library.
 *
 * With Bun's `--compile` the dependency is bundled, so we import it
 * directly and only fall back to plain text when not running in a TTY.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdin as input, stdout as output } from "node:process";
import blessed from "blessed";

// Ask the user for a single line of input.  Falls back to readline.
export async function promptText(message: string, defaultValue = ""): Promise<string> {
	// Always use readline for simple text input to avoid blessed rendering quirks
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input, output });
	const answer = (await rl.question(`${message} `)).trim();
	rl.close();
	return answer || defaultValue;
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
			tput: false,
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
