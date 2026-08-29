import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup, withTimeout } from "./test-utils.ts";

type ProjectServerHandlers = {
	handleCreateTask(request: Request): Promise<Response>;
	handleUpdateTask(request: Request, taskId: string): Promise<Response>;
};

describe("BacklogServer task project field", () => {
	let testDir: string;
	let server: BacklogServer | null;
	let handlers: ProjectServerHandlers;

	beforeEach(async () => {
		testDir = createUniqueTestDir("server-task-project");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		const filesystem = new FileSystem(testDir);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server project field",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			checkActiveBranches: false,
			autoCommit: false,
			projects: ["web", "api"],
		});
		server = new BacklogServer(testDir);
		handlers = server as unknown as ProjectServerHandlers;
	});

	afterEach(async () => {
		await server?.stop();
		server = null;
		await safeCleanup(testDir);
	});

	const jsonRequest = (path: string, method: string, body: unknown) =>
		new Request(`http://localhost${path}`, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

	it("persists project selected via the create endpoint", async () => {
		const createdResponse = await withTimeout(
			handlers.handleCreateTask(jsonRequest("/api/tasks", "POST", { title: "Web task", project: "web" })),
			"server task creation",
			2_000,
		);
		expect(createdResponse.status).toBe(201);
		const created = (await createdResponse.json()) as Task;
		expect(created.project).toBe("web");
	});

	it("persists and clears project through the update endpoint", async () => {
		const createdResponse = await handlers.handleCreateTask(
			jsonRequest("/api/tasks", "POST", { title: "Untagged task" }),
		);
		const created = (await createdResponse.json()) as Task;
		expect(created.project).toBeUndefined();

		const updatedResponse = await handlers.handleUpdateTask(
			jsonRequest(`/api/tasks/${created.id}`, "PUT", { project: "api" }),
			created.id,
		);
		expect(updatedResponse.status).toBe(200);
		expect(((await updatedResponse.json()) as Task).project).toBe("api");

		const clearedResponse = await handlers.handleUpdateTask(
			jsonRequest(`/api/tasks/${created.id}`, "PUT", { project: null }),
			created.id,
		);
		expect(clearedResponse.status).toBe(200);
		expect(((await clearedResponse.json()) as Task).project).toBeUndefined();
	});
});
