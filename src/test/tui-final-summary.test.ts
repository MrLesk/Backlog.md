import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { createTaskPopup } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";

describe("TUI Final Summary display", () => {
	it("shows Final Summary section when present", async () => {
		const screen = createScreen({ smartCSR: false });
		const originalIsTTY = process.stdout.isTTY;
		let patchedTTY = false;

		try {
			if (process.stdout.isTTY === false) {
				Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
				patchedTTY = true;
			}

			const task: Task = {
				id: "TASK-1",
				title: "Summarized task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
				finalSummary: "PR-style summary",
			};

			const popup = await createTaskPopup(screen, task);
			expect(popup).not.toBeNull();

			const contentArea = popup?.contentArea as
				| {
						getContent?: () => string;
						content?: string;
				  }
				| undefined;
			const content = contentArea?.getContent ? contentArea.getContent() : (contentArea?.content ?? "");
			const contentText = String(content);
			expect(contentText).toContain("Final Summary");
			expect(contentText).toContain("PR-style summary");

			popup?.close();
		} finally {
			if (patchedTTY) {
				Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
			}
			screen.destroy();
		}
	});

	it("hides Final Summary section when empty", async () => {
		const screen = createScreen({ smartCSR: false });
		const originalIsTTY = process.stdout.isTTY;
		let patchedTTY = false;

		try {
			if (process.stdout.isTTY === false) {
				Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
				patchedTTY = true;
			}

			const task: Task = {
				id: "TASK-2",
				title: "No summary task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
			};

			const popup = await createTaskPopup(screen, task);
			expect(popup).not.toBeNull();

			const contentArea = popup?.contentArea as
				| {
						getContent?: () => string;
						content?: string;
				  }
				| undefined;
			const content = contentArea?.getContent ? contentArea.getContent() : (contentArea?.content ?? "");
			const contentText = String(content);
			expect(contentText).not.toContain("Final Summary");

			popup?.close();
		} finally {
			if (patchedTTY) {
				Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
			}
			screen.destroy();
		}
	});
});
