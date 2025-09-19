import { describe, expect, it } from "bun:test";
import { adjustDependenciesForInsertBetween, computeSequences } from "../core/sequences.ts";
import type { Task } from "../types/index.ts";

function t(id: string, deps: string[] = []): Task {
	return {
		id,
		title: id,
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: deps,
		rawContent: "## Description\n\nTest",
	};
}

describe("adjustDependenciesForInsertBetween", () => {
	it("creates new sequence between K and K+1 with dependency updates", () => {
		// seq1: 1,2 ; seq2: 3(dep:1,2) ; seq3: 4(dep:3), 5(dep:3)
		const tasks = [
			t("task-1"),
			t("task-2"),
			t("task-3", ["task-1", "task-2"]),
			t("task-4", ["task-3"]),
			t("task-5", ["task-3"]),
		];
		const res = computeSequences(tasks);
		expect(res.sequences.length).toBe(3);
		// Drop task-5 between seq1 (K=1) and seq2 (K+1)
		const updated = adjustDependenciesForInsertBetween(tasks, res.sequences, "task-5", 1);
		const next = computeSequences(updated);
		// Expect: seq1: 1,2 ; seq2: 5 ; seq3: 3 ; seq4: 4
		expect(next.sequences.length).toBe(4);
		expect(next.sequences[0]?.tasks.map((x) => x.id)).toEqual(["task-1", "task-2"]);
		expect(next.sequences[1]?.tasks.map((x) => x.id)).toEqual(["task-5"]);
		expect(next.sequences[2]?.tasks.map((x) => x.id)).toEqual(["task-3"]);
		expect(next.sequences[3]?.tasks.map((x) => x.id)).toEqual(["task-4"]);
	});

	it("supports top insertion (K=0): moved becomes Sequence 1; next sequence tasks depend on moved", () => {
		// seq1: 1 ; seq2: 2(dep:1)
		const tasks = [t("task-1"), t("task-2", ["task-1"]), t("task-3")];
		const res = computeSequences(tasks);
		expect(res.sequences.length).toBe(2);
		const updated = adjustDependenciesForInsertBetween(tasks, res.sequences, "task-3", 0);
		const next = computeSequences(updated);
		// Expect: seq1: 3 ; seq2: 1 ; seq3: 2
		expect(next.sequences.length).toBe(3);
		expect(next.sequences[0]?.tasks.map((x) => x.id)).toEqual(["task-3"]);
		expect(next.sequences[1]?.tasks.map((x) => x.id)).toEqual(["task-1"]);
		expect(next.sequences[2]?.tasks.map((x) => x.id)).toEqual(["task-2"]);
	});

	it("when there are no sequences, top insertion anchors moved via ordinal", () => {
		// All tasks unsequenced initially (no deps, no dependents)
		const tasks = [t("task-1"), t("task-2")];
		const res = computeSequences(tasks);
		expect(res.sequences.length).toBe(0);
		const updated = adjustDependenciesForInsertBetween(tasks, res.sequences, "task-2", 0);
		const byId = new Map(updated.map((x) => [x.id, x]));
		// moved has ordinal set
		expect(byId.get("task-2")?.ordinal).toBe(0);
		const next = computeSequences(updated);
		expect(next.sequences.length).toBe(1);
		expect(next.sequences[0]?.tasks.map((x) => x.id)).toEqual(["task-2"]);
	});
});
