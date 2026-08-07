import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import DependencyInput from "../web/components/DependencyInput.tsx";

const availableTasks: Task[] = [
	{
		id: "BACK-10",
		title: "Known dependency",
		status: "To Do",
		assignee: [],
		createdDate: "2026-07-24",
		labels: [],
		dependencies: [],
	},
];

function renderChips(dependencies: string[]): Document {
	const html = renderToString(
		<MemoryRouter>
			<DependencyInput value={dependencies} onChange={() => {}} availableTasks={availableTasks} />
		</MemoryRouter>,
	);
	return new JSDOM(html).window.document;
}

describe("DependencyInput dependency chips", () => {
	it("links a dependency chip to the task it references", () => {
		const rendered = renderChips(["BACK-10"]);
		const link = rendered.querySelector('a[href="/tasks/BACK-10"]');

		expect(link).toBeTruthy();
		expect(link?.textContent).toBe("BACK-10 - Known dependency");
	});

	it("keeps dependencies that match no loaded task as plain text", () => {
		const rendered = renderChips(["BACK-9999"]);

		expect(rendered.querySelectorAll("a").length).toBe(0);
		expect(rendered.body.textContent).toContain("BACK-9999");
	});
});
