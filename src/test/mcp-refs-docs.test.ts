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

describe("MCP task references and documentation", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-refs-docs");
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await mcpServer.initializeProject("Test Project");

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

	describe("task_create with references", () => {
		it("creates task with references", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Feature with refs",
						references: ["https://github.com/issue/123", "src/api.ts"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("Task TASK-1 - Feature with refs");
			expect(text).toContain("References: https://github.com/issue/123, src/api.ts");
		});

		it("creates task without references", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Feature without refs",
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("Task TASK-1 - Feature without refs");
			expect(text).not.toContain("References:");
		});
	});

	describe("task_create with documentation", () => {
		it("creates task with documentation", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Feature with docs",
						documentation: ["https://design-docs.example.com", "docs/spec.md"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("Task TASK-1 - Feature with docs");
			expect(text).toContain("Documentation: https://design-docs.example.com, docs/spec.md");
		});

		it("creates task without documentation", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Feature without docs",
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("Task TASK-1 - Feature without docs");
			expect(text).not.toContain("Documentation:");
		});
	});

	describe("task_create with both references and documentation", () => {
		it("creates task with both fields", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Feature with both",
						references: ["https://github.com/issue/123"],
						documentation: ["https://design-docs.example.com"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("Task TASK-1 - Feature with both");
			expect(text).toContain("References: https://github.com/issue/123");
			expect(text).toContain("Documentation: https://design-docs.example.com");
		});
	});

	describe("task_edit with references", () => {
		it("sets references on existing task", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: { title: "Task to edit" },
				},
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_edit",
					arguments: {
						id: "task-1",
						references: ["https://example.com", "file.ts"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("References: https://example.com, file.ts");
		});

		it("adds references to existing task", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Task with refs",
						references: ["file1.ts"],
					},
				},
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_edit",
					arguments: {
						id: "task-1",
						addReferences: ["file2.ts", "file3.ts"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("References: file1.ts, file2.ts, file3.ts");
		});

		it("removes references from existing task", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Task with refs",
						references: ["file1.ts", "file2.ts", "file3.ts"],
					},
				},
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_edit",
					arguments: {
						id: "task-1",
						removeReferences: ["file2.ts"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("References: file1.ts, file3.ts");
			expect(text).not.toContain("file2.ts");
		});
	});

	describe("task_edit with documentation", () => {
		it("sets documentation on existing task", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: { title: "Task to edit" },
				},
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_edit",
					arguments: {
						id: "task-1",
						documentation: ["https://docs.example.com", "README.md"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("Documentation: https://docs.example.com, README.md");
		});

		it("adds documentation to existing task", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Task with docs",
						documentation: ["doc1.md"],
					},
				},
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_edit",
					arguments: {
						id: "task-1",
						addDocumentation: ["doc2.md", "doc3.md"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("Documentation: doc1.md, doc2.md, doc3.md");
		});

		it("removes documentation from existing task", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Task with docs",
						documentation: ["doc1.md", "doc2.md", "doc3.md"],
					},
				},
			});

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_edit",
					arguments: {
						id: "task-1",
						removeDocumentation: ["doc2.md"],
					},
				},
			});

			const text = getText(result.content);
			expect(text).toContain("Documentation: doc1.md, doc3.md");
			expect(text).not.toContain("doc2.md");
		});
	});

	describe("persistence verification", () => {
		it("persists references and documentation in task", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Persistent task",
						references: ["ref1.ts", "ref2.ts"],
						documentation: ["doc1.md", "doc2.md"],
					},
				},
			});

			// Reload task to verify persistence
			const task = await mcpServer.getTask("task-1");
			expect(task?.references).toEqual(["ref1.ts", "ref2.ts"]);
			expect(task?.documentation).toEqual(["doc1.md", "doc2.md"]);
		});
	});
});
