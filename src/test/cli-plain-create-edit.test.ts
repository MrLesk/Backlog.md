import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI --plain for task create/edit", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-plain-create-edit");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first using shell API (same as other tests)
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize backlog project using Core
		const core = new Core(TEST_DIR);
		await core.initializeProject("Plain Create/Edit Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	it("prints plain details after task create --plain", async () => {
		const result = await $`bun ${cliPath} task create "Example" --desc "Hello" --plain`.cwd(TEST_DIR).quiet();

		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		// Begins with File: line and contains key sections
		expect(out).toContain("File: ");
		expect(out).toContain("Task TASK-1 - Example");
		expect(out).toContain("Status:");
		expect(out).toContain("Created:");
		expect(out).toContain("Description:");
		expect(out).toContain("Hello");
		expect(out).toContain("Acceptance Criteria:");
		expect(out).toContain("Definition of Done:");
		// Should not contain TUI escape codes
		expect(out).not.toContain("[?1049h");
		expect(out).not.toContain("\x1b");
	});

	it("prints plain details after task edit --plain", async () => {
		// Create base task first (without plain)
		await $`bun ${cliPath} task create "Edit Me" --desc "First"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit 1 -s "In Progress" --plain`.cwd(TEST_DIR).quiet();

		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		// Begins with File: line and contains updated details
		expect(out).toContain("File: ");
		expect(out).toContain("Task TASK-1 - Edit Me");
		expect(out).toContain("Status: ◒ In Progress");
		expect(out).toContain("Created:");
		expect(out).toContain("Updated:");
		expect(out).toContain("Description:");
		expect(out).toContain("Acceptance Criteria:");
		expect(out).toContain("Definition of Done:");
		// Should not contain TUI escape codes
		expect(out).not.toContain("[?1049h");
		expect(out).not.toContain("\x1b");
	});
});
