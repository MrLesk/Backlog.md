import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { formatTaskListItem } from "../ui/board.ts";
import { formatTaskTypeBadge } from "../ui/task-type.ts";
import { createTaskPopup } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";

const createTask = (overrides: Partial<Task> = {}): Task => ({
	id: "TASK-1",
	title: "Typed task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-07-10",
	labels: [],
	dependencies: [],
	...overrides,
});

const getPopupContent = (contentArea: unknown): string => {
	const content = contentArea as { getContent?: () => string; content?: string } | undefined;
	return String(content?.getContent ? content.getContent() : (content?.content ?? ""));
};

describe("TUI task type display", () => {
	it("formats configured values as a distinct badge and omits untyped values", () => {
		expect(formatTaskTypeBadge(" Epic ")).toBe("{magenta-fg}[Epic]{/}");
		expect(formatTaskTypeBadge(undefined)).toBe("");
		expect(formatTaskTypeBadge("   ")).toBe("");
	});

	it("shows the type badge on board task cards", () => {
		const typed = formatTaskListItem(createTask({ type: "Epic" }));
		const untyped = formatTaskListItem(createTask());

		expect(typed).toContain("{magenta-fg}[Epic]{/}");
		expect(untyped).not.toContain("{magenta-fg}");
	});

	it("shows the type field in task details and hides it for untyped tasks", async () => {
		const screen = createScreen({ smartCSR: false });
		const originalIsTTY = process.stdout.isTTY;
		let patchedTTY = false;

		try {
			if (process.stdout.isTTY === false) {
				Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
				patchedTTY = true;
			}

			const typedPopup = await createTaskPopup(screen, createTask({ type: "Epic" }));
			const typedContent = getPopupContent(typedPopup?.contentArea);
			expect(typedContent).toContain("Type:");
			expect(typedContent).toContain("[Epic]");
			typedPopup?.close();

			const untypedPopup = await createTaskPopup(screen, createTask({ id: "TASK-2" }));
			const untypedContent = getPopupContent(untypedPopup?.contentArea);
			expect(untypedContent).not.toContain("Type:");
			untypedPopup?.close();
		} finally {
			if (patchedTTY) {
				Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
			}
			screen.destroy();
		}
	});
});
