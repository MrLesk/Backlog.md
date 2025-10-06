import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { registerBoardTools } from "../mcp/tools/board-tools.ts";
import type { BacklogConfig } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Board Tools", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-board-tools");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		// Create test config
		const testConfig: BacklogConfig = {
			projectName: "Test Project",
			statuses: ["To Do", "In Progress", "Done"],
			labels: ["feature", "bug"],
			milestones: ["v1.0"],
			dateFormat: "YYYY-MM-DD HH:mm",
		};
		await mcpServer.filesystem.saveConfig(testConfig);

		registerBoardTools(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("board_view tool", () => {
		it("should return empty board when no tasks exist", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: true },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = JSON.parse(result.content[0]?.text as string);
			expect(data.columns).toEqual({});
			expect(data.metadata.totalTasks).toBe(0);
			expect(data.metadata.completionRate).toBe(0);
			expect(data.metadata.projectName).toBe("Test Project");
		});

		it("should return board with tasks grouped by status", async () => {
			// Create test tasks
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "First Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task 1",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-2",
				title: "Second Task",
				status: "In Progress",
				assignee: [],
				createdDate: "2024-01-01 11:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task 2",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-3",
				title: "Completed Task",
				status: "Done",
				assignee: [],
				createdDate: "2024-01-01 12:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task 3",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: true, includeTasks: true },
				},
			});

			expect(result.content).toHaveLength(1);
			const boardData = JSON.parse(result.content[0]?.text as string);
			expect(Object.keys(boardData.columns)).toContain("To Do");
			expect(Object.keys(boardData.columns)).toContain("In Progress");
			expect(Object.keys(boardData.columns)).toContain("Done");

			expect(boardData.columns["To Do"]).toHaveLength(1);
			expect(boardData.columns["In Progress"]).toHaveLength(1);
			expect(boardData.columns.Done).toHaveLength(1);

			expect(boardData.metadata.totalTasks).toBe(3);
			expect(boardData.metadata.completionRate).toBe(33); // 1/3 tasks done
			expect(boardData.metadata.statusCounts).toEqual({
				"To Do": 1,
				"In Progress": 1,
				Done: 1,
			});
		});

		it("should work without metadata", async () => {
			// Create test task
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: false, includeTasks: true },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = JSON.parse(result.content[0]?.text as string);
			expect(data.columns).toBeDefined();
			expect(data.metadata).toBeUndefined();
		});

		it("should handle tasks with no status", async () => {
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "No Status Task",
				status: "",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task with no status",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: true, includeTasks: true },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = JSON.parse(result.content[0]?.text as string);
			expect(data.columns["No Status"]).toHaveLength(1);
		});

		it("should handle missing config", async () => {
			// Create a new server without config
			const tempServer = new McpServer(createUniqueTestDir("test-no-config"));
			registerBoardTools(tempServer);

			const result = await tempServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: true },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Configuration not found");
		});
	});

	describe("board_view pagination and filtering", () => {
		it("should default to summary mode (no task objects)", async () => {
			// Create 100 tasks
			for (let i = 0; i < 100; i++) {
				await mcpServer.filesystem.saveTask({
					id: `task-${i}`,
					title: `Task ${i}`,
					status: "To Do",
					assignee: [],
					createdDate: "2024-01-01 10:00",
					labels: [],
					dependencies: [],
					rawContent: `Test task ${i}`,
				});
			}

			const result = await mcpServer.testInterface.callTool({
				params: { name: "board_view", arguments: {} },
			});

			const data = JSON.parse(result.content[0]?.text as string);

			// Should have empty columns (no task objects)
			expect(data.columns).toEqual({});

			// Should have metadata with counts
			expect(data.metadata.totalTasks).toBe(100);
			expect(data.metadata.statusCounts["To Do"]).toBe(100);

			// Should have boardMarkdown
			expect(data.metadata.boardMarkdown).toContain("Kanban Board");
		});

		it("should include tasks when includeTasks=true", async () => {
			// Create tasks
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Task 1",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task 1",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeTasks: true },
				},
			});

			const data = JSON.parse(result.content[0]?.text as string);

			// Should include task objects
			expect(data.columns["To Do"]).toHaveLength(1);
			expect(data.columns["To Do"][0].id).toBe("task-1");
		});

		it("should respect limitPerStatus", async () => {
			// Create 100 tasks
			for (let i = 0; i < 100; i++) {
				await mcpServer.filesystem.saveTask({
					id: `task-${i}`,
					title: `Task ${i}`,
					status: "To Do",
					assignee: [],
					createdDate: "2024-01-01 10:00",
					labels: [],
					dependencies: [],
					rawContent: `Test task ${i}`,
				});
			}

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: {
						includeTasks: true,
						limitPerStatus: 10,
					},
				},
			});

			const data = JSON.parse(result.content[0]?.text as string);

			// Should only return 10 tasks
			expect(data.columns["To Do"]).toHaveLength(10);

			// Should indicate pagination
			expect(data.metadata.pagination.applied).toBe(true);
			expect(data.metadata.pagination.totalByStatus["To Do"]).toBe(100);
			expect(data.metadata.pagination.returnedByStatus["To Do"]).toBe(10);
			expect(data.metadata.pagination.hasMore["To Do"]).toBe(true);
		});

		it("should filter by status", async () => {
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Task 1",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task 1",
			});
			await mcpServer.filesystem.saveTask({
				id: "task-2",
				title: "Task 2",
				status: "In Progress",
				assignee: [],
				createdDate: "2024-01-01 11:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task 2",
			});
			await mcpServer.filesystem.saveTask({
				id: "task-3",
				title: "Task 3",
				status: "Done",
				assignee: [],
				createdDate: "2024-01-01 12:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task 3",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: {
						includeTasks: true,
						statusFilter: "In Progress",
					},
				},
			});

			const data = JSON.parse(result.content[0]?.text as string);

			// Should only return In Progress column
			expect(Object.keys(data.columns)).toEqual(["In Progress"]);
			expect(data.columns["In Progress"]).toHaveLength(1);

			// Metadata should still show total for all tasks in context
			expect(data.metadata.totalTasks).toBe(3);
		});

		it("should filter task fields", async () => {
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: ["@alice"],
				description: "Long description...",
				implementationNotes: "Long notes...",
				labels: ["bug", "urgent"],
				createdDate: "2024-01-01 10:00",
				dependencies: [],
				rawContent: "Test task",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: {
						includeTasks: true,
						taskFields: ["id", "title", "assignee"],
					},
				},
			});

			const data = JSON.parse(result.content[0]?.text as string);
			const task = data.columns["To Do"][0];

			// Should include requested fields
			expect(task.id).toBe("task-1");
			expect(task.title).toBe("Test Task");
			expect(task.status).toBe("To Do"); // Always included
			expect(task.assignee).toEqual(["@alice"]);

			// Should NOT include other fields
			expect(task.description).toBeUndefined();
			expect(task.implementationNotes).toBeUndefined();
			expect(task.labels).toBeUndefined();
		});

		it("should paginate with offsetPerStatus", async () => {
			// Create 150 tasks in "Done" status
			for (let i = 0; i < 150; i++) {
				await mcpServer.filesystem.saveTask({
					id: `task-${i}`,
					title: `Task ${i}`,
					status: "Done",
					assignee: [],
					createdDate: "2024-01-01 10:00",
					labels: [],
					dependencies: [],
					rawContent: `Test task ${i}`,
				});
			}

			// Get first page
			const page1 = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: {
						includeTasks: true,
						statusFilter: "Done",
						limitPerStatus: 50,
						offsetPerStatus: 0,
					},
				},
			});

			const data1 = JSON.parse(page1.content[0]?.text as string);
			expect(data1.columns.Done).toHaveLength(50);
			expect(data1.metadata.pagination.hasMore.Done).toBe(true);
			expect(data1.metadata.pagination.totalByStatus.Done).toBe(150);

			// Get second page
			const page2 = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: {
						includeTasks: true,
						statusFilter: "Done",
						limitPerStatus: 50,
						offsetPerStatus: 50,
					},
				},
			});

			const data2 = JSON.parse(page2.content[0]?.text as string);
			expect(data2.columns.Done).toHaveLength(50);
			expect(data2.metadata.pagination.hasMore.Done).toBe(true);

			// Get third page
			const page3 = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: {
						includeTasks: true,
						statusFilter: "Done",
						limitPerStatus: 50,
						offsetPerStatus: 100,
					},
				},
			});

			const data3 = JSON.parse(page3.content[0]?.text as string);
			expect(data3.columns.Done).toHaveLength(50);
			expect(data3.metadata.pagination.hasMore.Done).toBe(false); // Last page
		});

		it("should handle offsetPerStatus beyond available tasks", async () => {
			// Create 25 tasks
			for (let i = 0; i < 25; i++) {
				await mcpServer.filesystem.saveTask({
					id: `task-${i}`,
					title: `Task ${i}`,
					status: "To Do",
					assignee: [],
					createdDate: "2024-01-01 10:00",
					labels: [],
					dependencies: [],
					rawContent: `Test task ${i}`,
				});
			}

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: {
						includeTasks: true,
						offsetPerStatus: 100, // Beyond available tasks
					},
				},
			});

			const data = JSON.parse(result.content[0]?.text as string);

			// Should return empty columns
			expect(data.columns["To Do"]).toEqual([]);
			expect(data.metadata.pagination.hasMore["To Do"]).toBe(false);
		});

		it("should combine statusFilter and limitPerStatus", async () => {
			// Create multiple tasks in different statuses
			for (let i = 0; i < 30; i++) {
				await mcpServer.filesystem.saveTask({
					id: `task-todo-${i}`,
					title: `Todo Task ${i}`,
					status: "To Do",
					assignee: [],
					createdDate: "2024-01-01 10:00",
					labels: [],
					dependencies: [],
					rawContent: `Test task ${i}`,
				});
			}

			for (let i = 0; i < 20; i++) {
				await mcpServer.filesystem.saveTask({
					id: `task-progress-${i}`,
					title: `Progress Task ${i}`,
					status: "In Progress",
					assignee: [],
					createdDate: "2024-01-01 11:00",
					labels: [],
					dependencies: [],
					rawContent: `Test task ${i}`,
				});
			}

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: {
						includeTasks: true,
						statusFilter: "To Do",
						limitPerStatus: 10,
					},
				},
			});

			const data = JSON.parse(result.content[0]?.text as string);

			// Should only return To Do column with limit
			expect(Object.keys(data.columns)).toEqual(["To Do"]);
			expect(data.columns["To Do"]).toHaveLength(10);
			expect(data.metadata.pagination.totalByStatus["To Do"]).toBe(30);
			expect(data.metadata.pagination.hasMore["To Do"]).toBe(true);
		});

		it("should work with legacy includeMetadata only (backwards compatibility)", async () => {
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Task 1",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Test task 1",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: true, includeTasks: true },
				},
			});

			const data = JSON.parse(result.content[0]?.text as string);

			// Should work with old behavior when explicitly requested
			expect(data.columns["To Do"]).toHaveLength(1);
			expect(data.metadata).toBeDefined();
			expect(data.metadata.totalTasks).toBe(1);
		});
	});
});
