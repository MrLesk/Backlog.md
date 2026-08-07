import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import { generateDetailContent } from "../ui/task-viewer-with-search.ts";
import { formatReadinessBlockers, getTaskReadiness } from "../utils/readiness.ts";
import { applyTaskFilters } from "../utils/task-search.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
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

describe("getTaskReadiness", () => {
	it("returns ready for a task with no dependencies", () => {
		const task = makeTask("BACK-1", "To Do");
		const readiness = getTaskReadiness(task, [task], statuses);

		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
		expect(readiness.blockingDependencies).toEqual([]);
		expect(readiness.missingDependencies).toEqual([]);
	});

	it("returns ready when all dependencies are in terminal status", () => {
		const dep = makeTask("BACK-1", "Done");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness = getTaskReadiness(task, [dep, task], statuses);

		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
	});

	it("returns blocked when a dependency is in non-terminal status", () => {
		const dep = makeTask("BACK-1", "In Progress");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness = getTaskReadiness(task, [dep, task], statuses);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(true);
		expect(readiness.blockingDependencies).toEqual(["BACK-1"]);
		expect(readiness.missingDependencies).toEqual([]);
	});

	it("reports an unresolvable dependency separately from an unfinished one and fails closed", () => {
		const unfinished = makeTask("BACK-1", "In Progress");
		const task = makeTask("BACK-2", "To Do", ["BACK-1", "BACK-99"]);
		const readiness = getTaskReadiness(task, [unfinished, task], statuses);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(true);
		expect(readiness.blockingDependencies).toEqual(["BACK-1"]);
		expect(readiness.missingDependencies).toEqual(["BACK-99"]);
		expect(formatReadinessBlockers(readiness)).toBe("Blocked by BACK-1; Unknown dependency BACK-99");
	});

	it("resolves dependencies through canonical task identity, not raw string equality", () => {
		const dep = makeTask("BACK-007", "Done");
		const task = makeTask("BACK-2", "To Do", ["back-7"]);
		const readiness = getTaskReadiness(task, [dep, task], statuses);

		expect(readiness.isReady).toBe(true);
		expect(readiness.missingDependencies).toEqual([]);
	});

	it("does not confuse task IDs that only differ by prefix", () => {
		const otherPrefix = makeTask("BACK-355.01", "Done");
		const task = makeTask("BACK-2", "To Do", ["task-355.01"]);
		const readiness = getTaskReadiness(task, [otherPrefix, task], statuses);

		expect(readiness.isReady).toBe(false);
		expect(readiness.missingDependencies).toEqual(["task-355.01"]);
	});

	it("prefers the first entry when the graph carries a duplicate identity", () => {
		const live = makeTask("BACK-1", "In Progress");
		const completedCopy = makeTask("BACK-1", "Done");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);

		expect(getTaskReadiness(task, [live, completedCopy, task], statuses).isReady).toBe(false);
	});

	it("returns not ready and not blocked for tasks already in terminal status", () => {
		const task = makeTask("BACK-1", "Done");
		const readiness = getTaskReadiness(task, [task], statuses);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(false);
	});

	it("handles dependency cycles safely without infinite recursion", () => {
		const task1 = makeTask("BACK-1", "To Do", ["BACK-2"]);
		const task2 = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness1 = getTaskReadiness(task1, [task1, task2], statuses);
		const readiness2 = getTaskReadiness(task2, [task1, task2], statuses);

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

		const readiness = getTaskReadiness(task, [dep, task], customStatuses);
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

		// BACK-3 (In Progress, no deps) and BACK-4 (To Do, dependency BACK-1 is Done) can be worked on
		const readyFiltered = applyTaskFilters(allTasks, { ready: true, statuses });
		expect(readyFiltered.map((t) => t.id)).toEqual(["BACK-3", "BACK-4"]);

		// Combine ready filter with status filter
		const readyToDoFiltered = applyTaskFilters(allTasks, { ready: true, status: "To Do", statuses });
		expect(readyToDoFiltered.map((t) => t.id)).toEqual(["BACK-4"]);
	});

	it("evaluates readiness against readinessTasks when display candidates omit completed tasks", () => {
		const completedDep = makeTask("BACK-1", "Done");
		const activeTask = makeTask("BACK-2", "To Do", ["BACK-1"]);

		const displayCandidates = [activeTask]; // BACK-1 excluded from active candidates
		const readinessTasks = [activeTask, completedDep];

		expect(applyTaskFilters(displayCandidates, { ready: true, statuses, readinessTasks }).map((t) => t.id)).toEqual([
			"BACK-2",
		]);

		// Without the wider graph the same dependency is unresolvable, so the task fails closed.
		expect(applyTaskFilters(displayCandidates, { ready: true, statuses })).toEqual([]);
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
			generateDetailContent(task, undefined, undefined, { tasks: graph, statuses }).bodyContent.join("\n");

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
				<ThemeProvider>
					<TaskDetailsModal
						task={task}
						availableTasks={availableTasks}
						availableStatuses={statuses}
						isOpen={true}
						onClose={() => {}}
					/>
				</ThemeProvider>,
			);

		expect(renderModal(readyTask)).toContain("Ready to start");
		expect(renderModal(blockedTask)).toContain("Blocked by BACK-2");
		expect(renderModal(unknownDepTask)).toContain("Unknown dependency BACK-404");

		// Same rule as the TUI: no readiness copy without dependencies, or once the task is done.
		expect(renderModal(noDepsTask)).not.toContain("Ready to start");
		expect(renderModal(doneDep)).not.toContain("Ready to start");
	});
});
