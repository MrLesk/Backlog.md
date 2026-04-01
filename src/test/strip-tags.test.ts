import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { formatTaskListItem } from "../ui/board.ts";
import { stripBlessedFgTags } from "../ui/utils/strip-tags.ts";

describe("stripBlessedFgTags", () => {
	it("returns the original string when no blessed tags are present", () => {
		expect(stripBlessedFgTags("plain text")).toBe("plain text");
	});

	it("removes foreground color tags that use generic closing tags", () => {
		expect(stripBlessedFgTags("{cyan-fg}@dev{/}")).toBe("@dev");
	});

	it("removes foreground color tags that use explicit closing tags", () => {
		expect(stripBlessedFgTags("{yellow-fg}[bug]{/yellow-fg}")).toBe("[bug]");
	});

	it("preserves structural tags while removing nested foreground wrappers", () => {
		expect(stripBlessedFgTags("{gray-fg}{bold}TASK-1{/bold}{/}")).toBe("{bold}TASK-1{/bold}");
	});

	it("removes multiple nested foreground tags while keeping text content", () => {
		expect(stripBlessedFgTags("{magenta-fg}► {bold}TASK-1{/bold} {cyan-fg}@dev{/}{/}")).toBe(
			"► {bold}TASK-1{/bold} @dev",
		);
	});

	it("preserves stack state when an explicit closing tag does not match the opener", () => {
		expect(stripBlessedFgTags("{bold}TASK{/cyan-fg}{/bold}")).toBe("{bold}TASK{/cyan-fg}{/bold}");
	});

	it("keeps empty strings unchanged", () => {
		expect(stripBlessedFgTags("")).toBe("");
	});
});

describe("formatTaskListItem", () => {
	it("retains all task content after stripping foreground color tags", () => {
		const task = {
			id: "TASK-24.4.5.1",
			title: "Simplify highlighted task contrast",
			status: "To Do",
			assignee: ["jay"],
			createdDate: "2026-04-01",
			labels: ["ui", "tui"],
			dependencies: [],
			branch: "tasks/back-409-highlight-contrast",
		} satisfies Task & { branch: string };

		const stripped = stripBlessedFgTags(formatTaskListItem(task));
		expect(stripped).toContain("{bold}TASK-24.4.5.1{/bold}");
		expect(stripped).toContain("Simplify highlighted task contrast");
		expect(stripped).toContain("@jay");
		expect(stripped).toContain("[ui, tui]");
		expect(stripped).toContain("(tasks/back-409-highlight-contrast)");
		expect(stripped).not.toContain("{cyan-fg}");
		expect(stripped).not.toContain("{yellow-fg}");
		expect(stripped).not.toContain("{green-fg}");
		expect(stripped).not.toContain("{gray-fg}");
	});
});
