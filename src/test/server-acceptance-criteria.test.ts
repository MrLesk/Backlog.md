import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

describe("browser acceptance criteria replacement", () => {
	let testDir: string;
	let core: Core;
	let server: BacklogServer;

	beforeEach(async () => {
		testDir = createUniqueTestDir("server-acceptance-criteria");
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Browser Acceptance Criteria");
		server = new BacklogServer(testDir);
		await server.start(0, false);
	});

	afterEach(async () => {
		await server.stop();
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	it("rejects line breaks before trimming on create and replacement", async () => {
		const acceptanceCriteriaItems = [{ text: "First\r\n", checked: false }];
		const created = await fetch(`http://127.0.0.1:${server.getPort()}/api/tasks`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Rejected", acceptanceCriteriaItems }),
		});
		expect(created.status).toBe(400);
		expect(((await created.json()) as { error: string }).error).toContain("single line");
		expect(await core.filesystem.listTasks()).toHaveLength(0);
		const { task } = await core.createTaskFromInput({
			title: "Keep",
			acceptanceCriteria: [{ text: "Keep", checked: true }],
		});
		if (!task.filePath) throw new Error("Expected task file path");
		const before = await Bun.file(task.filePath).text();
		const edited = await fetch(`http://127.0.0.1:${server.getPort()}/api/tasks/${task.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Must not change", acceptanceCriteriaItems }),
		});
		expect(edited.status).toBe(400);
		expect(((await edited.json()) as { error: string }).error).toContain("single line");
		expect(await Bun.file(task.filePath).text()).toBe(before);
	});

	it("honors explicit true and false instead of inheriting matching checks", async () => {
		const { task } = await core.createTaskFromInput({
			title: "Browser checks",
			acceptanceCriteria: [
				{ text: "First", checked: true },
				{ text: "Second", checked: false },
			],
		});
		const response = await fetch(`http://127.0.0.1:${server.getPort()}/api/tasks/${task.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				acceptanceCriteriaItems: [
					{ text: "First", checked: false },
					{ text: "Second", checked: true },
					{ text: "New", checked: true },
				],
			}),
		});
		expect(response.status).toBe(200);
		const expected = [
			{ index: 1, text: "First", checked: false },
			{ index: 2, text: "Second", checked: true },
			{ index: 3, text: "New", checked: true },
		];
		expect(((await response.json()) as Task).acceptanceCriteriaItems).toEqual(expected);
		expect((await core.filesystem.loadTask(task.id))?.acceptanceCriteriaItems).toEqual(expected);
	});
});
