import { describe, expect, it } from "bun:test";
import type { ListInterface, ScreenInterface } from "neo-neo-bblessed";
import type { Task } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import { openMultiSelectFilterPopup, openSingleSelectFilterPopup } from "../ui/components/filter-popup.ts";
import { GenericList } from "../ui/components/generic-list.ts";
import { resolveListBoundaryNavigation } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

type EmittingWidget = { emit: (event: string, ch?: string, key?: { name: string; full: string }) => boolean };

function pressKey(widget: EmittingWidget, name: string): void {
	widget.emit("keypress", "", { name, full: name });
	widget.emit(`key ${name}`, "", { name, full: name });
}

function withTty<T>(run: () => T): T {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	try {
		return run();
	} finally {
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

function task(id: string, status = "To Do"): Task {
	return {
		id,
		title: `Task ${id}`,
		status,
		assignee: [],
		createdDate: "2026-08-07 00:00",
		labels: [],
		dependencies: [],
	};
}

describe("vim keys stay inside the task list at boundaries", () => {
	function createTaskListHarness(screen: ScreenInterface) {
		const searchHandoffs: Array<"up" | "down"> = [];
		// Mirrors the task viewer's boundary callback (src/ui/task-viewer-with-search.ts).
		const list = new GenericList({
			parent: screen,
			items: [{ id: "TASK-1" }, { id: "TASK-2" }],
			itemRenderer: (item) => item.id,
			showHelp: false,
			onBoundaryNavigation: (direction, selectedIndex, total, key) => {
				const navigation = resolveListBoundaryNavigation(direction, selectedIndex, total, key);
				if (navigation === "move") return false;
				if (navigation === "search") searchHandoffs.push(direction);
				return true;
			},
		});
		return { list, listBox: list.getListBox() as ListInterface & EmittingWidget, searchHandoffs };
	}

	it("keeps j on the last row and k on the first row inside the list", () => {
		withTty(() => {
			const screen = createScreen({ smartCSR: false });
			try {
				const { list, listBox, searchHandoffs } = createTaskListHarness(screen);

				pressKey(listBox, "j");
				expect(list.getSelectedIndex()).toBe(1);

				pressKey(listBox, "j");
				expect(list.getSelectedIndex()).toBe(1);

				pressKey(listBox, "k");
				expect(list.getSelectedIndex()).toBe(0);

				pressKey(listBox, "k");
				expect(list.getSelectedIndex()).toBe(0);

				expect(searchHandoffs).toEqual([]);
				list.destroy();
			} finally {
				screen.destroy();
			}
		});
	});

	it("still hands the arrow keys off to search at the same boundaries", () => {
		withTty(() => {
			const screen = createScreen({ smartCSR: false });
			try {
				const { list, listBox, searchHandoffs } = createTaskListHarness(screen);

				pressKey(listBox, "up");
				expect(list.getSelectedIndex()).toBe(0);
				expect(searchHandoffs).toEqual(["up"]);

				pressKey(listBox, "down");
				expect(list.getSelectedIndex()).toBe(1);

				pressKey(listBox, "down");
				expect(list.getSelectedIndex()).toBe(1);
				expect(searchHandoffs).toEqual(["up", "down"]);

				list.destroy();
			} finally {
				screen.destroy();
			}
		});
	});
});

describe("vim keys navigate the filter popups", () => {
	function popupScreen(): ScreenInterface {
		const screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
		return screen;
	}

	// The popups focus their picker on the next tick.
	async function settleFocus(): Promise<void> {
		await new Promise<void>((resolve) => setImmediate(resolve));
		await new Promise<void>((resolve) => setImmediate(resolve));
	}

	function focusedPicker(screen: ScreenInterface): EmittingWidget & { selected?: number } {
		const focused = (screen as unknown as { focused?: EmittingWidget & { selected?: number } }).focused;
		if (!focused) throw new Error("No focused picker");
		return focused;
	}

	it("moves the single-select picker with j and k and clamps at both ends", async () => {
		const screen = popupScreen();
		try {
			const answer = openSingleSelectFilterPopup({
				screen,
				title: "Filter Status",
				choices: [
					{ label: "To Do", value: "To Do" },
					{ label: "In Progress", value: "In Progress" },
					{ label: "Done", value: "Done" },
				],
				selectedValue: "To Do",
			});
			await settleFocus();
			const picker = focusedPicker(screen);
			expect(picker.selected).toBe(0);

			// k on the first row stays put, exactly like ArrowUp does here.
			pressKey(picker, "k");
			expect(picker.selected).toBe(0);

			pressKey(picker, "j");
			pressKey(picker, "j");
			expect(picker.selected).toBe(2);

			// j on the last row stays put too: the picker never wrapped for the arrows either.
			pressKey(picker, "j");
			expect(picker.selected).toBe(2);

			pressKey(picker, "k");
			expect(picker.selected).toBe(1);

			pressKey(picker, "enter");
			expect(await withTimeout(answer, "single-select filter popup", 1000)).toBe("In Progress");
		} finally {
			screen.destroy();
		}
	});

	it("moves the multi-select picker with j and k", async () => {
		const screen = popupScreen();
		try {
			const answer = openMultiSelectFilterPopup({
				screen,
				title: "Filter Labels",
				items: ["bug", "docs", "enhancement"],
				selectedItems: [],
			});
			await settleFocus();
			const picker = focusedPicker(screen);
			expect(picker.selected).toBe(0);

			// This popup is a GenericList, which wraps at both ends for the arrows and for j/k alike.
			pressKey(picker, "k");
			expect(picker.selected).toBe(2);

			pressKey(picker, "j");
			expect(picker.selected).toBe(0);

			pressKey(picker, "j");
			expect(picker.selected).toBe(1);

			pressKey(picker, "space");
			pressKey(picker, "enter");
			expect(await withTimeout(answer, "multi-select filter popup", 1000)).toEqual(["docs"]);
		} finally {
			screen.destroy();
		}
	});
});

describe("vim keys stay inside board columns at boundaries", () => {
	type BoardWidget = { type?: string; items?: unknown[]; selected?: number };

	async function withBoard(
		run: (context: {
			screen: ScreenInterface & EmittingWidget;
			focused: () => BoardWidget | undefined;
			selectedRow: () => number | undefined;
		}) => Promise<void> | void,
	): Promise<void> {
		const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
		const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
		try {
			const boardPromise = renderBoardTui([task("TASK-1"), task("TASK-2")], ["To Do", "Done"], "horizontal", 20, {
				screen,
			});
			await Bun.sleep(20);
			const focused = () => (screen as unknown as { focused?: BoardWidget }).focused;
			await run({ screen, focused, selectedRow: () => focused()?.selected });
			pressKey(screen, "q");
			await withTimeout(boardPromise, "board close", 1000);
		} finally {
			screen.destroy();
			if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
			else Reflect.deleteProperty(process.stdout, "isTTY");
		}
	}

	it("keeps j and k inside a populated column and lets arrows reach search", async () => {
		await withBoard(async ({ screen, focused, selectedRow }) => {
			expect(focused()?.type).toBe("list");
			expect(selectedRow()).toBe(0);

			pressKey(screen, "k");
			expect(focused()?.type).toBe("list");
			expect(selectedRow()).toBe(0);

			pressKey(screen, "j");
			expect(selectedRow()).toBe(1);

			pressKey(screen, "j");
			expect(focused()?.type).toBe("list");
			expect(selectedRow()).toBe(1);

			pressKey(screen, "down");
			expect(focused()?.type).toBe("textbox");
		});
	});

	it("keeps j and k inside an empty column and lets arrows reach search", async () => {
		await withBoard(async ({ screen, focused }) => {
			pressKey(screen, "right");
			expect(focused()?.type).toBe("list");
			expect(focused()?.items?.length ?? 0).toBe(0);

			pressKey(screen, "j");
			expect(focused()?.type).toBe("list");

			pressKey(screen, "k");
			expect(focused()?.type).toBe("list");

			pressKey(screen, "up");
			expect(focused()?.type).toBe("textbox");
		});
	});
});
