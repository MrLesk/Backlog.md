import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";

describe("--desc alias functionality", () => {
	const testDir = join(process.cwd(), "test-desc-alias");
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
		await core.initializeProject("Desc Alias Test Project");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should create task with --desc alias", () => {
		const result = spawnSync("bun", [cliPath, "task", "create", "Test --desc alias", "--desc", "Created with --desc"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Created task");
		expect(result.stdout).toContain("task-1");
	});

	it("should verify task created with --desc has correct description", async () => {
		// Create task with --desc
		spawnSync("bun", [cliPath, "task", "create", "Test task", "--desc", "Description via --desc"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Verify the task was created with correct description
		const core = new Core(testDir);
		const task = await core.filesystem.loadTask("task-1");

		expect(task).not.toBeNull();
		expect(task?.description).toContain("Description via --desc");
	});

	it("should edit task description with --desc alias", async () => {
		// Create initial task
		const core = new Core(testDir);
		await core.createTask(
			{
				id: "task-1",
				title: "Edit test task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				description: "Original description",
			},
			false,
		);

		// Edit with --desc
		const result = spawnSync("bun", [cliPath, "task", "edit", "1", "--desc", "Updated via --desc"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Updated task");

		// Verify the description was updated
		const updatedTask = await core.filesystem.loadTask("task-1");
		expect(updatedTask?.description).toContain("Updated via --desc");
	});

	it("should create draft with --desc alias", () => {
		const result = spawnSync("bun", [cliPath, "draft", "create", "Draft with --desc", "--desc", "Draft description"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Created draft");
	});

	it("should verify draft created with --desc has correct description", async () => {
		// Create draft with --desc
		spawnSync("bun", [cliPath, "draft", "create", "Test draft", "--desc", "Draft via --desc"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Verify the draft was created with correct description
		const core = new Core(testDir);
		const draft = await core.filesystem.loadDraft("task-1");

		expect(draft).not.toBeNull();
		expect(draft?.description).toContain("Draft via --desc");
	});

	it("should show --desc in help text", () => {
		const result = spawnSync("bun", [cliPath, "task", "create", "--help"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("-d, --description <text>");
		expect(result.stdout).toContain("--desc <text>");
		expect(result.stdout).toContain("alias for --description");
	});
});
