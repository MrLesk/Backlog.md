import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScreenInterface } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import { getHelpShortcuts } from "../ui/components/help-popup.ts";
import { createScreen } from "../ui/tui.ts";
import { initializeTestProject, retry, withTimeout } from "./test-utils.ts";

type EmittingWidget = {
	emit: (event: string, ch?: string, key?: { name: string; full: string; shift?: boolean }) => boolean;
};
type TreeWidget = {
	type?: string;
	children?: TreeWidget[];
	items?: Array<{ content?: string }>;
	content?: string;
	position?: { bottom?: number };
};

const STATUSES = ["To Do", "In Progress", "Done"];

function createTask(id: string, status: string, ordinal: number): Task {
	return {
		id,
		title: `Title for ${id}`,
		status,
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description: "",
		ordinal,
	};
}

function pressKey(widget: EmittingWidget, full: string, name = full.replace(/^S-/, "")): void {
	const key = { name, full, shift: full.startsWith("S-") };
	widget.emit("keypress", "", key);
	widget.emit(`key ${full}`, "", key);
}

/** Rendered rows of every task list on the board, flattened in render order. */
function renderedRows(root: TreeWidget): string[] {
	const rows: string[] = [];
	const visit = (node: TreeWidget) => {
		if (node.type === "list") {
			for (const item of node.items ?? []) rows.push(item.content ?? "");
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return rows;
}

/** The footer is the only box anchored to the bottom row of the screen. */
function footerText(root: TreeWidget): string {
	let found = "";
	const visit = (node: TreeWidget) => {
		if (node.type === "box" && node.position?.bottom === 0 && typeof node.content === "string") {
			found = node.content;
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return found;
}

let TEST_DIR: string;
let core: Core;

beforeEach(async () => {
	TEST_DIR = await mkdtemp(join(tmpdir(), "board-tui-batch-move-"));
	core = new Core(TEST_DIR);
	await initializeTestProject(core, "Board Batch Move");
	await core.createTask(createTask("TASK-1", "To Do", 1000), false);
	await core.createTask(createTask("TASK-2", "To Do", 2000), false);
	await core.createTask(createTask("TASK-3", "To Do", 3000), false);
});

afterEach(async () => {
	await rm(TEST_DIR, { recursive: true, force: true });
});

type BoardFilters = NonNullable<Parameters<typeof renderBoardTui>[4]>["filters"];

async function withBoard(
	run: (context: {
		screen: ScreenInterface & EmittingWidget;
		rows: () => string[];
		footer: () => string;
		quit: () => Promise<void>;
	}) => Promise<void> | void,
	filters?: BoardFilters,
): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
	const tasks = [
		createTask("TASK-1", "To Do", 1000),
		createTask("TASK-2", "To Do", 2000),
		createTask("TASK-3", "To Do", 3000),
	];
	try {
		const boardPromise = renderBoardTui(tasks, STATUSES, "horizontal", 20, { screen, core, filters });
		await Bun.sleep(20);
		let closed = false;
		const quit = async () => {
			if (closed) return;
			closed = true;
			pressKey(screen, "q");
			await withTimeout(boardPromise, "board close", 5000);
		};
		await run({
			screen,
			rows: () => renderedRows(screen as unknown as TreeWidget),
			footer: () => footerText(screen as unknown as TreeWidget),
			quit,
		});
		await quit();
	} finally {
		screen.destroy();
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

const markedRows = (rows: string[]) => rows.filter((row) => row.includes("●"));

describe("TUI board batch move", () => {
	it("marks the task the ghost stands on with M and unmarks it on a second press", async () => {
		await withBoard(({ screen, rows, footer }) => {
			pressKey(screen, "m");
			expect(footer()).toContain("MOVE MODE");
			expect(footer()).toContain("Mark task below");

			pressKey(screen, "m");
			expect(markedRows(rows())).toHaveLength(1);
			expect(footer()).toContain("MOVE 2 TASKS");

			pressKey(screen, "m");
			expect(markedRows(rows())).toHaveLength(0);
			expect(footer()).toContain("MOVE MODE");

			pressKey(screen, "escape");
		});
	});

	it("clears the marks and exits move mode on Escape", async () => {
		await withBoard(({ screen, rows, footer }) => {
			pressKey(screen, "m");
			pressKey(screen, "m");
			expect(markedRows(rows())).toHaveLength(1);

			pressKey(screen, "escape");
			expect(markedRows(rows())).toHaveLength(0);
			expect(footer()).not.toContain("MOVE");
		});
	});

	it("moves every marked task to the column the ghost lands in", async () => {
		await withBoard(async ({ screen, footer, rows, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "m");
			expect(footer()).toContain("MOVE 2 TASKS");

			pressKey(screen, "right");
			pressKey(screen, "enter");
			await retry(async () => {
				const first = await core.filesystem.loadTask("TASK-1");
				const second = await core.filesystem.loadTask("TASK-2");
				if (first?.status !== "In Progress" || second?.status !== "In Progress") {
					throw new Error("batch move not persisted yet");
				}
			});

			// The anchor keeps the previewed spot and the marked task lines up right behind it.
			const first = await core.filesystem.loadTask("TASK-1");
			const second = await core.filesystem.loadTask("TASK-2");
			expect(first?.ordinal ?? 0).toBeLessThan(second?.ordinal ?? 0);
			expect((await core.filesystem.loadTask("TASK-3"))?.status).toBe("To Do");
			expect(markedRows(rows())).toHaveLength(0);
			await quit();
		});
	});

	it("blocks marking behind the same filter guard as a single move", async () => {
		await withBoard(
			({ screen, footer }) => {
				pressKey(screen, "m");

				expect(footer()).toContain("Clear filters before moving tasks");
				expect(footer()).not.toContain("MOVE MODE");
			},
			{
				searchQuery: "",
				priorityFilter: "high",
				labelFilter: [],
				milestoneFilter: "",
			},
		);
	});

	it("keeps the single-task move flow as the one-task case", async () => {
		await withBoard(async ({ screen, footer, quit }) => {
			pressKey(screen, "m");
			expect(footer()).toContain("MOVE MODE");

			pressKey(screen, "right");
			pressKey(screen, "enter");
			await retry(async () => {
				const moved = await core.filesystem.loadTask("TASK-1");
				if (moved?.status !== "In Progress") throw new Error("move not persisted yet");
			});

			expect((await core.filesystem.loadTask("TASK-2"))?.status).toBe("To Do");
			await quit();
		});
	});

	it("reports the tasks it could not move", async () => {
		await withBoard(async ({ screen, footer, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "m");

			// Deleting the file behind the marked task makes the move fail for that task only.
			await core.archiveTask("TASK-2", false);

			pressKey(screen, "right");
			pressKey(screen, "enter");

			await retry(async () => {
				if (!footer().includes("failed 1")) throw new Error("failure not reported yet");
			});
			expect(footer()).toContain("TASK-2");
			expect((await core.filesystem.loadTask("TASK-1"))?.status).toBe("In Progress");
			await quit();
		});
	});

	it("documents the move key in the help popup", () => {
		const keys = getHelpShortcuts("board").map((shortcut) => shortcut.key);
		expect(keys).toContain("M");
		expect(keys).not.toContain("Space/M");
	});
});
