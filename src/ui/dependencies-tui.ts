/*
 * Interactive dependency graph view for `backlog task dependencies`.
 *
 * Renders exactly the tree the plain serializer prints, one list row per line, and lets the user
 * walk the graph: arrow keys or j/k move between task rows, Enter or a mouse click re-roots the
 * view on the selected task, Esc/q leaves. Unresolved identities and cycle markers are shown the
 * way every surface shows them and are never navigated into.
 */

import { stdout as output } from "node:process";
import { box, list } from "neo-neo-bblessed";
import type { Core } from "../core/backlog.ts";
import { loadTaskCorpus, loadTaskDetail, toTaskDetail } from "../core/task-detail.ts";
import { formatDependencyGraphEntries, formatDependencyNodeLabel } from "../formatters/dependency-graph-text.ts";
import { formatTaskDependenciesPlainText } from "../formatters/task-plain-text.ts";
import type { Task } from "../types/index.ts";
import type { DependencyGraphNode } from "../utils/dependency-graph.ts";
import { canonicalTaskId } from "../utils/task-id.ts";
import { createTaskRecordIndex } from "../utils/task-record-index.ts";
import { formatStatusWithIcon, getStatusColor, wrapStatusColor } from "./status-icon.ts";
import { createScreen, formatTuiTitle } from "./tui.ts";
import { stripBlessedFgTags } from "./utils/strip-tags.ts";

/** Blessed reads `{...}` as style tags, so a stored title's braces must render as characters. */
export function escapeBlessedTags(text: string): string {
	return text.replace(/[{}]/g, (brace) => (brace === "{" ? "{open}" : "{close}"));
}

/**
 * The shared node label, colored for the terminal. Unresolved identities are called out, finished
 * work recedes, and the wording itself stays the one every surface uses.
 */
export function formatDependencyNodeTuiLabel(node: DependencyGraphNode): string {
	const label = escapeBlessedTags(formatDependencyNodeLabel(node));
	if (node.state !== "resolved") return `{yellow-fg}${label}{/}`;
	if (node.completed) return `{gray-fg}${label}{/}`;
	return label;
}

/** A rendered line that names a graph node, addressable by its position in the list. */
type GraphRow = { displayIndex: number; node: DependencyGraphNode };

/**
 * Open the dependency graph of `root` in the terminal.
 *
 * The corpus is loaded once and every re-rooted view resolves against it, which is the same
 * fail-closed resolution the plain output uses: a node the graph reports as missing or ambiguous
 * is rendered but never followed.
 */
