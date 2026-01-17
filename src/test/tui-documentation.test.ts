import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { createTaskPopup } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";

describe("TUI documentation display", () => {
	it("shows documentation entries in task popup content", async () => {
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
				title: "Documented task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
				documentation: ["README.md", "https://docs.example.com"],
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
			expect(contentText).toContain("Documentation");
			expect(contentText).toContain("README.md");
			expect(contentText).toContain("https://docs.example.com");

			popup?.close();
		} finally {
			if (patchedTTY) {
				Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
			}
			screen.destroy();
		}
	});
});
