import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { createTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

describe("init Claude agent default", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-init-claude");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("does not install Claude agent by default in non-interactive mode", async () => {
		// Use defaults, do not pass --install-claude-agent
		const result = await $`bun ${CLI_PATH} init MyProj --defaults`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		// Verify that agent file was not created
		const agentExists = await Bun.file(join(TEST_DIR, ".claude", "agents", "project-manager-backlog.md")).exists();
		expect(agentExists).toBe(false);
	});

	it("installs Claude agent when flag is true", async () => {
		const result = await $`bun ${CLI_PATH} init MyProj --defaults --install-claude-agent true`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const agentExists = await Bun.file(join(TEST_DIR, ".claude", "agents", "project-manager-backlog.md")).exists();
		expect(agentExists).toBe(true);
	});
});
