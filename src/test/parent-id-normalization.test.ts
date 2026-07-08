import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

async function initGitRepo(dir: string) {
	await $`git init -b main`.cwd(dir).quiet();
	await $`git config user.name "Test User"`.cwd(dir).quiet();
	await $`git config user.email test@example.com`.cwd(dir).quiet();
}

describe("CLI parent task id normalization", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-parent-normalization");
		await mkdir(TEST_DIR, { recursive: true });
		await initGitRepo(TEST_DIR);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should normalize parent task id when creating subtasks", async () => {
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Normalization Test", true);

		const parent: Task = {
			id: "task-4",
			title: "Parent",
			status: "To Do",
			assignee: [],
			createdDate: "2025-06-08",
			labels: [],
			dependencies: [],
		};
		await core.createTask(parent, true);

		await $`bun run ${CLI_PATH} task create Child --parent 4`.cwd(TEST_DIR).quiet();

		const child = await core.filesystem.loadTask("task-4.1");
		expect(child?.parentTaskId).toBe("TASK-4");
	});

	it("accepts parent task IDs from other active branches", async () => {
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Cross Branch Parent Test", true);

		const remoteDir = join(TEST_DIR, "remote.git");
		await $`git init --bare -b main ${remoteDir}`.quiet();
		await $`git remote add origin ${remoteDir}`.cwd(TEST_DIR).quiet();
		await $`git push -u origin main`.cwd(TEST_DIR).quiet();

		await $`git checkout -b feature-parent`.cwd(TEST_DIR).quiet();
		await core.createTask(
			{
				id: "task-1",
				title: "Cross-branch parent",
				status: "To Do",
				assignee: [],
				createdDate: "2026-07-08",
				labels: [],
				dependencies: [],
				rawContent: "Created on feature branch",
			},
			true,
		);
		await $`git push -u origin feature-parent`.cwd(TEST_DIR).quiet();
		await $`git remote update origin --prune`.cwd(TEST_DIR).quiet();
		await $`git checkout main`.cwd(TEST_DIR).quiet();
		await core.gitOps.fetch();

		const viewResult = await $`bun run ${CLI_PATH} task view task-1 --plain`.cwd(TEST_DIR).quiet();
		expect(viewResult.stdout.toString()).toContain("Cross-branch parent");

		const createResult = await $`bun run ${CLI_PATH} task create Child --parent task-1`.cwd(TEST_DIR).quiet();

		expect(createResult.stdout.toString()).toContain("Created task TASK-1.1");
		const child = await core.filesystem.loadTask("task-1.1");
		expect(child?.parentTaskId).toBe("TASK-1");
	});

	it("rejects milestone IDs as parent task IDs when creating subtasks", async () => {
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Parent Validation Test", true);
		await $`bun run ${CLI_PATH} milestone add "Release"`.cwd(TEST_DIR).quiet();

		const result = await $`bun run ${CLI_PATH} task create Child --parent m-0`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Parent task M-0 not found");
		expect(result.stderr.toString()).toContain("--milestone");
		expect(await core.filesystem.listTasks()).toHaveLength(0);
	});
});
