import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerMilestoneTools } from "../mcp/tools/milestones/index.ts";
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

describe("MCP milestone tools", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-milestones");
		server = new McpServer(TEST_DIR, "Test instructions");
		await server.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await server.initializeProject("Test Project");

		const config = await loadConfigOrThrow(server);
		registerTaskTools(server, config);
		registerMilestoneTools(server);
	});

	afterEach(async () => {
		try {
			await server.stop();
		} catch {
			// ignore
		}
		await safeCleanup(TEST_DIR);
	});

	it("supports setting and clearing milestone via task_create/task_edit", async () => {
		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Milestone task",
					milestone: "Release 1.0",
				},
			},
		});

		const created = await server.getTask("task-1");
		expect(created?.milestone).toBe("Release 1.0");

		await server.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					milestone: "Release 2.0",
				},
			},
		});

		const updated = await server.getTask("task-1");
		expect(updated?.milestone).toBe("Release 2.0");

		await server.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					milestone: null,
				},
			},
		});

		const cleared = await server.getTask("task-1");
		expect(cleared?.milestone).toBeUndefined();
	});

	it("adds milestones as files with validation", async () => {
		const add = await server.testInterface.callTool({
			params: {
				name: "milestone_add",
				arguments: { name: "Release 1.0" },
			},
		});
		expect(getText(add.content)).toContain('Created milestone "Release 1.0"');
		expect(getText(add.content)).toContain("(m-0)");

		// Check that milestone file was created
		const milestones = await server.filesystem.listMilestones();
		expect(milestones.length).toBe(1);
		expect(milestones[0]?.title).toBe("Release 1.0");
		expect(milestones[0]?.id).toBe("m-0");

		// Duplicate should fail (case-insensitive)
		const duplicate = await server.testInterface.callTool({
			params: {
				name: "milestone_add",
				arguments: { name: " release 1.0 " },
			},
		});
		expect(duplicate.isError).toBe(true);
		expect(getText(duplicate.content)).toContain("Milestone already exists");
	});

	it("lists file-based and task-only milestones", async () => {
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release 1.0" } },
		});

		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: { title: "Unconfigured milestone task", milestone: "Unconfigured" },
			},
		});

		const list = await server.testInterface.callTool({
			params: { name: "milestone_list", arguments: {} },
		});
		const text = getText(list.content);
		expect(text).toContain("Milestones (1):");
		expect(text).toContain("m-0: Release 1.0");
		expect(text).toContain("Milestones found on tasks without files (1):");
		expect(text).toContain("- Unconfigured");
	});

	it("renames milestones and updates local tasks by default", async () => {
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release 1.0" } },
		});
		await server.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "A", milestone: "Release 1.0" } },
		});
		await server.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "B", milestone: "Release 1.0" } },
		});

		const rename = await server.testInterface.callTool({
			params: {
				name: "milestone_rename",
				arguments: { from: "Release 1.0", to: "Release 2.0" },
			},
		});
		expect(getText(rename.content)).toContain('Renamed milestone "Release 1.0"');
		expect(getText(rename.content)).toContain("Updated 2 local tasks");

		const task1 = await server.getTask("task-1");
		const task2 = await server.getTask("task-2");
		expect(task1?.milestone).toBe("Release 2.0");
		expect(task2?.milestone).toBe("Release 2.0");
	});

	it("removes milestones and clears or reassigns local tasks", async () => {
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release A" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release B" } },
		});
		await server.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "A", milestone: "Release A" } },
		});

		const reassign = await server.testInterface.callTool({
			params: {
				name: "milestone_remove",
				arguments: { name: "Release A", taskHandling: "reassign", reassignTo: "Release B" },
			},
		});
		expect(getText(reassign.content)).toContain('Removed milestone "Release A".');
		expect(getText(reassign.content)).toContain("Reassigned 1 local task");

		const task1 = await server.getTask("task-1");
		expect(task1?.milestone).toBe("Release B");

		// Now test clear behavior
		await server.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "task-1", milestone: "Release B" } },
		});

		const clear = await server.testInterface.callTool({
			params: { name: "milestone_remove", arguments: { name: "Release B" } },
		});
		expect(getText(clear.content)).toContain('Removed milestone "Release B".');
		expect(getText(clear.content)).toContain("Cleared milestone for 1 local task");

		const cleared = await server.getTask("task-1");
		expect(cleared?.milestone).toBeUndefined();
	});
});
