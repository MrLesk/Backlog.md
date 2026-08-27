import { describe, expect, it } from "bun:test";
import type { ListInterface, ScreenInterface } from "neo-neo-bblessed";
import { GenericList } from "../ui/components/generic-list.ts";
import { createScreen } from "../ui/tui.ts";

type RenderedList = ListInterface & {
	emit: (event: string, ch?: string, key?: { name: string }) => boolean;
	ritems: string[];
	selected?: number;
};

function withTtyScreen(run: (screen: ScreenInterface) => void): void {
	const originalIsTTY = process.stdout.isTTY;
	if (process.stdout.isTTY === false) {
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
	}
	const screen = createScreen({ smartCSR: false });
	try {
		run(screen);
	} finally {
		if (process.stdout.isTTY !== originalIsTTY) {
			Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
		}
		screen.destroy();
	}
}

describe("GenericList selection rendering", () => {
	it("syncs highlighted content when the blessed list selection changes", () => {
		withTtyScreen((screen) => {
			const highlighted: number[] = [];
			const list = new GenericList({
				parent: screen,
				items: [{ id: "TASK-1" }, { id: "TASK-2" }],
				itemRenderer: (item) => `{cyan-fg}${item.id}{/}`,
				onHighlight: (_item, index) => {
					highlighted.push(index);
				},
				showHelp: false,
			});

			const listBox = list.getListBox() as RenderedList;
			expect(listBox.ritems[0]).toBe("TASK-1");
			expect(listBox.ritems[1]).toBe("{cyan-fg}TASK-2{/}");

			listBox.select(1);

			expect(listBox.ritems[0]).toBe("{cyan-fg}TASK-1{/}");
			expect(listBox.ritems[1]).toBe("TASK-2");
			expect(list.getSelectedIndex()).toBe(1);
			expect(highlighted.at(-1)).toBe(1);

			list.destroy();
		});
	});

	it("uses display-index mapping for page navigation in grouped lists", () => {
		withTtyScreen((screen) => {
			const highlighted: number[] = [];
			const list = new GenericList({
				parent: screen,
				items: [
					{ id: "TASK-1", group: "One" },
					{ id: "TASK-2", group: "One" },
					{ id: "TASK-3", group: "Two" },
				],
				groupBy: (item: { group?: string }) => item.group ?? "",
				itemRenderer: (item) => item.id,
				onHighlight: (_item, index) => {
					highlighted.push(index);
				},
				showHelp: false,
			});

			const listBox = list.getListBox() as RenderedList;
			listBox.emit("key end", "", { name: "end" });

			expect(list.getSelectedIndex()).toBe(2);
			expect(listBox.selected).toBe(4);
			expect(highlighted.at(-1)).toBe(2);

			list.destroy();
		});
	});
});

describe("GenericList wrapping", () => {
	const longTitle = "TASK-1 - Review promo-tester with Opus 5 and rank what needs fixing";

	it("clips long items to a single row when wrapping is off", () => {
		withTtyScreen((screen) => {
			const list = new GenericList({
				parent: screen,
				items: [{ id: "TASK-1" }],
				itemRenderer: () => longTitle,
				border: false,
				scrollbar: false,
				width: 30,
				showHelp: false,
			});

			const listBox = list.getListBox() as RenderedList;
			expect(listBox.ritems).toHaveLength(1);
			expect(listBox.ritems[0]).toBe(longTitle);

			list.destroy();
		});
	});

	it("splits a long item across rows without losing any text", () => {
		withTtyScreen((screen) => {
			const list = new GenericList({
				parent: screen,
				items: [{ id: "TASK-1" }],
				itemRenderer: () => longTitle,
				border: false,
				scrollbar: false,
				width: 30,
				wrap: true,
				wrapIndent: "  ",
				showHelp: false,
			});

			const listBox = list.getListBox() as RenderedList;
			expect(listBox.ritems.length).toBeGreaterThan(1);
			// The selected item carries highlight markup and padding on its
			// continuation rows, so compare the visible text only.
			const visible = listBox.ritems
				.map((row) => row.replace(/\{\/?[^{}]*\}/g, "").trim())
				.join(" ")
				.replace(/\s+/g, " ");
			expect(visible).toBe(longTitle);

			list.destroy();
		});
	});

	it("keeps navigation on item boundaries when items occupy several rows", () => {
		withTtyScreen((screen) => {
			const highlighted: number[] = [];
			const list = new GenericList({
				parent: screen,
				items: [{ id: "TASK-1" }, { id: "TASK-2" }],
				itemRenderer: (item) => `${item.id} - a fairly long title that will need several rows`,
				border: false,
				scrollbar: false,
				width: 30,
				wrap: true,
				onHighlight: (_item, index) => {
					highlighted.push(index);
				},
				showHelp: false,
			});

			const listBox = list.getListBox() as RenderedList;
			listBox.emit("key down", "", { name: "down" });

			// One keypress moves a whole item, not a single wrapped row.
			expect(list.getSelectedIndex()).toBe(1);
			expect(highlighted.at(-1)).toBe(1);
			// The second item starts below the first item's continuation rows.
			expect(listBox.selected).toBeGreaterThan(1);

			list.destroy();
		});
	});

	it("resolves a click on a continuation row to its owning item", () => {
		withTtyScreen((screen) => {
			const list = new GenericList({
				parent: screen,
				items: [{ id: "TASK-1" }, { id: "TASK-2" }],
				itemRenderer: (item) => `${item.id} - a fairly long title that will need several rows`,
				border: false,
				scrollbar: false,
				width: 30,
				wrap: true,
				showHelp: false,
			});

			const listBox = list.getListBox() as RenderedList;
			// Row 1 is a continuation of the first item, so it must select item 0.
			listBox.select(1);

			expect(list.getSelectedIndex()).toBe(0);

			list.destroy();
		});
	});
});
