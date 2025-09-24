import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createUniqueTestDir, safeCleanup } from "../../../test/test-utils.ts";
import type { BacklogConfig } from "../../../types/index.ts";
import { McpServer } from "../../server.ts";
import { registerBoardTools } from "../../tools/board-tools.ts";

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
				body: "Test task 1",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-2",
				title: "Second Task",
				status: "In Progress",
				assignee: [],
				createdDate: "2024-01-01 11:00",
				labels: [],
				dependencies: [],
				body: "Test task 2",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-3",
				title: "Completed Task",
				status: "Done",
				assignee: [],
				createdDate: "2024-01-01 12:00",
				labels: [],
				dependencies: [],
				body: "Test task 3",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: true },
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
				body: "Test task",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: false },
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
				body: "Test task with no status",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "board_view",
					arguments: { includeMetadata: true },
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
});
