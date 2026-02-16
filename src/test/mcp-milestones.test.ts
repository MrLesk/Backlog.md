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
			params: { name: "milestone_add", arguments: { name: "Release 1.0" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release 2.0" } },
		});

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
		expect(created?.milestone).toBe("m-0");

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
		expect(updated?.milestone).toBe("m-1");

		await server.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					milestone: "m-0",
				},
			},
		});

		const updatedById = await server.getTask("task-1");
		expect(updatedById?.milestone).toBe("m-0");

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

		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Milestone task by id",
					milestone: "m-1",
				},
			},
		});
		const createdById = await server.getTask("task-2");
		expect(createdById?.milestone).toBe("m-1");

		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Unconfigured milestone task",
					milestone: "Planned Later",
				},
			},
		});
		const createdWithUnconfiguredMilestone = await server.getTask("task-3");
		expect(createdWithUnconfiguredMilestone?.milestone).toBe("Planned Later");
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

	it("archives milestones and hides them from lists", async () => {
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release 1.0" } },
		});
		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: { title: "Archived milestone task", milestone: "Release 1.0" },
			},
		});

		const archived = await server.testInterface.callTool({
			params: { name: "milestone_archive", arguments: { name: "Release 1.0" } },
		});
		expect(getText(archived.content)).toContain('Archived milestone "Release 1.0"');

		await server.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "task-1", milestone: "Release 1.0" } },
		});
		const archivedTitleResolved = await server.getTask("task-1");
		expect(archivedTitleResolved?.milestone).toBe("m-0");

		const active = await server.filesystem.listMilestones();
		const archivedList = await server.filesystem.listArchivedMilestones();
		expect(active.length).toBe(0);
		expect(archivedList.length).toBe(1);

		const list = await server.testInterface.callTool({
			params: { name: "milestone_list", arguments: {} },
		});
		const text = getText(list.content);
		expect(text).toContain("Milestones (0):");
		expect(text).toContain("Milestones found on tasks without files (0):");
		expect(text).not.toContain("Release 1.0");
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

	it("prefers milestone ID matches over title collisions", async () => {
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "m-1" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release B" } },
		});

		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Collision task",
					milestone: "m-1",
				},
			},
		});

		const task = await server.getTask("task-1");
		expect(task?.milestone).toBe("m-1");
	});

	it("supports milestone ID inputs for rename/remove", async () => {
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release A" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Release B" } },
		});
		await server.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Task A", milestone: "Release A" } },
		});

		const renamed = await server.testInterface.callTool({
			params: { name: "milestone_rename", arguments: { from: "m-0", to: "m-1" } },
		});
		expect(getText(renamed.content)).toContain('Renamed milestone "m-0"');
		expect(getText(renamed.content)).toContain("Updated 1 local task");

		const afterRename = await server.getTask("task-1");
		expect(afterRename?.milestone).toBe("m-1");

		const removed = await server.testInterface.callTool({
			params: { name: "milestone_remove", arguments: { name: "m-1" } },
		});
		expect(getText(removed.content)).toContain('Removed milestone "m-1".');
		expect(getText(removed.content)).toContain("Cleared milestone for 1 local task");

		const afterRemove = await server.getTask("task-1");
		expect(afterRemove?.milestone).toBeUndefined();
	});

	it("does not cross-match reused titles when removing by milestone ID", async () => {
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Shared" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Keep ID occupied" } },
		});
		await server.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Old task", milestone: "Shared" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_archive", arguments: { name: "Shared" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Shared" } },
		});
		await server.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "New task", milestone: "Shared" } },
		});

		const removeById = await server.testInterface.callTool({
			params: { name: "milestone_remove", arguments: { name: "m-0" } },
		});
		expect(getText(removeById.content)).toContain('Removed milestone "m-0".');
		expect(getText(removeById.content)).toContain("Cleared milestone for 1 local task");

		const oldTask = await server.getTask("task-1");
		const newTask = await server.getTask("task-2");
		expect(oldTask?.milestone).toBeUndefined();
		expect(newTask?.milestone).toBe("m-2");
	});

	it("treats reused title input as the active milestone", async () => {
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Shared" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Keep ID occupied" } },
		});
		await server.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Archived task", milestone: "Shared" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_archive", arguments: { name: "Shared" } },
		});
		await server.testInterface.callTool({
			params: { name: "milestone_add", arguments: { name: "Shared" } },
		});

		await server.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Active task", milestone: "Shared" } },
		});
		const activeTaskBeforeRemove = await server.getTask("task-2");
		expect(activeTaskBeforeRemove?.milestone).toBe("m-2");

		await server.testInterface.callTool({
			params: { name: "milestone_remove", arguments: { name: "Shared" } },
		});

		const archivedTask = await server.getTask("task-1");
		const activeTask = await server.getTask("task-2");
		expect(archivedTask?.milestone).toBe("m-0");
		expect(activeTask?.milestone).toBeUndefined();
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
		expect(task1?.milestone).toBe("m-1");

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
