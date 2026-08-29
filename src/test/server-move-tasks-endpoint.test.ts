import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

interface MoveResponse {
	success: boolean;
	tasks: Task[];
	changedTasks: Task[];
	failures: Array<{ taskId: string; reason: string }>;
}

async function postMove(body: unknown): Promise<{ status: number; payload: MoveResponse & { error?: string } }> {
	const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/move`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: response.status, payload: await response.json() };
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

describe("BacklogServer batch move endpoint", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-move-tasks");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Move Tasks",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		await core.createTask(makeTask({ id: "task-1", ordinal: 1000 }), false);
		await core.createTask(makeTask({ id: "task-2", ordinal: 2000 }), false);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetch(`http://127.0.0.1:${serverPort}/api/tasks`);
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("moves every listed task in one request", async () => {
		const { status, payload } = await postMove({ taskIds: ["task-1", "task-2"], targetStatus: "Done" });

		expect(status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.failures).toEqual([]);
		expect((await core.filesystem.loadTask("task-1"))?.status).toBe("Done");
		expect((await core.filesystem.loadTask("task-2"))?.status).toBe("Done");
	});

	it("reports the tasks it could not move and still moves the rest", async () => {
		const { status, payload } = await postMove({ taskIds: ["task-1", "task-404"], targetStatus: "Done" });

		expect(status).toBe(200);
		expect(payload.success).toBe(false);
		expect(payload.failures.map((failure) => failure.taskId)).toEqual(["task-404"]);
		expect((await core.filesystem.loadTask("task-1"))?.status).toBe("Done");
	});

	it("applies the milestone lane the request names", async () => {
		const { status, payload } = await postMove({
			taskIds: ["task-1", "task-2"],
			targetStatus: "Done",
			targetMilestone: "Release 1",
		});

		expect(status).toBe(200);
		expect(payload.success).toBe(true);
		expect((await core.filesystem.loadTask("task-1"))?.milestone).toBe("Release 1");
		expect((await core.filesystem.loadTask("task-2"))?.milestone).toBe("Release 1");
	});

	it("clears the milestone for the no-milestone lane and leaves it alone when unnamed", async () => {
		await postMove({ taskIds: ["task-1", "task-2"], targetStatus: "To Do", targetMilestone: "Release 1" });

		await postMove({ taskIds: ["task-1"], targetStatus: "Done", targetMilestone: null });
		await postMove({ taskIds: ["task-2"], targetStatus: "Done" });

		expect((await core.filesystem.loadTask("task-1"))?.milestone).toBeUndefined();
		expect((await core.filesystem.loadTask("task-2"))?.milestone).toBe("Release 1");
	});

	it("rejects a request without task IDs", async () => {
		const { status, payload } = await postMove({ taskIds: [], targetStatus: "Done" });

		expect(status).toBe(400);
		expect(payload.error).toContain("taskIds");
	});
});
