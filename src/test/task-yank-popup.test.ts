import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import type { Task } from "../types/index.ts";
import { openTaskYankPopup } from "../ui/components/task-yank-popup.ts";
import { createScreen } from "../ui/tui.ts";

type TestWidget = {
	emit?: (event: string, ...args: unknown[]) => void;
};

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const key = { name, full: name, shift: false };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

async function settlePopup(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

function createTask(filePath?: string): Task {
	return {
		id: "TASK-7",
		title: "Task for yank menu",
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description: "",
		filePath,
	};
}

describe("task yank popup", () => {
	it.each([
		["y", "TASK-7"],
		["r", "backlog/tasks/back-7 - Task.md"],
		["a", "/workspace/repo/backlog/tasks/back-7 - Task.md"],
	])("copies the %s option", async (key, expected) => {
		const screen = createScreen({ smartCSR: false });
		const copied: string[] = [];
		const feedback: Array<{ message: string; success: boolean }> = [];
		try {
			const popup = openTaskYankPopup({
				screen,
				task: createTask("/workspace/repo/backlog/tasks/back-7 - Task.md"),
				projectRoot: "/workspace/repo",
				repositoryRoot: "/workspace/repo",
				copy: async (value) => {
					copied.push(value);
					return true;
				},
				onFeedback: (message, success) => feedback.push({ message, success }),
			});
			await settlePopup();

			pressKey((screen as unknown as { focused?: TestWidget }).focused, key);
			await popup;

			expect(copied).toEqual([expected]);
			expect(feedback).toHaveLength(1);
			expect(feedback[0]?.success).toBe(true);
		} finally {
			screen.destroy();
		}
	});

	it("cancels without copying", async () => {
		const screen = createScreen({ smartCSR: false });
		const copied: string[] = [];
		try {
			const popup = openTaskYankPopup({
				screen,
				task: createTask("/workspace/repo/backlog/tasks/back-7 - Task.md"),
				projectRoot: "/workspace/repo",
				repositoryRoot: "/workspace/repo",
				copy: async (value) => {
					copied.push(value);
					return true;
				},
				onFeedback: () => {},
			});
			await settlePopup();

			pressKey((screen as unknown as { focused?: TestWidget }).focused, "escape", "\x1b");
			await popup;

			expect(copied).toEqual([]);
		} finally {
			screen.destroy();
		}
	});

	it("reports missing paths and clipboard failures", async () => {
		const screen = createScreen({ smartCSR: false });
		const feedback: Array<{ message: string; success: boolean }> = [];
		try {
			const popup = openTaskYankPopup({
				screen,
				task: createTask(),
				projectRoot: "/workspace/repo",
				repositoryRoot: null,
				copy: async () => false,
				onFeedback: (message, success) => feedback.push({ message, success }),
			});
			await settlePopup();
			pressKey((screen as unknown as { focused?: TestWidget }).focused, "a");
			await popup;
			expect(feedback).toEqual([{ message: "Task file path is unavailable", success: false }]);

			const clipboardFailure = openTaskYankPopup({
				screen,
				task: createTask(resolve("/workspace/repo/backlog/tasks/back-7.md")),
				projectRoot: "/workspace/repo",
				repositoryRoot: "/workspace/repo",
				copy: async () => false,
				onFeedback: (message, success) => feedback.push({ message, success }),
			});
			await settlePopup();
			pressKey((screen as unknown as { focused?: TestWidget }).focused, "y");
			await clipboardFailure;
			expect(feedback[1]?.success).toBe(false);
			expect(feedback[1]?.message).toBe("Failed to copy to clipboard");
		} finally {
			screen.destroy();
		}
	});
});
