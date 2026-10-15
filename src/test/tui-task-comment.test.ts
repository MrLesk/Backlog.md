import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { commentOnTaskFromTui } from "../ui/task-comment.ts";
import { createScreen } from "../ui/tui.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup, withTimeout } from "./test-utils.ts";

type TestWidget = {
	children?: unknown[];
	content?: string;
	options?: { label?: string };
	getValue?: () => string;
	emit?: (event: string, ...args: unknown[]) => void;
};

function collectWidgets(root: { children?: unknown[] }): TestWidget[] {
	const widgets: TestWidget[] = [];
	const visit = (node: TestWidget) => {
		widgets.push(node);
		for (const child of node.children ?? []) visit(child as TestWidget);
	};
	visit(root as TestWidget);
	return widgets;
}

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const key = { name, full: name, shift: false };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

async function settle(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("commentOnTaskFromTui", () => {
	let testDir: string;
	let core: Core;
	let task: Task;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-tui-task-comment");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeTestProject(core, "TUI Task Comment Test");
		await core.createTask(
			{
				id: "task-1",
				title: "Comment target",
				status: "To Do",
				assignee: [],
				createdDate: "2026-10-04 10:00",
				labels: [],
				dependencies: [],
			},
			false,
		);
		const loaded = await core.filesystem.loadTask("task-1");
		if (!loaded) throw new Error("Expected task");
		task = loaded;
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	// Opens the composer through the helper, fills it in, and adds the comment.
	const addComment = async (body: string, author?: string) => {
		const screen = createScreen({ smartCSR: false });
		const messages: string[] = [];
		try {
			const result = commentOnTaskFromTui(core, screen, task, (message) => messages.push(message));
			await settle();
			const widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			const authorField = widgets.find((widget) => widget.options?.label === " Author ");
			const prefilled = authorField?.getValue?.() ?? "";
			if (author !== undefined) {
				(authorField as { setValue?: (value: string) => void })?.setValue?.(author);
			}
			const bodyField = widgets.find((widget) => widget.options?.label === " Comment ");
			(bodyField as { setValue?: (value: string) => void })?.setValue?.(body);
			pressKey(
				widgets.find((widget) => widget.content === "Add comment"),
				"enter",
				"\r",
			);
			return { updated: await withTimeout(result, "TUI comment", 2000), messages, prefilled };
		} finally {
			screen.destroy();
		}
	};

	it("appends the comment to the task file and reports it", async () => {
		const { updated, messages } = await addComment("Looks good", "@simon");

		expect(updated?.comments?.at(-1)?.body).toBe("Looks good");
		const saved = await core.filesystem.loadTask(task.id);
		expect(saved?.comments).toHaveLength(1);
		expect(saved?.comments?.[0]?.author).toBe("@simon");
		expect(messages.at(-1)).toContain(`Comment #1 added to ${task.id}`);
	});

	it("prefills the next comment's author with the last one used", async () => {
		await addComment("First", "@alex");
		const { prefilled } = await addComment("Second");

		expect(prefilled).toBe("@alex");
		expect((await core.filesystem.loadTask(task.id))?.comments?.map((comment) => comment.author)).toEqual([
			"@alex",
			"@alex",
		]);
	});

	it("refuses a task from another branch without opening the composer", async () => {
		const screen = createScreen({ smartCSR: false });
		const messages: string[] = [];
		try {
			const result = await commentOnTaskFromTui(core, screen, { ...task, branch: "feature" }, (message) =>
				messages.push(message),
			);

			expect(result).toBeNull();
			expect(messages).toEqual([' {red-fg}Cannot comment on task from branch "feature".{/}']);
			expect(
				collectWidgets(screen as unknown as { children?: unknown[] }).some((w) => w.options?.label === " Comment "),
			).toBe(false);
		} finally {
			screen.destroy();
		}
	});
});
