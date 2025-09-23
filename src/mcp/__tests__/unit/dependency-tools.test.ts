import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { createUniqueTestDir, safeCleanup } from "../../../test/test-utils.ts";
import { McpServer } from "../../server.ts";
import { DependencyToolHandlers } from "../../tools/dependency-tools.ts";

describe("Dependency Tools", () => {
	let TEST_DIR: string;
	let server: McpServer;
	let handlers: DependencyToolHandlers;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-dependency-tools");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize server
		server = new McpServer(TEST_DIR);
		await server.initializeProject("test-project");

		// Create some test tasks
		await server.createTaskFromData({
			title: "Task 1",
			body: "First task",
		});

		await server.createTaskFromData({
			title: "Task 2",
			body: "Second task",
		});

		await server.createTaskFromData({
			title: "Task 3",
			body: "Third task",
		});

		handlers = new DependencyToolHandlers(server);
	});

	afterEach(async () => {
		try {
			await server.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("addDependencies", () => {
		test("should add valid dependencies to a task", async () => {
			const result = await handlers.addDependencies({
				id: "task-2",
				dependencies: ["task-1"],
			});

			expect(result.content[0]?.type).toBe("text");
			expect(result.content[0]?.text).toContain("Successfully added 1 dependencies");

			// Verify dependency was added
			const task = await server.fs.loadTask("task-2");
			expect(task).toBeTruthy();
			expect(task?.dependencies).toEqual(["task-1"]);
		});

		test("should add multiple dependencies", async () => {
			const result = await handlers.addDependencies({
				id: "task-3",
				dependencies: ["task-1", "task-2"],
			});

			expect(result.content[0]?.text).toContain("Successfully added 2 dependencies");

			const task = await server.fs.loadTask("task-3");
			expect(task).toBeTruthy();
			expect(task?.dependencies).toEqual(expect.arrayContaining(["task-1", "task-2"]));
		});

		test("should normalize numeric task IDs", async () => {
			const result = await handlers.addDependencies({
				id: "task-2",
				dependencies: ["1"], // Should become "task-1"
			});

			expect(result.content[0]?.text).toContain("Successfully added 1 dependencies");

			const task = await server.fs.loadTask("task-2");
			expect(task).toBeTruthy();
			expect(task?.dependencies).toEqual(["task-1"]);
		});

		test("should prevent duplicate dependencies", async () => {
			// Add initial dependency
			await handlers.addDependencies({
				id: "task-2",
				dependencies: ["task-1"],
			});

			// Try to add same dependency again
			const result = await handlers.addDependencies({
				id: "task-2",
				dependencies: ["task-1"],
			});

			expect(result.content[0]?.text).toContain("No new dependencies added");

			const task = await server.fs.loadTask("task-2");
			expect(task).toBeTruthy();
			expect(task?.dependencies).toEqual(["task-1"]);
		});

		test("should reject non-existent dependencies", async () => {
			await expect(
				handlers.addDependencies({
					id: "task-1",
					dependencies: ["task-999"],
				}),
			).rejects.toThrow("The following dependencies do not exist: task-999");
		});

		test("should reject self-referential dependencies", async () => {
			await expect(
				handlers.addDependencies({
					id: "task-1",
					dependencies: ["task-1"],
				}),
			).rejects.toThrow("Task cannot depend on itself: task-1");
		});

		test("should detect circular dependencies", async () => {
			// Create A → B dependency
			await handlers.addDependencies({
				id: "task-2",
				dependencies: ["task-1"],
			});

			// Try to create B → A dependency (circular)
			await expect(
				handlers.addDependencies({
					id: "task-1",
					dependencies: ["task-2"],
				}),
			).rejects.toThrow("Circular dependency detected");
		});

		test("should detect multi-level circular dependencies", async () => {
			// Create A → B → C chain
			await handlers.addDependencies({
				id: "task-2",
				dependencies: ["task-1"],
			});

			await handlers.addDependencies({
				id: "task-3",
				dependencies: ["task-2"],
			});

			// Try to create C → A dependency (circular)
			await expect(
				handlers.addDependencies({
					id: "task-1",
					dependencies: ["task-3"],
				}),
			).rejects.toThrow("Circular dependency detected");
		});
	});

	describe("removeDependencies", () => {
		beforeEach(async () => {
			// Set up some dependencies
			await handlers.addDependencies({
				id: "task-3",
				dependencies: ["task-1", "task-2"],
			});
		});

		test("should remove single dependency", async () => {
			const result = await handlers.removeDependencies({
				id: "task-3",
				dependencies: ["task-1"],
			});

			expect(result.content[0]?.text).toContain("Successfully removed 1 dependencies");

			const task = await server.fs.loadTask("task-3");
			expect(task).toBeTruthy();
			expect(task?.dependencies).toEqual(["task-2"]);
		});

		test("should remove multiple dependencies", async () => {
			const result = await handlers.removeDependencies({
				id: "task-3",
				dependencies: ["task-1", "task-2"],
			});

			expect(result.content[0]?.text).toContain("Successfully removed 2 dependencies");

			const task = await server.fs.loadTask("task-3");
			expect(task).toBeTruthy();
			expect(task?.dependencies).toEqual([]);
		});

		test("should handle removing non-existent dependency", async () => {
			const result = await handlers.removeDependencies({
				id: "task-3",
				dependencies: ["task-999"],
			});

			expect(result.content[0]?.text).toContain("No dependencies removed");

			const task = await server.fs.loadTask("task-3");
			expect(task).toBeTruthy();
			expect(task?.dependencies).toEqual(expect.arrayContaining(["task-1", "task-2"]));
		});
	});

	describe("listDependencies", () => {
		beforeEach(async () => {
			await handlers.addDependencies({
				id: "task-3",
				dependencies: ["task-1", "task-2"],
			});
		});

		test("should list dependencies without status", async () => {
			const result = await handlers.listDependencies({
				id: "task-3",
				includeStatus: false,
			});

			expect(result.content[0]?.text).toContain("Task task-3 has 2 dependencies");
			expect(result.content[0]?.text).toContain("task-1");
			expect(result.content[0]?.text).toContain("task-2");
		});

		test("should list dependencies with status", async () => {
			const result = await handlers.listDependencies({
				id: "task-3",
				includeStatus: true,
			});

			expect(result.content[0]?.text).toContain("Task task-3 has 2 dependencies");
			expect(result.content[0]?.text).toContain("task-1 (");
			expect(result.content[0]?.text).toContain("task-2 (");
		});

		test("should handle task with no dependencies", async () => {
			const result = await handlers.listDependencies({
				id: "task-1",
			});

			expect(result.content[0]?.text).toContain("Task task-1 has no dependencies");
		});
	});

	describe("validateDependencyGraph", () => {
		test("should validate valid dependencies", async () => {
			const result = await handlers.validateDependencyGraph({
				id: "task-2",
				proposedDependencies: ["task-1"],
			});

			expect(result.content[0]?.text).toContain("✅ All dependencies exist");
			expect(result.content[0]?.text).toContain("✅ No self-reference");
			expect(result.content[0]?.text).toContain("✅ No circular dependencies");
			expect(result.content[0]?.text).toContain("✅ Overall validation: PASSED");
		});

		test("should detect invalid dependencies", async () => {
			const result = await handlers.validateDependencyGraph({
				id: "task-2",
				proposedDependencies: ["task-999"],
			});

			expect(result.content[0]?.text).toContain("❌ Invalid dependencies");
			expect(result.content[0]?.text).toContain("task-999");
			expect(result.content[0]?.text).toContain("❌ Overall validation: FAILED");
		});

		test("should detect self-reference", async () => {
			const result = await handlers.validateDependencyGraph({
				id: "task-2",
				proposedDependencies: ["task-2"],
			});

			expect(result.content[0]?.text).toContain("❌ Self-reference detected");
			expect(result.content[0]?.text).toContain("❌ Overall validation: FAILED");
		});

		test("should detect circular dependencies", async () => {
			// Set up circular dependency scenario
			await handlers.addDependencies({
				id: "task-2",
				dependencies: ["task-1"],
			});

			const result = await handlers.validateDependencyGraph({
				id: "task-1",
				proposedDependencies: ["task-2"],
			});

			expect(result.content[0]?.text).toContain("❌ Circular dependency detected");
			expect(result.content[0]?.text).toContain("❌ Overall validation: FAILED");
		});

		test("should validate existing dependencies when no proposals given", async () => {
			await handlers.addDependencies({
				id: "task-2",
				dependencies: ["task-1"],
			});

			const result = await handlers.validateDependencyGraph({
				id: "task-2",
			});

			expect(result.content[0]?.text).toContain("✅ All dependencies exist");
			expect(result.content[0]?.text).toContain("✅ Overall validation: PASSED");
		});
	});

	describe("edge cases", () => {
		test("should handle task not found", async () => {
			await expect(
				handlers.addDependencies({
					id: "task-999",
					dependencies: ["task-1"],
				}),
			).rejects.toThrow("Task not found: task-999");
		});

		test("should handle comma-separated dependencies", async () => {
			const result = await handlers.addDependencies({
				id: "task-3",
				dependencies: ["task-1,task-2"],
			});

			expect(result.content[0]?.text).toContain("Successfully added 2 dependencies");

			const task = await server.fs.loadTask("task-3");
			expect(task).toBeTruthy();
			expect(task?.dependencies).toEqual(expect.arrayContaining(["task-1", "task-2"]));
		});

		test("should handle empty dependency array", async () => {
			const result = await handlers.addDependencies({
				id: "task-1",
				dependencies: [],
			});

			expect(result.content[0]?.text).toContain("No new dependencies added");
		});
	});

	describe("integration with sequences", () => {
		test("should maintain compatibility with sequence computation", async () => {
			// Create a dependency chain: task-3 → task-2 → task-1
			await handlers.addDependencies({
				id: "task-2",
				dependencies: ["task-1"],
			});

			await handlers.addDependencies({
				id: "task-3",
				dependencies: ["task-2"],
			});

			// Verify sequence computation works
			const result = await server.listActiveSequences();
			expect(result.sequences.length).toBeGreaterThan(0);

			// Verify tasks are in correct sequence order
			const task1Found = result.sequences.some((seq) => seq.tasks.some((t) => t.id === "task-1"));
			const task3Found = result.sequences.some((seq) => seq.tasks.some((t) => t.id === "task-3"));

			expect(task1Found).toBe(true);
			expect(task3Found).toBe(true);
		});
	});
});
