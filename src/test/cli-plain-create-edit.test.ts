import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTaskPlatformAware, editTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

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
		await initializeTestProject(core, "Plain Create/Edit Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	it("prints plain details after task create --plain", async () => {
		const result = await createTaskPlatformAware({ title: "Example", description: "Hello", plain: true }, TEST_DIR);

		const out = result.stdout;
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

	it("assigns default tail ordinals and preserves explicit ordinals on CLI create", async () => {
		const first = await createTaskPlatformAware({ title: "First ordinal CLI task", plain: true }, TEST_DIR);
		expect(first.exitCode).toBe(0);
		expect(first.stdout).toContain("Ordinal: 1000");

		const second = await createTaskPlatformAware({ title: "Second ordinal CLI task", plain: true }, TEST_DIR);
		expect(second.exitCode).toBe(0);
		expect(second.stdout).toContain("Ordinal: 2000");

		const explicit = await createTaskPlatformAware(
			{ title: "Explicit ordinal CLI task", ordinal: 7500, plain: true },
			TEST_DIR,
		);
		expect(explicit.exitCode).toBe(0);
		expect(explicit.stdout).toContain("Ordinal: 7500");
	});

	it("rejects non-finite ordinals on CLI create", async () => {
		// CLI-CONTRACT: verifies error message text and exit code for invalid ordinal value
		const result = await $`bun ${cliPath} task create "Invalid ordinal CLI task" --ordinal Infinity`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Invalid ordinal: Infinity. Must be a non-negative number.");
	});

	it("prints plain details after task edit --plain", async () => {
		// Create base task first (without plain)
		await createTaskPlatformAware({ title: "Edit Me", description: "First" }, TEST_DIR);

		const result = await editTaskPlatformAware({ taskId: "1", status: "In Progress", plain: true }, TEST_DIR);

		const out = result.stdout;
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
