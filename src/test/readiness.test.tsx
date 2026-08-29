import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { generateDetailContent } from "../ui/task-viewer-with-search.ts";
import { createReadinessGraph, formatReadinessBlockers, getTaskReadiness } from "../utils/readiness.ts";
import { applyTaskFilters } from "../utils/task-search.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

const statuses = ["To Do", "In Progress", "Done"];

function makeTask(id: string, status: string, dependencies: string[] = []): Task {
	return {
		id,
		title: `Task ${id}`,
		status,
		dependencies,
		assignee: [],
		labels: [],
		createdDate: "2026-07-24",
		rawContent: "",
	};
}

/** Readiness against an active-only corpus with the default statuses. */
function graphOf(tasks: Task[], graphStatuses: readonly string[] = statuses) {
	return createReadinessGraph({ tasks, statuses: graphStatuses });
}

function readinessOf(task: Task, tasks: Task[], graphStatuses: readonly string[] = statuses) {
	return getTaskReadiness(task, graphOf(tasks, graphStatuses));
}

describe("getTaskReadiness", () => {
	it("returns ready for a task with no dependencies", () => {
		const task = makeTask("BACK-1", "To Do");
		const readiness = readinessOf(task, [task]);

		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
		expect(readiness.blockingDependencies).toEqual([]);
		expect(readiness.missingDependencies).toEqual([]);
	});

	it("returns ready when all dependencies are in terminal status", () => {
		const dep = makeTask("BACK-1", "Done");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness = readinessOf(task, [dep, task]);

		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
	});

	it("returns blocked when a dependency is in non-terminal status", () => {
		const dep = makeTask("BACK-1", "In Progress");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness = readinessOf(task, [dep, task]);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(true);
		expect(readiness.blockingDependencies).toEqual(["BACK-1"]);
		expect(readiness.missingDependencies).toEqual([]);
	});

	it("reports an unresolvable dependency separately from an unfinished one and fails closed", () => {
		const unfinished = makeTask("BACK-1", "In Progress");
		const task = makeTask("BACK-2", "To Do", ["BACK-1", "BACK-99"]);
		const readiness = readinessOf(task, [unfinished, task]);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(true);
		expect(readiness.blockingDependencies).toEqual(["BACK-1"]);
		expect(readiness.missingDependencies).toEqual(["BACK-99"]);
		expect(formatReadinessBlockers(readiness)).toBe("Blocked by BACK-1; Unknown dependency BACK-99");
	});

	it("resolves dependencies through canonical task identity, not raw string equality", () => {
		const dep = makeTask("BACK-007", "Done");
		const task = makeTask("BACK-2", "To Do", ["back-7"]);
		const readiness = readinessOf(task, [dep, task]);

		expect(readiness.isReady).toBe(true);
		expect(readiness.missingDependencies).toEqual([]);
	});

	it("does not confuse task IDs that only differ by prefix", () => {
		const otherPrefix = makeTask("BACK-355.01", "Done");
		const task = makeTask("BACK-2", "To Do", ["task-355.01"]);
		const readiness = readinessOf(task, [otherPrefix, task]);

		expect(readiness.isReady).toBe(false);
		expect(readiness.missingDependencies).toEqual(["task-355.01"]);
	});

	it("fails closed when more than one record claims the dependency identity", () => {
		const unfinished = makeTask("BACK-1", "In Progress");
		const doneCopy = makeTask("BACK-01", "Done");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);

		// Order must not decide the verdict: an ambiguous identity is never satisfied by luck.
		for (const corpus of [
			[unfinished, doneCopy, task],
			[doneCopy, unfinished, task],
		]) {
			const readiness = readinessOf(task, corpus);
			expect(readiness.isReady).toBe(false);
			expect(readiness.isBlocked).toBe(true);
			expect(readiness.missingDependencies).toEqual(["BACK-1"]);
			expect(readiness.blockingDependencies).toEqual([]);
		}
	});

	it("treats a record in the completed corpus as completed whatever its status string says", () => {
		// The terminal status was renamed to Shipped, so the archived record's "Done" is not terminal.
		const renamedStatuses = ["To Do", "In Progress", "Shipped"];
		const completedDep = makeTask("BACK-1", "Done");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);

		const graph = createReadinessGraph({ tasks: [task], completedTasks: [completedDep], statuses: renamedStatuses });
		const readiness = getTaskReadiness(task, graph);
		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);

		// The same record left in the active corpus is genuinely unfinished under that configuration.
		expect(readinessOf(task, [completedDep, task], renamedStatuses).blockingDependencies).toEqual(["BACK-1"]);
	});

	it("treats a task whose own record is in the completed corpus as not actionable", () => {
		const completedTask = makeTask("BACK-1", "To Do", ["BACK-2"]);
		const graph = createReadinessGraph({ tasks: [], completedTasks: [completedTask], statuses });

		const readiness = getTaskReadiness(completedTask, graph);
		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(false);
	});

	it("falls back to the default statuses when the configured list is empty", () => {
		const dep = makeTask("BACK-1", "Done");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);

		// An empty statuses array leaves no terminal status, which would block everything forever.
		const readiness = readinessOf(task, [dep, task], []);
		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
	});

	it("returns not ready and not blocked for tasks already in terminal status", () => {
		const task = makeTask("BACK-1", "Done");
		const readiness = readinessOf(task, [task]);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(false);
	});

	it("handles dependency cycles safely without infinite recursion", () => {
		const task1 = makeTask("BACK-1", "To Do", ["BACK-2"]);
		const task2 = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness1 = readinessOf(task1, [task1, task2]);
		const readiness2 = readinessOf(task2, [task1, task2]);

		expect(readiness1.isReady).toBe(false);
		expect(readiness1.isBlocked).toBe(true);
		expect(readiness1.blockingDependencies).toEqual(["BACK-2"]);

		expect(readiness2.isReady).toBe(false);
		expect(readiness2.isBlocked).toBe(true);
		expect(readiness2.blockingDependencies).toEqual(["BACK-1"]);
	});

	it("respects custom configured terminal statuses (e.g. Closed)", () => {
		const customStatuses = ["Open", "In Review", "Closed"];
		const dep = makeTask("BACK-1", "Closed");
		const task = makeTask("BACK-2", "Open", ["BACK-1"]);

		const readiness = readinessOf(task, [dep, task], customStatuses);
		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
	});
});

