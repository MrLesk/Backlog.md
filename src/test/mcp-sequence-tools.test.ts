import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { registerSequenceTools } from "../mcp/tools/sequence-tools.ts";
import type { BacklogConfig } from "../types/index.ts";
import { parseSequenceCreateMarkdown, parseSequencePlanMarkdown } from "./markdown-test-helpers.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Sequence Tools", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-sequence-tools");
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

		registerSequenceTools(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("sequence_create tool", () => {
		it("should return empty sequences when no tasks exist", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_create",
					arguments: {},
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequenceCreateMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.unsequenced).toEqual([]);
				expect(data.sequences).toEqual([]);
				expect(data.metadata.totalTasks).toBe(0);
				expect(data.metadata.filteredTasks).toBe(0);
			}
		});

		it("should create sequences from tasks with dependencies", async () => {
			// Create tasks with dependencies
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Foundation Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Base task",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-2",
				title: "Dependent Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 11:00",
				labels: [],
				dependencies: ["task-1"],
				rawContent: "Depends on task-1",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-3",
				title: "Final Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 12:00",
				labels: [],
				dependencies: ["task-2"],
				rawContent: "Depends on task-2",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_create",
					arguments: {},
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequenceCreateMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.sequences).toHaveLength(3); // 3 sequence levels
				expect(data.metadata.totalTasks).toBe(3);
				expect(data.metadata.sequenceCount).toBe(3);
			}
		});

		it("should exclude completed tasks by default", async () => {
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Completed Task",
				status: "Done",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "This is done",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-2",
				title: "Active Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 11:00",
				labels: [],
				dependencies: [],
				rawContent: "Active task with no dependencies",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_create",
					arguments: { includeCompleted: false },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequenceCreateMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.metadata.filteredTasks).toBe(1); // Only non-completed task
				expect(data.unsequenced).toHaveLength(1);
				expect(data.unsequenced?.[0]?.id).toBe("task-2");
			}
		});

		it("should include completed tasks when requested", async () => {
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Completed Task",
				status: "Done",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "This is done",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-2",
				title: "Active Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 11:00",
				labels: [],
				dependencies: ["task-1"],
				rawContent: "Active task",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_create",
					arguments: { includeCompleted: true },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequenceCreateMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.metadata.filteredTasks).toBe(2); // Both tasks included
				expect(data.sequences).toHaveLength(2); // 2 sequence levels
			}
		});

		it("should filter by status", async () => {
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "To Do Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Task 1",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-2",
				title: "In Progress Task",
				status: "In Progress",
				assignee: [],
				createdDate: "2024-01-01 11:00",
				labels: [],
				dependencies: [],
				rawContent: "Task 2",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_create",
					arguments: { filterStatus: "To Do" },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequenceCreateMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.metadata.filteredTasks).toBe(1);
				expect(data.unsequenced?.[0]?.id).toBe("task-1");
			}
		});

		it("should handle isolated tasks (no dependencies or dependents)", async () => {
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Isolated Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01 10:00",
				labels: [],
				dependencies: [],
				rawContent: "Standalone task",
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_create",
					arguments: {},
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequenceCreateMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.unsequenced).toHaveLength(1);
				expect(data.sequences).toHaveLength(0);
				expect(data.unsequenced?.[0]?.id).toBe("task-1");
			}
		});
	});

	describe("sequence_plan tool", () => {
		beforeEach(async () => {
			// Create a set of interdependent tasks for planning
			await mcpServer.filesystem.saveTask({
				id: "task-1",
				title: "Foundation",
				status: "To Do",
				assignee: ["alice"],
				createdDate: "2024-01-01 10:00",
				labels: ["core"],
				dependencies: [],
				rawContent: "Foundation work",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-2",
				title: "Feature A",
				status: "To Do",
				assignee: ["bob"],
				createdDate: "2024-01-01 11:00",
				labels: ["feature"],
				dependencies: ["task-1"],
				rawContent: "Feature A implementation",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-3",
				title: "Feature B",
				status: "To Do",
				assignee: ["charlie"],
				createdDate: "2024-01-01 12:00",
				labels: ["feature"],
				dependencies: ["task-1"],
				rawContent: "Feature B implementation",
			});

			await mcpServer.filesystem.saveTask({
				id: "task-4",
				title: "Integration",
				status: "To Do",
				assignee: ["alice"],
				createdDate: "2024-01-01 13:00",
				labels: ["integration"],
				dependencies: ["task-2", "task-3"],
				rawContent: "Integrate features",
			});
		});

		it("should create execution plan for all tasks", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_plan",
					arguments: {},
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequencePlanMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.phases).toHaveLength(3); // 3 phases of execution
				expect(data.summary.totalPhases).toBe(3);
				expect(data.summary.totalTasksInPlan).toBe(4);

				// First phase should have the foundation task
				expect(data.phases?.[0]?.tasks?.[0]?.id).toBe("task-1");

				// Second phase should have both features (can run in parallel)
				expect(data.phases?.[1]?.tasks).toHaveLength(2);

				// Third phase should have integration
				expect(data.phases?.[2]?.tasks?.[0]?.id).toBe("task-4");
			}
		});

		it("should create plan for specific task IDs", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_plan",
					arguments: { taskIds: ["task-1", "task-2"] },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequencePlanMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.phases).toHaveLength(2); // Foundation + Feature A
				expect(data.summary.totalTasksInPlan).toBe(2);
			}
		});

		it("should handle missing task IDs", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_plan",
					arguments: { taskIds: ["task-999", "task-1000"] },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Tasks not found");
		});

		it("should include task details in plan", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_plan",
					arguments: { taskIds: ["task-1"] },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequencePlanMarkdown(result.content[0]?.text as string);
			if (result.success) {
				// task-1 has no dependencies or dependents when selected alone, so it goes to unsequenced
				expect(data.unsequenced).toHaveLength(1);
				const task = data.unsequenced?.[0];
				expect(task?.id).toBe("task-1");
				expect(task?.title).toBe("Foundation");
				expect(task?.status).toBe("To Do");
				expect(task?.reason).toBe("No dependencies or dependents - can be done anytime");
			}
		});

		it("should handle empty task set", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "sequence_plan",
					arguments: { taskIds: [] },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = parseSequencePlanMarkdown(result.content[0]?.text as string);
			if (result.success) {
				expect(data.phases).toHaveLength(3); // All tasks since empty array means all
			}
		});
	});
});
