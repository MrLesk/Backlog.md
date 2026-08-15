import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
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

const renderModal = (task: Task) => {
	setupDom();
	return renderToString(
		<ThemeProvider>
			<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
		</ThemeProvider>,
	);
};

// A path long enough to overflow its row, so wrapping rather than horizontal scrolling is what keeps it readable.
const longPath = (index: number) =>
	`src/web/components/${`deeply-nested-feature-directory-${index}/`.repeat(6)}TaskDetailsModalSection${index}.tsx`;

describe("Web task popup modified files display", () => {
	it("renders modified file paths when present", () => {
		const html = renderModal(baseTask({ modifiedFiles: ["src/cli.ts", "src/web/components/TaskDetailsModal.tsx"] }));

		expect(html).toContain("Modified files");
		expect(html).toContain("src/cli.ts");
		expect(html).toContain("src/web/components/TaskDetailsModal.tsx");
	});

	it("shows an empty state when the task has no modified files", () => {
		const html = renderModal(baseTask({ modifiedFiles: [] }));

		expect(html).toContain("Modified files");
		expect(html).toContain("No modified files");
	});

	it("counts the paths in the section heading", () => {
		const html = renderModal(baseTask({ modifiedFiles: ["src/cli.ts", "src/server/index.ts", "src/types/index.ts"] }));

		expect(html).toContain("Modified files (3)");
	});

	it("keeps the modal usable when a task lists many long paths", () => {
		const modifiedFiles = Array.from({ length: 120 }, (_, index) => longPath(index));
		const html = renderModal(baseTask({ modifiedFiles }));

		// Every path stays in the document: the list is bounded by scrolling, not by dropping entries.
		for (const file of modifiedFiles) {
			expect(html).toContain(file);
		}
		expect(html).toContain("Modified files (120)");

		// The list scrolls inside its own section so the sections below it stay reachable.
		const section = html.slice(html.indexOf("Modified files (120)"));
		const listClasses = section.match(/<ul class="([^"]*)"/)?.[1] ?? "";
		expect(listClasses).toContain("max-h-64");
		expect(listClasses).toContain("overflow-y-auto");

		// Long paths break inside their row instead of widening the modal.
		expect(html).toContain("break-all");

		// Sections rendered after the modified files list are still part of the modal.
		expect(html).toContain("Acceptance Criteria");
	});

	it("hides add and remove controls for read-only cross-branch tasks", () => {
		const html = renderModal(baseTask({ branch: "feature/other", modifiedFiles: ["src/cli.ts"] }));

		expect(html).toContain("src/cli.ts");
		expect(html).not.toContain("Remove modified file");
		expect(html).not.toContain("newModifiedFile");
	});
});
