import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "TASK-1",
		title: "First",
		status: "To Do",
		assignee: [],
		createdDate: "2026-08-02 00:00",
		labels: [],
		dependencies: [],
		...overrides,
	};
}

async function waitUntil(predicate: () => boolean, message: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		if (predicate()) return;
		await Bun.sleep(10);
	}
	throw new Error(`Timed out waiting for ${message}`);
}

function hasCreateControl(root: { content?: string; children?: unknown[] }): boolean {
	if (root.content === "Create") return true;
	return (root.children ?? []).some((child) => hasCreateControl(child as { content?: string; children?: unknown[] }));
}

describe("TUI task creation entrypoint", () => {
	it("does not open the composer from N and keeps column navigation available", async () => {
		const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
		const screen = createScreen({ smartCSR: false });
		try {
			const boardPromise = renderBoardTui(
				[task(), task({ id: "TASK-2", title: "Second", status: "Done" })],
				["To Do", "Done"],
				"horizontal",
				20,
				{ screen },
			);
			(screen as unknown as { emit(event: string): void }).emit("key n");
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(hasCreateControl(screen as unknown as { content?: string; children?: unknown[] })).toBe(false);

			(screen as unknown as { emit(event: string): void }).emit("key right");
			await waitUntil(() => {
				const focused = (screen as unknown as { focused?: { items?: Array<{ content?: string }>; selected?: number } })
					.focused;
				return Boolean(focused?.items?.[focused.selected ?? 0]?.content?.includes("TASK-2"));
			}, "the second column to receive focus");

			(screen as unknown as { emit(event: string): void }).emit("key q");
			await withTimeout(boardPromise, "board close", 1000);
		} finally {
			screen.destroy();
			if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
			else Reflect.deleteProperty(process.stdout, "isTTY");
		}
	});
});
