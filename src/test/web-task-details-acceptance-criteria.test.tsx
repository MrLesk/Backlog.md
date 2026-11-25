import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard";
import TaskDetails from "../web/components/TaskDetails";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { STANDALONE_CARD_NESTING } from "./task-card-nesting.ts";

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

describe("Task view acceptance criteria display", () => {
	it("renders existing acceptance criteria numbers in preview", () => {
		setupDom();

		const task: Task = {
			id: "TASK-1",
			title: "Task with acceptance criteria",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			acceptanceCriteriaItems: [
				{ index: 1, text: "First criterion", checked: false },
				{ index: 3, text: "Third criterion", checked: true },
			],
		};

		const html = renderToString(
			<MemoryRouter>
				<ThemeProvider>
					<TaskDetails task={task} onClose={() => {}} />
				</ThemeProvider>
			</MemoryRouter>,
		);

		const rendered = new JSDOM(html).window.document;
		const section = Array.from(rendered.querySelectorAll("section")).find(
			(candidate) => candidate.querySelector("h3")?.textContent === "Acceptance criteria",
		);
		const progress = section?.querySelector("[role='progressbar']");
		expect(progress?.getAttribute("aria-valuenow")).toBe("1");
		expect(progress?.getAttribute("aria-valuemax")).toBe("2");
		expect(Array.from(section?.querySelectorAll("li") ?? [], (item) => item.textContent)).toEqual([
			"#1First criterion",
			"#3Third criterion",
		]);
	});

	it("does not add acceptance criteria details to board cards", () => {
		setupDom();

		const task: Task = {
			id: "TASK-7",
			title: "Board card task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			acceptanceCriteriaItems: [{ index: 7, text: "Hidden criterion", checked: false }],
		};

		const html = renderToString(
			<MemoryRouter initialEntries={["/board"]}>
				<TaskCard task={task} onEdit={() => {}} {...STANDALONE_CARD_NESTING} />
			</MemoryRouter>,
		);

		expect(html).toContain("Board card task");
		expect(html).not.toContain("Hidden criterion");
		expect(html).not.toContain("#7");
	});
});
