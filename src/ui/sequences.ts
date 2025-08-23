import { stdout as output } from "node:process";
import blessed from "blessed";
import type { Sequence } from "../types/index.ts";
import { createScreen } from "./tui.ts";

/**
 * Render a simple read-only TUI for sequences.
 * - Vertical layout: each sequence has a header and its tasks listed below.
 * - Exit with 'q' or 'Esc'.
 */
export async function runSequencesView(sequences: Sequence[]): Promise<void> {
	// Build content string first so we can also support headless environments (CI/tests)
	const lines: string[] = [];
	for (const seq of sequences) {
		lines.push(`Sequence ${seq.index}:`);
		for (const t of seq.tasks) {
			lines.push(`  ${t.id} - ${t.title}`);
		}
	}

	// Headless/CI fallback: when not a TTY or explicitly requested, just print text content
	const forceHeadless = process.env.BACKLOG_HEADLESS === "1" || process.env.CI === "1" || process.env.CI === "true";
	if (output.isTTY === false || forceHeadless) {
		console.log(lines.join("\n"));
		return;
	}

	const screen = createScreen({ smartCSR: true });

	const container = blessed.box({
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		keys: true,
		scrollable: true,
		alwaysScroll: true,
		mouse: true,
		vi: false,
		tags: false,
		border: { type: "line" },
		label: " Sequences (read-only) ",
		scrollbar: { ch: " ", inverse: true },
		style: {
			border: { fg: "gray" },
			scrollbar: { bg: "gray" },
		},
	});

	// Build bordered blocks for each sequence
	let y = 0;
	for (const seq of sequences) {
		const tasksText = seq.tasks.map((t) => `  ${t.id} - ${t.title}`).join("\n");
		// Approximate height: number of task lines + border padding (2)
		const h = Math.max(3, seq.tasks.length + 2);
		blessed.box({
			parent: container,
			top: y,
			left: 0,
			right: 0,
			height: h,
			border: { type: "line" },
			label: ` Sequence ${seq.index} `,
			tags: false,
			content: tasksText,
			style: { border: { fg: "cyan" } },
		});
		y += h + 1; // 1 line gap between blocks
	}

	screen.append(container);

	// Footer hint
	const footer = blessed.box({
		bottom: 0,
		left: 0,
		right: 0,
		height: 1,
		tags: true,
		style: { bg: "black", fg: "gray" },
		content: " Press q or Esc to exit ",
	});
	screen.append(footer);

	// Focus and keybindings
	container.focus();
	screen.key(["q", "C-c", "escape"], () => {
		screen.destroy();
	});

	screen.render();
}
