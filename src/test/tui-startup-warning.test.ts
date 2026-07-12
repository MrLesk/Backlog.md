import { describe, expect, it } from "bun:test";
import { box } from "neo-neo-bblessed";
import { createStartupWarningBar } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";

describe("TUI startup warning bar", () => {
	it("renders the duplicate-ID warning persistently with doctor guidance", () => {
		const screen = createScreen({ smartCSR: false });
		try {
			const container = box({ parent: screen, width: "100%", height: "100%" });
			const message = "Duplicate task IDs detected: TASK-1. Run 'backlog doctor' to preview a safe repair.";
			const bar = createStartupWarningBar(container, message);

			const barContent = bar as { getContent?: () => string; content?: string };
			const content = String(barContent.getContent ? barContent.getContent() : (barContent.content ?? ""));
			expect(content).toContain("Duplicate task IDs detected: TASK-1");
			expect(content).toContain("backlog doctor");
			expect(bar.height).toBe(1);
		} finally {
			screen.destroy();
		}
	});
});
