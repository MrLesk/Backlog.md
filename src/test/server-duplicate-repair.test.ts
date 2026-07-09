import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { DuplicateRepairPlan, DuplicateRepairResult } from "../core/duplicate-task-repair.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let testDir: string;
let server: BacklogServer | null = null;
let serverPort = 0;

function makeTask(id: string, title: string): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies: [],
		rawContent: `## Description\n\n${title} refers to TASK-1.`,
	};
}

async function request(path: string, init?: RequestInit): Promise<Response> {
	return await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
}

beforeEach(async () => {
	testDir = createUniqueTestDir("server-duplicate-repair");
	await mkdir(testDir, { recursive: true });
	const core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "Server duplicate repair",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});
	await Bun.write(join(core.filesystem.tasksDir, "task-1 - Alpha.md"), serializeTask(makeTask("TASK-1", "Alpha")));
	await Bun.write(join(core.filesystem.tasksDir, "task-01 - Beta.md"), serializeTask(makeTask("TASK-01", "Beta")));
	await Bun.write(
		join(core.filesystem.completedDir, "task-001 - Gamma.md"),
		serializeTask(makeTask("TASK-001", "Gamma")),
	);

	server = new BacklogServer(testDir);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
	await retry(async () => {
		const response = await request("/api/tasks/duplicates");
		if (!response.ok) throw new Error(await response.text());
	});
});

afterEach(async () => {
	if (server) {
		await server.stop();
		server = null;
	}
	await safeCleanup(testDir);
});

describe("duplicate repair server boundary", () => {
	it("returns the shared preview and applies it with the preview fingerprint", async () => {
		const previewResponse = await request("/api/tasks/duplicates");
		expect(previewResponse.status).toBe(200);
		const preview = (await previewResponse.json()) as DuplicateRepairPlan;
		expect(preview.groups).toHaveLength(1);
		expect(preview.groups[0]?.tasks).toHaveLength(3);
		expect(preview.changes).toHaveLength(2);
		expect(preview.references.length).toBeGreaterThan(0);

		const repairResponse = await request("/api/tasks/duplicates", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ fingerprint: preview.fingerprint }),
		});
		expect(repairResponse.status).toBe(200);
		const result = (await repairResponse.json()) as DuplicateRepairResult;
		expect(result.repairedFiles).toBe(2);
		expect(result.remainingGroups).toEqual([]);

		const verified = (await (await request("/api/tasks/duplicates")).json()) as DuplicateRepairPlan;
		expect(verified.groups).toEqual([]);
		const activeTasks = (await (await request("/api/tasks")).json()) as Task[];
		expect(new Set(activeTasks.map((task) => task.id)).size).toBe(activeTasks.length);
		expect(activeTasks.map((task) => task.title).sort()).toEqual(["Alpha", "Beta"]);
	});

	it("returns conflict for a stale preview without renaming files", async () => {
		const preview = (await (await request("/api/tasks/duplicates")).json()) as DuplicateRepairPlan;
		const changedPath = join(testDir, preview.changes[0]?.sourcePath ?? "");
		const contentBefore = await Bun.file(changedPath).text();
		await Bun.write(changedPath, `${contentBefore}\nConcurrent edit\n`);

		const response = await request("/api/tasks/duplicates", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ fingerprint: preview.fingerprint }),
		});
		expect(response.status).toBe(409);
		expect(await response.text()).toContain("changed after the preview");
		expect(await Bun.file(changedPath).exists()).toBe(true);
	});

	it("returns conflict for ambiguous task reads and updates", async () => {
		const read = await request("/api/task/TASK-1");
		expect(read.status).toBe(409);
		expect(await read.text()).toContain("is ambiguous");

		const parentFilter = await request("/api/tasks?parent=TASK-1");
		expect(parentFilter.status).toBe(409);
		expect(await parentFilter.text()).toContain("is ambiguous");

		const update = await request("/api/tasks/TASK-1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Changed" }),
		});
		expect(update.status).toBe(409);
		expect(await update.text()).toContain("backlog doctor");
	});
});
