import { describe, expect, it } from "bun:test";
import type { Task, TaskCommentInput } from "../types/index.ts";
import { getCommentComposerLayout, openCommentComposer } from "../ui/components/comment-composer.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

type TestWidget = {
	children?: unknown[];
	content?: string;
	options?: { label?: string };
	getValue?: () => string;
	emit?: (event: string, ...args: unknown[]) => void;
};

const task: Task = {
	id: "TASK-7",
	title: "Comment target",
	status: "To Do",
	assignee: [],
	createdDate: "2026-10-04 10:00",
	labels: [],
	dependencies: [],
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
	const key = { name, full: name, shift: false, ctrl: name.startsWith("C-") };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

function typeText(widget: TestWidget | undefined, value: string): void {
	for (const character of value) pressKey(widget, character, character);
}

async function settle(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

async function openComposer(persist: (comment: TaskCommentInput) => Promise<Task>, author?: string) {
	const screen = createScreen({ smartCSR: false });
	Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
	const result = openCommentComposer({ screen, task, author, persist });
	await settle();
	const widgets = collectWidgets(screen as unknown as { children?: unknown[] });
	const find = (predicate: (widget: TestWidget) => boolean) => widgets.find(predicate);
	return {
		screen,
		result,
		focused: () => (screen as unknown as { focused?: TestWidget }).focused,
		author: find((widget) => widget.options?.label === " Author "),
		body: find((widget) => widget.options?.label === " Comment "),
		add: find((widget) => widget.content === "Add comment"),
		cancel: find((widget) => widget.content === "Cancel"),
		errorText: () => widgets.filter((widget) => widget.content?.startsWith(" ")).map((widget) => widget.content ?? ""),
	};
}

describe("TUI comment composer", () => {
	it("starts in the comment field with the author prefilled and adds the comment", async () => {
		const persisted: TaskCommentInput[] = [];
		const composer = await openComposer(async (comment) => {
			persisted.push(comment);
			return {
				...task,
				comments: [{ index: 1, body: comment.body, author: comment.author, createdDate: "2026-10-04 10:05" }],
			};
		}, "@simon");
		try {
			expect(composer.focused()).toBe(composer.body);
			expect(composer.author?.getValue?.()).toBe("@simon");

			typeText(composer.focused(), "Looks good");
			pressKey(composer.add, "enter", "\r");

			const updated = await withTimeout(composer.result, "comment composer add", 1000);
			expect(updated?.comments?.[0]?.body).toBe("Looks good");
			expect(persisted).toEqual([{ body: "Looks good", author: "@simon" }]);
		} finally {
			composer.screen.destroy();
		}
	});

	it("adds with Ctrl+S from the comment field and omits a blank author", async () => {
		const persisted: TaskCommentInput[] = [];
		const composer = await openComposer(async (comment) => {
			persisted.push(comment);
			return task;
		});
		try {
			typeText(composer.focused(), "No name");
			pressKey(composer.focused(), "C-s");

			await withTimeout(composer.result, "comment composer Ctrl+S", 1000);
			expect(persisted).toEqual([{ body: "No name" }]);
		} finally {
			composer.screen.destroy();
		}
	});

	it("keeps the composer open with a message when the comment is empty", async () => {
		let writes = 0;
		const composer = await openComposer(async () => {
			writes += 1;
			return task;
		});
		try {
			pressKey(composer.add, "enter", "\r");
			await settle();

			expect(writes).toBe(0);
			expect(composer.errorText()).toContain(" Write a comment first.");
			pressKey(composer.focused(), "escape", "\x1b");
			expect(await withTimeout(composer.result, "comment composer cancel", 1000)).toBeNull();
		} finally {
			composer.screen.destroy();
		}
	});

	it("shows a rejected comment's error and lets it be fixed", async () => {
		let attempts = 0;
		const composer = await openComposer(async (comment) => {
			attempts += 1;
			if (attempts === 1) throw new Error("Comment body cannot contain standalone '---' delimiter lines.");
			return { ...task, comments: [{ index: 1, body: comment.body, createdDate: "2026-10-04 10:05" }] };
		});
		try {
			typeText(composer.focused(), "First try");
			pressKey(composer.add, "enter", "\r");
			await settle();

			expect(composer.errorText()).toContain(" Comment body cannot contain standalone '---' delimiter lines.");
			expect(composer.focused()).toBe(composer.body);

			pressKey(composer.add, "enter", "\r");
			expect((await withTimeout(composer.result, "comment composer retry", 1000))?.comments?.[0]?.body).toBe(
				"First try",
			);
		} finally {
			composer.screen.destroy();
		}
	});

	it("Cancel adds nothing", async () => {
		let writes = 0;
		const composer = await openComposer(async () => {
			writes += 1;
			return task;
		});
		try {
			typeText(composer.focused(), "Never mind");
			pressKey(composer.cancel, "enter", "\r");

			expect(await withTimeout(composer.result, "comment composer cancel button", 1000)).toBeNull();
			expect(writes).toBe(0);
		} finally {
			composer.screen.destroy();
		}
	});

	it("fits short and narrow terminals", () => {
		expect(getCommentComposerLayout(100, 30)).toEqual({ popupWidth: 72, popupHeight: 16, bodyHeight: 7 });
		const small = getCommentComposerLayout(40, 12);
		expect(small.popupWidth).toBeLessThanOrEqual(36);
		expect(small.popupHeight).toBeLessThanOrEqual(10);
		expect(small.bodyHeight).toBeGreaterThanOrEqual(3);
	});
});
