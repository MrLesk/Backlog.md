import { stdout as output } from "node:process";
import type { BoxInterface } from "neo-neo-bblessed";
import { box, scrollablebox } from "neo-neo-bblessed";
import type { Core } from "../index.ts";
import type { Sequence, Task } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { createTaskPopup } from "./task-viewer-with-search.ts";
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
	const seqBlocks: { node: BoxInterface; index: number; top: number; height: number }[] = [];
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
		seqBlocks.push({ node: block, index: -1, top: y, height: h });
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

		seqBlocks.push({ node: block, index: seq.index, top: y, height: h });

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
		content: " ↑/↓ navigate · Enter view · m move · q quit · Esc close popup/quit ",
	});
	screen.append(footer);

	// Navigation and keybindings
	let selected = 0;
	let popupOpen = false;
	let moveMode = false;

	type MoveTarget = { kind: "unsequenced" } | { kind: "sequence"; seqIndex: number } | { kind: "between"; k: number };

	// Build move targets: optional Unsequenced, and interleaved sequence + between K and K+1 (no top/bottom)
	const seqIdxs = data.sequences.map((s) => s.index);
	const moveTargets: MoveTarget[] = [];
	if (data.unsequenced.length > 0) moveTargets.push({ kind: "unsequenced" });
	for (let i = 0; i < seqIdxs.length; i++) {
		const seqIndex = seqIdxs[i] as number;
		moveTargets.push({ kind: "sequence", seqIndex });
		// Drop zone only between this sequence and the next
		if (i < seqIdxs.length - 1) moveTargets.push({ kind: "between", k: seqIndex });
	}
	let targetPos = 0;

	// Drop zone overlay boxes (visible only in move mode)
	const dropZoneBoxes = new Map<number, BoxInterface>();

	function _pickNumber(arr: number[], idx: number, fallback: number): number {
		const v = arr[idx];
		return typeof v === "number" ? v : fallback;
	}

	function hideDropZones() {
		for (const [, node] of dropZoneBoxes) node.destroy();
		dropZoneBoxes.clear();
	}

	function ensureDropZoneOverlays() {
		hideDropZones();
		if (!moveMode) return;
		// Build overlays using sequence blocks only (index > 0)
		const seqOnly = seqBlocks.filter((b) => b.index > 0).sort((a, b) => a.index - b.index);
		if (seqOnly.length === 0) return;
		// between each pair (k = index of upper sequence)
		for (let i = 0; i < seqOnly.length - 1; i++) {
			const prev = seqOnly[i];
			if (!prev) continue;
			const yPos = prev.top + prev.height; // gap line between blocks
			const k = prev.index; // between Sequence k and k+1
			const node = box({
				parent: container,
				top: yPos,
				left: 0,
				right: 0,
				height: 1,
				style: { bg: "black", fg: "gray" },
				content: ` ▼ Drop between Sequence ${k} and ${k + 1} `,
			});
			dropZoneBoxes.set(k, node);
		}
		// No top/bottom overlays
	}

	function moveFooterText(): string {
		const tgt = moveTargets[targetPos];
		let suffix = "";
		if (tgt) {
			if (tgt.kind === "unsequenced") suffix = " · Target: Unsequenced";
			else if (tgt.kind === "sequence") suffix = ` · Target: Sequence ${tgt.seqIndex}`;
			else if (tgt.kind === "between") suffix = ` · Target: Between Sequence ${tgt.k} and ${tgt.k + 1}`;
		}
		return ` Move mode: ↑/↓ choose target · Enter apply · Esc cancel${suffix} `;
	}
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
		// Reset all to default
		for (const blk of seqBlocks) {
			blk.node.style = { ...(blk.node.style || {}), border: { fg: "cyan" } } as unknown;
		}
		// Reset overlays
		for (const [, dz] of dropZoneBoxes) dz.style = { ...(dz.style || {}), fg: "gray" } as unknown;
		if (moveMode) {
			const tgt = moveTargets[targetPos];
			if (tgt?.kind === "sequence") {
				for (const blk of seqBlocks) {
					if (blk.index === tgt.seqIndex) {
						blk.node.style = {
							...(blk.node.style || {}),
							border: { fg: "yellow", /* pseudo-thicker */ bold: true },
						} as unknown;
					}
				}
			} else if (tgt?.kind === "between") {
				const k = tgt.k;
				// Do not highlight adjacent sequences for drop-zones; only the drop-zone line itself
				const dz = dropZoneBoxes.get(k);
				if (dz) dz.style = { ...(dz.style || {}), fg: "yellow" } as unknown;
			}
		}
		screen.render();
	}

	function move(delta: number) {
		if (popupOpen) return;
		if (moveMode) {
			const nextPos = Math.max(0, Math.min(moveTargets.length - 1, targetPos + delta));
			targetPos = nextPos;
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
			footer.setContent(" ↑/↓ navigate · Enter view · m move · q quit · Esc close popup/quit ");
			hideDropZones();
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
		if (item) {
			if (item.seqIdx === -1) {
				// If unsequenced, select Unsequenced target when available, else top-between
				const pos = moveTargets.findIndex((t) => t.kind === "unsequenced");
				targetPos =
					pos >= 0
						? pos
						: Math.max(
								0,
								moveTargets.findIndex((t) => t.kind === "between" && t.k === 0),
							);
			} else {
				const seqIndex = data.sequences[item.seqIdx]?.index;
				const pos = moveTargets.findIndex((t) => t.kind === "sequence" && t.seqIndex === seqIndex);
				targetPos = pos >= 0 ? pos : 0;
			}
		}
		// Update footer to indicate mode and overlays
		footer.setContent(
			moveMode ? moveFooterText() : " ↑/↓ navigate · Enter view · m move · q quit · Esc close popup/quit ",
		);
		ensureDropZoneOverlays();
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
		const tgt = moveTargets[targetPos];
		if (tgt?.kind === "unsequenced") {
			const { planMoveToUnsequenced } = await import("../core/sequences.ts");
			const res = planMoveToUnsequenced(allTasks, task.id);
			if (!res.ok) {
				footer.setContent(` ${res.error} · Esc cancel `);
				screen.render();
				return;
			}
			await core.updateTasksBulk(res.changed, `Move ${task.id} to Unsequenced`);
		} else if (tgt?.kind === "sequence") {
			const { planMoveToSequence } = await import("../core/sequences.ts");
			const changed = planMoveToSequence(allTasks, data.sequences, task.id, tgt.seqIndex);
			if (changed.length > 0) await core.updateTasksBulk(changed, `Update dependencies/order for move of ${task.id}`);
		} else if (tgt?.kind === "between") {
			const { adjustDependenciesForInsertBetween } = await import("../core/sequences.ts");
			const updated = adjustDependenciesForInsertBetween(allTasks, data.sequences, task.id, tgt.k);
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
				await core.updateTasksBulk(changed, `Insert new sequence via drop between for ${task.id}`);
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
	ensureDropZoneOverlays();
	refreshMoveIndicators();
}
