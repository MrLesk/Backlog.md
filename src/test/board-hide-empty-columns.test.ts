import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScreenInterface } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { type ColumnData, filterVisibleColumns, renderBoardTui } from "../ui/board.ts";
import { getHelpShortcuts } from "../ui/components/help-popup.ts";
import { createScreen } from "../ui/tui.ts";
import { initializeTestProject, retry, withTimeout } from "./test-utils.ts";

function createTask(id: string, status: string): Task {
	return {
		id,
		title: `Title for ${id}`,
		status,
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description: "",
	};
}

function makeColumns(entries: Array<[string, string[]]>): ColumnData[] {
	return entries.map(([status, ids]) => ({
		status,
		tasks: ids.map((id) => createTask(id, status)),
	}));
}

describe("filterVisibleColumns", () => {
	it("hides empty columns when enabled and not moving", () => {
		const data = makeColumns([
			["To Do", ["task-1"]],
			["In Progress", []],
			["Done", ["task-2"]],
		]);

		const result = filterVisibleColumns(data, true, false);

		expect(result.map((column) => column.status)).toEqual(["To Do", "Done"]);
	});

	it("keeps all columns when moving, even if hideEmptyColumns is enabled", () => {
		const data = makeColumns([
			["To Do", ["task-1"]],
			["In Progress", []],
			["Done", ["task-2"]],
		]);

		const result = filterVisibleColumns(data, true, true);

		expect(result).toBe(data);
	});

	it("keeps all columns when hideEmptyColumns is disabled", () => {
		const data = makeColumns([
			["To Do", ["task-1"]],
			["In Progress", []],
			["Done", ["task-2"]],
		]);

		const result = filterVisibleColumns(data, false, false);

		expect(result).toBe(data);
	});

	it("falls back to the unfiltered list when every column is empty", () => {
		const data = makeColumns([
			["To Do", []],
			["In Progress", []],
		]);

		const result = filterVisibleColumns(data, true, false);

		expect(result).toBe(data);
	});
});

type EmittingWidget = {
	emit: (event: string, ch?: string, key?: { name: string; full: string; shift?: boolean }) => boolean;
};
type LabelledWidget = { type?: string; children?: LabelledWidget[]; _label?: { content?: string } };

function pressKey(widget: EmittingWidget, full: string, name = full.replace(/^S-/, "")): void {
	const key = { name, full, shift: full.startsWith("S-") };
	widget.emit("keypress", "", key);
	widget.emit(`key ${full}`, "", key);
}

/** Statuses of the column boxes currently on the board, in render order. */
function renderedColumnStatuses(root: LabelledWidget): string[] {
	const statuses: string[] = [];
	const visit = (node: LabelledWidget) => {
		for (const child of node.children ?? []) {
			const label = child._label?.content;
			// Column boxes are the labelled boxes wrapping a task list: "<icon> <status> (<count>)".
			if (label && (child.children ?? []).some((grandchild) => grandchild.type === "list")) {
				const status = label.trim().match(/^\S+\s+(.+)\s+\(\d+\)$/)?.[1];
				if (status) statuses.push(status);
			}
			visit(child);
		}
	};
	visit(root);
	return statuses;
}

const BOARD_TASKS = [createTask("TASK-1", "To Do"), createTask("TASK-2", "Done")];
const BOARD_STATUSES = ["To Do", "In Progress", "Done"];

