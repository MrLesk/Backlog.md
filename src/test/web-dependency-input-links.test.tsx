import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import DependencyInput from "../web/components/DependencyInput.tsx";

const taskFixtures = (...ids: string[]): Task[] =>
	ids.map((id) => ({
		id,
		title: `Task ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2026-07-24",
		labels: [],
		dependencies: [],
	}));

const availableTasks = taskFixtures("BACK-10");

function renderChips(dependencies: string[], tasks: Task[] = availableTasks, path = "/"): Document {
	const html = renderToString(
		<MemoryRouter initialEntries={[path]}>
			<DependencyInput value={dependencies} onChange={() => {}} availableTasks={tasks} />
		</MemoryRouter>,
	);
	return new JSDOM(html).window.document;
}

describe("DependencyInput dependency chips", () => {
	it("links a dependency chip to the task it references", () => {
		const rendered = renderChips(["BACK-10"]);
		const link = rendered.querySelector('a[href="/tasks/BACK-10"]');

		expect(link).toBeTruthy();
		expect(link?.textContent).toBe("BACK-10 - Task BACK-10");
	});

	it("keeps the reader on the board: chips clicked from /board link within /board", () => {
		const rendered = renderChips(["BACK-10"], availableTasks, "/board/BACK-20");
		const link = rendered.querySelector('a[href="/board/BACK-10"]');

		expect(link).toBeTruthy();
		expect(rendered.querySelector('a[href="/tasks/BACK-10"]')).toBeNull();
	});

	it("links chips through /tasks when reading from the task list", () => {
		const rendered = renderChips(["BACK-10"], availableTasks, "/tasks/BACK-20");
		const link = rendered.querySelector('a[href="/tasks/BACK-10"]');

		expect(link).toBeTruthy();
	});

	it("resolves dependencies that differ in case or zero padding", () => {
		const rendered = renderChips(["back-010"]);
		const link = rendered.querySelector('a[href="/tasks/BACK-10"]');

		expect(link).toBeTruthy();
		expect(link?.textContent).toBe("BACK-10 - Task BACK-10");
	});

	it("keeps dependencies that match no loaded task as plain text", () => {
		const rendered = renderChips(["BACK-9999"]);

		expect(rendered.querySelectorAll("a").length).toBe(0);
		expect(rendered.body.textContent).toContain("BACK-9999");
	});

	it("keeps dependencies plain when two loaded tasks share a canonical ID", () => {
		const rendered = renderChips(["BACK-1"], taskFixtures("BACK-1", "BACK-01"));

		expect(rendered.querySelectorAll("a").length).toBe(0);
		expect(rendered.body.textContent).toContain("BACK-1");
	});
});
