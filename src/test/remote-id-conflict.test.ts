import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";

const TEST_DIR = join(process.cwd(), "test-remote-id");
const REMOTE_DIR = join(TEST_DIR, "remote.git");
const LOCAL_DIR = join(TEST_DIR, "local");
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

async function initRepo(dir: string) {
	await $`git init -b main`.cwd(dir).quiet();
	await $`git config user.name Test`.cwd(dir).quiet();
	await $`git config user.email test@example.com`.cwd(dir).quiet();
}

describe("next id across remote branches", () => {
	beforeAll(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(REMOTE_DIR, { recursive: true });
		await $`git init --bare -b main`.cwd(REMOTE_DIR).quiet();
		await mkdir(LOCAL_DIR, { recursive: true });
		await initRepo(LOCAL_DIR);
		await $`git remote add origin ${REMOTE_DIR}`.cwd(LOCAL_DIR).quiet();

		const core = new Core(LOCAL_DIR);
		await core.initializeProject("Remote Test", true);
		await core.ensureConfigMigrated();
		await $`git branch -M main`.cwd(LOCAL_DIR).quiet();
		await $`git push -u origin main`.cwd(LOCAL_DIR).quiet();

		await $`git checkout -b feature`.cwd(LOCAL_DIR).quiet();
		await core.createTask(
			{
				id: "task-1",
				title: "Remote Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-08",
				labels: [],
				dependencies: [],
				body: "",
			},
			true,
		);
		await $`git push -u origin feature`.cwd(LOCAL_DIR).quiet();
		await $`git checkout main`.cwd(LOCAL_DIR).quiet();
	});

	afterAll(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
	});

	it("uses id after highest remote task", async () => {
		const result = await $`bun run ${CLI_PATH} task create "Local Task"`.cwd(LOCAL_DIR).quiet();
		expect(result.stdout.toString()).toContain("Created task task-2");
		const core = new Core(LOCAL_DIR);
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
	});
});
