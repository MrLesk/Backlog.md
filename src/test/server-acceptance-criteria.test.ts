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
