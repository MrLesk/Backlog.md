import { describe, expect, it } from "bun:test";
import type { BoxInterface, ScreenInterface } from "neo-neo-bblessed";
import type { Task } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

type Widget = BoxInterface & {
	children: Widget[];
	content: string;
	options: { label?: string };
	style: { inverse?: boolean };
	emit: (event: string) => void;
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const tasks: [Task] = [
	{
		id: "TASK-1",
		title: "Keep my place",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-11-11",
	},
];

async function withBoard(
	confirmExit: boolean | undefined,
	run: (board: {
		key: (full: string) => Promise<void>;
		prompt: () => Widget | undefined;
		closed: () => boolean;
		screen: ScreenInterface;
		update: (tasks: Task[]) => void;
		handoffs: () => number;
	}) => Promise<void>,
) {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false });
	Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
	let closed = false;
	let handoffs = 0;
	let update: ((nextTasks: Task[], statuses: string[]) => void) | undefined;
	const prompt = () =>
		(screen as unknown as Widget).children.find((child) =>
			(child as unknown as { _label?: { content?: string } })._label?.content?.includes("Quit Backlog.md?"),
		);
	// Use blessed's program dispatch so both the screen shortcuts and focused widget see each
	// key in their real order. Emitting directly on a popup would miss quit-key fallthrough.
	const key = async (full: string) => {
		const program = screen.program as unknown as {
			emit: (event: string, ch: string, key: Record<string, unknown>) => void;
		};
		program.emit("keypress", full.length === 1 ? full : "", {
			name: full.replace(/^(C-|S-)/, ""),
			full,
			ctrl: full.startsWith("C-"),
			shift: full.startsWith("S-"),
		});
		await tick();
	};
	const board = renderBoardTui(tasks, ["To Do", "Done"], "horizontal", 20, {
		screen,
		confirmExit,
		onTabPress: async () => {
			handoffs++;
		},
		subscribeUpdates: (callback) => {
			update = callback;
		},
	}).then(() => {
		closed = true;
	});
	try {
		await tick();
		await run({
			key,
			prompt,
			closed: () => closed,
			screen,
			update: (next) => update?.(next, []),
			handoffs: () => handoffs,
		});
		if (!closed) {
			if (prompt()) await key("escape");
			await key("q");
			if (prompt()) {
				await key("enter");
			}
		}
		await withTimeout(board, "board exit", 1000);
	} finally {
		screen.destroy();
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

describe("terminal board exit confirmation", () => {
	it.each(["q", "escape", "C-c"])("prompts on %s with Quit selected and confirms on Enter", async (quitKey) => {
		await withBoard(true, async ({ key, prompt, closed, screen }) => {
			await key(quitKey);
			expect(prompt()).toBeDefined();
			expect(prompt()?.options.label).toBe(" Quit Backlog.md? ");
			expect(closed()).toBe(false);
			expect(screen.focused).toBe(prompt());
			const cancel = prompt()?.children.find((child) => child.content === "[Cancel]");
			const quit = prompt()?.children.find((child) => child.content === "[Quit]");
			expect(cancel).toBeDefined();
			expect(quit).toBeDefined();
			expect(Number(cancel?.aleft)).toBeLessThan(Number(quit?.aleft));
			expect(cancel?.style.inverse).toBe(false);
			expect(quit?.style.inverse).toBe(true);
			await key("enter");
			expect(closed()).toBe(true);
		});
	});

	for (const selection of ["Quit", "Cancel"]) {
		it.each(["q", "C-c"])(`confirms with %s when ${selection} is selected`, async (quitKey) => {
			await withBoard(true, async ({ key, prompt, closed }) => {
				await key(quitKey);
				expect(prompt()).toBeDefined();
				expect(closed()).toBe(false);
				if (selection === "Cancel") await key("left");
				expect(prompt()?.children.find((child) => child.content === `[${selection}]`)?.style.inverse).toBe(true);
				await key(quitKey);
				expect(prompt()).toBeUndefined();
				expect(closed()).toBe(true);
			});
		});
	}

	it.each(["escape", "n", "N"])("cancels with %s and restores board interaction", async (cancelKey) => {
		await withBoard(true, async ({ key, prompt, closed, screen }) => {
			const boardFocus = screen.focused;
			await key("q");
			expect(prompt()).toBeDefined();
			await key(cancelKey);
			expect(prompt()).toBeUndefined();
			expect(closed()).toBe(false);
			expect(screen.focused).toBe(boardFocus);
			await key("right");
			expect(screen.focused).not.toBe(boardFocus);
		});
	});

	it("selects Cancel with an arrow and resets to Quit when reopened", async () => {
		await withBoard(true, async ({ key, prompt, closed, screen }) => {
			const boardFocus = screen.focused;
			await key("q");
			await key("left");
			expect(prompt()?.children.find((child) => child.content === "[Cancel]")?.style.inverse).toBe(true);
			await key("enter");
			expect(prompt()).toBeUndefined();
			expect(closed()).toBe(false);
			expect(screen.focused).toBe(boardFocus);
			await key("q");
			expect(prompt()?.children.find((child) => child.content === "[Quit]")?.style.inverse).toBe(true);
			await key("enter");
			expect(closed()).toBe(true);
		});
	});

	it("keeps navigation inside the prompt and supports Tab and normalized Enter", async () => {
		await withBoard(true, async ({ key, prompt, closed, handoffs }) => {
			await key("q");
			await key("tab"); // Quit -> Cancel
			expect(handoffs()).toBe(0);
			expect(prompt()).toBeDefined();
			await key("linefeed");
			expect(closed()).toBe(false);
			expect(prompt()).toBeUndefined();
			await key("q");
			await key("tab"); // Quit -> Cancel
			await key("S-tab"); // Cancel -> Quit
			await key("linefeed");
			expect(closed()).toBe(true);
		});
	});

	it("supports clicking Cancel and Quit", async () => {
		await withBoard(true, async ({ key, prompt, closed }) => {
			await key("q");
			const cancel = prompt()?.children.find((child) => child.content === "[Cancel]");
			expect(cancel).toBeDefined();
			cancel?.emit("click");
			await tick();
			expect(closed()).toBe(false);
			expect(prompt()).toBeUndefined();
			await key("q");
			const quit = prompt()?.children.find((child) => child.content === "[Quit]");
			expect(quit).toBeDefined();
			quit?.emit("click");
			await tick();
			expect(closed()).toBe(true);
		});
	});

	it("preserves filter, task popup, and move cancellation and view switching", async () => {
		await withBoard(true, async ({ key, prompt, closed, handoffs, screen }) => {
			const boardFocus = screen.focused;
			await key("enter");
			expect(screen.focused).not.toBe(boardFocus);
			await key("escape");
			expect(screen.focused).toBe(boardFocus);
			expect(prompt()).toBeUndefined();
			expect(closed()).toBe(false);
			await key("/");
			await key("escape");
			expect(prompt()).toBeUndefined();
			expect(closed()).toBe(false);
			await key("m");
			await key("escape");
			expect(prompt()).toBeUndefined();
			expect(closed()).toBe(false);
			await key("tab");
			expect(prompt()).toBeUndefined();
			expect(handoffs()).toBe(1);
			expect(closed()).toBe(true);
		});
	});

	it("keeps the prompt focused when board data changes", async () => {
		await withBoard(true, async ({ key, prompt, closed, screen, update }) => {
			await key("q");
			const dialog = prompt();
			update([{ ...tasks[0], status: "Done" }]);
			expect(screen.focused).toBe(dialog);
			await key("escape");
			expect(prompt()).toBeUndefined();
			expect(closed()).toBe(false);
		});
	});

	for (const setting of [false, undefined]) {
		it.each(["q", "escape", "C-c"])(`exits immediately on %s when confirmExit is ${setting}`, async (quitKey) => {
			await withBoard(setting, async ({ key, prompt, closed }) => {
				await key(quitKey);
				expect(prompt()).toBeUndefined();
				expect(closed()).toBe(true);
			});
		});
	}
});
