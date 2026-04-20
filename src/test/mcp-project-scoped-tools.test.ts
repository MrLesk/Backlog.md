import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { McpServer } from "../mcp/server.ts";
import { registerDefinitionOfDoneTools } from "../mcp/tools/definition-of-done/index.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { registerMilestoneTools } from "../mcp/tools/milestones/index.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { JsonSchema } from "../mcp/validation/validators.ts";
import { writeProjectRegistry } from "../utils/project-registry.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

async function initializeProjectWithStatuses(
	testDir: string,
	projectKey: string,
	projectName: string,
	statuses: string[],
): Promise<Core> {
	const core = new Core(testDir, {
		backlogRoot: join(testDir, "backlog", projectKey),
	});
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName,
		statuses,
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});
	await core.ensureConfigLoaded();
	return core;
}

describe("MCP project-scoped tools", () => {
	let testDir: string;
	let server: McpServer;
	let webCore: Core;
	let opsCore: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("mcp-project-scoped-tools");
		await mkdir(join(testDir, "apps", "web", "src"), { recursive: true });
		await mkdir(join(testDir, "services", "ops", "src"), { recursive: true });

		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		webCore = await initializeProjectWithStatuses(testDir, "web", "Web", ["To Do", "In Progress", "Done"]);
		opsCore = await initializeProjectWithStatuses(testDir, "ops", "Ops", ["Queued", "Escalated", "Shipped"]);

		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "web",
			projects: [
				{ key: "web", path: "apps/web" },
				{ key: "ops", path: "services/ops" },
			],
		});

		server = new McpServer(testDir, "Test instructions");
		const defaultConfig = await webCore.filesystem.loadConfig();
		if (!defaultConfig) {
			throw new Error("Failed to load default project config");
		}
		await registerTaskTools(server, defaultConfig);
		registerMilestoneTools(server);
		registerDocumentTools(server, defaultConfig);
		registerDefinitionOfDoneTools(server);
	});

	afterEach(async () => {
		try {
			await server.stop();
		} catch {
			// ignore shutdown issues in tests
		}
		await safeCleanup(testDir);
	});

	it("exposes an optional project field on project-scoped MCP tools", async () => {
		const tools = await server.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const expectedToolNames = [
			"task_create",
			"task_edit",
			"task_list",
			"task_search",
			"task_view",
			"task_archive",
			"task_complete",
			"milestone_list",
			"milestone_add",
			"milestone_rename",
			"milestone_remove",
			"milestone_archive",
			"document_list",
			"document_view",
			"document_create",
			"document_update",
			"document_search",
			"definition_of_done_defaults_get",
			"definition_of_done_defaults_upsert",
		];

		for (const toolName of expectedToolNames) {
			const schema = toolByName.get(toolName)?.inputSchema as JsonSchema | undefined;
			expect(schema?.properties?.project).toEqual({
				type: "string",
				minLength: 1,
				maxLength: 100,
				description: "Optional project key from backlog/projects.yml to scope this tool call.",
			});
			expect(schema?.required).not.toContain("project");
		}
	});

	it("routes task tools per call to the selected project and keeps default-project fallback", async () => {
		const createOps = await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					project: "ops",
					title: "Escalate vendor outage",
					status: "Escalated",
				},
			},
		});

		expect(createOps.isError).not.toBe(true);
		expect(getText(createOps.content)).toContain("Escalate vendor outage");

		const createDefault = await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Ship web changelog",
					status: "To Do",
				},
			},
		});

		expect(createDefault.isError).not.toBe(true);
		expect(getText(createDefault.content)).toContain("Ship web changelog");

		const editOps = await server.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					project: "ops",
					id: "task-1",
					status: "Shipped",
				},
			},
		});

		expect(editOps.isError).not.toBe(true);

		const defaultList = await server.testInterface.callTool({
			params: { name: "task_list", arguments: {} },
		});
		const defaultListText = getText(defaultList.content);
		expect(defaultListText).toContain("Ship web changelog");
		expect(defaultListText).not.toContain("Escalate vendor outage");

		const opsList = await server.testInterface.callTool({
			params: {
				name: "task_list",
				arguments: {
					project: "ops",
				},
			},
		});
		const opsListText = getText(opsList.content);
		expect(opsListText).toContain("Escalate vendor outage");
		expect(opsListText).not.toContain("Ship web changelog");

		const opsTask = await opsCore.getTask("task-1");
		const webTask = await webCore.getTask("task-1");
		expect(opsTask?.status).toBe("Shipped");
		expect(opsTask?.title).toBe("Escalate vendor outage");
		expect(webTask?.title).toBe("Ship web changelog");
		expect(webTask?.status).toBe("To Do");
	});

	it("routes milestone, document, and definition-of-done tools to the selected project", async () => {
		const milestoneAdd = await server.testInterface.callTool({
			params: {
				name: "milestone_add",
				arguments: {
					project: "ops",
					name: "Ops Launch",
				},
			},
		});
		expect(milestoneAdd.isError).not.toBe(true);

		const documentCreate = await server.testInterface.callTool({
			params: {
				name: "document_create",
				arguments: {
					project: "ops",
					title: "Ops Runbook",
					content: "Escalation flow",
				},
			},
		});
		expect(documentCreate.isError).not.toBe(true);

		const dodUpsert = await server.testInterface.callTool({
			params: {
				name: "definition_of_done_defaults_upsert",
				arguments: {
					project: "ops",
					items: ["Notify stakeholders"],
				},
			},
		});
		expect(dodUpsert.isError).not.toBe(true);

		const defaultMilestones = await server.testInterface.callTool({
			params: { name: "milestone_list", arguments: {} },
		});
		expect(getText(defaultMilestones.content)).not.toContain("Ops Launch");

		const opsMilestones = await server.testInterface.callTool({
			params: {
				name: "milestone_list",
				arguments: { project: "ops" },
			},
		});
		expect(getText(opsMilestones.content)).toContain("Ops Launch");

		const defaultDocuments = await server.testInterface.callTool({
			params: { name: "document_list", arguments: {} },
		});
		expect(getText(defaultDocuments.content)).not.toContain("Ops Runbook");

		const opsDocuments = await server.testInterface.callTool({
			params: {
				name: "document_list",
				arguments: { project: "ops" },
			},
		});
		expect(getText(opsDocuments.content)).toContain("Ops Runbook");

		const defaultDod = await server.testInterface.callTool({
			params: { name: "definition_of_done_defaults_get", arguments: {} },
		});
		expect(getText(defaultDod.content)).not.toContain("Notify stakeholders");

		const opsDod = await server.testInterface.callTool({
			params: {
				name: "definition_of_done_defaults_get",
				arguments: { project: "ops" },
			},
		});
		expect(getText(opsDod.content)).toContain("Notify stakeholders");
	});
});
