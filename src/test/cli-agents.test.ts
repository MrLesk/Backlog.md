import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
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
		spawnSync("git", ["init"], { cwd: testDir, encoding: "utf8" });
		spawnSync("git", ["config", "user.name", "Test User"], { cwd: testDir, encoding: "utf8" });
		spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: testDir, encoding: "utf8" });

		// Initialize backlog project using Core
		const core = new Core(testDir);
		await core.initializeProject("Agents Test Project");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should show help when no options are provided", () => {
		const result = spawnSync("bun", [cliPath, "agents"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Usage: backlog agents [options]");
		expect(result.stdout).toContain("manage agent instruction files");
		expect(result.stdout).toContain("--update-instructions");
	});

	it("should show help text with agents --help", () => {
		const result = spawnSync("bun", [cliPath, "agents", "--help"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Usage: backlog agents [options]");
		expect(result.stdout).toContain("manage agent instruction files");
		expect(result.stdout).toContain("--update-instructions");
		expect(result.stdout).toContain("update agent instruction files");
		expect(result.stdout).toContain(".cursorrules");
		expect(result.stdout).toContain("CLAUDE.md");
		expect(result.stdout).toContain("AGENTS.md");
		expect(result.stdout).toContain("GEMINI.md");
		expect(result.stdout).toContain("copilot-instructions.md");
	});

	it("should update selected agent instruction files", () => {
		// Run the command with selection (selecting the first option - .cursorrules)
		const result = spawnSync("bun", [cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			encoding: "utf8",
			input: " \n", // Space to select first option, Enter to confirm
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Updated 1 agent instruction file(s): .cursorrules");
	});

	it("should verify that selected files are created with correct content", async () => {
		// Run the command with selection (selecting the first option - .cursorrules)
		spawnSync("bun", [cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			encoding: "utf8",
			input: " \n", // Space to select first option, Enter to confirm
		});

		// Verify the file was created with correct content
		const cursorrules = await Bun.file(join(testDir, ".cursorrules")).text();
		expect(cursorrules).toContain("# === BACKLOG.MD GUIDELINES START ===");
		expect(cursorrules).toContain("# === BACKLOG.MD GUIDELINES END ===");
		expect(cursorrules).toContain("# Instructions for the usage of Backlog.md CLI Tool");
	});

	it("should handle case when no files are selected", () => {
		// Run the command without selecting any files (just hit Enter)
		const result = spawnSync("bun", [cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			encoding: "utf8",
			input: "\n", // Just Enter to confirm empty selection
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("No files selected for update.");
	});

	it("should fail when not in a backlog project", async () => {
		// Create a fresh directory without backlog initialization
		const nonBacklogDir = join(process.cwd(), "test-non-backlog");
		await rm(nonBacklogDir, { recursive: true, force: true }).catch(() => {});
		await mkdir(nonBacklogDir, { recursive: true });

		// Initialize git repo (required for backlog to work)
		spawnSync("git", ["init"], { cwd: nonBacklogDir, encoding: "utf8" });
		spawnSync("git", ["config", "user.name", "Test User"], { cwd: nonBacklogDir, encoding: "utf8" });
		spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: nonBacklogDir, encoding: "utf8" });

		const result = spawnSync("bun", [cliPath, "agents", "--update-instructions"], {
			cwd: nonBacklogDir,
			encoding: "utf8",
			input: "\n",
		});

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("No backlog project found. Initialize one first with: backlog init");

		// Cleanup
		await rm(nonBacklogDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should update multiple selected files", () => {
		// Run the command with multiple selections (select first two options)
		const result = spawnSync("bun", [cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			encoding: "utf8",
			input: " \u001b[B \n", // Space to select first, down arrow, space to select second, Enter to confirm
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Updated 2 agent instruction file(s):");
		expect(result.stdout).toContain(".cursorrules");
		expect(result.stdout).toContain("CLAUDE.md");
	});

	it("should verify multiple files are created correctly", async () => {
		// Run the command with multiple selections (select first two options)
		spawnSync("bun", [cliPath, "agents", "--update-instructions"], {
			cwd: testDir,
			encoding: "utf8",
			input: " \u001b[B \n", // Space to select first, down arrow, space to select second, Enter to confirm
		});

		// Verify both files were created
		const cursorrules = await Bun.file(join(testDir, ".cursorrules")).text();
		const claude = await Bun.file(join(testDir, "CLAUDE.md")).text();

		expect(cursorrules).toContain("# === BACKLOG.MD GUIDELINES START ===");
		expect(cursorrules).toContain("# === BACKLOG.MD GUIDELINES END ===");
		expect(cursorrules).toContain("# Instructions for the usage of Backlog.md CLI Tool");

		expect(claude).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(claude).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(claude).toContain("# Instructions for the usage of Backlog.md CLI Tool");
	});
});
