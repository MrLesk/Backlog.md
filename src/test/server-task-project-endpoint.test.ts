import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, safeCleanup, withTimeout } from "./test-utils.ts";

type ProjectServerHandlers = {
	handleCreateTask(request: Request): Promise<Response>;
	handleUpdateTask(request: Request, taskId: string): Promise<Response>;
	handleGetTask(taskId: string): Promise<Response>;
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

	it.each(["To Do", "Draft"])("refuses a stale browser save of a %s record after a CLI edit", async (status) => {
		const created = await handlers.handleCreateTask(
			jsonRequest("/api/tasks", "POST", {
				title: "Concurrent edits",
				status,
				implementationNotes: "Initial notes",
			}),
		);
		const task = (await created.json()) as Task & { revision?: string };
		const original = (await (await handlers.handleGetTask(task.id)).json()) as Task & { revision?: string };
		const command = status === "Draft" ? "draft" : "task";
		const edited = await $`bun ${getTestCliPath()} ${command} edit ${task.id} --append-notes ${"New CLI notes"}`
			.cwd(testDir)
			.nothrow()
			.quiet();
		expect(edited.exitCode).toBe(0);
		const newer = (await (await handlers.handleGetTask(task.id)).json()) as Task & { revision?: string };
		if (!newer.filePath) throw new Error("Expected the stored record path");
		const before = await Bun.file(newer.filePath).text();
		const filesystem = new FileSystem(testDir);
		const config = await filesystem.loadConfig();
		if (!config) throw new Error("Expected the config");
		await filesystem.saveConfig({
			...config,
			onStatusChange: `node -e "require('node:fs').writeFileSync('status-callback-ran', 'changed')"`,
		});

		const response = await handlers.handleUpdateTask(
			jsonRequest(`/api/tasks/${task.id}`, "PUT", {
				title: "Browser title",
				implementationNotes: original.implementationNotes,
				status: "Done",
				expectedRevision: original.revision,
			}),
			task.id,
		);

		expect(response.status).toBe(409);
		expect((await response.json()).code).toBe("TASK_CHANGED");
		expect(await Bun.file(newer.filePath).text()).toBe(before);
		expect(await Bun.file(`${testDir}/status-callback-ran`).exists()).toBe(false);
		expect(newer.implementationNotes).toContain("New CLI notes");
		expect(newer.revision).not.toBe(original.revision);
		const retry = await handlers.handleUpdateTask(
			jsonRequest(`/api/tasks/${task.id}`, "PUT", {
				title: "Browser title",
				expectedRevision: newer.revision,
			}),
			task.id,
		);
		expect(retry.status).toBe(200);
		expect((await retry.json()).implementationNotes).toContain("New CLI notes");
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
