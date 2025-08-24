import { stdout as output } from "node:process";
import blessed from "blessed";
import type { Core } from "../index.ts";
import type { Sequence } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { createTaskPopup } from "./task-viewer.ts";
import { createScreen } from "./tui.ts";

/**
 * Render a simple read-only TUI for sequences.
 * - Vertical layout: each sequence has a header and its tasks listed below.
 * - Exit with 'q' or 'Esc'.
 */
export async function runSequencesView(sequences: Sequence[], core?: Core): Promise<void> {
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

	// Build bordered blocks for each sequence and individual task lines (for selection)
	let y = 0;
	type TaskLine = {
		node: any;
		globalIndex: number;
		seqIdx: number;
		taskIdx: number;
		absTop: number; // absolute top inside container
	};
	const taskLines: TaskLine[] = [];
	let global = 0;
	for (let s = 0; s < sequences.length; s++) {
		const seq = sequences[s]!;
		const h = Math.max(3, seq.tasks.length + 2);
		const block = blessed.box({
			parent: container,
			top: y,
			left: 0,
			right: 0,
			height: h,
			border: { type: "line" },
			label: ` Sequence ${seq.index} `,
			tags: false,
			style: { border: { fg: "cyan" } },
		});

		for (let t = 0; t < seq.tasks.length; t++) {
			const lineTop = t; // start at content top, no extra blank line
			const task = seq.tasks[t]!;
			const node = blessed.box({
				parent: block,
				top: lineTop,
				left: 1,
				right: 1,
				height: 1,
				tags: true,
				content: `  ${task.id} - ${task.title}`,
			});
			taskLines.push({ node, globalIndex: global++, seqIdx: s, taskIdx: t, absTop: y + lineTop });
		}

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
		content: " ↑/↓ navigate · Enter view · q quit · Esc close popup/quit ",
	});
	screen.append(footer);

	// Navigation and keybindings
	let selected = 0;
	let popupOpen = false;
	function refreshHighlight() {
		for (const tl of taskLines) {
			const task = sequences[tl.seqIdx]!.tasks[tl.taskIdx]!;
			const text = `  ${task.id} - ${task.title}`;
			if (tl.globalIndex === selected) {
				tl.node.setContent(`{inverse}${text}{/inverse}`);
			} else {
				tl.node.setContent(text);
			}
		}
		// Ensure selected line is in view
		const tl = taskLines.find((t) => t.globalIndex === selected);
		if (tl) {
			const viewTop = container.getScroll();
			const viewHeight = typeof container.height === "number" ? (container.height as number) : 0;
			if (tl.absTop < viewTop + 1) {
				container.scrollTo(Math.max(0, tl.absTop - 1));
			} else if (viewHeight && tl.absTop > viewTop + viewHeight - 4) {
				container.scrollTo(Math.max(0, tl.absTop - viewHeight + 4));
			}
		}
		screen.render();
	}

	function move(delta: number) {
		if (popupOpen) return;
		if (taskLines.length === 0) return;
		selected = Math.max(0, Math.min(taskLines.length - 1, selected + delta));
		refreshHighlight();
	}

	async function openDetail() {
		if (!core) return;
		const item = taskLines.find((t) => t.globalIndex === selected);
		if (!item) return;
		const task = sequences[item.seqIdx]!.tasks[item.taskIdx]!;
		if (popupOpen) return;
		popupOpen = true;

		let content = "";
		try {
			const filePath = await getTaskPath(task.id, core);
			if (filePath) content = await Bun.file(filePath).text();
		} catch {
			/* ignore */
		}

		const popup = await createTaskPopup(screen, task, content);
		if (!popup) {
			popupOpen = false;
			return;
		}
		const { contentArea, close } = popup;
		contentArea.key(["escape", "q"], () => {
			popupOpen = false;
			close();
			container.focus();
		});
		screen.render();
	}

	container.focus();
	screen.key(["q", "C-c"], () => screen.destroy());
	// Global Esc: if popup is open, contentArea handler will catch it; otherwise quit
	screen.key(["escape"], () => {
		if (!popupOpen) screen.destroy();
	});
	screen.key(["up", "k"], () => move(-1));
	screen.key(["down", "j"], () => move(1));
	screen.key(["enter"], () => void openDetail());

	refreshHighlight();
}
