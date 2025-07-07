import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";

const TEST_DIR = join(process.cwd(), "test-parent-normalization");
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

async function initGitRepo(dir: string) {
	await Bun.spawn(["git", "init", "-b", "main"], { cwd: dir }).exited;
	await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: dir }).exited;
	await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: dir }).exited;
}

describe("CLI parent task id normalization", () => {
	beforeEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
		await initGitRepo(TEST_DIR);
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
	});

	it("should normalize parent task id when creating subtasks", async () => {
		const core = new Core(TEST_DIR);
		await core.initializeProject("Normalization Test", true);

		const parent: Task = {
			id: "task-4",
			title: "Parent",
			status: "To Do",
			assignee: [],
			createdDate: "2025-06-08",
			labels: [],
			dependencies: [],
			description: "",
		};
		await core.createTask(parent, true);

		await Bun.spawn(["bun", "run", CLI_PATH, "task", "create", "Child", "--parent", "4"], { cwd: TEST_DIR }).exited;

		const child = await core.filesystem.loadTask("task-4.1");
		expect(child?.parentTaskId).toBe("task-4");
	});
});
