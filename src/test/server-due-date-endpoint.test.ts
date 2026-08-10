import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Milestone, Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup, withTimeout } from "./test-utils.ts";

type DueDateServerHandlers = {
	handleCreateTask(request: Request): Promise<Response>;
	handleGetTask(taskId: string): Promise<Response>;
	handleUpdateTask(request: Request, taskId: string): Promise<Response>;
	handleCreateMilestone(request: Request): Promise<Response>;
	handleListMilestones(): Promise<Response>;
	handleUpdateMilestone(request: Request, milestoneId: string): Promise<Response>;
};

describe("BacklogServer due date endpoints", () => {
	let testDir: string;
	let server: BacklogServer | null;
	let handlers: DueDateServerHandlers;

	beforeEach(async () => {
		testDir = createUniqueTestDir("server-due-date");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		const filesystem = new FileSystem(testDir);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server due dates",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			checkActiveBranches: false,
			autoCommit: false,
		});
		server = new BacklogServer(testDir);
		handlers = server as unknown as DueDateServerHandlers;
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

	it("round-trips task dueDate through create, view, and update", async () => {
		const invalidCreateType = await handlers.handleCreateTask(
			jsonRequest("/api/tasks", "POST", { title: "Invalid task due type", dueDate: 123 }),
		);
		expect(invalidCreateType.status).toBe(400);

		const createdResponse = await withTimeout(
			handlers.handleCreateTask(
				jsonRequest("/api/tasks", "POST", {
					title: "Web due task",
					dueDate: "2026-08-10T16:30+02:00",
				}),
			),
			"server task creation",
			2_000,
		);
		expect(createdResponse.status).toBe(201);
		const created = (await createdResponse.json()) as Task;
		expect(created.dueDate).toBe("2026-08-10 14:30");

		const viewed = (await (await handlers.handleGetTask(created.id)).json()) as Task;
		expect(viewed.dueDate).toBe("2026-08-10 14:30");

		const clearedResponse = await handlers.handleUpdateTask(
			jsonRequest(`/api/tasks/${created.id}`, "PUT", { dueDate: null }),
			created.id,
		);
		expect(clearedResponse.status).toBe(200);
		expect(((await clearedResponse.json()) as Task).dueDate).toBeUndefined();

		const invalidResponse = await handlers.handleUpdateTask(
			jsonRequest(`/api/tasks/${created.id}`, "PUT", { dueDate: "2026-08-10" }),
			created.id,
		);
		expect(invalidResponse.status).toBe(400);
		expect(await invalidResponse.text()).toContain("Date-only values are not supported");
		const invalidUpdateType = await handlers.handleUpdateTask(
			jsonRequest(`/api/tasks/${created.id}`, "PUT", { dueDate: false }),
			created.id,
		);
		expect(invalidUpdateType.status).toBe(400);
	});

	it("round-trips milestone dueDate through create, list, and update", async () => {
		const invalidCreateType = await handlers.handleCreateMilestone(
			jsonRequest("/api/milestones", "POST", { title: "Invalid milestone due type", dueDate: [] }),
		);
		expect(invalidCreateType.status).toBe(400);

		const createdResponse = await withTimeout(
			handlers.handleCreateMilestone(
				jsonRequest("/api/milestones", "POST", {
					title: "Web release",
					dueDate: "2026-09-01T14:00+02:00",
				}),
			),
			"server milestone creation",
			2_000,
		);
		expect(createdResponse.status).toBe(201);
		const created = (await createdResponse.json()) as Milestone;
		expect(created.dueDate).toBe("2026-09-01 12:00");

		const listed = (await (await handlers.handleListMilestones()).json()) as Milestone[];
		expect(listed[0]?.dueDate).toBe("2026-09-01 12:00");

		const updatedResponse = await handlers.handleUpdateMilestone(
			jsonRequest(`/api/milestones/${created.id}`, "PUT", {
				title: created.title,
				dueDate: "2026-09-02T13:30Z",
			}),
			created.id,
		);
		expect(updatedResponse.status).toBe(200);
		const updated = (await updatedResponse.json()) as { milestone?: Milestone };
		expect(updated.milestone?.dueDate).toBe("2026-09-02 13:30");

		const clearedResponse = await handlers.handleUpdateMilestone(
			jsonRequest(`/api/milestones/${created.id}`, "PUT", {
				title: created.title,
				dueDate: null,
			}),
			created.id,
		);
		expect(clearedResponse.status).toBe(200);
		expect(((await clearedResponse.json()) as { milestone?: Milestone }).milestone?.dueDate).toBeUndefined();
		const invalidUpdateType = await handlers.handleUpdateMilestone(
			jsonRequest(`/api/milestones/${created.id}`, "PUT", { title: created.title, dueDate: {} }),
			created.id,
		);
		expect(invalidUpdateType.status).toBe(400);
	});

	it("keeps unexpected milestone creation failures as internal errors", async () => {
		const filesystem = (
			server as unknown as {
				core: {
					filesystem: {
						createMilestone: (title: string, description?: string, dueDate?: string) => Promise<Milestone>;
					};
				};
			}
		).core.filesystem;
		const createMilestone = filesystem.createMilestone;
		const consoleError = console.error;
		filesystem.createMilestone = async () => {
			throw new Error("simulated storage failure");
		};
		console.error = () => {};
		try {
			const response = await handlers.handleCreateMilestone(
				jsonRequest("/api/milestones", "POST", { title: "Internal failure", dueDate: "2026-09-01T12:00Z" }),
			);
			expect(response.status).toBe(500);
			expect(await response.json()).toEqual({ error: "Failed to create milestone" });
		} finally {
			filesystem.createMilestone = createMilestone;
			console.error = consoleError;
		}
	});
});
