import { describe, expect, it } from "bun:test";
import {
	formatDependencyGraphEntries,
	formatDependencyGraphLines,
	formatDependencyGraphSection,
	formatDependencyNodeTuiLabel,
} from "../formatters/dependency-graph-text.ts";
import type { Task } from "../types/index.ts";
import {
	buildDependencyGraph,
	buildDependencyTree,
	type DependencyGraph,
	nodesInDirection,
} from "../utils/dependency-graph.ts";
import { createReadinessGraph, getTaskReadiness } from "../utils/readiness.ts";

const STATUSES = ["To Do", "In Progress", "Done"] as const;

function task(id: string, dependencies: string[] = [], overrides: Partial<Task> = {}): Task {
	return {
		id,
		title: `Title ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies,
		...overrides,
	};
}

function graphFor(rootId: string, tasks: Task[], completedTasks: Task[] = []): DependencyGraph {
	const root = [...tasks, ...completedTasks].find((candidate) => candidate.id === rootId);
	if (!root) throw new Error(`missing root ${rootId}`);
	return buildDependencyGraph(root, { tasks, completedTasks, statuses: STATUSES });
}

function nodeIds(graph: DependencyGraph, direction: "dependencies" | "dependents"): string[] {
	return nodesInDirection(graph, direction).map((node) => node.id);
}

describe("buildDependencyGraph", () => {
	it("separates direct from transitive in both directions", () => {
		const graph = graphFor("task-3", [
			task("task-1"),
			task("task-2", ["task-1"]),
			task("task-3", ["task-2"]),
			task("task-4", ["task-3"]),
			task("task-5", ["task-4"]),
		]);

		expect(graph.rootId).toBe("task-3");
		expect(nodeIds(graph, "dependencies")).toEqual(["task-1", "task-2"]);
		expect(nodeIds(graph, "dependents")).toEqual(["task-4", "task-5"]);

		const byId = new Map(graph.nodes.map((node) => [node.id, node]));
		expect(byId.get("task-3")).toMatchObject({ dependencyDepth: 0, dependentDepth: 0 });
		expect(byId.get("task-2")).toMatchObject({ dependencyDepth: 1, dependentDepth: null });
		expect(byId.get("task-1")).toMatchObject({ dependencyDepth: 2, dependentDepth: null });
		expect(byId.get("task-4")).toMatchObject({ dependencyDepth: null, dependentDepth: 1 });
		expect(byId.get("task-5")).toMatchObject({ dependencyDepth: null, dependentDepth: 2 });
	});

	it("points every edge from the declaring task to the task it depends on", () => {
		const graph = graphFor("task-2", [task("task-1"), task("task-2", ["task-1"]), task("task-3", ["task-2"])]);

		expect(graph.edges).toEqual([
			{ from: "task-2", to: "task-1" },
			{ from: "task-3", to: "task-2" },
		]);
	});

	it("represents a diamond node once and expands its subtree once", () => {
		const graph = graphFor("task-1", [
			task("task-1", ["task-2", "task-3"]),
			task("task-2", ["task-4"]),
			task("task-3", ["task-4"]),
			task("task-4"),
		]);

		expect(graph.nodes.filter((node) => node.id === "task-4")).toHaveLength(1);
		expect(graph.edges).toEqual([
			{ from: "task-1", to: "task-2" },
			{ from: "task-1", to: "task-3" },
			{ from: "task-2", to: "task-4" },
			{ from: "task-3", to: "task-4" },
		]);

		const tree = buildDependencyTree(graph, "dependencies");
		expect(tree.map((entry) => entry.node.id)).toEqual(["task-2", "task-3"]);
		expect(tree[0]?.children.map((entry) => entry.node.id)).toEqual(["task-4"]);
		expect(tree[0]?.children[0]?.repeat).toBeNull();
		expect(tree[1]?.children[0]?.node.id).toBe("task-4");
		expect(tree[1]?.children[0]?.repeat).toBe("repeat");
		expect(tree[1]?.children[0]?.children).toEqual([]);
	});

	it("terminates on a cycle and marks the closing edge", () => {
		const graph = graphFor("task-1", [
			task("task-1", ["task-2"]),
			task("task-2", ["task-3"]),
			task("task-3", ["task-1"]),
		]);

		expect(nodeIds(graph, "dependencies")).toEqual(["task-2", "task-3"]);
		expect(nodeIds(graph, "dependents")).toEqual(["task-2", "task-3"]);
		expect(graph.nodes).toHaveLength(3);

		const tree = buildDependencyTree(graph, "dependencies");
		expect(tree[0]?.node.id).toBe("task-2");
		expect(tree[0]?.children[0]?.node.id).toBe("task-3");
		expect(tree[0]?.children[0]?.children[0]).toMatchObject({ repeat: "cycle" });
		expect(tree[0]?.children[0]?.children[0]?.node.id).toBe("task-1");
	});

	it("handles a task that depends on itself", () => {
		const graph = graphFor("task-1", [task("task-1", ["task-1"])]);

		expect(graph.nodes).toHaveLength(1);
		expect(graph.edges).toEqual([{ from: "task-1", to: "task-1" }]);
		expect(buildDependencyTree(graph, "dependencies")[0]).toMatchObject({ repeat: "cycle" });
	});

	it("reports a missing reference explicitly and never traverses through it", () => {
		const graph = graphFor("task-1", [task("task-1", ["task-404"]), task("task-9", ["task-404"])]);

		const missing = graph.nodes.find((node) => node.id === "task-404");
		expect(missing).toMatchObject({ state: "missing", title: null, status: null, completed: false });
		// task-9 also depends on task-404, but a missing identity is never walked through, so it is
		// not reported as a dependent of the root by way of an identity nobody claims.
		expect(nodeIds(graph, "dependents")).toEqual([]);
	});

	it("reports an ambiguous identity explicitly and never traverses through it", () => {
		const duplicated = [task("task-2", ["task-3"]), task("TASK-02", ["task-3"])];
		const graph = graphFor("task-1", [task("task-1", ["task-2"]), ...duplicated, task("task-3")]);

		const ambiguous = graph.nodes.find((node) => node.state === "ambiguous");
		expect(ambiguous?.id).toBe("TASK-2");
		expect(ambiguous?.completed).toBe(false);
		// task-3 sits behind the ambiguous identity, so it is not claimed as a resolved dependency.
		expect(nodeIds(graph, "dependencies")).toEqual(["TASK-2"]);
	});

	it("reports a collision the corpus carries but cannot show in its records", () => {
		// A loader that resolves each identity to one record hands over a corpus where a contested ID
		// looks singly claimed. The collision travels beside the records, and the read fails closed on
		// it rather than on how many claimants survived the loader.
		const graph = buildDependencyGraph(task("task-1", ["task-2"]), {
			tasks: [task("task-1", ["task-2"]), task("task-2", ["task-3"]), task("task-3")],
			statuses: STATUSES,
			ambiguousIds: new Set(["TASK-2"]),
		});

		expect(graph.nodes.find((node) => node.id === "TASK-2")?.state).toBe("ambiguous");
		expect(nodeIds(graph, "dependencies")).toEqual(["TASK-2"]);
	});

	it("keeps an ambiguous identity a leaf even when reverse edges leave it", () => {
		// One duplicate record behind the ambiguous identity declares a dependency on task-3, which is
		// itself a dependent of the root, so the shared edge set carries an edge leaving the ambiguous
		// node. The display tree must not follow it in either direction.
		const graph = graphFor("task-1", [
			task("task-1", ["task-2"]),
			task("task-2", ["task-3"]),
			task("TASK-02"),
			task("task-3", ["task-1"]),
		]);

		const dependsOn = buildDependencyTree(graph, "dependencies");
		expect(dependsOn.map((entry) => entry.node.state)).toEqual(["ambiguous"]);
		expect(dependsOn[0]?.children).toEqual([]);

		const dependents = buildDependencyTree(graph, "dependents");
		expect(dependents[0]?.node.id).toBe("task-3");
		expect(dependents[0]?.children[0]?.node.state).toBe("ambiguous");
		expect(dependents[0]?.children[0]?.children).toEqual([]);
	});

	it("keeps a completed record visible as a resolved dependency", () => {
		const graph = graphFor("task-1", [task("task-1", ["task-2"])], [task("task-2", [], { status: "In Progress" })]);

		const dependency = graph.nodes.find((node) => node.id === "task-2");
		// The record lives in the completed corpus, so its location settles completion whatever its
		// status string says.
		expect(dependency).toMatchObject({ state: "resolved", completed: true, status: "In Progress" });
	});

	it("resolves a cross-branch record supplied by the caller's corpus", () => {
		const graph = graphFor("task-1", [
			task("task-1", ["task-2"]),
			task("task-2", [], { source: "remote", branch: "origin/feature" }),
		]);

		expect(graph.nodes.find((node) => node.id === "task-2")).toMatchObject({ state: "resolved" });
	});

	it("does not resurrect an identity that is absent from the corpus", () => {
		// Archiving takes the record out of every corpus a detail read is allowed to see, so the ID
		// resolves as missing rather than being restored from somewhere else.
		const graph = graphFor("task-1", [task("task-1", ["task-2"])]);
		expect(graph.nodes.find((node) => node.id === "task-2")).toMatchObject({ state: "missing" });
	});

	it("matches dependency references that differ in case, prefix casing, and padding", () => {
		const graph = graphFor("task-1", [task("task-1", ["TASK-002", "task-03"]), task("task-2"), task("task-3")]);

		expect(nodeIds(graph, "dependencies")).toEqual(["task-2", "task-3"]);
		expect(graph.nodes.every((node) => node.state === "resolved")).toBe(true);
	});

	it("orders nodes and edges deterministically whatever the corpus order is", () => {
		const tasks = [
			task("task-1", ["task-10", "task-2"]),
			task("task-2", ["task-10"]),
			task("task-10"),
			task("task-11", ["task-1"]),
			task("task-3", ["task-1"]),
		];
		const forward = graphFor("task-1", tasks);
		const reversed = graphFor("task-1", [...tasks].reverse());

		expect(forward.nodes.map((node) => node.id)).toEqual(["task-1", "task-2", "task-3", "task-10", "task-11"]);
		expect(reversed).toEqual(forward);
		expect(forward.edges).toEqual([
			{ from: "task-1", to: "task-2" },
			{ from: "task-1", to: "task-10" },
			{ from: "task-2", to: "task-10" },
			{ from: "task-3", to: "task-1" },
			{ from: "task-11", to: "task-1" },
		]);
	});

	it("stays linear on a wide fan-in and a deep chain", () => {
		const chain = Array.from({ length: 400 }, (_, position) =>
			task(`task-${position + 1}`, position === 0 ? [] : [`task-${position}`]),
		);
		const fanIn = Array.from({ length: 200 }, (_, position) => task(`task-${1000 + position}`, ["task-400"]));

		const graph = graphFor("task-400", [...chain, ...fanIn]);

		expect(graph.nodes).toHaveLength(600);
		expect(graph.edges).toHaveLength(599);
		expect(nodesInDirection(graph, "dependencies")).toHaveLength(399);
		expect(nodesInDirection(graph, "dependents")).toHaveLength(200);
	});

	it("keeps one file supplied twice resolved, with its completion evidence", () => {
		// `task view <completed-id>` hands the viewer the completed record to display while the viewer
		// also loads the completed corpus, so the same file arrives in both lists. Poisoning that
		// identity would lose the completion evidence and could show a stale non-terminal status.
		const completed = task("task-1", [], { status: "In Progress", filePath: "/p/backlog/completed/task-1 - Done.md" });
		const dependent = task("task-2", ["task-1"], { filePath: "/p/backlog/tasks/task-2 - Next.md" });
		const graph = buildDependencyGraph(completed, {
			tasks: [dependent, completed],
			completedTasks: [completed],
			statuses: STATUSES,
		});

		const root = graph.nodes.find((node) => node.id === "task-1");
		expect(root).toMatchObject({ state: "resolved", completed: true });
		expect(nodeIds(graph, "dependents")).toEqual(["task-2"]);

		const readinessGraph = createReadinessGraph({
			tasks: [dependent, completed],
			completedTasks: [completed],
			statuses: STATUSES,
		});
		// The dependent resolves it as satisfied rather than as an ambiguous identity.
		expect(getTaskReadiness(dependent, readinessGraph)).toMatchObject({ isReady: true, missingDependencies: [] });
		// And the completed record keeps its completion evidence, so it is neither ready nor blocked.
		// Losing it makes an already-finished task render a readiness verdict in the detail view.
		expect(readinessGraph.isCompletedRecord("task-1")).toBe(true);
		expect(getTaskReadiness(completed, readinessGraph)).toMatchObject({ isReady: false, isBlocked: false });
	});

	it("still fails closed when two different files claim one identity", () => {
		const first = task("task-1", [], { filePath: "/p/backlog/tasks/task-1 - Alpha.md" });
		const second = task("TASK-01", [], { filePath: "/p/backlog/tasks/task-01 - Beta.md" });
		const graph = buildDependencyGraph(task("task-2", ["task-1"]), {
			tasks: [task("task-2", ["task-1"]), first, second],
			statuses: STATUSES,
		});

		expect(graph.nodes.find((node) => node.state === "ambiguous")?.id).toBe("TASK-1");
	});

	it("resolves a root that is not part of the supplied corpus", () => {
		const root = task("task-1", ["task-2"]);
		const graph = buildDependencyGraph(root, { tasks: [task("task-2")], statuses: STATUSES });

		expect(graph.rootId).toBe("task-1");
		expect(nodeIds(graph, "dependencies")).toEqual(["task-2"]);
	});
});

describe("dependency graph text", () => {
	it("renders both directions with direct and total counts", () => {
		const graph = graphFor("task-2", [
			task("task-1"),
			task("task-2", ["task-1", "task-404"]),
			task("task-3", ["task-2"]),
			task("task-4", ["task-3"]),
		]);

		expect(formatDependencyGraphLines(graph)).toEqual([
			"Depends on (2 direct, 2 total):",
			"├─ task-1 - Title task-1 [To Do]",
			"└─ task-404 - unknown task ID",
			"",
			"Dependents (1 direct, 2 total):",
			"└─ task-3 - Title task-3 [To Do]",
			"   └─ task-4 - Title task-4 [To Do]",
		]);
	});

	it("renders a completed dependency as completed rather than as its stored status", () => {
		const graph = graphFor("task-1", [task("task-1", ["task-2"])], [task("task-2", [], { status: "In Progress" })]);

		expect(formatDependencyGraphSection(graph, "dependencies")).toEqual([
			"Depends on (1 direct, 1 total):",
			"└─ task-2 - Title task-2 [completed]",
		]);
	});

	it("renders nothing for a task with no dependencies and no dependents", () => {
		expect(formatDependencyGraphLines(graphFor("task-1", [task("task-1")]))).toEqual([]);
	});

	it("renders a pathologically deep dependency chain without recursing", () => {
		// Deep enough that a recursive tree walk or formatter would be at risk on a small stack,
		// while the quadratic indentation the rendered lines inherently carry stays affordable.
		const depth = 2500;
		const chain = Array.from({ length: depth }, (_, position) =>
			task(`task-${position + 1}`, position === 0 ? [] : [`task-${position}`]),
		);

		const lines = formatDependencyGraphSection(graphFor(`task-${depth}`, chain), "dependencies");
		expect(lines.length).toBe(depth);
		expect(lines[0]).toBe(`Depends on (1 direct, ${depth - 1} total):`);
		expect(lines[1]).toBe(`└─ task-${depth - 1} - Title task-${depth - 1} [To Do]`);
		expect(lines[depth - 1]).toBe(`${"   ".repeat(depth - 2)}└─ task-1 - Title task-1 [To Do]`);
	});
	it("pairs every task line with its node and leaves headings and separators unattached", () => {
		const graph = graphFor(
			"task-2",
			[task("task-2", ["task-1", "task-404"]), task("task-3", ["task-2"])],
			[task("task-1")],
		);
		const entries = formatDependencyGraphEntries(graph);

		expect(entries.map((entry) => [entry.text, entry.node?.id ?? null])).toEqual([
			["Depends on (2 direct, 2 total):", null],
			["├─ task-1 - Title task-1 [completed]", "task-1"],
			["└─ task-404 - unknown task ID", "task-404"],
			["", null],
			["Dependents (1 direct, 1 total):", null],
			["└─ task-3 - Title task-3 [To Do]", "task-3"],
		]);
		// Unresolved nodes carry their state so a surface can refuse to follow them.
		expect(entries[2]?.node?.state).toBe("missing");
	});

	it("colors the TUI label and escapes blessed tags without changing the shared wording", () => {
		const graph = graphFor("task-8", [
			task("task-8", ["task-7", "task-404"]),
			task("task-7", [], { title: "Style {red-fg}accent{/} braces" }),
		]);
		const entries = formatDependencyGraphEntries(graph, { formatLabel: formatDependencyNodeTuiLabel });

		expect(entries[1]?.text).toContain("task-7 - Style {open}red-fg{close}accent{open}/{close} braces [To Do]");
		expect(entries[2]?.text).toContain("{yellow-fg}task-404 - unknown task ID{/}");
	});
});
