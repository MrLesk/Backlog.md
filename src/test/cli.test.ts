import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Core, isGitRepository } from "../index.ts";

const TEST_DIR = join(process.cwd(), "test-cli");

describe("CLI Integration", () => {
	beforeEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("backlog init command", () => {
		it("should initialize backlog project in existing git repo", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			// Initialize backlog project using Core (simulating CLI)
			const core = new Core(TEST_DIR);
			await core.initializeProject("CLI Test Project");

			// Verify directory structure was created
			const configExists = await Bun.file(join(TEST_DIR, ".backlog", "config.yml")).exists();
			expect(configExists).toBe(true);

			// Verify config content
			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("CLI Test Project");
			expect(config?.statuses).toEqual(["Draft", "To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("Draft");

			// Verify git commit was created
			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("Initialize backlog project: CLI Test Project");
		});

		it("should create all required directories", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("Directory Test");

			// Check all expected directories exist
			const expectedDirs = [
				".backlog",
				".backlog/tasks",
				".backlog/drafts",
				".backlog/archive",
				".backlog/archive/tasks",
				".backlog/archive/drafts",
				".backlog/docs",
				".backlog/decisions",
			];

			for (const dir of expectedDirs) {
				try {
					const stats = await stat(join(TEST_DIR, dir));
					expect(stats.isDirectory()).toBe(true);
				} catch {
					// If stat fails, directory doesn't exist
					expect(false).toBe(true);
				}
			}
		});

		it("should handle project names with special characters", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			const specialProjectName = "My-Project_2024 (v1.0)";
			await core.initializeProject(specialProjectName);

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe(specialProjectName);
		});

		it("should work when git repo exists", async () => {
			// Set up existing git repo
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const isRepo = await isGitRepository(TEST_DIR);
			expect(isRepo).toBe(true);

			const core = new Core(TEST_DIR);
			await core.initializeProject("Existing Repo Test");

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Existing Repo Test");
		});
	});

	describe("git integration", () => {
		beforeEach(async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;
		});

		it("should create initial commit with backlog structure", async () => {
			const core = new Core(TEST_DIR);
			await core.initializeProject("Git Integration Test");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toBe("backlog: Initialize backlog project: Git Integration Test");

			// Verify git status is clean after initialization
			const isClean = await core.gitOps.isClean();
			expect(isClean).toBe(true);
		});
	});
});