async function withBoard(
	options: { hideEmptyColumns?: boolean; core?: Core },
	run: (context: {
		screen: ScreenInterface & EmittingWidget;
		columnStatuses: () => string[];
		/** Press q and wait for the board to shut down, exactly as the CLI does before exiting. */
		quit: () => Promise<void>;
	}) => Promise<void> | void,
): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
	try {
		const boardPromise = renderBoardTui(BOARD_TASKS, BOARD_STATUSES, "horizontal", 20, {
			screen,
			core: options.core,
			hideEmptyColumns: options.hideEmptyColumns,
		});
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
			columnStatuses: () => renderedColumnStatuses(screen as unknown as LabelledWidget),
			quit,
		});
		await quit();
	} finally {
		screen.destroy();
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

describe("TUI board honors hideEmptyColumns", () => {
	it("renders every configured column by default", async () => {
		await withBoard({}, ({ columnStatuses }) => {
			expect(columnStatuses()).toEqual(["To Do", "In Progress", "Done"]);
		});
	});

	it("hides columns without tasks when the setting is enabled", async () => {
		await withBoard({ hideEmptyColumns: true }, ({ columnStatuses }) => {
			expect(columnStatuses()).toEqual(["To Do", "Done"]);
		});
	});

	it("restores hidden columns while a task is being moved", async () => {
		await withBoard({ hideEmptyColumns: true }, ({ screen, columnStatuses }) => {
			pressKey(screen, "m");
			expect(columnStatuses()).toEqual(["To Do", "In Progress", "Done"]);

			pressKey(screen, "escape");
			expect(columnStatuses()).toEqual(["To Do", "Done"]);
		});
	});

	it("documents the toggle in the help popup instead of the footer", () => {
		const keys = getHelpShortcuts("board").map((shortcut) => shortcut.key);
		expect(keys).toContain("H");
	});
});

describe("Shift+H toggles hideEmptyColumns", () => {
	it("hides the empty column and persists the setting for every surface", async () => {
		const testDir = await mkdtemp(join(tmpdir(), "backlog-hide-empty-columns-"));
		const core = new Core(testDir);
		try {
			await initializeTestProject(core, "Hide Empty Columns");

			await withBoard({ core }, async ({ screen, columnStatuses }) => {
				expect(columnStatuses()).toEqual(["To Do", "In Progress", "Done"]);

				pressKey(screen, "S-h");
				await retry(async () => {
					const config = await core.fs.loadConfig();
					expect(config?.hideEmptyColumns).toBe(true);
				}, 20);
				expect(columnStatuses()).toEqual(["To Do", "Done"]);

				pressKey(screen, "S-h");
				await retry(async () => {
					const config = await core.fs.loadConfig();
					expect(config?.hideEmptyColumns).toBe(false);
				}, 20);
				expect(columnStatuses()).toEqual(["To Do", "In Progress", "Done"]);
			});
		} finally {
			await rm(testDir, { force: true, recursive: true });
		}
	});

	it("finishes the pending write before the board shuts down", async () => {
		const testDir = await mkdtemp(join(tmpdir(), "backlog-hide-empty-columns-exit-"));
		const core = new Core(testDir);
		try {
			await initializeTestProject(core, "Hide Empty Columns Exit");

			// Quitting resolves the board, and the CLI can exit the process right after,
			// so a slow write must still land before the board reports it is done.
			const saveConfig = core.fs.saveConfig.bind(core.fs);
			core.fs.saveConfig = async (config) => {
				await Bun.sleep(300);
				await saveConfig(config);
			};

			await withBoard({ core }, async ({ screen, quit }) => {
				pressKey(screen, "S-h");
				await quit();
			});

			const persisted = await new Core(testDir).fs.loadConfig();
			expect(persisted?.hideEmptyColumns).toBe(true);
		} finally {
			await rm(testDir, { force: true, recursive: true });
		}
	});
});

describe("piped board output honors hideEmptyColumns", () => {
	async function captureBoardOutput(options: { hideEmptyColumns?: boolean; milestoneMode?: boolean }): Promise<string> {
		const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: false });
		const originalLog = console.log;
		const lines: string[] = [];
		console.log = (...args: unknown[]) => {
			lines.push(args.map(String).join(" "));
		};
		try {
			await renderBoardTui(BOARD_TASKS, BOARD_STATUSES, "horizontal", 20, {
				hideEmptyColumns: options.hideEmptyColumns,
				milestoneMode: options.milestoneMode,
				milestoneEntities: [],
			});
		} finally {
			console.log = originalLog;
			if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
			else Reflect.deleteProperty(process.stdout, "isTTY");
		}
		return lines.join("\n");
	}

	it("keeps every column by default", async () => {
		const output = await captureBoardOutput({});

		expect(output).toContain("| To Do | In Progress | Done |");
	});

	it("drops empty columns when the setting is enabled", async () => {
		const output = await captureBoardOutput({ hideEmptyColumns: true });

		expect(output).toContain("| To Do | Done |");
		expect(output).not.toContain("In Progress");
	});

	it("keeps every milestone heading by default", async () => {
		const output = await captureBoardOutput({ milestoneMode: true });

		expect(output).toContain("### In Progress (0)");
	});

	it("drops empty milestone headings when the setting is enabled", async () => {
		const output = await captureBoardOutput({ hideEmptyColumns: true, milestoneMode: true });

		expect(output).toContain("### To Do (1)");
		expect(output).toContain("### Done (1)");
		expect(output).not.toContain("In Progress");
	});
});
