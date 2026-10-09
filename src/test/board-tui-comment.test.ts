import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScreenInterface } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import { createScreen } from "../ui/tui.ts";
import { initializeTestProject, withTimeout } from "./test-utils.ts";

type EmittingWidget = { emit: (event: string, ...args: unknown[]) => void };
type TreeWidget = {
	type?: string;
	children?: TreeWidget[];
	content?: string;
	options?: { label?: string };
	position?: { bottom?: number };
	setValue?: (value: string) => void;
} & Partial<EmittingWidget>;

const STATUSES = ["To Do", "In Progress", "Done"];
const task: Task = {
	id: "TASK-1",
	title: "Comment target",
	status: "To Do",
	assignee: [],
	createdDate: "2026-10-04 10:00",
	labels: [],
	dependencies: [],
	description: "",
	ordinal: 1000,
};

function pressKey(widget: Partial<EmittingWidget> | undefined, full: string, ch = ""): void {
	const key = { name: full, full, shift: false };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${full}`, ch, key);
}

function widgets(root: TreeWidget): TreeWidget[] {
	const found: TreeWidget[] = [];
	const visit = (node: TreeWidget) => {
		found.push(node);
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return found;
}

let testDir: string;
let core: Core;

beforeEach(async () => {
	testDir = await mkdtemp(join(tmpdir(), "board-tui-comment-"));
	core = new Core(testDir);
	await initializeTestProject(core, "Board Comment");
	await core.createTask(task, false);
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("TUI board comments", () => {
	it("opens the composer on O, ignores board shortcuts while it is open, and adds the comment", async () => {
		const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
		const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
		const tree = () => widgets(screen as unknown as TreeWidget);
		const find = (predicate: (widget: TreeWidget) => boolean) => tree().find(predicate);
		const footer = () =>
			find((widget) => widget.type === "box" && widget.position?.bottom === 0 && typeof widget.content === "string")
				?.content ?? "";
		try {
			const board = renderBoardTui([task], STATUSES, "horizontal", 20, { screen, core });
			await Bun.sleep(20);

			pressKey(screen, "o");
			await Bun.sleep(10);
			const comment = find((widget) => widget.options?.label === " Comment ");
			expect(comment).toBeDefined();

			// Board shortcuts must not fire while the composer holds the keyboard.
			pressKey(screen, "m");
			pressKey(screen, "n");
			await Bun.sleep(10);
			expect(footer()).not.toContain("MOVE MODE");
			expect(find((widget) => widget.options?.label === " Title ")).toBeUndefined();

			comment?.setValue?.("Ship it");
			pressKey(
				find((widget) => widget.content === "Add comment"),
				"enter",
				"\r",
			);
			for (let attempt = 0; attempt < 100 && find((widget) => widget.options?.label === " Comment "); attempt += 1) {
				await Bun.sleep(20);
			}

			expect(find((widget) => widget.options?.label === " Comment ")).toBeUndefined();
			expect((await core.filesystem.loadTask(task.id))?.comments?.map((entry) => entry.body)).toEqual(["Ship it"]);

			pressKey(screen, "q");
			await withTimeout(board, "board close", 5000);
		} finally {
			screen.destroy();
			if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
			else Reflect.deleteProperty(process.stdout, "isTTY");
		}
	});
});
