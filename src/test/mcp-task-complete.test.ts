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
let server: McpServer;

async function loadConfigOrThrow(mcpServer: McpServer) {
	const config = await mcpServer.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load config");
	}
	return config;
}

describe("MCP task_complete", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-task-complete");
		server = new McpServer(TEST_DIR, "Test instructions");
		await server.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await server.initializeProject("Test Project");

		const config = await loadConfigOrThrow(server);
		registerTaskTools(server, config);
	});

	afterEach(async () => {
		try {
			await server.stop();
		} catch {
			// ignore
		}
		await safeCleanup(TEST_DIR);
	});

	it("moves Done tasks to the completed folder", async () => {
		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Done task",
					status: "Done",
				},
			},
		});

		const archiveAttempt = await server.testInterface.callTool({
			params: {
				name: "task_archive",
				arguments: { id: "task-1" },
			},
		});
		expect(archiveAttempt.isError).toBe(true);
		expect(getText(archiveAttempt.content)).toContain("task_complete");

		const complete = await server.testInterface.callTool({
			params: {
				name: "task_complete",
				arguments: { id: "task-1" },
			},
		});
		expect(complete.isError).toBeUndefined();
		expect(getText(complete.content)).toContain("Completed task TASK-1");

		const activeTask = await server.filesystem.loadTask("task-1");
		expect(activeTask).toBeNull();

		const completedFiles = await Array.fromAsync(
			new Bun.Glob("task-1*.md").scan({ cwd: server.filesystem.completedDir, followSymlinks: true }),
		);
		expect(completedFiles.length).toBe(1);
	});

	it("refuses to complete tasks that are not Done", async () => {
		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Not done task",
					status: "To Do",
				},
			},
		});

		const complete = await server.testInterface.callTool({
			params: {
				name: "task_complete",
				arguments: { id: "task-1" },
			},
		});
		expect(complete.isError).toBe(true);
		expect(getText(complete.content)).toContain("not Done");
	});
});
