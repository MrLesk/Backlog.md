import { describe, expect, it } from "bun:test";
import { TaskIdentityIndex, type TaskIdentityRecord } from "../core/task-identity-index.ts";
import type { Task } from "../types/index.ts";

const context = {
	repositoryRoot: "/repo",
	projectRoot: "/repo",
	backlogDirectory: "backlog",
};

function task(title: string): Task {
	return {
		id: "BACK-1",
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2026-08-01",
		labels: [],
		dependencies: [],
	};
}

function index(records: TaskIdentityRecord[]): TaskIdentityIndex {
	return new TaskIdentityIndex(records, context, ["To Do", "In Progress", "Done"], "most_progressed");
}

describe("TaskIdentityIndex", () => {
	it("prefers a live record over an equal-time archive independent of scan order", () => {
		const active: TaskIdentityRecord = {
			id: "BACK-001",
			type: "task",
			branch: "feature/active",
			path: "backlog/tasks/back-1 - Shared.md",
			lastModified: new Date("2026-08-01T10:00:00Z"),
			task: task("Active"),
		};
		const archived: TaskIdentityRecord = {
			id: "BACK-1",
			type: "archived",
			branch: "feature/archive",
			path: "backlog/archive/tasks/back-1 - Shared.md",
			lastModified: new Date("2026-08-01T10:00:00Z"),
		};

		for (const records of [
			[active, archived],
			[archived, active],
		]) {
			const identityIndex = index(records);
			expect(identityIndex.getTasks().map((candidate) => candidate.title)).toEqual(["Active"]);
			expect(identityIndex.getOccupiedIds()).toContain("BACK-001");
		}
	});

	it("selects equal task versions deterministically independent of scan order", () => {
		const branchA: TaskIdentityRecord = {
			id: "BACK-1",
			type: "task",
			branch: "branch-a",
			path: "backlog/tasks/back-1 - Shared.md",
			lastModified: new Date("2026-08-01T10:00:00Z"),
			task: task("Branch A"),
		};
		const branchB: TaskIdentityRecord = {
			...branchA,
			branch: "branch-b",
			task: task("Branch B"),
		};

		expect(index([branchA, branchB]).getTasks()[0]?.title).toBe("Branch A");
		expect(index([branchB, branchA]).getTasks()[0]?.title).toBe("Branch A");
	});

	it("hides and frees an identity when every record is archived", () => {
		const identityIndex = index([
			{
				id: "BACK-001",
				type: "archived",
				branch: "branch-a",
				path: "backlog/archive/tasks/back-1 - Shared.md",
				lastModified: new Date("2026-08-01T10:00:00Z"),
			},
			{
				id: "BACK-1",
				type: "archived",
				branch: "branch-b",
				path: "backlog/archive/tasks/back-1 - Shared.md",
				lastModified: new Date("2026-08-01T11:00:00Z"),
			},
		]);

		expect(identityIndex.getTasks()).toEqual([]);
		expect(identityIndex.getOccupiedIds()).toEqual([]);
	});
});
