import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("CLI Splash (bare run)", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-splash");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("prints minimal splash in non-initialized repo (non-TTY)", async () => {
		const result = await $`bun ${CLI_PATH}`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		expect(out).toContain("Backlog.md v");
		expect(out).toContain("Docs: https://backlog.md");
		expect(out).toContain("backlog init");
	});

	it("prints quickstart (initialized repo)", async () => {
		// Initialize Git + project via Core
		const core = new Core(TEST_DIR);
		await core.initializeProject("Splash Test");

		const result = await $`bun ${CLI_PATH}`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		expect(out).toContain("Quickstart");
		expect(out).toContain("backlog task create");
		expect(out).toContain("backlog board");
		expect(out).not.toContain("backlog init");
	});

	it("--help shows commander help, not splash", async () => {
		const result = await $`bun ${CLI_PATH} --help`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		expect(out).toMatch(/Usage: .*backlog/);
	});

	it("--plain forces minimal splash", async () => {
		const result = await $`bun ${CLI_PATH} --plain`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		expect(out).toContain("Backlog.md v");
		expect(out).toContain("Docs: https://backlog.md");
	});
});
