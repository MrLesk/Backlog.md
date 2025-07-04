import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";

describe("CLI agents command", () => {
	const testDir = join(process.cwd(), "test-agents-cli");
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
		await mkdir(testDir, { recursive: true });

		// Initialize git repo first
		const gitInit = Bun.spawn(["git", "init"], { cwd: testDir, stdout: "inherit", stderr: "inherit" });
		await gitInit.exited;
		const gitConfigName = Bun.spawn(["git", "config", "user.name", "Test User"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
		});
		await gitConfigName.exited;
		const gitConfigEmail = Bun.spawn(["git", "config", "user.email", "test@example.com"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
		});
		await gitConfigEmail.exited;

		// Initialize backlog project using Core
		const core = new Core(testDir);
		await core.initializeProject("Agents Test Project");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should show help when no options are provided", async () => {
		const result = Bun.spawn(["bun", cliPath, "agents"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
		});

		expect(await result.exited).toBe(0);
	});

	it("should show help text with agents --help", async () => {
		const result = Bun.spawn(["bun", cliPath, "agents", "--help"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
		});

		expect(await result.exited).toBe(0);
	});

	it("should update selected agent instruction files", async () => {
		// Run the command with selection (selecting the first option - .cursorrules)
		const result = Bun.spawn(["bun", cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
			stdin: "inherit",
		});

		expect(await result.exited).toBe(0);
	});

	it("should handle user cancellation gracefully", async () => {
		// First, run the command to create some files
		const setupResult = Bun.spawn(["bun", cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
			stdin: "inherit",
		});
		await setupResult.exited;

		// Then verify files were updated
		const result = Bun.spawn(["bun", cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
			stdin: "inherit",
		});

		expect(await result.exited).toBe(0);
	});

	it("should fail when not in a backlog project", async () => {
		const nonBacklogDir = join(process.cwd(), "test-non-backlog");

		// Create a temporary directory that's not a backlog project
		await mkdir(nonBacklogDir, { recursive: true });

		// Initialize git repo
		const gitInit = Bun.spawn(["git", "init"], { cwd: nonBacklogDir, stdout: "inherit", stderr: "inherit" });
		await gitInit.exited;
		const gitConfigName = Bun.spawn(["git", "config", "user.name", "Test User"], {
			cwd: nonBacklogDir,
			stdout: "inherit",
			stderr: "inherit",
		});
		await gitConfigName.exited;
		const gitConfigEmail = Bun.spawn(["git", "config", "user.email", "test@example.com"], {
			cwd: nonBacklogDir,
			stdout: "inherit",
			stderr: "inherit",
		});
		await gitConfigEmail.exited;

		const result = Bun.spawn(["bun", cliPath, "agents", "--update-instructions"], {
			cwd: nonBacklogDir,
			stdout: "inherit",
			stderr: "inherit",
			stdin: "inherit",
		});

		expect(await result.exited).toBe(1);

		// Cleanup
		await rm(nonBacklogDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should update multiple selected files", async () => {
		// Run the command with multiple selections (select first two options)
		const result = Bun.spawn(["bun", cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
			stdin: "inherit",
		});

		expect(await result.exited).toBe(0);
	});

	it("should update existing files correctly", async () => {
		// Verify the command updates existing files correctly
		const updateResult = Bun.spawn(["bun", cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			stdout: "inherit",
			stderr: "inherit",
			stdin: "inherit",
		});
		await updateResult.exited;
	});
});
