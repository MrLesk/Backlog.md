import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { DEFAULT_STATUSES, DEFAULT_TASK_TYPES } from "../constants/index.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { JsonSchema } from "../mcp/validation/validators.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

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

		await initializeTestProject(mcpServer, "Test Project");

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

	it("assigns default tail ordinals for task_create and preserves explicit ordinals", async () => {
		const first = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "First MCP ordinal task",
				},
			},
		});
		expect(getText(first.content)).toContain("Ordinal: 1000");

		const second = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Second MCP ordinal task",
				},
			},
		});
		expect(getText(second.content)).toContain("Ordinal: 2000");

		const explicit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Explicit MCP ordinal task",
					ordinal: 9000,
				},
			},
		});
		expect(getText(explicit.content)).toContain("Ordinal: 9000");
	});

	it("searches tasks with a separate modifiedFiles filter", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Button search",
					modifiedFiles: ["src/web/components/Button.tsx"],
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Server search",
					modifiedFiles: ["src/server/index.ts"],
				},
			},
		});

		const searchResult = await mcpServer.testInterface.callTool({
			params: { name: "task_search", arguments: { modifiedFiles: ["components/Button"] } },
		});

		const searchText = getText(searchResult.content);
		expect(searchText).toContain("TASK-1 - Button search");
		expect(searchText).not.toContain("TASK-2 - Server search");
	});

	it("appends and renders task comments through task_edit and task_view", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Commented MCP task",
				},
			},
		});

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					title: "Commented MCP task renamed",
					commentsAppend: ["MCP comment body"],
					commentAuthor: "@mcp",
				},
			},
		});
		const editText = getText(editResult.content);
		expect(editText).toMatch(/Created: \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC\)/);
		expect(editText).toContain("Comments:");
		expect(editText).toMatch(/#1 - @mcp - \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC\)/);
		expect(editText).toContain("MCP comment body");

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-1" } },
		});
		const viewText = getText(viewResult.content);
		expect(viewText).toContain("Task TASK-1 - Commented MCP task renamed");
		expect(viewText).toContain("Comments:");
		expect(viewText).toContain("MCP comment body");
	});

	it("rejects reserved comment markers through task_edit", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Invalid comment marker task",
				},
			},
		});

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					commentsAppend: ["Invalid <!-- COMMENT:END --> marker"],
				},
			},
		});
		expect(editResult.isError).toBe(true);
		expect(getText(editResult.content)).toContain("Comment body cannot contain Backlog comment markers.");

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-1" } },
		});
		expect(getText(viewResult.content)).not.toContain("Comments:");
	});

	it("filters task_list by milestone using closest matching and combines with status", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Milestone Task One",
					status: "To Do",
					milestone: "Release-1",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Milestone Task Two",
					status: "In Progress",
					milestone: "release-1",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Other Milestone Task",
					status: "To Do",
					milestone: "Release-2",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "No Milestone Task",
					status: "To Do",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Roadmap Milestone Task",
					status: "To Do",
					milestone: "Roadmap Alpha",
				},
			},
		});

		const milestoneResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { milestone: "RELEASE-1" } },
		});
		const milestoneText = (milestoneResult.content ?? [])
			.map((entry) => ("text" in entry ? entry.text : ""))
			.join("\n\n");
		expect(milestoneText).toContain("TASK-1 - Milestone Task One");
		expect(milestoneText).toContain("TASK-2 - Milestone Task Two");
		expect(milestoneText).not.toContain("TASK-3 - Other Milestone Task");
		expect(milestoneText).not.toContain("TASK-4 - No Milestone Task");
		expect(milestoneText).not.toContain("TASK-5 - Roadmap Milestone Task");

		const fuzzyResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { milestone: "roadmp" } },
		});
		const fuzzyText = (fuzzyResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
		expect(fuzzyText).toContain("TASK-5 - Roadmap Milestone Task");
		expect(fuzzyText).not.toContain("TASK-1 - Milestone Task One");
		expect(fuzzyText).not.toContain("TASK-2 - Milestone Task Two");
		expect(fuzzyText).not.toContain("TASK-3 - Other Milestone Task");
		expect(fuzzyText).not.toContain("TASK-4 - No Milestone Task");

		const combinedResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { milestone: "release-1", status: "To Do" } },
		});
		const combinedText = (combinedResult.content ?? [])
			.map((entry) => ("text" in entry ? entry.text : ""))
			.join("\n\n");
		expect(combinedText).toContain("TASK-1 - Milestone Task One");
		expect(combinedText).not.toContain("TASK-2 - Milestone Task Two");
		expect(combinedText).not.toContain("TASK-3 - Other Milestone Task");
		expect(combinedText).not.toContain("TASK-4 - No Milestone Task");
		expect(combinedText).not.toContain("TASK-5 - Roadmap Milestone Task");
	});

	it("applies milestone filtering in task_list draft status path", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Draft Milestone One",
					status: "Draft",
					milestone: "draft-alpha",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Draft Milestone Two",
					status: "Draft",
					milestone: "draft-beta",
				},
			},
		});

		const draftResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { status: "Draft", milestone: "draft-alph" } },
		});
		const draftText = getText(draftResult.content);
		expect(draftText).toContain("DRAFT-1 - Draft Milestone One");
		expect(draftText).not.toContain("DRAFT-2 - Draft Milestone Two");
	});

	it("includes completed tasks in task_search results and excludes archived tasks", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Active task",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Completed task",
					status: "Done",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_complete",
				arguments: {
					id: "task-2",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Archived task",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_archive",
				arguments: {
					id: "task-3",
				},
			},
		});

		const searchResult = await mcpServer.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "task" } },
		});

		const searchText = getText(searchResult.content);
		expect(searchText).toContain("TASK-2 - Completed task");
		expect(searchText).toContain("(Done)");
		expect(searchText).not.toContain("TASK-3 - Archived task");
	});

	it("exposes status enums and defaults from configuration", async () => {
		const config = await loadConfig(mcpServer);
		const configuredStatuses =
			config.statuses && config.statuses.length > 0 ? [...config.statuses] : Array.from(DEFAULT_STATUSES);
		const normalizedStatuses = configuredStatuses.map((status) => status.trim());
		const hasDraft = normalizedStatuses.some((status) => status.toLowerCase() === "draft");
		const expectedStatuses = hasDraft ? normalizedStatuses : ["Draft", ...normalizedStatuses];
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));

		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		const createStatusSchema = createSchema?.properties?.status;
		const editStatusSchema = editSchema?.properties?.status;

		expect(createStatusSchema?.enum).toEqual(expectedStatuses);
		expect(createStatusSchema?.default).toBe(normalizedStatuses[0] ?? DEFAULT_STATUSES[0]);
		expect(createStatusSchema?.enumCaseInsensitive).toBe(true);
		expect(createStatusSchema?.enumNormalizeWhitespace).toBe(true);

		expect(editStatusSchema?.enum).toEqual(expectedStatuses);
		expect(editStatusSchema?.default).toBe(normalizedStatuses[0] ?? DEFAULT_STATUSES[0]);
		expect(editStatusSchema?.enumCaseInsensitive).toBe(true);
		expect(editStatusSchema?.enumNormalizeWhitespace).toBe(true);
	});

	it("describes Definition of Done fields as task-level in schemas", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		expect(createSchema?.properties?.definitionOfDoneAdd?.description).toContain("Task-specific");
		expect(createSchema?.properties?.disableDefinitionOfDoneDefaults?.description).toContain(
			"definition_of_done_defaults_upsert",
		);
		expect(editSchema?.properties?.definitionOfDoneAdd?.description).toContain("Task-specific");
		expect(editSchema?.properties?.definitionOfDoneCheck?.description).toContain("this task");
	});

	it("documents reserved comment delimiters in task_edit schema", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		expect(editSchema?.properties?.commentsAppend?.description).toContain("standalone '---' lines are reserved");
	});

	it("exposes ordinal in task schemas", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		expect(createSchema?.properties?.ordinal).toEqual({
			type: "number",
			minimum: 0,
			description:
				"Optional non-negative ordering value for manual task ordering. Lower values sort earlier. Prefer spaced integers such as 1000, 2000, 3000 to leave room for inserts.",
		});
		expect(editSchema?.properties?.ordinal).toEqual({
			type: "number",
			minimum: 0,
			description:
				"Set task ordinal for manual ordering. Lower values sort earlier. Prefer spaced integers such as 1000, 2000, 3000 to leave room for inserts.",
		});
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

	it("does not clear labels from blank-only task_edit label arrays", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Label blank input",
					labels: ["docs", "workflow"],
				},
			},
		});

		const blankEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					labels: ["", "   "],
				},
			},
		});

		expect(getText(blankEdit.content)).toContain("Labels: docs, workflow");
		expect((await mcpServer.getTask("task-1"))?.labels).toEqual(["docs", "workflow"]);

		const clearEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					labels: [],
				},
			},
		});

		expect(getText(clearEdit.content)).not.toContain("Labels:");
		expect((await mcpServer.getTask("task-1"))?.labels).toEqual([]);
	});

	it("creates, edits, lists, and views tasks with ordinal", async () => {
		const createdA = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Ordinal task A",
					status: "To Do",
					priority: "low",
					ordinal: 20,
				},
			},
		});
		const createdB = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Ordinal task B",
					status: "To Do",
					priority: "high",
					ordinal: 10,
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Ordinal task C",
					status: "To Do",
					priority: "medium",
				},
			},
		});

		expect(getText(createdA.content)).toContain("Ordinal: 20");
		expect(getText(createdB.content)).toContain("Ordinal: 10");

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { status: "To Do", search: "Ordinal task" } },
		});
		const listText = getText(listResult.content);
		expect(listText.indexOf("TASK-2 - Ordinal task B")).toBeLessThan(listText.indexOf("TASK-1 - Ordinal task A"));
		expect(listText.indexOf("TASK-1 - Ordinal task A")).toBeLessThan(listText.indexOf("TASK-3 - Ordinal task C"));

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-3",
					ordinal: 5,
				},
			},
		});
		expect(getText(editResult.content)).toContain("Ordinal: 5");

		const updatedTask = await mcpServer.getTask("task-3");
		expect(updatedTask?.ordinal).toBe(5);

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-3" } },
		});
		expect(getText(viewResult.content)).toContain("Ordinal: 5");
	});

	it("applies task_list limit after ordinal-aware sorting", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Limited ordinal later id",
					status: "To Do",
					ordinal: 2000,
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Limited ordinal first by order",
					status: "To Do",
					ordinal: 1000,
				},
			},
		});

		const listResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_list",
				arguments: {
					status: "To Do",
					search: "Limited ordinal",
					limit: 1,
				},
			},
		});

		const listText = getText(listResult.content);
		expect(listText).toContain("TASK-2 - Limited ordinal first by order");
		expect(listText).not.toContain("TASK-1 - Limited ordinal later id");
	});

	it("rejects invalid ordinal input", async () => {
		const invalidCreate = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Invalid ordinal create",
					ordinal: -1,
				},
			},
		});
		expect(invalidCreate.isError).toBe(true);
		expect(getText(invalidCreate.content)).toContain("must be at least 0");

		const nullCreate = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Null ordinal create",
					ordinal: null,
				},
			},
		});
		expect(nullCreate.isError).toBe(true);
		expect(getText(nullCreate.content)).toContain("Ordinal must be a non-negative number.");

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Valid task",
				},
			},
		});

		const invalidEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					ordinal: -1,
				},
			},
		});
		expect(invalidEdit.isError).toBe(true);
		expect(getText(invalidEdit.content)).toContain("must be at least 0");

		const nullEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					ordinal: null,
				},
			},
		});
		expect(nullEdit.isError).toBe(true);
		expect(getText(nullEdit.content)).toContain("Ordinal must be a non-negative number.");
	});

	it("creates and edits Definition of Done items", async () => {
		const config = await loadConfig(mcpServer);
		config.definitionOfDone = ["Run tests", "Update docs"];
		await mcpServer.filesystem.saveConfig(config);

		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "DoD MCP task",
					definitionOfDoneAdd: ["Ship notes"],
				},
			},
		});

		const createText = getText(createResult.content);
		expect(createText).toContain("Definition of Done:");
		expect(createText).toContain("- [ ] #1 Run tests");
		expect(createText).toContain("- [ ] #2 Update docs");
		expect(createText).toContain("- [ ] #3 Ship notes");

		const disableResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "DoD no defaults",
					disableDefinitionOfDoneDefaults: true,
				},
			},
		});

		const disableText = getText(disableResult.content);
		expect(disableText).toContain("Definition of Done:");
		expect(disableText).toContain("No Definition of Done items defined");

		const checkResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					definitionOfDoneCheck: [2],
				},
			},
		});

		const checkText = getText(checkResult.content);
		expect(checkText).toContain("- [x] #2 Update docs");

		const removeResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					definitionOfDoneRemove: [1],
				},
			},
		});

		const removeText = getText(removeResult.content);
		expect(removeText).toContain("- [x] #1 Update docs");

		const uncheckResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					definitionOfDoneUncheck: [1],
				},
			},
		});

		const uncheckText = getText(uncheckResult.content);
		expect(uncheckText).toContain("- [ ] #1 Update docs");
	});

	it("includes subtask list in task_view output and hides it when empty", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Parent task",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Child task A",
					parentTaskId: "TASK-1",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Child task B",
					parentTaskId: "TASK-1",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Standalone task",
				},
			},
		});

		const parentView = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-1" } },
		});

		const parentText = getText(parentView.content);
		expect(parentText).toContain("Subtasks (2):");
		expect(parentText).toContain("- TASK-1.1 - Child task A");
		expect(parentText).toContain("- TASK-1.2 - Child task B");
		expect(parentText.indexOf("TASK-1.1")).toBeLessThan(parentText.indexOf("TASK-1.2"));

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1.1",
					title: "Child task A updated",
				},
			},
		});

		const parentAfterEdit = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-1" } },
		});

		const parentAfterEditText = getText(parentAfterEdit.content);
		expect(parentAfterEditText).toContain("- TASK-1.1 - Child task A updated");

		const standaloneView = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-2" } },
		});

		const standaloneText = getText(standaloneView.content);
		expect(standaloneText).not.toContain("Subtasks (");
		expect(standaloneText).not.toContain("Subtasks:");
	});

	it("creates and edits tasks with a semantic type and shows it in view and list output", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Typed task",
					type: "BUG",
					priority: "high",
				},
			},
		});
		expect(getText(createResult.content)).toContain("Type: bug");

		const createdTask = await mcpServer.getTask("task-1");
		expect(createdTask?.type).toBe("bug");

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Untyped task",
				},
			},
		});

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: {} },
		});
		const listText = (listResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
		expect(listText).toContain("[HIGH] [bug] TASK-1 - Typed task");
		expect(listText).toContain("  TASK-2 - Untyped task");

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					type: "Feature",
				},
			},
		});
		expect(getText(editResult.content)).toContain("Type: feature");

		const editedTask = await mcpServer.getTask("task-1");
		expect(editedTask?.type).toBe("feature");

		const untypedView = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-2" } },
		});
		expect(getText(untypedView.content)).not.toContain("Type:");
	});

	it("rejects invalid task types through task_create and task_edit", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Invalid type task",
					type: "banana",
				},
			},
		});
		expect(createResult.isError).toBe(true);
		expect(getText(createResult.content)).toContain(`must be one of: ${DEFAULT_TASK_TYPES.join(", ")}`);

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Valid task",
				},
			},
		});

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					type: "banana",
				},
			},
		});
		expect(editResult.isError).toBe(true);
		expect(getText(editResult.content)).toContain(`must be one of: ${DEFAULT_TASK_TYPES.join(", ")}`);

		const task = await mcpServer.getTask("task-1");
		expect(task?.type).toBeUndefined();
	});

	it("exposes task type enums from configuration without a default", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createTypeSchema = (toolByName.get("task_create")?.inputSchema as JsonSchema | undefined)?.properties?.type;
		const editTypeSchema = (toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined)?.properties?.type;

		expect(createTypeSchema?.enum).toEqual([...DEFAULT_TASK_TYPES]);
		expect(createTypeSchema?.enumCaseInsensitive).toBe(true);
		expect(createTypeSchema?.default).toBeUndefined();
		expect(createTypeSchema?.description).toContain(`Valid values: ${DEFAULT_TASK_TYPES.join(", ")}`);

		expect(editTypeSchema?.enum).toEqual([...DEFAULT_TASK_TYPES]);
		expect(editTypeSchema?.enumCaseInsensitive).toBe(true);
		expect(editTypeSchema?.default).toBeUndefined();

		const config = await loadConfig(mcpServer);
		config.types = ["Bug", "Epic"];
		await mcpServer.filesystem.saveConfig(config);

		const customServer = new McpServer(TEST_DIR, "Test instructions");
		try {
			registerTaskTools(customServer, await loadConfig(customServer));

			const customTools = await customServer.testInterface.listTools();
			const customCreateSchema = customTools.tools.find((tool) => tool.name === "task_create")?.inputSchema as
				| JsonSchema
				| undefined;
			expect(customCreateSchema?.properties?.type?.enum).toEqual(["Bug", "Epic"]);

			const createResult = await customServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Configured type task",
						type: "bug",
					},
				},
			});
			expect(getText(createResult.content)).toContain("Type: Bug");

			const invalidResult = await customServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Rejected type task",
						type: "feature",
					},
				},
			});
			expect(invalidResult.isError).toBe(true);
			expect(getText(invalidResult.content)).toContain("must be one of: Bug, Epic");
		} finally {
			await customServer.stop().catch(() => {});
		}
	});
});
