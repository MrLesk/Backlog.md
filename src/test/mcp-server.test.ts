import { afterEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import {
	MCP_TASK_CREATION_GUIDE,
	MCP_TASK_EXECUTION_GUIDE,
	MCP_TASK_FINALIZATION_GUIDE,
	MCP_WORKFLOW_OVERVIEW,
	MCP_WORKFLOW_OVERVIEW_TOOLS,
} from "../guidelines/mcp/index.ts";
import { registerWorkflowResources } from "../mcp/resources/workflow/index.ts";
import { createMcpServer, McpServer } from "../mcp/server.ts";
import { registerDefinitionOfDoneTools } from "../mcp/tools/definition-of-done/index.ts";
import { registerTaskTools, taskListSchema } from "../mcp/tools/tasks/index.ts";
import { registerWorkflowTools } from "../mcp/tools/workflow/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

// Helpers to extract text from MCP responses (handles union types)
const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};
const getContentsText = (contents: unknown[] | undefined, index = 0): string => {
	const item = contents?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let TEST_DIR: string;

async function bootstrapServer(): Promise<McpServer> {
	TEST_DIR = createUniqueTestDir("mcp-server");
	// Use normal mode instructions for bootstrapped test server
	const server = new McpServer(TEST_DIR, "Test instructions");

	await server.filesystem.ensureBacklogStructure();
	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

	await initializeTestProject(server, "Test Project");

	// Register workflow resources and tools manually (normally done in createMcpServer)
	registerWorkflowResources(server);
	registerWorkflowTools(server);

	return server;
}

describe("McpServer bootstrap", () => {
	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("exposes core capabilities before registration", async () => {
		const server = await bootstrapServer();

		const tools = await server.testInterface.listTools();
		expect(tools.tools.map((tool) => tool.name)).toEqual(["get_backlog_instructions"]);
		expect(tools.tools[0]?.inputSchema).toEqual({
			type: "object",
			properties: {
				instruction: {
					type: "string",
					enum: ["overview", "task-creation", "task-execution", "task-finalization"],
				},
			},
			required: [],
			additionalProperties: false,
		});

		const resources = await server.testInterface.listResources();
		expect(resources.resources.map((r) => r.uri)).toEqual([
			"backlog://workflow/overview",
			"backlog://workflow/task-creation",
			"backlog://workflow/task-execution",
			"backlog://workflow/task-finalization",
		]);

		const prompts = await server.testInterface.listPrompts();
		expect(prompts.prompts).toEqual([]);

		const resourceTemplates = await server.testInterface.listResourceTemplates();
		expect(resourceTemplates.resourceTemplates).toEqual([]);

		await server.stop();
	});

	it("workflow overview resource returns correct content", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://workflow/overview" },
		});

		expect(result.contents).toHaveLength(1);
		expect(getContentsText(result.contents)).toBe(MCP_WORKFLOW_OVERVIEW);
		expect(result.contents[0]?.mimeType).toBe("text/markdown");

		await server.stop();
	});

	it("workflow overview documents task_list schema filters", () => {
		const taskListLine = MCP_WORKFLOW_OVERVIEW.split("\n").find((line) => line.startsWith("- `task_list`"));
		expect(taskListLine).toBeDefined();

		for (const filter of Object.keys(taskListSchema.properties ?? {})) {
			expect(taskListLine).toContain(filter);
		}
	});

	it("task creation guide resource returns correct content", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://workflow/task-creation" },
		});

		expect(result.contents).toHaveLength(1);
		expect(getContentsText(result.contents)).toBe(MCP_TASK_CREATION_GUIDE);
		expect(getContentsText(result.contents)).toContain(
			"If you will continue from task creation into implementation in the same session, stop and read `backlog://workflow/task-execution` before viewing, assigning, planning, editing, or implementing a task.",
		);

		await server.stop();
	});

	it("task execution guide resource returns correct content", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://workflow/task-execution" },
		});

		expect(result.contents).toHaveLength(1);
		expect(getContentsText(result.contents)).toBe(MCP_TASK_EXECUTION_GUIDE);

		await server.stop();
	});

	it("task finalization guide resource returns correct content", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://workflow/task-finalization" },
		});

		expect(result.contents).toHaveLength(1);
		expect(getContentsText(result.contents)).toBe(MCP_TASK_FINALIZATION_GUIDE);

		await server.stop();
	});

	it("workflow guides require objective evidence before finalizing acceptance criteria", () => {
		TEST_DIR = createUniqueTestDir("mcp-server-guides");

		expect(MCP_TASK_EXECUTION_GUIDE).toContain(
			"Do not check acceptance criteria, write the final summary, or move the task to Done from this guide alone",
		);
		expect(MCP_TASK_EXECUTION_GUIDE).toContain("verify each acceptance criterion with objective evidence");
		expect(MCP_TASK_FINALIZATION_GUIDE).toContain("Run objective verification before checking acceptance criteria");
		expect(MCP_TASK_FINALIZATION_GUIDE).toContain(
			"For UI or interactive work, exercise the behavior through a browser, DOM script, test runner, or documented manual interaction result.",
		);
		expect(MCP_TASK_FINALIZATION_GUIDE).toContain(
			"Do not check acceptance criteria from code presence, grep output, or implementation intent alone.",
		);
	});

	it("task creation guide keeps parent task IDs distinct from milestone IDs", () => {
		TEST_DIR = createUniqueTestDir("mcp-server-guides");

		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"Use `parentTaskId` only with an existing task ID returned by `task_create`, `task_list`, or `task_view`.",
		);
		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"Do not pass milestone IDs such as `m-0` as `parentTaskId`; assign a task to a milestone with the `milestone` field.",
		);
	});

	it("task creation guide shapes work by kind and restrains invented acceptance criteria", () => {
		TEST_DIR = createUniqueTestDir("mcp-server-guides");

		expect(MCP_TASK_CREATION_GUIDE).toContain("**Shape by work kind**");
		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"Do not force a feature-shaped work order onto a bug report or friction capture.",
		);
		expect(MCP_TASK_CREATION_GUIDE).toContain("legitimate, observable success condition a stakeholder would accept");
		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"Do not invent nice-to-haves, speculative edges, tests, docs, or follow-on work unless the user, product decision, or existing task scope requires them.",
		);
		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"Inventing acceptance criteria the user or product did not need in order to look thorough",
		);
		expect(MCP_TASK_CREATION_GUIDE).toContain("Empty criteria beat invented ones.");
	});

	it("legacy MCP guides preserve just-in-time planning parity with the canonical CLI lifecycle", () => {
		TEST_DIR = createUniqueTestDir("mcp-server-guides");

		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"Do not add implementation research, an implementation plan, or a speculative code approach during creation.",
		);
		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"creation records only durable intent, context, scope, acceptance criteria, references, and dependencies",
		);
		expect(MCP_TASK_CREATION_GUIDE).toContain("CLI instructions");
		expect(MCP_TASK_CREATION_GUIDE).toContain("canonical workflow");
		expect(MCP_TASK_CREATION_GUIDE).toContain("### Durable Context at Creation");
		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"Do not inspect implementation code or tests, or perform external implementation research",
		);
		expect(MCP_TASK_CREATION_GUIDE).toContain(
			"The execution worker performs current-system research after the task is active and records the plan then",
		);
		expect(MCP_TASK_CREATION_GUIDE).toContain("already-started work created directly in an active status");
		expect(MCP_TASK_CREATION_GUIDE).not.toContain("Inspect relevant code/docs/tests in the repository");
		expect(MCP_TASK_CREATION_GUIDE).not.toContain("so your plan reflects current reality");
		expect(MCP_TASK_EXECUTION_GUIDE).toContain("_after_ taking the task into progress");
		expect(MCP_TASK_EXECUTION_GUIDE).toContain("researching the current system, but before implementation");
		expect(MCP_TASK_EXECUTION_GUIDE).toContain(
			"If the plan contains a material product, architecture, or workflow decision",
		);
		expect(MCP_TASK_EXECUTION_GUIDE).toContain("Routine plans can proceed when no review was requested");
		expect(MCP_TASK_EXECUTION_GUIDE).toContain(
			"Update routine plan adjustments in the task and continue without mandatory human confirmation",
		);
		expect(MCP_TASK_EXECUTION_GUIDE).not.toContain(
			"Do not touch the codebase until the implementation plan is approved _and_ recorded",
		);
		expect(MCP_TASK_EXECUTION_GUIDE).not.toContain("update it first and get confirmation before continuing");
		expect(MCP_TASK_EXECUTION_GUIDE).not.toContain("then get user approval for the revised approach");
		expect(MCP_TASK_EXECUTION_GUIDE).not.toContain("explain why and wait for confirmation");

		const viewIndex = MCP_TASK_EXECUTION_GUIDE.indexOf("Use `task_view` to inspect");
		const eligibilityIndex = MCP_TASK_EXECUTION_GUIDE.indexOf("Confirm eligibility and scope");
		const activateIndex = MCP_TASK_EXECUTION_GUIDE.indexOf("Mark task as In Progress");
		const researchIndex = MCP_TASK_EXECUTION_GUIDE.indexOf("Research the current system");
		const planIndex = MCP_TASK_EXECUTION_GUIDE.indexOf("Draft and record the implementation plan");
		const conditionalReviewIndex = MCP_TASK_EXECUTION_GUIDE.indexOf("Apply proportional review");
		const implementIndex = MCP_TASK_EXECUTION_GUIDE.indexOf("### Execution Workflow");
		expect(viewIndex).toBeGreaterThan(-1);
		expect(eligibilityIndex).toBeGreaterThan(viewIndex);
		expect(activateIndex).toBeGreaterThan(eligibilityIndex);
		expect(researchIndex).toBeGreaterThan(activateIndex);
		expect(planIndex).toBeGreaterThan(researchIndex);
		expect(conditionalReviewIndex).toBeGreaterThan(planIndex);
		expect(implementIndex).toBeGreaterThan(conditionalReviewIndex);
	});

	it("workflow tool returns overview by default and selected guide content when requested", async () => {
		const server = await bootstrapServer();

		const overview = await server.testInterface.callTool({
			params: { name: "get_backlog_instructions", arguments: {} },
		});
		expect(getText(overview.content)).toBe(MCP_WORKFLOW_OVERVIEW_TOOLS);

		const creation = await server.testInterface.callTool({
			params: { name: "get_backlog_instructions", arguments: { instruction: "task-creation" } },
		});
		expect(getText(creation.content)).toBe(MCP_TASK_CREATION_GUIDE);

		await server.stop();
	});

	it("registers task tools via helpers", async () => {
		const server = await bootstrapServer();
		const config = await server.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load config");
		}

		registerTaskTools(server, config);
		registerDefinitionOfDoneTools(server);

		const tools = await server.testInterface.listTools();
		const toolNames = tools.tools.map((tool) => tool.name).sort();
		expect(toolNames).toEqual([
			"definition_of_done_defaults_get",
			"definition_of_done_defaults_upsert",
			"get_backlog_instructions",
			"task_archive",
			"task_complete",
			"task_create",
			"task_edit",
			"task_list",
			"task_search",
			"task_view",
		]);

		const resources = await server.testInterface.listResources();
		expect(resources.resources.map((r) => r.uri)).toEqual([
			"backlog://workflow/overview",
			"backlog://workflow/task-creation",
			"backlog://workflow/task-execution",
			"backlog://workflow/task-finalization",
		]);
		expect(MCP_WORKFLOW_OVERVIEW).toContain("## Backlog.md Overview (MCP)");

		const resourceTemplates = await server.testInterface.listResourceTemplates();
		expect(resourceTemplates.resourceTemplates).toEqual([]);

		await server.stop();
	});

	it("createMcpServer wires stdio-ready instance", async () => {
		TEST_DIR = createUniqueTestDir("mcp-server-factory");

		const bootstrap = new McpServer(TEST_DIR, "Bootstrap instructions");
		await bootstrap.filesystem.ensureBacklogStructure();
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await initializeTestProject(bootstrap, "Factory Project");
		await bootstrap.stop();

		const server = await createMcpServer(TEST_DIR);

		const tools = await server.testInterface.listTools();
		expect(tools.tools.map((tool) => tool.name)).toEqual([
			"get_backlog_instructions",
			"task_create",
			"task_list",
			"task_search",
			"task_edit",
			"task_view",
			"task_archive",
			"task_complete",
			"milestone_list",
			"milestone_add",
			"milestone_rename",
			"milestone_remove",
			"milestone_archive",
			"definition_of_done_defaults_get",
			"definition_of_done_defaults_upsert",
			"document_list",
			"document_view",
			"document_create",
			"document_update",
			"document_search",
		]);

		const resources = await server.testInterface.listResources();
		expect(resources.resources.map((r) => r.uri)).toEqual([
			"backlog://workflow/overview",
			"backlog://workflow/task-creation",
			"backlog://workflow/task-execution",
			"backlog://workflow/task-finalization",
		]);
		expect(MCP_WORKFLOW_OVERVIEW).toContain("## Backlog.md Overview (MCP)");

		const resourceTemplates = await server.testInterface.listResourceTemplates();
		expect(resourceTemplates.resourceTemplates).toEqual([]);

		await server.connect();
		await server.start();
		await server.stop();
		await safeCleanup(TEST_DIR);
	});
});
