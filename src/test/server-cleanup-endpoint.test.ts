import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
	if (!response.ok) {
		throw new Error(`${response.status}: ${await response.text()}`);
	}
	return response.json();
}

function makeTask(overrides: Partial<Task>): Task {
	return {
		id: "task-1",
		title: "Task",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		rawContent: "Task body",
		...overrides,
	};
}

describe("BacklogServer cleanup endpoints", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-cleanup");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Cleanup",
			statuses: ["To Do", "Review", "Closed"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - 7);
		const oldDateValue = oldDate.toISOString().split("T")[0] as string;
		await core.createTask(
			makeTask({
				id: "task-1",
				title: "Old Closed Task",
				status: "Closed",
				createdDate: oldDateValue,
				updatedDate: oldDateValue,
			}),
			false,
		);
		await core.createTask(
			makeTask({
				id: "task-2",
				title: "Old Literal Done Task",
				status: "Done",
				createdDate: oldDateValue,
				updatedDate: oldDateValue,
			}),
			false,
		);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetchJson<unknown>("/api/tasks/cleanup?age=3");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("previews and executes cleanup for the final configured status", async () => {
		const preview = await fetchJson<{ count: number; tasks: Array<{ id: string; title: string }> }>(
			"/api/tasks/cleanup?age=3",
		);
		expect(preview.count).toBe(1);
		expect(preview.tasks.map((task) => task.id)).toEqual(["TASK-1"]);
		expect(preview.tasks[0]?.title).toBe("Old Closed Task");

		const result = await fetchJson<{ success: boolean; movedCount: number; totalCount: number }>(
			"/api/tasks/cleanup/execute",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskIds: preview.tasks.map((task) => task.id) }),
			},
		);
		expect(result.success).toBe(true);
		expect(result.movedCount).toBe(1);
		expect(result.totalCount).toBe(1);

		const activeTasks = await core.filesystem.listTasks();
		expect(activeTasks.map((task) => task.id)).toEqual(["TASK-2"]);

		const archivedTasks = await core.filesystem.listArchivedTasks();
		expect(archivedTasks.map((task) => task.id)).toEqual(["TASK-1"]);
	});

	it("archives only the tasks the preview showed", async () => {
		const preview = await fetchJson<{ tasks: Array<{ id: string }> }>("/api/tasks/cleanup?age=3");
		expect(preview.tasks.map((task) => task.id)).toEqual(["TASK-1"]);
		// A task that became old enough and finished after the preview was shown.
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - 7);
		const oldDateValue = oldDate.toISOString().split("T")[0] as string;
		await core.createTask(
			makeTask({
				id: "task-3",
				title: "Finished after the preview",
				status: "Closed",
				createdDate: oldDateValue,
				updatedDate: oldDateValue,
			}),
			false,
		);

		const result = await fetchJson<{ movedCount: number; totalCount: number }>("/api/tasks/cleanup/execute", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ taskIds: preview.tasks.map((task) => task.id) }),
		});

		expect(result).toMatchObject({ movedCount: 1, totalCount: 1 });
		expect((await core.filesystem.listArchivedTasks()).map((task) => task.id)).toEqual(["TASK-1"]);
		expect((await core.filesystem.listTasks()).map((task) => task.id)).toEqual(["TASK-2", "TASK-3"]);
	});

	it("skips a previewed task that left the final status before the click", async () => {
		const preview = await fetchJson<{ tasks: Array<{ id: string }> }>("/api/tasks/cleanup?age=3");
		await core.updateTaskFromInput("TASK-1", { status: "To Do" }, false);

		const result = await fetchJson<{ movedCount: number; totalCount: number; message: string }>(
			"/api/tasks/cleanup/execute",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskIds: preview.tasks.map((task) => task.id) }),
			},
		);

		expect(result).toMatchObject({ movedCount: 0, totalCount: 1 });
		// The browser shows this message, so it names the skipped task and the reason as `backlog cleanup` does.
		expect(result.message).toBe("Skipped task TASK-1: its status is now To Do\nSuccessfully archived 0 of 1 tasks.");
		expect(await core.filesystem.listArchivedTasks()).toEqual([]);
	});

	it.each([
		["no body", undefined],
		["a body that is not JSON", "not json"],
		["an age instead of task IDs", JSON.stringify({ age: 3 })],
		["an empty list", JSON.stringify({ taskIds: [] })],
		["a list with an entry that is not a task ID", JSON.stringify({ taskIds: ["TASK-1", 1] })],
		["a list with an empty task ID", JSON.stringify({ taskIds: ["TASK-1", " "] })],
	])("answers 400 to %s and archives nothing", async (_name, body) => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/cleanup/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "taskIds must be a non-empty list of task IDs" });
		expect(await core.filesystem.listArchivedTasks()).toEqual([]);
	});

	it("archives final-status work, keeps its ID and status, and preserves incoming links", async () => {
		await core.updateTaskFromInput("TASK-2", { dependencies: ["TASK-1"], references: ["TASK-1"] }, false);

		const result = await fetchJson<{ success: boolean }>("/api/tasks/TASK-1/archive", { method: "POST" });

		expect(result).toEqual({ success: true });
		expect(await core.filesystem.loadTask("TASK-1")).toBeNull();
		expect((await core.filesystem.listArchivedTasks()).map((task) => [task.id, task.status])).toEqual([
			["TASK-1", "Closed"],
		]);
		const dependent = await core.filesystem.loadTask("TASK-2");
		expect(dependent?.dependencies).toEqual(["TASK-1"]);
		expect(dependent?.references).toEqual(["TASK-1"]);
	});

	it("archives nonfinal work without rewriting the tasks that link to it", async () => {
		await core.updateTaskFromInput("TASK-1", { dependencies: ["TASK-2"], references: ["TASK-2"] }, false);

		const result = await fetchJson<{ success: boolean }>("/api/tasks/TASK-2/archive", { method: "POST" });

		expect(result).toEqual({ success: true });
		expect(await core.filesystem.loadTask("TASK-2")).toBeNull();
		expect((await core.filesystem.listArchivedTasks()).map((task) => task.id)).toEqual(["TASK-2"]);
		const dependent = await core.filesystem.loadTask("TASK-1");
		expect(dependent?.dependencies).toEqual(["TASK-2"]);
		expect(dependent?.references).toEqual(["TASK-2"]);
	});

	it("refuses to archive or edit an archived task and has no complete or delete route", async () => {
		await fetchJson("/api/tasks/TASK-1/archive", { method: "POST" });

		const again = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-1/archive`, { method: "POST" });
		expect(again.status).toBe(400);
		expect(((await again.json()) as { error: string }).error).toBe(
			"Task TASK-1 is archived. Archived tasks are read-only. Restore it to the board first: backlog task restore TASK-1",
		);

		const edit = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Must not change" }),
		});
		expect(edit.status).toBe(400);
		expect(((await edit.json()) as { error: string }).error).toContain("Task TASK-1 is archived.");

		const complete = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-2/complete`, { method: "POST" });
		expect(complete.ok).toBe(false);
		const remove = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-2`, { method: "DELETE" });
		expect(remove.ok).toBe(false);
		expect((await core.filesystem.loadTask("TASK-2"))?.status).toBe("Done");
	});

	it("answers an unknown ID with the shared not-found sentence", async () => {
		const unknown = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-9/archive`, { method: "POST" });

		expect(unknown.status).toBe(404);
		expect(await unknown.json()).toEqual({ error: "Task TASK-9 not found." });
	});

	it("refuses to archive over an archive file of the same name and changes nothing", async () => {
		const boardPath = (await core.filesystem.loadTask("TASK-2"))?.filePath;
		if (!boardPath) throw new Error("Expected the board task file");
		const archivePath = join(core.filesystem.archiveTasksDir, basename(boardPath));
		await mkdir(core.filesystem.archiveTasksDir, { recursive: true });
		await Bun.write(archivePath, serializeTask(makeTask({ id: "TASK-9", title: "Already archived" })));
		const archiveBefore = await Bun.file(archivePath).text();

		const refused = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-2/archive`, { method: "POST" });

		expect(refused.status).toBe(400);
		expect(await refused.json()).toEqual({
			error: `Task TASK-2 cannot be archived: the archive already has a file named ${basename(boardPath)}.`,
		});
		expect(await Bun.file(boardPath).exists()).toBe(true);
		expect(await Bun.file(archivePath).text()).toBe(archiveBefore);
	});
});

describe("BacklogServer archive endpoint and a task on another branch", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-archive-other-branch");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Archive",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: true,
			remoteOperations: false,
		});
		await core.createTask(makeTask({ id: "task-1", title: "On the board" }), false);
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add the board task"`.cwd(TEST_DIR).quiet();
		await $`git switch -c feature`.cwd(TEST_DIR).quiet();
		await core.createTask(makeTask({ id: "task-2", title: "Only on the feature branch" }), false);
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add the feature task"`.cwd(TEST_DIR).quiet();
		await $`git switch main`.cwd(TEST_DIR).quiet();

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		serverPort = server.getPort() ?? 0;
		await retry(async () => {
			await fetchJson<unknown>("/api/tasks");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("answers with core's read-only refusal, as it does for an archived task", async () => {
		// The browser shows the task, so "not found" would contradict the board.
		const listed = await fetchJson<Array<{ id: string; branch?: string }>>("/api/tasks");
		expect(listed.find((task) => task.id === "TASK-2")?.branch).toBe("feature");

		const refused = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-2/archive`, { method: "POST" });

		expect(refused.status).toBe(400);
		expect(await refused.json()).toEqual({
			error: 'Task TASK-2 exists only on branch "feature" and is read-only here. Switch to that branch to change it.',
		});
		expect((await core.filesystem.listTasks()).map((task) => task.id)).toEqual(["TASK-1"]);
		expect(await core.filesystem.listArchivedTasks()).toEqual([]);
	});
});
