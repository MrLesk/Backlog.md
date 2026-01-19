import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let TEST_DIR: string;
let mcpServer: McpServer;

async function loadConfig(server: McpServer) {
	const config = await server.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load backlog configuration for tests");
	}
	return config;
}

describe("MCP final summary", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-final-summary");
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await mcpServer.initializeProject("MCP Final Summary Project");

		const config = await loadConfig(mcpServer);
		registerTaskTools(mcpServer, config);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
		} catch {
			// ignore
		}
		await safeCleanup(TEST_DIR);
	});

	it("supports finalSummary on task_create and task_view output", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Summarized task",
					finalSummary: "PR-style summary",
				},
			},
		});

		const createText = getText(createResult.content);
		expect(createText).toContain("Task TASK-1 - Summarized task");
		expect(createText).toContain("Final Summary:");
		expect(createText).toContain("PR-style summary");

		const createdTask = await mcpServer.getTask("task-1");
		expect(createdTask?.finalSummary).toBe("PR-style summary");

		const viewResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_view",
				arguments: { id: "task-1" },
			},
		});
		const viewText = getText(viewResult.content);
		expect(viewText).toContain("Final Summary:");
		expect(viewText).toContain("PR-style summary");
	});

	it("supports finalSummary set/append/clear on task_edit", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: { title: "Editable" },
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: { id: "task-1", finalSummary: "Initial" },
			},
		});

		let task = await mcpServer.getTask("task-1");
		expect(task?.finalSummary).toBe("Initial");

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: { id: "task-1", finalSummaryAppend: ["Second", "Third"] },
			},
		});

		task = await mcpServer.getTask("task-1");
		expect(task?.finalSummary).toBe("Initial\n\nSecond\n\nThird");

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: { id: "task-1", finalSummaryClear: true },
			},
		});

		task = await mcpServer.getTask("task-1");
		expect(task?.finalSummary).toBeUndefined();
	});
});
