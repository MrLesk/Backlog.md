import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import { generateDetailContent } from "../ui/task-viewer-with-search.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { getTaskReadiness } from "../utils/readiness.ts";
import { applyTaskFilters } from "../utils/task-search.ts";

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
	});

	it("returns blocked when a dependency is missing", () => {
		const task = makeTask("BACK-2", "To Do", ["BACK-99"]);
		const readiness = getTaskReadiness(task, [task], statuses);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(true);
		expect(readiness.missingDependencies).toEqual(["BACK-99"]);
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

		// Filter for ready tasks: BACK-3 (In Progress, no deps) and BACK-4 (To Do, BACK-1 dep is Done) are unblocked/ready
		const readyFiltered = applyTaskFilters(allTasks, { ready: true, statuses });
		expect(readyFiltered.map((t) => t.id)).toEqual(["BACK-3", "BACK-4"]);

		// Combine ready filter with status filter
		const readyToDoFiltered = applyTaskFilters(allTasks, { ready: true, status: "To Do", statuses });
		expect(readyToDoFiltered.map((t) => t.id)).toEqual(["BACK-4"]);
	});

	it("evaluates readiness against fullGraphTasks when display candidates omit completed tasks", () => {
		const archivedDoneDep = makeTask("BACK-1", "Done");
		const activeTask = makeTask("BACK-2", "To Do", ["BACK-1"]);

		const displayCandidates = [activeTask]; // BACK-1 excluded from active candidates
		const fullGraph = [archivedDoneDep, activeTask];

		// Filtering display candidates with fullGraphTasks supplied
		const result = applyTaskFilters(displayCandidates, { ready: true, statuses, fullGraphTasks: fullGraph });
		expect(result.map((t) => t.id)).toEqual(["BACK-2"]);
	});
});

describe("Rendered TUI and Web UI readiness guidance assertions", () => {
	it("renders TUI detail readiness guidance for ready, blocked, and terminal tasks", () => {
		const doneDep = makeTask("BACK-1", "Done");
		const inProgDep = makeTask("BACK-2", "In Progress");
		const readyTask = makeTask("BACK-3", "To Do", ["BACK-1"]);
		const blockedTask = makeTask("BACK-4", "To Do", ["BACK-2"]);
		const fullGraph = [doneDep, inProgDep, readyTask, blockedTask];

		const readyDetail = generateDetailContent(readyTask, undefined, undefined, fullGraph, statuses);
		const readyText = readyDetail.bodyContent.join("\n");
		expect(readyText).toContain("Readiness:");
		expect(readyText).toContain("✓ Ready to start");

		const blockedDetail = generateDetailContent(blockedTask, undefined, undefined, fullGraph, statuses);
		const blockedText = blockedDetail.bodyContent.join("\n");
		expect(blockedText).toContain("Readiness:");
		expect(blockedText).toContain("⏳ Blocked by: BACK-2");

		const terminalDetail = generateDetailContent(doneDep, undefined, undefined, fullGraph, statuses);
		const terminalText = terminalDetail.bodyContent.join("\n");
		expect(terminalText).toContain("Readiness:");
		expect(terminalText).toContain("Terminal status (Done)");
	});

	it("renders Web TaskDetailsModal readiness badge accurately for ready, blocked, and terminal tasks", () => {
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
		const availableTasks = [doneDep, inProgDep, readyTask, blockedTask];

		const readyHtml = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={readyTask} availableTasks={availableTasks} isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);
		expect(readyHtml).toContain("Readiness:");
		expect(readyHtml).toContain("✓ Ready to start");

		const blockedHtml = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={blockedTask} availableTasks={availableTasks} isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);
		expect(blockedHtml).toContain("Readiness:");
		expect(blockedHtml).toContain("BACK-2");

		const terminalHtml = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={doneDep} availableTasks={availableTasks} isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);
		expect(terminalHtml).toContain("Readiness:");
		expect(terminalHtml).toContain("Done");
	});
});
