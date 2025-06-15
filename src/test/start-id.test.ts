import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";

const TEST_DIR = join(process.cwd(), "test-start-id");
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

async function initGitRepo(dir: string) {
	await Bun.spawn(["git", "init"], { cwd: dir }).exited;
	await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: dir }).exited;
	await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: dir }).exited;
}

describe("task id generation", () => {
	beforeEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
		await initGitRepo(TEST_DIR);
		const core = new Core(TEST_DIR);
		await core.initializeProject("ID Test");
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
	});

	it("starts numbering tasks at 1", async () => {
		const result = Bun.spawnSync(["bun", CLI_PATH, "task", "create", "First"], { cwd: TEST_DIR });
		expect(result.exitCode).toBe(0);

		const files = await readdir(join(TEST_DIR, ".backlog", "tasks"));
		const first = files.find((f) => f.startsWith("task-1 -"));
		expect(first).toBeDefined();
	});
});
