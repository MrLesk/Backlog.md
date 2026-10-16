import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

const operations = [
	["definitionOfDoneCheck", 1],
	["definitionOfDoneUncheck", 2],
	["definitionOfDoneRemove", 1],
] as const;

describe("BacklogServer Definition of Done index updates", () => {
	let testDir: string;
	let core: Core;
	let server: BacklogServer | null = null;
	let taskId: string;
	let taskPath: string;
	let taskUrl: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("server-definition-of-done");
		core = new Core(testDir);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Definition of Done",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			checkActiveBranches: false,
			autoCommit: false,
		});
		const { task } = await core.createTaskFromInput({
			title: "Definition of Done edits",
			definitionOfDoneAdd: ["First item", "Second item"],
		});
		taskId = task.id;
		await core.updateTaskFromInput(taskId, { checkDefinitionOfDone: [2] });
		const saved = await core.filesystem.loadTask(taskId);
		if (!saved?.filePath) throw new Error("Expected task file path");
		taskPath = saved.filePath;

		server = new BacklogServer(testDir);
		await server.start(0, false);
		const baseUrl = `http://127.0.0.1:${server.getPort()}`;
		taskUrl = `${baseUrl}/api/tasks/${taskId}`;
		await retry(async () => {
			const response = await fetch(`${baseUrl}/api/status`);
			if (!response.ok) throw new Error("Server is not ready");
		});
	});

	afterEach(async () => {
		await server?.stop();
		server = null;
		await safeCleanup(testDir);
	});

	async function put(body: unknown): Promise<Response> {
		return await fetch(taskUrl, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	it.each(operations)("rejects malformed %s without changing the task", async (field, index) => {
		const before = await readFile(taskPath);
		for (const value of [[String(index)], [index, String(index)], [null], [true], [{}], [[]], "1", 1, null, true, {}]) {
			const response = await put({ [field]: value });
			expect(response.status).toBe(400);
			const body = (await response.json()) as { error: string };
			expect(body.error).toContain(field);
			expect(body.error).toContain("array of finite numbers");
			expect(await readFile(taskPath)).toEqual(before);
		}
	});

	it.each(operations)("rejects valid edits combined with malformed %s", async (field, index) => {
		const before = await readFile(taskPath);
		const response = await put({
			title: "This valid edit must not be saved",
			definitionOfDoneAdd: ["Another valid edit"],
			[field]: [index, String(index)],
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: expect.stringContaining(field) });
		expect(await readFile(taskPath)).toEqual(before);
	});

	it("rejects JSON numbers that overflow to infinity", async () => {
		const before = await readFile(taskPath);
		for (const [field] of operations) {
			const response = await fetch(taskUrl, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: `{"${field}":[1e309]}`,
			});
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: expect.stringContaining(field) });
			expect(await readFile(taskPath)).toEqual(before);
		}
	});

	it("checks, unchecks, and removes numeric indices through shared task updates", async () => {
		const checked = await put({ definitionOfDoneCheck: [1] });
		expect(checked.status).toBe(200);
		expect(((await checked.json()) as Task).definitionOfDoneItems).toEqual([
			{ index: 1, text: "First item", checked: true },
			{ index: 2, text: "Second item", checked: true },
		]);

		const unchecked = await put({ definitionOfDoneUncheck: [2] });
		expect(unchecked.status).toBe(200);
		expect(((await unchecked.json()) as Task).definitionOfDoneItems).toEqual([
			{ index: 1, text: "First item", checked: true },
			{ index: 2, text: "Second item", checked: false },
		]);

		const removed = await put({ definitionOfDoneRemove: [1] });
		expect(removed.status).toBe(200);
		const items = [{ index: 1, text: "Second item", checked: false }];
		expect(((await removed.json()) as Task).definitionOfDoneItems).toEqual(items);
		expect((await core.filesystem.loadTask(taskId))?.definitionOfDoneItems).toEqual(items);
	});

	it("accepts empty index arrays and keeps unknown fields ignored", async () => {
		const before = await readFile(taskPath);
		const response = await put({
			definitionOfDoneCheck: [],
			definitionOfDoneUncheck: [],
			definitionOfDoneRemove: [],
			unknownField: "unchanged behavior",
		});

		expect(response.status).toBe(200);
		expect(await readFile(taskPath)).toEqual(before);
	});

	it.each(operations)("keeps shared missing-index errors for numeric %s", async (field) => {
		const before = await readFile(taskPath);
		const response = await put({ title: "Do not save this edit either", [field]: [999] });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: expect.stringContaining("Definition of Done item #999 not found") });
		expect(await readFile(taskPath)).toEqual(before);
	});
});
