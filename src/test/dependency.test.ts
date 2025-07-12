import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";

describe("Task Dependencies", () => {
	let tempDir: string;
	let core: Core;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "backlog-dependency-test-"));

		// Initialize git repository first using the same pattern as other tests
		await Bun.spawn(["git", "init", "-b", "main"], { cwd: tempDir }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: tempDir }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: tempDir }).exited;

		core = new Core(tempDir);
		await core.initializeProject("test-project");
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch (error) {
			console.warn(`Failed to clean up temp directory: ${error}`);
		}
	});

	test("should create task with dependencies", async () => {
		// Create base tasks first
		const task1: Task = {
			id: "task-1",
			title: "Base Task 1",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			body: "## Description\n\nBase task",
		};

		const task2: Task = {
			id: "task-2",
			title: "Base Task 2",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			body: "## Description\n\nAnother base task",
		};

		await core.createTask(task1, false);
		await core.createTask(task2, false);

		// Create task with dependencies
		const dependentTask: Task = {
			id: "task-3",
			title: "Dependent Task",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1", "task-2"],
			body: "## Description\n\nTask that depends on others",
		};

		await core.createTask(dependentTask, false);

		// Verify the task was created with dependencies
		const savedTask = await core.filesystem.loadTask("task-3");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should update task dependencies", async () => {
		// Create base tasks
		const task1: Task = {
			id: "task-1",
			title: "Base Task 1",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			body: "## Description\n\nBase task",
		};

		const task2: Task = {
			id: "task-2",
			title: "Base Task 2",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			body: "## Description\n\nAnother base task",
		};

		const task3: Task = {
			id: "task-3",
			title: "Task without dependencies",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			body: "## Description\n\nTask without dependencies initially",
		};

		await core.createTask(task1, false);
		await core.createTask(task2, false);
		await core.createTask(task3, false);

		// Update task to add dependencies
		task3.dependencies = ["task-1", "task-2"];
		await core.updateTask(task3, false);

		// Verify the dependencies were updated
		const savedTask = await core.filesystem.loadTask("task-3");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should handle tasks with dependencies in drafts", async () => {
		// Create a draft task
		const draftTask: Task = {
			id: "task-1",
			title: "Draft Task",
			status: "Draft",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			body: "## Description\n\nDraft task",
		};

		await core.createDraft(draftTask, false);

		// Create task that depends on draft
		const task2: Task = {
			id: "task-2",
			title: "Task depending on draft",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"], // Depends on draft task
			body: "## Description\n\nTask depending on draft",
		};

		await core.createTask(task2, false);

		// Verify the task was created with dependency on draft
		const savedTask = await core.filesystem.loadTask("task-2");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["task-1"]);
	});

	test("should serialize and deserialize dependencies correctly", async () => {
		const task: Task = {
			id: "task-1",
			title: "Task with multiple dependencies",
			status: "In Progress",
			assignee: ["@developer"],
			createdDate: "2024-01-01",
			labels: ["feature", "backend"],
			dependencies: ["task-2", "task-3", "task-4"],
			body: "## Description\n\nTask with various metadata and dependencies",
		};

		// Create dependency tasks first
		for (let i = 2; i <= 4; i++) {
			const depTask: Task = {
				id: `task-${i}`,
				title: `Dependency Task ${i}`,
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01",
				labels: [],
				dependencies: [],
				body: `## Description\n\nDependency task ${i}`,
			};
			await core.createTask(depTask, false);
		}

		await core.createTask(task, false);

		// Load the task back and verify all fields
		const loadedTask = await core.filesystem.loadTask("task-1");
		expect(loadedTask).not.toBeNull();
		expect(loadedTask?.id).toBe("task-1");
		expect(loadedTask?.title).toBe("Task with multiple dependencies");
		expect(loadedTask?.status).toBe("In Progress");
		expect(loadedTask?.assignee).toEqual(["@developer"]);
		expect(loadedTask?.labels).toEqual(["feature", "backend"]);
		expect(loadedTask?.dependencies).toEqual(["task-2", "task-3", "task-4"]);
	});

	test("should handle empty dependencies array", async () => {
		const task: Task = {
			id: "task-1",
			title: "Task without dependencies",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			body: "## Description\n\nTask without dependencies",
		};

		await core.createTask(task, false);

		const loadedTask = await core.filesystem.loadTask("task-1");
		expect(loadedTask).not.toBeNull();
		expect(loadedTask?.dependencies).toEqual([]);
	});
});