export async function runTaskDependenciesTui(core: Core, root: Task): Promise<void> {
	if (output.isTTY === false) {
		console.log(formatTaskDependenciesPlainText(await loadTaskDetail(core, root)));
		return;
	}

	const [corpus, config] = await Promise.all([loadTaskCorpus(core), core.filesystem.loadConfig()]);
	const index = createTaskRecordIndex(corpus);
	const rootDetail = toTaskDetail(root, corpus);
	if (formatDependencyGraphEntries(rootDetail.dependencyGraph).length === 0) {
		console.log(formatTaskDependenciesPlainText(rootDetail));
		return;
	}

	const projectName = config?.projectName;

	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: formatTuiTitle(`Dependencies ${root.id}`, projectName) });

		const header = box({ parent: screen, top: 0, left: 0, width: "100%", height: 1, tags: true });
		const listBox = list({
			parent: screen,
			label: " Dependency Graph ",
			top: 1,
			left: 0,
			width: "100%",
			height: "100%-2",
			border: { type: "line" },
			style: { border: { fg: "gray" }, selected: { inverse: true, bold: true }, item: {} },
			tags: true,
			keys: false,
			mouse: true,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: { ch: " ", inverse: true },
		});
		box({
			parent: screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			tags: true,
			content: " {cyan-fg}[↑↓/jk]{/} Nav | {cyan-fg}[Enter/Click]{/} Open task | {cyan-fg}[Esc/q]{/} Quit",
		});

		let current: Task = root;
		let rows: GraphRow[] = [];
		let itemTexts: string[] = [];
		const rowByDisplayIndex = new Map<number, GraphRow>();
		let selectedRow = 0;
		let highlightedDisplay: number | null = null;
		let updatingSelection = false;

		const setItemText = (displayIndex: number, text: string) => {
			const widget = listBox as unknown as {
				items?: unknown[];
				setItem?: (itemIndex: number, content: string) => void;
			};
			if (!widget.items?.[displayIndex]) return;
			widget.setItem?.(displayIndex, text);
		};

		/** Highlight one task row: blessed selection follows it and its colors yield to the inverse bar. */
		const setRow = (rowIndex: number, options: { render?: boolean } = {}) => {
			const row = rows[rowIndex];
			if (!row) return;
			if (highlightedDisplay !== null && highlightedDisplay !== row.displayIndex) {
				const previous = itemTexts[highlightedDisplay];
				if (previous !== undefined) setItemText(highlightedDisplay, previous);
			}
			selectedRow = rowIndex;
			updatingSelection = true;
			try {
				listBox.select(row.displayIndex);
			} finally {
				updatingSelection = false;
			}
			const text = itemTexts[row.displayIndex];
			if (text !== undefined) setItemText(row.displayIndex, stripBlessedFgTags(text));
			highlightedDisplay = row.displayIndex;
			if (options.render !== false) screen.render();
		};

		const renderGraph = (task: Task) => {
			current = task;
			const detail = toTaskDetail(task, corpus);
			const entries = formatDependencyGraphEntries(detail.dependencyGraph, {
				formatLabel: formatDependencyNodeTuiLabel,
			});
			rows = [];
			rowByDisplayIndex.clear();
			highlightedDisplay = null;
			itemTexts = entries.map((entry, displayIndex) => {
				if (entry.node) {
					const row: GraphRow = { displayIndex, node: entry.node };
					rows.push(row);
					rowByDisplayIndex.set(displayIndex, row);
				}
				return entry.node ? entry.text : entry.text && `{bold}${entry.text}{/bold}`;
			});
			// setItems re-selects internally; the guard keeps the snap handler out of the rebuild.
			updatingSelection = true;
			try {
				listBox.setItems([...itemTexts]);
			} finally {
				updatingSelection = false;
			}
			header.setContent(
				` ${wrapStatusColor(formatStatusWithIcon(task.status), getStatusColor(task.status))} {bold}{blue-fg}${task.id}{/blue-fg}{/bold} - ${escapeBlessedTags(task.title)}`,
			);
			screen.title = formatTuiTitle(`Dependencies ${task.id}`, projectName);
			setRow(0, { render: false });
			screen.render();
		};

		/** Re-root on a row's task. Unresolved identities fail closed: shown, never followed. */
		const openRow = (row: GraphRow | undefined) => {
			if (row?.node.state !== "resolved") return;
			const record = index.lookup(row.node.id);
			if (record === undefined || record === "ambiguous") return;
			if (canonicalTaskId(record.task.id) === canonicalTaskId(current.id)) return;
			renderGraph(record.task);
		};

		listBox.key(["up", "k"], () => setRow(selectedRow > 0 ? selectedRow - 1 : rows.length - 1));
		listBox.key(["down", "j"], () => setRow(selectedRow < rows.length - 1 ? selectedRow + 1 : 0));
		listBox.key(["enter"], () => openRow(rows[selectedRow]));

		// Blessed moves its own selection on mouse wheel and click, and may land on a heading or
		// separator line; snap to the nearest task row instead of highlighting a non-task line.
		listBox.on("select item", (_item: unknown, displayIndex: unknown) => {
			if (updatingSelection || typeof displayIndex !== "number") return;
			const row = rowByDisplayIndex.get(displayIndex);
			if (row) {
				setRow(rows.indexOf(row));
				return;
			}
			let nearest = 0;
			let nearestDistance = Number.POSITIVE_INFINITY;
			rows.forEach((candidate, rowIndex) => {
				const distance = Math.abs(candidate.displayIndex - displayIndex);
				if (distance < nearestDistance) {
					nearest = rowIndex;
					nearestDistance = distance;
				}
			});
			if (rows.length > 0) setRow(nearest);
		});

		// A single click on a task row both selects it (blessed's own handler) and opens it.
		listBox.on("element click", (element: unknown) => {
			const items = (listBox as unknown as { items?: unknown[] }).items ?? [];
			const displayIndex = items.indexOf(element);
			if (displayIndex < 0) return;
			openRow(rowByDisplayIndex.get(displayIndex));
		});

		screen.key(["escape", "q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		// neo-neo-bblessed binds its mouse parser lazily via a newListener hook that does not fire
		// for the screen's own registration, leaving clicks dead. Binding explicitly is idempotent.
		(screen as unknown as { program: { bindMouse?: () => void } }).program.bindMouse?.();

		renderGraph(root);
		listBox.focus();
	});
}
