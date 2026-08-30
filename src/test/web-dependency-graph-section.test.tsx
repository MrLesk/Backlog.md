import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { buildDependencyGraph, type DependencyGraph } from "../utils/dependency-graph.ts";
import { withDependencyGraph } from "../core/task-detail.ts";
import { DependencyGraphSection } from "../web/components/DependencyGraphSection";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { ThemeProvider } from "../web/contexts/ThemeContext";

const STATUSES = ["To Do", "In Progress", "Done"] as const;

function setupDom() {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
}

function makeTask(id: string, title: string, dependencies: string[] = [], status = "To Do"): Task {
	return { id, title, status, assignee: [], createdDate: "2026-01-01", labels: [], dependencies };
}

function payloadFor(rootId: string, tasks: Task[], completedTasks: Task[] = []): DependencyGraph {
	const root = [...tasks, ...completedTasks].find((candidate) => candidate.id === rootId);
	if (!root) throw new Error(`missing root ${rootId}`);
	return buildDependencyGraph(root, { tasks, completedTasks, statuses: STATUSES });
}

function render(payload: DependencyGraph): string {
	setupDom();
	return renderToString(
		<MemoryRouter>
			<DependencyGraphSection graph={payload} />
		</MemoryRouter>,
	);
}

describe("Web dependency graph section", () => {
	const corpus = [
		makeTask("TASK-1", "Foundation", [], "Done"),
		makeTask("TASK-2", "Selected", ["TASK-1", "TASK-404"]),
		makeTask("TASK-3", "Follow up", ["TASK-2"]),
		makeTask("TASK-4", "Later", ["TASK-3"]),
	];

	it("renders both directions with direct and total counts", () => {
		const html = render(payloadFor("TASK-2", corpus));

		expect(html).toContain("Depends on");
		expect(html).toContain("Dependents");
		expect(html).toContain("2 direct, 2 total");
		expect(html).toContain("1 direct, 2 total");
	});

	it("uses nested lists rather than drawn characters", () => {
		const html = render(payloadFor("TASK-2", corpus));

		// The hard rule for this surface: structure carries the shape, never glyph art.
		for (const glyph of ["├", "└", "│", "─"]) {
			expect(html).not.toContain(glyph);
		}
		expect(html).toContain("<ul");
		expect(html).toContain("<li");
		// The transitive dependent sits inside its parent's list item, not in a flat list.
		const parentIndex = html.indexOf('data-dependency-node="TASK-3"');
		const nestedIndex = html.indexOf('data-dependency-node="TASK-4"');
		expect(parentIndex).toBeGreaterThan(-1);
		expect(nestedIndex).toBeGreaterThan(parentIndex);
		expect(html.slice(parentIndex, nestedIndex)).toContain("<ul");
	});

	it("links every resolved node and labels it for assistive technology", () => {
		const html = render(payloadFor("TASK-2", corpus));

		expect(html).toContain('href="/tasks/TASK-1"');
		expect(html).toContain('href="/tasks/TASK-3"');
		expect(html).toContain('aria-label="Open TASK-1 - Foundation"');
		expect(html).toContain('aria-label="Depends on (2)"');
		expect(html).toContain('aria-label="Dependents (2)"');
	});

	it("marks completed, unknown, and ambiguous nodes without linking the unresolved ones", () => {
		const duplicated = [makeTask("TASK-5", "Contested"), makeTask("task-05", "Contested copy")];
		const html = render(payloadFor("TASK-2", [...corpus, ...duplicated], []));

		expect(html).toContain("Completed");
		expect(html).toContain("Unknown ID");
		expect(html).not.toContain('href="/tasks/TASK-404"');

		const ambiguousHtml = render(payloadFor("TASK-6", [...duplicated, makeTask("TASK-6", "Root", ["TASK-5"])]));
		expect(ambiguousHtml).toContain("Ambiguous ID");
		expect(ambiguousHtml).not.toContain('href="/tasks/TASK-5"');
	});

	it("marks a cycle and a repeated node instead of drawing them again", () => {
		const cyclic = [
			makeTask("TASK-1", "Selected", ["TASK-2"]),
			makeTask("TASK-2", "Second", ["TASK-1"]),
		];
		expect(render(payloadFor("TASK-1", cyclic))).toContain("Cycle");

		const diamond = [
			makeTask("TASK-1", "Shared"),
			makeTask("TASK-2", "Left", ["TASK-1"]),
			makeTask("TASK-3", "Right", ["TASK-1"]),
			makeTask("TASK-4", "Selected", ["TASK-2", "TASK-3"]),
		];
		const html = render(payloadFor("TASK-4", diamond));
		expect(html).toContain("Shown above");
		// The shared node is placed twice but expanded once, so its subtree is never repeated.
		expect(html.split('data-dependency-node="TASK-1"').length - 1).toBe(2);
	});

	it("renders nothing for a task with no dependencies and no dependents", () => {
		expect(render(payloadFor("TASK-1", [makeTask("TASK-1", "Alone")]))).toBe("");
	});
});

describe("Web task details modal dependency graph", () => {
	const corpus = [
		makeTask("TASK-1", "Foundation", [], "Done"),
		makeTask("TASK-2", "Selected", ["TASK-1", "TASK-404"]),
		makeTask("TASK-3", "Follow up", ["TASK-2"]),
	];

	function renderModal(task: Task) {
		setupDom();
		if (!globalThis.window.matchMedia) {
			globalThis.window.matchMedia = (() => ({
				matches: false,
				media: "",
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			})) as unknown as typeof window.matchMedia;
		}
		globalThis.localStorage = globalThis.window.localStorage;
		const requests: string[] = [];
		const previousFetch = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			requests.push(typeof input === "string" ? input : input.toString());
			return new Response("[]", { headers: { "Content-Type": "application/json" } });
		}) as typeof fetch;
		try {
			const html = renderToString(
				<MemoryRouter>
					<ThemeProvider>
						<TaskDetailsModal
							task={task}
							isOpen={true}
							onClose={() => {}}
							availableTasks={corpus}
							availableStatuses={[...STATUSES]}
						/>
					</ThemeProvider>
				</MemoryRouter>,
			);
			return { html, requests };
		} finally {
			globalThis.fetch = previousFetch;
		}
	}

	it("renders the graph straight from the task it was given, with no request of its own", () => {
		const selected = corpus[1] as Task;
		const detail = withDependencyGraph(selected, { tasks: corpus, completedTasks: [], statuses: STATUSES });

		const { html, requests } = renderModal(detail);

		expect(html).toContain("Dependency Graph");
		expect(html).toContain("Depends on");
		expect(html).toContain("Dependents");
		expect(html).toContain('href="/tasks/TASK-1"');
		// The graph arrives with the task, so opening it costs no extra round trip at all.
		expect(requests.filter((url) => url.includes("dependency-graph"))).toEqual([]);
	});

	it("shows no graph section for a plain task record", () => {
		const { html } = renderModal(corpus[1] as Task);
		expect(html).not.toContain("Dependency Graph");
	});
});
