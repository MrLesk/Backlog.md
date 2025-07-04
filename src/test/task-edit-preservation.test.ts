import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";

describe("Task edit section preservation", () => {
	const testDir = join(process.cwd(), "test-task-edit-preservation");
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
		await core.initializeProject("Task Edit Preservation Test");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should preserve all sections when updating description", async () => {
		// Create a task with all sections
		const core = new Core(testDir);
		await core.createTask(
			{
				id: "task-1",
				title: "Full task test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				description: "Original description",
			},
			false,
		);

		// Add acceptance criteria
		spawnSync("bun", [cliPath, "task", "edit", "1", "--ac", "Criterion 1,Criterion 2"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Add implementation plan
		spawnSync("bun", [cliPath, "task", "edit", "1", "--plan", "Step 1\\nStep 2\\nStep 3"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Add implementation notes
		spawnSync("bun", [cliPath, "task", "edit", "1", "--notes", "Original implementation notes"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Verify all sections exist
		let result = spawnSync("bun", [cliPath, "task", "1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.stdout).toContain("Original description");
		expect(result.stdout).toContain("Criterion 1");
		expect(result.stdout).toContain("Criterion 2");
		expect(result.stdout).toContain("Step 1");
		expect(result.stdout).toContain("Step 2");
		expect(result.stdout).toContain("Step 3");
		expect(result.stdout).toContain("Original implementation notes");

		// Update just the description
		spawnSync("bun", [cliPath, "task", "edit", "1", "-d", "UPDATED description"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Verify ALL sections are preserved
		result = spawnSync("bun", [cliPath, "task", "1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.stdout).toContain("UPDATED description");
		expect(result.stdout).toContain("Criterion 1");
		expect(result.stdout).toContain("Criterion 2");
		expect(result.stdout).toContain("Step 1");
		expect(result.stdout).toContain("Step 2");
		expect(result.stdout).toContain("Step 3");
		expect(result.stdout).toContain("Original implementation notes");
	});

	it("should preserve all sections when updating acceptance criteria", async () => {
		// Create a task with all sections
		const core = new Core(testDir);
		await core.createTask(
			{
				id: "task-2",
				title: "AC update test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				description: "Test description",
			},
			false,
		);

		// Add all sections
		spawnSync("bun", [cliPath, "task", "edit", "2", "--ac", "Original criterion"], {
			cwd: testDir,
			encoding: "utf8",
		});
		spawnSync("bun", [cliPath, "task", "edit", "2", "--plan", "Original plan"], {
			cwd: testDir,
			encoding: "utf8",
		});
		spawnSync("bun", [cliPath, "task", "edit", "2", "--notes", "Original notes"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Update acceptance criteria
		spawnSync("bun", [cliPath, "task", "edit", "2", "--ac", "Updated criterion 1,Updated criterion 2"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Verify all sections are preserved
		const result = spawnSync("bun", [cliPath, "task", "2", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.stdout).toContain("Test description");
		expect(result.stdout).toContain("Updated criterion 1");
		expect(result.stdout).toContain("Updated criterion 2");
		expect(result.stdout).toContain("Original plan");
		expect(result.stdout).toContain("Original notes");
		expect(result.stdout).not.toContain("Original criterion");
	});

	it("should preserve all sections when updating implementation plan", async () => {
		// Create a task with all sections
		const core = new Core(testDir);
		await core.createTask(
			{
				id: "task-3",
				title: "Plan update test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				description: "Test description",
			},
			false,
		);

		// Add all sections
		spawnSync("bun", [cliPath, "task", "edit", "3", "--ac", "Test criterion"], {
			cwd: testDir,
			encoding: "utf8",
		});
		spawnSync("bun", [cliPath, "task", "edit", "3", "--plan", "Original plan"], {
			cwd: testDir,
			encoding: "utf8",
		});
		spawnSync("bun", [cliPath, "task", "edit", "3", "--notes", "Original notes"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Update implementation plan
		spawnSync("bun", [cliPath, "task", "edit", "3", "--plan", "Updated plan step 1\\nUpdated plan step 2"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Verify all sections are preserved
		const result = spawnSync("bun", [cliPath, "task", "3", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.stdout).toContain("Test description");
		expect(result.stdout).toContain("Test criterion");
		expect(result.stdout).toContain("Updated plan step 1");
		expect(result.stdout).toContain("Updated plan step 2");
		expect(result.stdout).toContain("Original notes");
		expect(result.stdout).not.toContain("Original plan");
	});

	it("should preserve all sections when updating implementation notes", async () => {
		// Create a task with all sections
		const core = new Core(testDir);
		await core.createTask(
			{
				id: "task-4",
				title: "Notes update test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				description: "Test description",
			},
			false,
		);

		// Add all sections
		spawnSync("bun", [cliPath, "task", "edit", "4", "--ac", "Test criterion"], {
			cwd: testDir,
			encoding: "utf8",
		});
		spawnSync("bun", [cliPath, "task", "edit", "4", "--plan", "Test plan"], {
			cwd: testDir,
			encoding: "utf8",
		});
		spawnSync("bun", [cliPath, "task", "edit", "4", "--notes", "Original notes"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Update implementation notes (should append to existing)
		spawnSync("bun", [cliPath, "task", "edit", "4", "--notes", "Additional notes"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Verify all sections are preserved and notes are appended
		const result = spawnSync("bun", [cliPath, "task", "4", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.stdout).toContain("Test description");
		expect(result.stdout).toContain("Test criterion");
		expect(result.stdout).toContain("Test plan");
		expect(result.stdout).toContain("Original notes");
		expect(result.stdout).toContain("Additional notes");
	});

	it("should handle tasks with minimal content", async () => {
		// Create a task with just description
		const core = new Core(testDir);
		await core.createTask(
			{
				id: "task-5",
				title: "Minimal task test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				description: "Minimal description",
			},
			false,
		);

		// Update description
		spawnSync("bun", [cliPath, "task", "edit", "5", "-d", "Updated minimal description"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Should have updated description and default AC text
		const result = spawnSync("bun", [cliPath, "task", "5", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.stdout).toContain("Updated minimal description");
		expect(result.stdout).toContain("No acceptance criteria defined");
	});
});
