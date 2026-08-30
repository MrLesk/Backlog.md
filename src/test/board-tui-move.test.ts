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
	TEST_DIR = await mkdtemp(join(tmpdir(), "board-tui-move-"));
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

describe("TUI board single-task mover", () => {
	it("enters move mode on M and shows the move-mode footer", async () => {
		await withBoard(({ screen, footer }) => {
			pressKey(screen, "m");
			expect(footer()).toContain("MOVE MODE");
			expect(footer()).toContain("{cyan-fg}[Shift+↑↓]{/} Highlight");
			expect(footer()).toContain("{cyan-fg}[M]{/} Select");
			expect(footer()).toContain("{cyan-fg}[Enter]{/} Confirm");

			pressKey(screen, "escape");
			expect(footer()).not.toContain("MOVE MODE");
		});
	});

	it("moves only the selected task and confirms with Enter", async () => {
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
			expect((await core.filesystem.loadTask("TASK-3"))?.status).toBe("To Do");
			await quit();
		});
	});

	it("confirms with M exactly like Enter", async () => {
		await withBoard(async ({ screen, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "right");
			pressKey(screen, "m");
			await retry(async () => {
				const moved = await core.filesystem.loadTask("TASK-1");
				if (moved?.status !== "In Progress") throw new Error("move not persisted yet");
			});

			expect((await core.filesystem.loadTask("TASK-2"))?.status).toBe("To Do");
			await quit();
		});
	});

	it("cancels the move on Escape without persisting anything", async () => {
		await withBoard(async ({ screen, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "right");
			pressKey(screen, "escape");

			expect((await core.filesystem.loadTask("TASK-1"))?.status).toBe("To Do");
			await quit();
		});
	});

	it("blocks move mode behind active filters", async () => {
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

	it("documents the move key in the help popup", () => {
		const keys = getHelpShortcuts("board").map((shortcut) => shortcut.key);
		expect(keys).toContain("M");
		expect(keys).not.toContain("Space/M");
	});
});

