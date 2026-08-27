import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { installDomGlobals } from "./dom-globals.ts";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";

afterEach(() => {
	delete (globalThis as { window?: Window & typeof globalThis }).window;
	delete (globalThis as { document?: Document }).document;
	delete (globalThis as { navigator?: Navigator }).navigator;
});

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

const knownTasks = taskFixtures("TASK-358.8", "BACK-123", "TASK-100", "TASK-200", "TASK-123", "BACK-1", "TASK-PREFIXED");

function renderMarkdown(source: string, tasks: Task[] = knownTasks): string {
	return renderToString(
		<TaskIdIndexProvider tasks={tasks}>
			<MermaidMarkdown source={source} />
		</TaskIdIndexProvider>,
	);
}

function taskLinks(html: string): string[] {
	const rendered = new JSDOM(html).window.document;
	return Array.from(rendered.querySelectorAll('a[href^="/tasks/"]')).map((link) => link.getAttribute("href") ?? "");
}

describe("MermaidMarkdown", () => {
	it("renders angle-bracket type strings without throwing", () => {
		const source =
			"Implemented contracts: getDishesByMenu(String menuId) -> Result<List<MenuItem>>";

		expect(() => renderToString(<MermaidMarkdown source={source} />)).not.toThrow();

		const html = renderToString(<MermaidMarkdown source={source} />);
		expect(html).toContain("Result&lt;List&lt;MenuItem&gt;&gt;");
	});

	it("keeps markdown rendering functional for normal content", () => {
		const source = "## Heading\n\nRegular **markdown** content.";
		const html = renderToString(<MermaidMarkdown source={source} />);

		expect(html).toContain("Heading");
		expect(html).toContain("<strong>markdown</strong>");
	});

	it("preserves non-http autolinks and email autolinks", () => {
		const source = "Links: <ftp://example.com/file> and <foo@example.com>";
		const html = renderToString(<MermaidMarkdown source={source} />);

		expect(html).toContain('href="ftp://example.com/file"');
		expect(html).toContain('href="mailto:foo@example.com"');
	});

	it("keeps hash-only markdown links on the current route when a base href is present", () => {
		const dom = new JSDOM("<!doctype html><html><head><base href='/'></head><body></body></html>", {
			url: "http://localhost/tasks/BACK-426?view=detail",
		});
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = dom.window.document as Document;
		globalThis.navigator = dom.window.navigator as Navigator;
		installDomGlobals(dom);

		const source = "# First Heading\n\n[First](#first-heading) [Second](#second-heading)\n\n## Second Heading";
		const html = renderToString(<MermaidMarkdown source={source} />);
		const renderedDocument = new JSDOM(html).window.document;
		const links = Array.from(renderedDocument.querySelectorAll("p a")).map((link) => link.getAttribute("href"));

		expect(renderedDocument.querySelector("#first-heading")).toBeTruthy();
		expect(renderedDocument.querySelector("#second-heading")).toBeTruthy();
		expect(links).toEqual([
			"/tasks/BACK-426?view=detail#first-heading",
			"/tasks/BACK-426?view=detail#second-heading",
		]);
	});

	it("automatically links task IDs to /tasks/:id", () => {
		const html = renderMarkdown("Related task: TASK-358.8 and BACK-123.");

		expect(taskLinks(html)).toEqual(["/tasks/TASK-358.8", "/tasks/BACK-123"]);
	});

	it("links task IDs written in lower case to their canonical task", () => {
		const html = renderMarkdown("See back-123 for context.");

		expect(taskLinks(html)).toEqual(["/tasks/BACK-123"]);
	});

	it("does not auto-link task IDs inside code backticks or existing links", () => {
		const html = renderMarkdown("Code `TASK-100` and link [TASK-200](/tasks/TASK-200?view=detail)");

		expect(html).toContain("<code>TASK-100</code>");
		expect(taskLinks(html)).toEqual(["/tasks/TASK-200?view=detail"]);
	});

	it("does not auto-link task IDs inside fenced code blocks", () => {
		const html = renderMarkdown("Run this:\n\n```bash\nbacklog task view TASK-100\n```\n\nThen open BACK-123.");

		expect(taskLinks(html)).toEqual(["/tasks/BACK-123"]);
	});

	it("does not auto-link tokens that only look like task IDs", () => {
		const html = renderMarkdown("Encoding UTF-8, dates in ISO-8601, release v1.2.3, file BACK-1.md.");

		expect(taskLinks(html)).toEqual([]);
	});

	it("does not auto-link an ID-shaped tail of a longer identifier", () => {
		const html = renderMarkdown("Branch my-task-123 and path backlog/tasks/TASK-123 stay plain.");

		expect(taskLinks(html)).toEqual([]);
	});

	it("does not auto-link IDs inside Windows-style paths", () => {
		const html = renderMarkdown("File backlog\\tasks\\BACK-123 - Title.md stays plain.");

		expect(taskLinks(html)).toEqual([]);
	});

	it("does not auto-link IDs that match no known task", () => {
		const html = renderMarkdown("Unknown reference BACK-9999 stays plain.");

		expect(taskLinks(html)).toEqual([]);
	});

	it("links task IDs inside list items and headings", () => {
		const html = renderMarkdown("## Blocked by BACK-123\n\n- depends on TASK-100\n");

		expect(taskLinks(html)).toEqual(["/tasks/BACK-123", "/tasks/TASK-100"]);
	});

	it("links zero-padded references to the canonical task", () => {
		const html = renderMarkdown("Padded reference BACK-0123 resolves.");

		expect(taskLinks(html)).toEqual(["/tasks/BACK-123"]);
	});

	it("links legacy non-numeric task IDs", () => {
		const html = renderMarkdown("Legacy reference TASK-PREFIXED resolves.");

		expect(taskLinks(html)).toEqual(["/tasks/TASK-PREFIXED"]);
	});

	it("leaves references plain when two loaded tasks share a canonical ID", () => {
		const ambiguousTasks = taskFixtures("BACK-1", "BACK-01", "BACK-2");
		const html = renderMarkdown("Ambiguous BACK-1 and unambiguous BACK-2.", ambiguousTasks);

		expect(taskLinks(html)).toEqual(["/tasks/BACK-2"]);
	});

	it("does not auto-link IDs embedded in non-ASCII identifiers", () => {
		const html = renderMarkdown("Tokens caféBACK-123 and BACK-123ä stay plain.");

		expect(taskLinks(html)).toEqual([]);
	});
});
