import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { formatTaskListItem } from "../ui/board.ts";
import { formatProjectBadge } from "../ui/project.ts";
import { createTaskPopup } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";

const createTask = (overrides: Partial<Task> = {}): Task => ({
	id: "TASK-1",
	title: "Projected task",
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

describe("TUI task project display", () => {
	it("formats configured values as a distinct badge and omits unset values", () => {
		expect(formatProjectBadge(" Web ")).toBe("{blue-fg}[Web]{/}");
		expect(formatProjectBadge(undefined)).toBe("");
		expect(formatProjectBadge("   ")).toBe("");
	});

	it("shows the project badge on board task cards", () => {
		const projected = formatTaskListItem(createTask({ project: "Web" }));
		const unprojected = formatTaskListItem(createTask());

		expect(projected).toContain("{blue-fg}[Web]{/}");
		expect(unprojected).not.toContain("{blue-fg}");
	});

	it("shows the project field in task details and hides it for unprojected tasks", async () => {
		const screen = createScreen({ smartCSR: false });
		const originalIsTTY = process.stdout.isTTY;
		let patchedTTY = false;

		try {
			if (process.stdout.isTTY === false) {
				Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
				patchedTTY = true;
			}

			const projectedPopup = await createTaskPopup(screen, createTask({ project: "Web" }));
			const projectedContent = getPopupContent(projectedPopup?.contentArea);
			expect(projectedContent).toContain("Project:");
			expect(projectedContent).toContain("[Web]");
			projectedPopup?.close();

			const unprojectedPopup = await createTaskPopup(screen, createTask({ id: "TASK-2" }));
			const unprojectedContent = getPopupContent(unprojectedPopup?.contentArea);
			expect(unprojectedContent).not.toContain("Project:");
			unprojectedPopup?.close();
		} finally {
			if (patchedTTY) {
				Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
			}
			screen.destroy();
		}
	});
});