describe("TUI board multi-select mover", () => {
	/** Task ids of the rendered board rows, in render order. */
	const rowIds = (rows: string[]): string[] =>
		rows.map((row) => row.match(/TASK-\d+/)?.[0]).filter((id): id is string => Boolean(id));
	/** Task ids of the rows carrying the ► moving-set indicator. */
	const movingIds = (rows: string[]): string[] => rowIds(rows.filter((row) => row.includes("►")));

	it("walks the highlight with Shift+Down without moving the grabbed task", async () => {
		await withBoard(({ screen, rows }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-down");
			pressKey(screen, "S-down");

			// The board order is untouched while the highlight walks; only the grabbed task is marked.
			expect(rowIds(rows())).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
			expect(movingIds(rows())).toEqual(["TASK-1"]);

			pressKey(screen, "escape");
		});
	});

	it("toggles the highlighted task in and out of the selection with M", async () => {
		await withBoard(({ screen, rows }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-down");
			pressKey(screen, "S-m");

			// Recruited tasks pick up the existing ► indicator and stay in place until Enter.
			expect(movingIds(rows())).toEqual(["TASK-1", "TASK-2"]);
			expect(rowIds(rows())).toEqual(["TASK-1", "TASK-2", "TASK-3"]);

			pressKey(screen, "S-m");
			expect(movingIds(rows())).toEqual(["TASK-1"]);

			pressKey(screen, "escape");
		});
	});

	it("collapses non-adjacent recruits into a block and reorders the whole set with plain arrows", async () => {
		await withBoard(({ screen, rows }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-down");
			pressKey(screen, "S-down");
			pressKey(screen, "S-m");
			expect(movingIds(rows())).toEqual(["TASK-1", "TASK-3"]);
			expect(rowIds(rows())).toEqual(["TASK-1", "TASK-2", "TASK-3"]);

			// The first plain arrow collapses the highlight: the preview now shows the whole
			// set landing adjacent at the target position.
			pressKey(screen, "down");
			expect(rowIds(rows())).toEqual(["TASK-1", "TASK-3", "TASK-2"]);

			// The next arrows reorder the whole set as one block.
			pressKey(screen, "down");
			expect(rowIds(rows())).toEqual(["TASK-2", "TASK-1", "TASK-3"]);

			// The block stops at the end of the column.
			pressKey(screen, "down");
			expect(rowIds(rows())).toEqual(["TASK-2", "TASK-1", "TASK-3"]);

			pressKey(screen, "escape");
		});
	});

	it("moves the whole set across columns on Enter", async () => {
		await withBoard(async ({ screen, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-down");
			pressKey(screen, "S-m");
			// First plain arrow collapses the highlight, the second changes the column.
			pressKey(screen, "right");
			pressKey(screen, "right");
			pressKey(screen, "enter");

			await retry(async () => {
				const moved = await core.filesystem.loadTask("TASK-1");
				if (moved?.status !== "In Progress") throw new Error("set move not persisted yet");
			});
			const companion = await core.filesystem.loadTask("TASK-2");
			expect(companion?.status).toBe("In Progress");
			const first = await core.filesystem.loadTask("TASK-1");
			expect((first?.ordinal ?? 0) < (companion?.ordinal ?? 0)).toBe(true);
			expect((await core.filesystem.loadTask("TASK-3"))?.status).toBe("To Do");
			await quit();
		});
	});

	it("lands non-adjacent recruits adjacent on Enter while the highlight is still active", async () => {
		await withBoard(async ({ screen, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-down");
			pressKey(screen, "S-down");
			pressKey(screen, "S-m");
			pressKey(screen, "enter");

			await retry(async () => {
				const first = await core.filesystem.loadTask("TASK-1");
				const second = await core.filesystem.loadTask("TASK-2");
				const third = await core.filesystem.loadTask("TASK-3");
				const ordinalOf = (task: Task | null) => task?.ordinal ?? Number.NaN;
				// The set [TASK-1, TASK-3] collapses adjacent at the grabbed task's position.
				if (!(ordinalOf(first) < ordinalOf(third) && ordinalOf(third) < ordinalOf(second))) {
					throw new Error("adjacency collapse not persisted yet");
				}
			});
			expect((await core.filesystem.loadTask("TASK-1"))?.status).toBe("To Do");
			expect((await core.filesystem.loadTask("TASK-3"))?.status).toBe("To Do");
			await quit();
		});
	});

	it("cancels a recruited move on Escape without persisting anything", async () => {
		await withBoard(async ({ screen, rows, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-down");
			pressKey(screen, "S-m");
			pressKey(screen, "right");
			pressKey(screen, "right");
			pressKey(screen, "escape");

			expect(movingIds(rows())).toEqual([]);
			expect((await core.filesystem.loadTask("TASK-1"))?.status).toBe("To Do");
			expect((await core.filesystem.loadTask("TASK-2"))?.status).toBe("To Do");
			await quit();
		});
	});

	it("recruits successive unrecruited tasks with M alone when no highlight is active", async () => {
		await withBoard(({ screen, rows, footer }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-m");
			expect(movingIds(rows())).toEqual(["TASK-1", "TASK-2"]);

			// The fallback advances past already-recruited neighbors, so repeated M keeps
			// growing the set instead of toggling the first recruit back off.
			pressKey(screen, "S-m");
			expect(movingIds(rows())).toEqual(["TASK-1", "TASK-2", "TASK-3"]);

			// With the whole column recruited there is nothing left to point at.
			pressKey(screen, "S-m");
			expect(footer()).toContain("No task to select here");

			pressKey(screen, "escape");
		});
	});

	it("freezes the move set and ignores Escape while the confirm write is in flight", async () => {
		await withBoard(async ({ screen, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-down");
			pressKey(screen, "S-m");
			pressKey(screen, "right");
			pressKey(screen, "right");
			pressKey(screen, "enter");
			// The write is now awaiting the core; late recruitment and a late Escape must
			// neither change the confirmed set nor make the move look canceled.
			pressKey(screen, "S-m");
			pressKey(screen, "escape");

			await retry(async () => {
				const moved = await core.filesystem.loadTask("TASK-1");
				if (moved?.status !== "In Progress") throw new Error("set move not persisted yet");
			});
			expect((await core.filesystem.loadTask("TASK-2"))?.status).toBe("In Progress");
			expect((await core.filesystem.loadTask("TASK-3"))?.status).toBe("To Do");
			await quit();
		});
	});

	it("reports per-task failures in the transient footer and still moves the rest", async () => {
		await withBoard(async ({ screen, footer, quit }) => {
			pressKey(screen, "m");
			pressKey(screen, "S-down");
			pressKey(screen, "S-m");

			// Remove the recruited task's file behind the board's back so its move fails.
			const recruited = await core.filesystem.loadTask("TASK-2");
			if (!recruited?.filePath) throw new Error("expected TASK-2 to have a file path");
			await rm(recruited.filePath, { force: true });

			pressKey(screen, "right");
			pressKey(screen, "right");
			pressKey(screen, "enter");

			await retry(async () => {
				const moved = await core.filesystem.loadTask("TASK-1");
				if (moved?.status !== "In Progress") throw new Error("partial move not persisted yet");
			});
			expect(footer()).toContain("Could not move 1 of the selected tasks");
			expect(footer()).toContain("TASK-2");
			await quit();
		});
	});
});
