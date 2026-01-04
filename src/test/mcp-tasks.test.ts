import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { DEFAULT_STATUSES } from "../constants/index.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { JsonSchema } from "../mcp/validation/validators.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

// Helper to extract text from MCP content (handles union types)
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

describe("MCP task tools (MVP)", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-tasks");
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

		expect(getText(createResult.content)).toContain("Task TASK-1 - Agent onboarding checklist");

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { search: "onboarding" } },
		});

		const listText = (listResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
		expect(listText).toContain("To Do:");
		expect(listText).toContain("[HIGH] TASK-1 - Agent onboarding checklist");
		expect(listText).not.toContain("Implementation Plan:");
		expect(listText).not.toContain("Acceptance Criteria:");

		const searchResult = await mcpServer.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "agent" } },
		});

		const searchText = getText(searchResult.content);
		expect(searchText).toContain("Tasks:");
		expect(searchText).toContain("TASK-1 - Agent onboarding checklist");
		expect(searchText).toContain("(To Do)");
		expect(searchText).not.toContain("Implementation Plan:");
	});

	it("exposes status enums and defaults from configuration", async () => {
		const config = await loadConfig(mcpServer);
		const expectedStatuses =
			config.statuses && config.statuses.length > 0 ? [...config.statuses] : Array.from(DEFAULT_STATUSES);
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));

		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		const createStatusSchema = createSchema?.properties?.status;
		const editStatusSchema = editSchema?.properties?.status;

		expect(createStatusSchema?.enum).toEqual(expectedStatuses);
		expect(createStatusSchema?.default).toBe(expectedStatuses[0] ?? DEFAULT_STATUSES[0]);
		expect(createStatusSchema?.enumCaseInsensitive).toBe(true);
		expect(createStatusSchema?.enumNormalizeWhitespace).toBe(true);

		expect(editStatusSchema?.enum).toEqual(expectedStatuses);
		expect(editStatusSchema?.default).toBe(expectedStatuses[0] ?? DEFAULT_STATUSES[0]);
		expect(editStatusSchema?.enumCaseInsensitive).toBe(true);
		expect(editStatusSchema?.enumNormalizeWhitespace).toBe(true);
	});

	it("allows case-insensitive and whitespace-normalized status values", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Status normalization",
					status: "done",
				},
			},
		});

		const createText = getText(createResult.content);
		expect(createText).toContain("Task TASK-1 - Status normalization");

		const createdTask = await mcpServer.getTask("task-1");
		expect(createdTask?.status).toBe("Done");

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					status: "inprogress",
				},
			},
		});

		const editText = getText(editResult.content);
		expect(editText).toContain("Task TASK-1 - Status normalization");

		const updatedTask = await mcpServer.getTask("task-1");
		expect(updatedTask?.status).toBe("In Progress");
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

		expect(getText(seedTask.content)).toContain("Task TASK-1 - Refine MCP documentation");

		// Create dependency task
		const dependencyTask = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Placeholder dependency",
				},
			},
		});

		expect(getText(dependencyTask.content)).toContain("Task TASK-2 - Placeholder dependency");

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

		const editText = getText(editResult.content);
		expect(editText).toContain("Status: ◒ In Progress");
		expect(editText).toContain("Labels: docs");
		expect(editText).toContain("Dependencies: TASK-2");
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

		const criteriaText = getText(criteriaUpdate.content);
		expect(criteriaText).toContain("- [x] #1 Plan documented");
		expect(criteriaText).toContain("- [ ] #2 Agents can follow instructions end-to-end");
	});
});