describe("applyTaskFilters with readiness filter integration", () => {
	it("filters candidates correctly when ready: true is requested", () => {
		const doneDep = makeTask("BACK-1", "Done");
		const blockedTask = makeTask("BACK-2", "To Do", ["BACK-3"]);
		const inProgDep = makeTask("BACK-3", "In Progress");
		const readyTask = makeTask("BACK-4", "To Do", ["BACK-1"]);

		const allTasks = [doneDep, blockedTask, inProgDep, readyTask];
		const graph = graphOf(allTasks);

		// BACK-3 (In Progress, no deps) and BACK-4 (To Do, dependency BACK-1 is Done) can be worked on
		const readyFiltered = applyTaskFilters(allTasks, { ready: graph });
		expect(readyFiltered.map((t) => t.id)).toEqual(["BACK-3", "BACK-4"]);

		// Combine ready filter with status filter
		const readyToDoFiltered = applyTaskFilters(allTasks, { ready: graph, status: "To Do" });
		expect(readyToDoFiltered.map((t) => t.id)).toEqual(["BACK-4"]);
	});

	it("keeps readiness verdicts independent of the filters that narrowed the display list", () => {
		// The display list was prefiltered by assignee, so the blocking and completed dependencies
		// are both absent from it. Readiness must still resolve them.
		const completedDep = makeTask("BACK-1", "Done");
		const unfinishedDep = makeTask("BACK-2", "In Progress");
		const readyTask = makeTask("BACK-3", "To Do", ["BACK-1"]);
		const blockedTask = makeTask("BACK-4", "To Do", ["BACK-2"]);

		const displayCandidates = [readyTask, blockedTask];
		const fullCorpus = [completedDep, unfinishedDep, readyTask, blockedTask];

		expect(applyTaskFilters(displayCandidates, { ready: graphOf(fullCorpus) }).map((t) => t.id)).toEqual(["BACK-3"]);

		// Resolving against the narrowed list instead loses both verdicts and fails closed.
		expect(applyTaskFilters(displayCandidates, { ready: graphOf(displayCandidates) })).toEqual([]);
	});

	it("stays linear when filtering a large dependent corpus", () => {
		// The graph index is built once per filter pass. Rebuilding it per candidate made this
		// quadratic and took seconds at this size.
		const dependency = makeTask("BACK-0", "Done");
		const dependents = Array.from({ length: 2000 }, (_, index) => makeTask(`BACK-${index + 1}`, "To Do", ["BACK-0"]));
		const corpus = [dependency, ...dependents];

		const startedAt = performance.now();
		const ready = applyTaskFilters(corpus, { ready: graphOf(corpus) });
		const elapsedMs = performance.now() - startedAt;

		expect(ready).toHaveLength(dependents.length);
		expect(elapsedMs).toBeLessThan(2000);
	});
});

