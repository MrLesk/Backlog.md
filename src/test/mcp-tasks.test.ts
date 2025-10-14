import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let mcpServer: McpServer;

async function loadConfig(server: McpServer) {
	const config = await server.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load backlog configuration for tests");
	}
	return config;
}

describe("MCP task tools (MVP)", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-tasks");
		mcpServer = new McpServer(TEST_DIR);
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

	it("creates and lists tasks", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Agent onboarding checklist",
					description: "Steps to onboard a new AI agent",
					labels: ["agents", "workflow"],
					priority: "high",
					acceptanceCriteria: ["Credentials provisioned", "Documentation shared"],
				},
			},
		});

		expect(createResult.content?.[0]?.text).toContain("Task task-1 - Agent onboarding checklist");

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { search: "onboarding" } },
		});

		const listText = (listResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
		expect(listText).toContain("To Do:");
		expect(listText).toContain("[HIGH] task-1 - Agent onboarding checklist");
		expect(listText).not.toContain("Implementation Plan:");
		expect(listText).not.toContain("Acceptance Criteria:");

		const searchResult = await mcpServer.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "agent" } },
		});

		const searchText = searchResult.content?.[0]?.text ?? "";
		expect(searchText).toContain("Tasks:");
		expect(searchText).toContain("task-1 - Agent onboarding checklist");
		expect(searchText).toContain("(To Do)");
		expect(searchText).not.toContain("Implementation Plan:");
	});

	it("edits tasks including plan, notes, dependencies, and acceptance criteria", async () => {
		// Seed primary task
		const seedTask = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Refine MCP documentation",
					status: "To Do",
				},
			},
		});

		expect(seedTask.content?.[0]?.text).toContain("Task task-1 - Refine MCP documentation");

		// Create dependency task
		const dependencyTask = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Placeholder dependency",
				},
			},
		});

		expect(dependencyTask.content?.[0]?.text).toContain("Task task-2 - Placeholder dependency");

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					status: "In Progress",
					labels: ["docs"],
					assignee: ["technical-writer"],
					dependencies: ["task-2"],
					planSet: "1. Audit existing content\n2. Remove non-MVP sections",
					notesAppend: ["Ensure CLI examples mirror MCP usage"],
					acceptanceCriteriaSet: ["Plan documented"],
					acceptanceCriteriaAdd: ["Agents can follow instructions end-to-end"],
				},
			},
		});

		const editText = editResult.content?.[0]?.text ?? "";
		expect(editText).toContain("Status: ◒ In Progress");
		expect(editText).toContain("Labels: docs");
		expect(editText).toContain("Dependencies: task-2");
		expect(editText).toContain("Implementation Plan:");
		expect(editText).toContain("Implementation Notes:");
		expect(editText).toContain("#1 Plan documented");
		expect(editText).toContain("#2 Agents can follow instructions end-to-end");

		// Uncheck criteria via task_edit
		const criteriaUpdate = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					acceptanceCriteriaCheck: [1],
					acceptanceCriteriaUncheck: [2],
				},
			},
		});

		const criteriaText = criteriaUpdate.content?.[0]?.text ?? "";
		expect(criteriaText).toContain("- [x] #1 Plan documented");
		expect(criteriaText).toContain("- [ ] #2 Agents can follow instructions end-to-end");
	});
});
