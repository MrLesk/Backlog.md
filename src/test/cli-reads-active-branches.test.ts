import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { Core } from "../index.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { Task } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
let TEST_DIR: string;

/**
 * One task, To Do on main and In Progress on a pushed-equivalent local feature branch. With
 * `cli_reads_active_branches` off, the command-line reads and the MCP task list report the working
 * copy's To Do; with it on they report the branch's In Progress, as the board does.
 */
async function initBranchedProject(cliReadsActiveBranches: boolean): Promise<void> {
	const core = new Core(TEST_DIR);
	await initializeFilesystemTestProject(core, "CLI reads active branches");
	const config = await core.filesystem.loadConfig();
	if (!config) throw new Error("Expected config to be loaded");
	await core.filesystem.saveConfig({
		...config,
		filesystemOnly: false,
		checkActiveBranches: true,
		remoteOperations: false,
		taskResolutionStrategy: "most_progressed",
		cliReadsActiveBranches,
	});

	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	await $`git config user.name Test`.cwd(TEST_DIR).quiet();

	const task: Task = {
		id: "TASK-1",
		title: "Branch-only progress",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-10-20",
		updatedDate: "2026-10-20 10:00",
		rawContent: "",
	};
	const taskPath = await core.filesystem.saveTask(task);
	await $`git add .`.cwd(TEST_DIR).quiet();
	await $`git commit -q -m "Add task"`.cwd(TEST_DIR).quiet();

	await $`git switch -q -c feature/task-1`.cwd(TEST_DIR).quiet();
	await Bun.write(taskPath, serializeTask({ ...task, status: "In Progress", updatedDate: "2026-10-21 10:00" }));
	await $`git add .`.cwd(TEST_DIR).quiet();
	await $`git commit -q -m "Start task"`.cwd(TEST_DIR).quiet();
	await $`git switch -q main`.cwd(TEST_DIR).quiet();
}

async function mcpTaskListText(): Promise<string> {
	const mcpServer = new McpServer(TEST_DIR, "Test instructions");
	const config = await mcpServer.filesystem.loadConfig();
	if (!config) throw new Error("Expected config to be loaded");
	registerTaskTools(mcpServer, config);
	const result = await mcpServer.testInterface.callTool({ params: { name: "task_list", arguments: {} } });
	return (result.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n");
}

describe("cli_reads_active_branches", () => {
	beforeEach(() => {
		TEST_DIR = createUniqueTestDir("cli-reads-active-branches");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("keeps task list, task view, task <id> and the MCP task list on the working copy when unset", async () => {
		await initBranchedProject(false);

		const list = await $`bun ${CLI_PATH} task list --plain`.cwd(TEST_DIR).text();
		expect(list).toContain("To Do:");
		expect(list).not.toContain("In Progress:");
		expect(list).toContain("TASK-1 - Branch-only progress");

		const view = await $`bun ${CLI_PATH} task view 1 --plain`.cwd(TEST_DIR).text();
		expect(view).toMatch(/Status:.*To Do/);
		const shorthand = await $`bun ${CLI_PATH} task 1 --plain`.cwd(TEST_DIR).text();
		expect(shorthand).toMatch(/Status:.*To Do/);

		const mcp = await mcpTaskListText();
		expect(mcp).toContain("To Do:");
		expect(mcp).not.toContain("In Progress:");
	});

	it("reports the branch's In Progress in task list, task view, task <id> and the MCP task list when set", async () => {
		await initBranchedProject(true);

		const list = await $`bun ${CLI_PATH} task list --plain`.cwd(TEST_DIR).text();
		expect(list).toContain("In Progress:");
		expect(list).toContain("TASK-1 - Branch-only progress");
		expect(list).not.toContain("To Do:");

		const view = await $`bun ${CLI_PATH} task view 1 --plain`.cwd(TEST_DIR).text();
		expect(view).toMatch(/Status:.*In Progress/);
		const shorthand = await $`bun ${CLI_PATH} task 1 --plain`.cwd(TEST_DIR).text();
		expect(shorthand).toMatch(/Status:.*In Progress/);

		const json = (await $`bun ${CLI_PATH} task list --json`.cwd(TEST_DIR).json()) as { tasks?: Task[]; data?: Task[] };
		const rows = json.tasks ?? json.data ?? [];
		expect(rows.find((row) => row.id === "TASK-1")?.status).toBe("In Progress");

		const mcp = await mcpTaskListText();
		expect(mcp).toContain("In Progress:");
		expect(mcp).toContain("TASK-1 - Branch-only progress");
		expect(mcp).not.toContain("To Do:");
	});
});
