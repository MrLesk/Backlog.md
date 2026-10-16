import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { formatPriorityMarker } from "../ui/priority-marker.ts";
import { formatTaskViewerListItem, generateDetailContent } from "../ui/task-viewer-with-search.ts";

/** The arrow of each configured priority, top of the list first. */
const arrows = (priorities: string[]) =>
	priorities.map((priority) => formatPriorityMarker(priority, priorities).replace(/\{[^}]+\}/g, "")).join(" ");

const createTask = (overrides: Partial<Task> = {}): Task => ({
	id: "TASK-1",
	title: "Marked task",
	status: "To Do",
	assignee: [],
	createdDate: new Date().toISOString().slice(0, 10),
	labels: [],
	dependencies: [],
	...overrides,
});

describe("TUI priority marker", () => {
	const priorities = ["now", "next", "later"];

	it("points up above the middle of the configured list, down below it, and right in the middle", () => {
		expect(arrows(priorities)).toBe("↑ → ↓");
		expect(arrows(["now", "later"])).toBe("↑ ↓");
		expect(arrows(["urgent", "high", "normal", "low"])).toBe("↑ ↑ ↓ ↓");
		expect(arrows(["very high", "high", "medium", "low", "very low"])).toBe("↑ ↑ → ↓ ↓");
		expect(arrows(["only"])).toBe("→");
	});

	it("uses high, medium and low when no priorities are configured", () => {
		expect(formatPriorityMarker("high")).toBe("{red-fg}↑{/red-fg}");
		expect(formatPriorityMarker("Medium")).toBe("{yellow-fg}→{/yellow-fg}");
		expect(formatPriorityMarker("low")).toBe("{green-fg}↓{/green-fg}");
	});

	it("is empty for a task without a priority or with one that is not configured", () => {
		expect(formatPriorityMarker(undefined, ["now", "later"])).toBe("");
		expect(formatPriorityMarker("high", ["now", "later"])).toBe("");
	});

	it("takes the place of the dash before the title on a task list row", () => {
		expect(formatTaskViewerListItem(createTask({ priority: "later" }), undefined, undefined, priorities)).toContain(
			"{bold}TASK-1{/bold} {green-fg}↓{/green-fg} Marked task",
		);
		expect(formatTaskViewerListItem(createTask(), undefined, undefined, priorities)).toContain(
			"{bold}TASK-1{/bold} - Marked task",
		);
	});

	it("follows the priority name in task details, for every configured priority", () => {
		const detailLines = (task: Task) =>
			generateDetailContent(task, { configuredPriorities: priorities }).bodyContent.join("\n");

		expect(detailLines(createTask({ priority: "now" }))).toContain("{bold}Priority:{/bold} Now {red-fg}↑{/red-fg}");
		expect(detailLines(createTask({ priority: "later" }))).toContain(
			"{bold}Priority:{/bold} Later {green-fg}↓{/green-fg}",
		);
		// A priority that is not configured keeps its name and gets no arrow.
		expect(detailLines(createTask({ priority: "high" }))).toMatch(/\{bold\}Priority:\{\/bold\} High(?! \{)/);
		expect(detailLines(createTask())).not.toContain("Priority:");
	});
});
