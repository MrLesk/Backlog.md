import { describe, expect, it } from "bun:test";
import { TaskIdentityIndex, type TaskIdentityRecord } from "../core/task-identity-index.ts";
import type { Task } from "../types/index.ts";

const context = {
	repositoryRoot: "/repo",
	projectRoot: "/repo",
	backlogDirectory: "backlog",
};

function task(title: string, id = "BACK-1"): Task {
	return {
		id,
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
	it("keeps the identity fingerprint stable when hydration moves between same-path branch records", () => {
		const branchA: TaskIdentityRecord = {
			id: "BACK-1",
			type: "task",
			branch: "origin/main",
			path: "backlog/tasks/back-1 - Shared.md",
			lastModified: new Date("2026-08-01T10:00:00Z"),
			task: task("Hydrated title"),
		};
		const branchB: TaskIdentityRecord = {
			...branchA,
			branch: "origin/feature",
			task: undefined,
		};

		expect(index([branchA, branchB]).getFingerprint()).toBe(
			index([
				{ ...branchA, task: undefined },
				{ ...branchB, task: task("Hydrated title") },
			]).getFingerprint(),
		);
	});

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

	it("orders tasks by numeric id segments so BACK-1.2 precedes BACK-1.11", () => {
		const ids = Array.from({ length: 11 }, (_, position) => `BACK-1.${position + 1}`);
		const records: TaskIdentityRecord[] = [...ids].reverse().map((id) => ({
			id,
			type: "task",
			branch: "local",
			path: `backlog/tasks/${id.toLowerCase()} - Subtask.md`,
			lastModified: new Date("2026-08-01T10:00:00Z"),
			task: task(`Subtask ${id}`, id),
		}));

		const ordered = index(records).getTasks();

		expect(ordered.map((entry) => entry.id)).toEqual(ids);
	});

	it("hides an identity from the board but keeps its ID taken when every record is archived", () => {
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
		expect(identityIndex.getOccupiedIds().sort()).toEqual(["BACK-001", "BACK-1"]);
	});

	it("resolves a working-copy archived record for reads and reports it as archived to mutations", () => {
		const archivedTask = task("Archived", "BACK-7");
		const identityIndex = index([
			{
				id: "BACK-7",
				type: "archived",
				branch: "local",
				path: "backlog/archive/tasks/back-7 - Archived.md",
				lastModified: new Date(0),
				task: archivedTask,
				workingCopy: true,
			},
		]);

		expect(identityIndex.resolveForRead("7")).toMatchObject({ status: "found", task: { source: "archived" } });
		expect(identityIndex.resolveForMutation("7")).toEqual({ status: "archived", taskId: "BACK-7" });
		expect(identityIndex.getTasks(true).map((entry) => entry.id)).toEqual(["BACK-7"]);
	});

	describe("selectTaskRecord resolves a task's copies by the configured strategy", () => {
		const path = "backlog/tasks/back-1 - Shared.md";
		const working = (status: string, lastModified: string): TaskIdentityRecord => ({
			id: "BACK-1",
			type: "task",
			branch: "local",
			path,
			lastModified: new Date(lastModified),
			task: { ...task("Working copy"), status, source: "local" },
			workingCopy: true,
		});
		const branch = (status: string, lastModified: string): TaskIdentityRecord => ({
			id: "BACK-1",
			type: "task",
			branch: "origin/feature",
			path,
			lastModified: new Date(lastModified),
			task: { ...task("Branch copy"), status, source: "remote" },
		});

		it("shows a branch's In Progress over the working copy's To Do under most_progressed", () => {
			const records = [working("To Do", "2026-09-22T10:00:00Z"), branch("In Progress", "2026-10-20T10:00:00Z")];
			expect(index(records).getTasks()[0]?.status).toBe("In Progress");
			expect(index(records.reverse()).getTasks()[0]?.title).toBe("Branch copy");
		});

		it("shows the branch's In Progress even when the working copy was edited after the branch's commit", () => {
			const records = [working("To Do", "2026-10-20T12:00:00Z"), branch("In Progress", "2026-10-20T10:00:00Z")];
			expect(index(records).getTasks()[0]?.status).toBe("In Progress");
		});

		it("keeps the working copy's Done over a stale branch's In Progress", () => {
			const records = [working("Done", "2026-10-21T10:00:00Z"), branch("In Progress", "2026-10-20T10:00:00Z")];
			expect(index(records).getTasks()[0]?.status).toBe("Done");
			expect(index(records.reverse()).getTasks()[0]?.title).toBe("Working copy");
		});

		it("lets the working copy win a tie of status even against a later branch commit", () => {
			// The working copy's time is its updated_date; the branch copy's is a commit date, which is
			// later whenever a branch committed the same status. The editable copy must still win.
			const records = [branch("To Do", "2026-10-20T10:00:00Z"), working("To Do", "2026-10-19T10:00:00Z")];
			expect(index(records).getTasks()[0]?.title).toBe("Working copy");
			expect(index(records.reverse()).getTasks()[0]?.source).toBe("local");
		});

		it("shows the most recently modified copy when only branch copies hold the same status", () => {
			const older = { ...branch("In Progress", "2026-10-19T10:00:00Z"), branch: "origin/older" };
			const newer = { ...branch("In Progress", "2026-10-20T10:00:00Z"), branch: "origin/newer" };
			newer.task = { ...(newer.task as Task), title: "Newer branch copy" };
			expect(index([older, newer]).getTasks()[0]?.title).toBe("Newer branch copy");
		});

		it("leaves most_recent as it was: the working copy ahead of a later branch commit", () => {
			const records = [working("In Progress", "2026-10-19T10:00:00Z"), branch("To Do", "2026-10-20T10:00:00Z")];
			const mostRecent = new TaskIdentityIndex(records, context, ["To Do", "In Progress", "Done"], "most_recent");
			expect(mostRecent.getTasks()[0]?.title).toBe("Working copy");
		});
	});
});
