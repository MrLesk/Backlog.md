import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { withDependencyGraph } from "../core/task-detail.ts";
import { generateDetailContent, mergeDependencyCorpusTasks } from "../ui/task-viewer-with-search.ts";

const STATUSES = ["To Do", "In Progress", "Done"] as const;

function makeTask(id: string, title: string, dependencies: string[] = [], status = "To Do"): Task {
	return { id, title, status, assignee: [], createdDate: "2026-01-01", labels: [], dependencies };
}

const CORPUS = [
	makeTask("BACK-1", "Foundation", [], "Done"),
	makeTask("BACK-2", "Selected", ["BACK-1", "BACK-404"]),
	makeTask("BACK-3", "Follow up", ["BACK-2"]),
	makeTask("BACK-4", "Later", ["BACK-3"]),
];

// A detail read hands the viewer a task that already carries its graph; every other caller hands it
// a plain record. The viewer only renders what it was given.
function detailBody(task: Task, asDetail: boolean): string {
	const given = asDetail
		? withDependencyGraph(task, { tasks: CORPUS, completedTasks: [], statuses: STATUSES })
		: task;
	return generateDetailContent(given).bodyContent.join("\n");
}

describe("TUI dependency graph section", () => {
	const selected = CORPUS[1] as Task;

	it("shows both directions with direct and transitive counts", () => {
		const body = detailBody(selected, true);

		expect(body).toContain("Dependency Graph");
		expect(body).toContain("Depends on (2 direct, 2 total):");
		expect(body).toContain("Dependents (1 direct, 2 total):");
		expect(body).toContain("└─ BACK-3 - Follow up [To Do]");
		expect(body).toContain("   └─ BACK-4 - Later [To Do]");
	});

	it("replaces the raw dependency ID list and sits directly above the description", () => {
		const body = detailBody(selected, true);

		// Same relative position as the canonical CLI plain output.
		expect(body).not.toContain("Dependencies:");
		expect(body.indexOf("Dependency Graph")).toBeLessThan(body.indexOf("Description"));
		expect(body.indexOf("Details")).toBeLessThan(body.indexOf("Dependency Graph"));
	});

	it("colors finished and unresolved nodes without changing the shared wording", () => {
		const body = detailBody(selected, true);

		expect(body).toContain("{gray-fg}BACK-1 - Foundation [completed]{/}");
		expect(body).toContain("{yellow-fg}BACK-404 - unknown task ID{/}");
	});

	it("renders a title containing blessed tag syntax as literal characters", () => {
		const styled = makeTask("BACK-7", "Style {red-fg}accent{/} braces");
		const root = makeTask("BACK-8", "Root", ["BACK-7"]);
		const detail = withDependencyGraph(root, { tasks: [root, styled], completedTasks: [], statuses: STATUSES });
		const body = generateDetailContent(detail).bodyContent.join("\n");

		expect(body).toContain("BACK-7 - Style {open}red-fg{close}accent{open}/{close} braces [To Do]");
		expect(body).not.toContain("{red-fg}accent");
	});

	it("leaves the board quick-look popup and other graph-less callers unchanged", () => {
		// The popup passes no graph, so it renders exactly what it rendered before.
		expect(detailBody(selected, false)).not.toContain("Dependency Graph");
		expect(detailBody(selected, false)).not.toContain("Depends on");
	});

	it("omits the section for a task with no dependencies and no dependents", () => {
		const isolated = makeTask("BACK-9", "Alone");
		const detail = withDependencyGraph(isolated, { tasks: [isolated], completedTasks: [], statuses: STATUSES });

		expect(generateDetailContent(detail).bodyContent.join("\n")).not.toContain("Dependency Graph");
	});
});

describe("filtered TUI dependency corpus merge", () => {
	it("lets a live display copy win over the snapshot for a uniquely claimed identity", () => {
		const snapshotTask = makeTask("BACK-1", "Foundation", [], "To Do");
		const outOfView = makeTask("BACK-2", "Elsewhere", ["BACK-1"]);
		const liveEdit = makeTask("BACK-1", "Foundation", [], "Done");

		const merged = mergeDependencyCorpusTasks([snapshotTask, outOfView], [liveEdit]);

		expect(merged).toHaveLength(2);
		expect(merged.find((task) => task.id === "BACK-1")?.status).toBe("Done");
		expect(merged.find((task) => task.id === "BACK-2")).toBe(outOfView);
	});

	it("keeps every claimant of a contested identity so the graph fails closed like the CLI", () => {
		const claimantA = makeTask("BACK-1", "First claimant", [], "Done");
		const claimantB = makeTask("BACK-1", "Second claimant");
		const root = makeTask("BACK-2", "Selected", ["BACK-1"]);

		const merged = mergeDependencyCorpusTasks([claimantA, claimantB, root], [root, claimantA]);
		expect(merged.filter((task) => task.id === "BACK-1")).toHaveLength(2);

		// The exact corpus the filtered viewer resolves, run through the shared graph: the contested
		// identity must be reported ambiguous, never silently collapsed to one claimant.
		const graph = withDependencyGraph(root, {
			tasks: merged,
			completedTasks: [],
			statuses: STATUSES,
		}).dependencyGraph;
		expect(graph.nodes.find((node) => node.id === "BACK-1")?.state).toBe("ambiguous");
	});
});