describe("rendered readiness guidance", () => {
	it("renders TUI detail readiness guidance for ready, blocked, and unresolved dependencies", () => {
		const doneDep = makeTask("BACK-1", "Done");
		const inProgDep = makeTask("BACK-2", "In Progress");
		const readyTask = makeTask("BACK-3", "To Do", ["BACK-1"]);
		const blockedTask = makeTask("BACK-4", "To Do", ["BACK-2"]);
		const unknownDepTask = makeTask("BACK-5", "To Do", ["BACK-404"]);
		const noDepsTask = makeTask("BACK-6", "To Do");
		const graph = [doneDep, inProgDep, readyTask, blockedTask, unknownDepTask, noDepsTask];

		const detailBody = (task: Task) =>
			generateDetailContent(task, { readinessGraph: graphOf(graph) }).bodyContent.join("\n");

		expect(detailBody(readyTask)).toContain("Readiness:");
		expect(detailBody(readyTask)).toContain("✓ Ready to start");

		expect(detailBody(blockedTask)).toContain("● Blocked by BACK-2");

		expect(detailBody(unknownDepTask)).toContain("● Unknown dependency BACK-404");

		// Readiness stays out of the way when it would only restate the status.
		expect(detailBody(noDepsTask)).not.toContain("Readiness:");
		expect(detailBody(doneDep)).not.toContain("Readiness:");

		// Callers without a task graph (the board quick-look popup) get no readiness claim at all
		// rather than one derived from an empty graph.
		expect(generateDetailContent(blockedTask).bodyContent.join("\n")).not.toContain("Readiness:");
	});

	it("renders the web task details modal readiness badge for ready, blocked, and unresolved dependencies", () => {
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

		const doneDep = makeTask("BACK-1", "Done");
		const inProgDep = makeTask("BACK-2", "In Progress");
		const readyTask = makeTask("BACK-3", "To Do", ["BACK-1"]);
		const blockedTask = makeTask("BACK-4", "To Do", ["BACK-2"]);
		const unknownDepTask = makeTask("BACK-5", "To Do", ["BACK-404"]);
		const noDepsTask = makeTask("BACK-6", "To Do");
		const availableTasks = [doneDep, inProgDep, readyTask, blockedTask, unknownDepTask, noDepsTask];

		const renderModal = (task: Task) =>
			renderToString(
				<MemoryRouter initialEntries={[`/tasks/${task.id}`]}>
					<ThemeProvider>
						<TaskIdIndexProvider tasks={availableTasks}>
							<TaskDetailsModal
								task={task}
								availableTasks={availableTasks}
								availableStatuses={statuses}
								isOpen={true}
								onClose={() => {}}
							/>
						</TaskIdIndexProvider>
					</ThemeProvider>
				</MemoryRouter>,
			);

		expect(renderModal(readyTask)).toContain("Ready to start");
		expect(renderModal(blockedTask)).toContain("Blocked by BACK-2");
		expect(renderModal(unknownDepTask)).toContain("Unknown dependency BACK-404");

		// Same rule as the TUI: no readiness copy without dependencies, or once the task is done.
		expect(renderModal(noDepsTask)).not.toContain("Ready to start");
		expect(renderModal(doneDep)).not.toContain("Ready to start");

		// A direct link can open a completed task whose historical status is no longer the configured
		// terminal one. Its location in the completed corpus still means the work is finished, so the
		// modal must not offer it as ready to start.
		const routedCompletedTask: Task = {
			...makeTask("BACK-7", "Shipped", ["BACK-1"]),
			source: "completed",
		};
		expect(renderModal(routedCompletedTask)).not.toContain("Ready to start");
	});
});
