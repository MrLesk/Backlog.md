import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import TaskDetails from "../web/components/TaskDetails";

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

describe("Task page documentation display", () => {
	it("renders documentation entries when present", () => {
		setupDom();

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

		const html = renderToString(
			<MemoryRouter>
				<ThemeProvider>
					<TaskDetails task={task} onClose={() => {}} />
				</ThemeProvider>
			</MemoryRouter>,
		);

		expect(html).toContain("Documentation");
		expect(html).toContain("README.md");
		expect(html).toContain("https://docs.example.com");
	});

	it("hides documentation section when empty", () => {
		setupDom();

		const task: Task = {
			id: "TASK-2",
			title: "No docs task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			documentation: [],
		};

		const html = renderToString(
			<MemoryRouter>
				<ThemeProvider>
					<TaskDetails task={task} onClose={() => {}} />
				</ThemeProvider>
			</MemoryRouter>,
		);

		expect(html).not.toContain("Documentation");
	});
});
