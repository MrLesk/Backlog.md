import { stdout as output } from "node:process";
import type { BoxInterface } from "neo-neo-bblessed";
import { box, scrollablebox } from "neo-neo-bblessed";
import type { Core } from "../index.ts";
import type { Sequence, Task } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { createTaskPopup } from "./task-viewer.ts";
import { createScreen } from "./tui.ts";

/**
 * Render a simple read-only TUI for sequences.
 * - Vertical layout: each sequence has a header and its tasks listed below.
 * - Exit with 'q' or 'Esc'.
 */
export async function runSequencesView(
	data: { unsequenced: Task[]; sequences: Sequence[] },
	core?: Core,
): Promise<void> {
	// Build content string first so we can also support headless environments (CI/tests)
	const lines: string[] = [];
	if (data.unsequenced.length > 0) {
		lines.push("Unsequenced:");
		for (const t of data.unsequenced) lines.push(`  ${t.id} - ${t.title}`);
		lines.push("");
	}
	for (const seq of data.sequences) {
		lines.push(`Sequence ${seq.index}:`);
		for (const t of seq.tasks) {
			lines.push(`  ${t.id} - ${t.title}`);
		}
		lines.push("");
	}

	// Headless/CI fallback: when not a TTY or explicitly requested, just print text content
	const forceHeadless = process.env.BACKLOG_HEADLESS === "1" || process.env.CI === "1" || process.env.CI === "true";
	if (output.isTTY === false || forceHeadless) {
		console.log(lines.join("\n"));
		return;
	}

	const screen = createScreen({ smartCSR: true });

	const container = scrollablebox({
		top: 0,
		left: 0,
		right: 0,
		height: "100%-1",
		keys: true,
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

	// Build bordered blocks for unsequenced and sequences, and individual task lines (for selection)
	let y = 0;
	type TaskLine = {
		node: BoxInterface;
		globalIndex: number;
		seqIdx: number;
		taskIdx: number;
		absTop: number; // absolute top inside container
	};
	const taskLines: TaskLine[] = [];
	// Keep references to sequence blocks for visual indicator during move mode
	const seqBlocks: { node: BoxInterface; index: number }[] = [];
	let global = 0;
	// Unsequenced block first
	if (data.unsequenced.length > 0) {
		const h = Math.max(4, data.unsequenced.length + 4);
		const block = box({
			parent: container,
			top: y,
			left: 0,
			right: 0,
			height: h,
			border: { type: "line" },
			label: " Unsequenced ",
			tags: false,
			style: { border: { fg: "cyan" } },
		});
		// Track for move target highlighting using index -1
		seqBlocks.push({ node: block, index: -1 });
		for (let t = 0; t < data.unsequenced.length; t++) {
			const lineTop = t + 1;
			const task = data.unsequenced[t];
			if (!task) continue;
			const node = box({
				parent: block,
				top: lineTop,
				left: 1,
				right: 1,
				height: 1,
				tags: true,
				content: `  ${task.id} - ${task.title}`,
			});
			taskLines.push({ node, globalIndex: global++, seqIdx: -1, taskIdx: t, absTop: y + lineTop });
		}
		y += h + 1;
	}

	for (let s = 0; s < data.sequences.length; s++) {
		const seq = data.sequences[s];
		if (!seq) continue;
		const tasksSorted = [...seq.tasks].sort((a, b) => {
			const ao = a.ordinal ?? Number.MAX_SAFE_INTEGER;
			const bo = b.ordinal ?? Number.MAX_SAFE_INTEGER;
			if (ao !== bo) return ao - bo;
			return a.id.localeCompare(b.id);
		});
		// Height calculation:
		// - 2 lines for border
		// - +1 top padding line, +1 bottom padding line so content doesn't overlap borders
		const h = Math.max(4, tasksSorted.length + 4);
		const block = box({
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

		seqBlocks.push({ node: block, index: seq.index });

		for (let t = 0; t < tasksSorted.length; t++) {
			// Render inside bordered content area
			const lineTop = t + 1;
			const task = tasksSorted[t];
			if (!task) continue;
			const node = box({
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
	const footer = box({
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
	let moveMode = false;
	let targetSeqIndex = data.sequences[0]?.index ?? (data.unsequenced.length > 0 ? -1 : 1);
	function refreshHighlight() {
		for (const tl of taskLines) {
			const seq = data.sequences[tl.seqIdx];
			const isUnseq = tl.seqIdx === -1;
			const task = isUnseq ? data.unsequenced[tl.taskIdx] : seq?.tasks[tl.taskIdx];
			if (!task) continue;
			const prefix = moveMode && tl.globalIndex === selected ? "->" : "  ";
			const text = `${prefix} ${task.id} - ${task.title}`;
			if (tl.globalIndex === selected && !moveMode) {
				// Normal selection highlight when not in move mode
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

	function refreshMoveIndicators() {
		// Highlight target sequence block border in move mode
		for (const blk of seqBlocks) {
			const isTarget = moveMode && blk.index === targetSeqIndex;
			blk.node.style = { ...(blk.node.style || {}), border: { fg: isTarget ? "yellow" : "cyan" } } as unknown;
		}
		screen.render();
	}

	function move(delta: number) {
		if (popupOpen) return;
		if (moveMode) {
			// Change target among [-1 (Unsequenced, if present), sequence indices]
			const idxs = [data.unsequenced.length > 0 ? -1 : undefined, ...data.sequences.map((s) => s.index)].filter(
				(v): v is number => v !== undefined,
			);
			const pos = idxs.indexOf(targetSeqIndex);
			const nextPos = Math.max(0, Math.min(idxs.length - 1, pos + delta));
			targetSeqIndex = idxs[nextPos] ?? targetSeqIndex;
			refreshHighlight();
			refreshMoveIndicators();
			return;
		}
		if (taskLines.length === 0) return;
		selected = Math.max(0, Math.min(taskLines.length - 1, selected + delta));
		refreshHighlight();
	}

	async function openDetail() {
		if (!core) return;
		const item = taskLines.find((t) => t.globalIndex === selected);
		if (!item) return;
		const seq = data.sequences[item.seqIdx];
		const task = item.seqIdx === -1 ? data.unsequenced[item.taskIdx] : seq?.tasks[item.taskIdx];
		if (!task) return;
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
	// Unified Esc: popup closes itself; else cancel move mode, else quit
	screen.key(["escape"], () => {
		if (popupOpen) return;
		if (moveMode) {
			moveMode = false;
			footer.setContent(" ↑/↓ navigate · Enter view · q quit · Esc close popup/quit ");
			refreshHighlight();
			refreshMoveIndicators();
			return;
		}
		screen.destroy();
	});
	screen.key(["up", "k"], () => move(-1));
	screen.key(["down", "j"], () => move(1));
	// Toggle move mode with 'm'
	screen.key(["m", "M"], () => {
		if (popupOpen) return;
		moveMode = !moveMode;
		// Default target is the selected task's current sequence
		const item = taskLines.find((t) => t.globalIndex === selected);
		if (item) targetSeqIndex = item.seqIdx === -1 ? -1 : (data.sequences[item.seqIdx]?.index ?? targetSeqIndex);
		// Update footer to indicate mode
		footer.setContent(
			moveMode
				? " Move mode: ↑/↓ choose target · Enter apply · Esc cancel "
				: " ↑/↓ navigate · Enter view · q quit · Esc close popup/quit ",
		);
		refreshHighlight();
		refreshMoveIndicators();
	});
	screen.key(["enter"], async () => {
		if (!moveMode) {
			await openDetail();
			return;
		}
		if (!core) return;
		const item = taskLines.find((t) => t.globalIndex === selected);
		if (!item) return;
		const seq2 = data.sequences[item.seqIdx];
		const task = item.seqIdx === -1 ? data.unsequenced[item.taskIdx] : seq2?.tasks[item.taskIdx];
		if (!task) return;
		// Persist changes based on target
		const allTasks = await core.filesystem.listTasks();
		if (targetSeqIndex === -1) {
			// Only allow if isolated (no deps and no dependents)
			const allIds = new Set(allTasks.map((t) => t.id));
			const hasDeps = (task.dependencies || []).some((d) => allIds.has(d));
			const hasDependents = allTasks.some((t) => (t.dependencies || []).includes(task.id));
			if (hasDeps || hasDependents) {
				footer.setContent(" Cannot move to Unsequenced: task has dependencies or dependents · Esc cancel ");
				screen.render();
				return;
			}
			const byId = new Map(allTasks.map((t) => [t.id, { ...t }]));
			const moved = byId.get(task.id);
			if (moved) {
				moved.dependencies = [];
				await core.updateTasksBulk([moved], `Move ${task.id} to Unsequenced`);
			}
		} else {
			const { adjustDependenciesForMove } = await import("../core/sequences.ts");
			const updated = adjustDependenciesForMove(allTasks, data.sequences, task.id, targetSeqIndex);
			// If moving from Unsequenced to Sequence 1 and deps remain empty, set an ordinal to keep it sequenced
			if (targetSeqIndex === 1 && item.seqIdx === -1) {
				const movedU = updated.find((x) => x.id === task.id);
				if (movedU && (!movedU.dependencies || movedU.dependencies.length === 0)) {
					if (movedU.ordinal === undefined) movedU.ordinal = 0;
				}
			}
			const byIdOrig = new Map(allTasks.map((t) => [t.id, t]));
			const changed: Task[] = [];
			for (const u of updated) {
				const orig = byIdOrig.get(u.id);
				if (!orig) continue;
				const depsChanged = JSON.stringify(orig.dependencies) !== JSON.stringify(u.dependencies);
				const ordChanged = (orig.ordinal ?? null) !== (u.ordinal ?? null);
				if (depsChanged || ordChanged) changed.push(u);
			}
			if (changed.length > 0) {
				await core.updateTasksBulk(changed, `Update dependencies/order for move of ${task.id}`);
			}
		}
		// Reload and rerender
		const tasksNew = await core.filesystem.listTasks();
		const active = tasksNew.filter((t) => (t.status || "").toLowerCase() !== "done");
		const { computeSequences: recompute } = await import("../core/sequences.ts");
		const next = recompute(active);
		screen.destroy();
		await runSequencesView(next, core);
	});

	refreshHighlight();
	refreshMoveIndicators();
}
