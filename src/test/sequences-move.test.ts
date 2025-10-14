import { describe, expect, it } from "bun:test";
import { adjustDependenciesForMove, computeSequences } from "../core/sequences.ts";
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
		description: "Test",
	};
}

describe("adjustDependenciesForMove (join semantics)", () => {
	it("sets moved task deps to previous sequence tasks and does not modify next sequence", () => {
		// seq1: 1,2 ; seq2: 3(dep:1,2) ; seq3: 4(dep:3)
		const tasks = [t("task-1"), t("task-2"), t("task-3", ["task-1", "task-2"]), t("task-4", ["task-3"])];
		const res = computeSequences(tasks);
		const seqs = res.sequences;

		// Move task-3 to sequence 1 (target index = 1)
		const updated = adjustDependenciesForMove(tasks, seqs, "task-3", 1);
		const byId = new Map(updated.map((x) => [x.id, x]));

		// Moved deps should be from previous sequence (none)
		expect(byId.get("task-3")?.dependencies).toEqual([]);

		// Next sequence unchanged (no forced dependency to moved)
		expect(byId.get("task-4")?.dependencies).toEqual(["task-3"]);
	});

	it("keeps deps and does not add duplicates to next sequence", () => {
		// seq1: 1 ; seq2: 2(dep:1), 3(dep:1) ; seq3: 4(dep:2,3)
		const tasks = [t("task-1"), t("task-2", ["task-1"]), t("task-3", ["task-1"]), t("task-4", ["task-2", "task-3"])];
		const res = computeSequences(tasks);
		const seqs = res.sequences;

		// Move task-2 to seq2 (target=2) -> prev seq = seq1 -> deps should be [task-1]
		const updated = adjustDependenciesForMove(tasks, seqs, "task-2", 2);
		const byId = new Map(updated.map((x) => [x.id, x]));
		expect(byId.get("task-2")?.dependencies).toEqual(["task-1"]);
		// task-4 unchanged
		expect(byId.get("task-4")?.dependencies).toEqual(["task-2", "task-3"]);
	});
});
