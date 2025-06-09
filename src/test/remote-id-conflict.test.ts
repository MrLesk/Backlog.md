import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";

const TEST_DIR = join(process.cwd(), "test-remote-id");
const REMOTE_DIR = join(TEST_DIR, "remote.git");
const LOCAL_DIR = join(TEST_DIR, "local");
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

async function initRepo(dir: string) {
	await Bun.spawn(["git", "init"], { cwd: dir }).exited;
	await Bun.spawn(["git", "config", "user.name", "Test"], { cwd: dir }).exited;
	await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: dir }).exited;
}

describe("next id across remote branches", () => {
	beforeAll(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(REMOTE_DIR, { recursive: true });
		await Bun.spawn(["git", "init", "--bare"], { cwd: REMOTE_DIR }).exited;
		await mkdir(LOCAL_DIR, { recursive: true });
		await initRepo(LOCAL_DIR);
		await Bun.spawn(["git", "remote", "add", "origin", REMOTE_DIR], { cwd: LOCAL_DIR }).exited;

		const core = new Core(LOCAL_DIR);
		await core.initializeProject("Remote Test");
		await Bun.spawn(["git", "branch", "-M", "main"], { cwd: LOCAL_DIR }).exited;
		await Bun.spawn(["git", "push", "-u", "origin", "main"], { cwd: LOCAL_DIR }).exited;

		await Bun.spawn(["git", "checkout", "-b", "feature"], { cwd: LOCAL_DIR }).exited;
		await core.createTask(
			{
				id: "task-1",
				title: "Remote Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-08",
				labels: [],
				dependencies: [],
				description: "",
			},
			true,
		);
		await Bun.spawn(["git", "push", "-u", "origin", "feature"], { cwd: LOCAL_DIR }).exited;
		await Bun.spawn(["git", "checkout", "main"], { cwd: LOCAL_DIR }).exited;
	});

	afterAll(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
	});

	it("uses id after highest remote task", async () => {
		const result = Bun.spawnSync(["bun", "run", CLI_PATH, "task", "create", "Local Task"], { cwd: LOCAL_DIR });
		expect(result.stdout.toString()).toContain("Created task task-2");
		const core = new Core(LOCAL_DIR);
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
	});
});
