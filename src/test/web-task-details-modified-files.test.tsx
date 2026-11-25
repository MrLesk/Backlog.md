import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskDetails from "../web/components/TaskDetails";
import { ThemeProvider } from "../web/contexts/ThemeContext";

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;

	if (!window.matchMedia) {
		window.matchMedia = () =>
			({
				matches: false,
				media: "",
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			}) as MediaQueryList;
	}
};

const baseTask = (overrides: Partial<Task>): Task => ({
	id: "TASK-1",
	title: "Task with modified files",
	status: "To Do",
	assignee: [],
	createdDate: "2025-01-01",
	labels: [],
	dependencies: [],
	...overrides,
});

const renderPage = (task: Task) => {
	setupDom();
	return renderToString(
		<MemoryRouter initialEntries={[`/tasks/${task.id}`]}>
			<ThemeProvider>
				<TaskDetails task={task} onClose={() => {}} />
			</ThemeProvider>
		</MemoryRouter>,
	);
};

// The Modified files panel beside the reading column, parsed from the page.
const modifiedFilesPanel = (html: string) =>
	Array.from(new JSDOM(html).window.document.querySelectorAll("section")).find((section) =>
		section.querySelector("h3")?.textContent?.startsWith("Modified files"),
	);

// A path long enough to overflow its row, so wrapping rather than horizontal scrolling is what keeps it readable.
const longPath = (index: number) =>
	`src/web/components/${`deeply-nested-feature-directory-${index}/`.repeat(6)}TaskDetailsModalSection${index}.tsx`;

describe("Task page modified files panel", () => {
	it("renders modified file paths when present", () => {
		const html = renderPage(baseTask({ modifiedFiles: ["src/cli.ts", "src/web/components/TaskDetailsModal.tsx"] }));

		expect(html).toContain("Modified files");
		expect(html).toContain("src/cli.ts");
		expect(html).toContain("src/web/components/TaskDetailsModal.tsx");
	});

	it("shows an empty state when the task has no modified files", () => {
		const html = renderPage(baseTask({ modifiedFiles: [] }));

		expect(html).toContain("Modified files");
		expect(html).toContain("No modified files");
	});

	it("counts the paths in the panel's caption", () => {
		const html = renderPage(baseTask({ modifiedFiles: ["src/cli.ts", "src/server/index.ts", "src/types/index.ts"] }));

		expect(modifiedFilesPanel(html)?.querySelector("h3 span")?.textContent).toBe("3");
	});

	it("keeps the page usable when a task lists many long paths", () => {
		const modifiedFiles = Array.from({ length: 120 }, (_, index) => longPath(index));
		const panel = modifiedFilesPanel(renderPage(baseTask({ modifiedFiles })));

		// Every path stays in the panel: the list is bounded by scrolling, not by dropping entries.
		expect(Array.from(panel?.querySelectorAll("li") ?? [], (item) => item.textContent)).toEqual(modifiedFiles);
		expect(panel?.querySelector("h3 span")?.textContent).toBe("120");

		// The list scrolls inside its panel so the panels below it stay reachable.
		const listClasses = panel?.querySelector("ul")?.className ?? "";
		expect(listClasses).toContain("max-h-64");
		expect(listClasses).toContain("overflow-y-auto");

		// Long paths break inside their row instead of widening the side column.
		expect(panel?.querySelector("li span")?.className).toContain("wrap-anywhere");
	});

	it("hides add and remove controls for read-only cross-branch tasks", () => {
		const html = renderPage(baseTask({ branch: "feature/other", modifiedFiles: ["src/cli.ts"] }));

		expect(html).toContain("src/cli.ts");
		expect(html).not.toContain("Remove modified file");
		expect(html).not.toContain("Add modified file");
	});
});
