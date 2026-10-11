import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import type { Core } from "../index.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createOrderFixtureProject, ORDER_FIXTURE_ORDERS, taskIds } from "./task-list-order-fixture.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();

/**
 * The plain, JSON and MCP task lists of one project. They take their order from one function, so
 * these tests pin the order each surface shows: the default order of every list, and the order
 * of each `--sort` value, which must not change. The interactive list and the browser table are
 * checked against the same project in tui-task-list-order-pty.test.ts and
 * web-task-list-labels-menu.test.tsx.
 */
describe("task list order across surfaces", () => {
	const projectDir = createUniqueTestDir("task-list-order");
	let core: Core;
	let mcpServer: McpServer;

	beforeAll(async () => {
		core = await createOrderFixtureProject(projectDir);
		mcpServer = new McpServer(projectDir, "Test instructions");
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) throw new Error("Expected the fixture project to have a config");
		registerTaskTools(mcpServer, config);
	});

	afterAll(async () => {
		await mcpServer.stop();
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(projectDir);
	});

	const plain = async (args: string[]) =>
		(await $`bun ${[CLI_PATH, "task", "list", ...args, "--plain"]}`.cwd(projectDir).quiet()).stdout.toString();

	const jsonIds = async (args: string[]) => {
		const output = await $`bun ${[CLI_PATH, "task", "list", ...args, "--json"]}`.cwd(projectDir).quiet();
		return (JSON.parse(output.stdout.toString()) as { tasks: Array<{ id: string }> }).tasks.map((row) => row.id);
	};

	const mcpTaskList = async (args: Record<string, unknown>) => {
		const result = await mcpServer.testInterface.callTool({ params: { name: "task_list", arguments: args } });
		// One content item per status section, so together they are the list.
		return (result.content as Array<{ text?: string }>).map((item) => item.text ?? "").join("\n");
	};

	it("orders by ordinal, then priority, then ID without --sort", async () => {
		expect(await plain([])).toBe(
			[
				"To Do:",
				"  [NOW] TASK-3 - Charlie",
				"  [LATER] TASK-1 - Alpha",
				"  [NEXT] TASK-6 - Foxtrot",
				"  TASK-5 - Echo",
				"",
				"In Progress:",
				"  [NOW] TASK-2 - Bravo",
				"",
				"Done:",
				"  [NEXT] TASK-4 - Delta",
				"",
				"",
			].join("\n"),
		);
		expect(await jsonIds([])).toEqual(taskIds(ORDER_FIXTURE_ORDERS.default));
	});

	it("keeps the order of --sort priority", async () => {
		expect(await plain(["--sort", "priority"])).toBe(
			[
				"Tasks (sorted by priority):",
				"  [NOW] TASK-2 - Bravo (In Progress)",
				"  [NOW] TASK-3 - Charlie (To Do)",
				"  [NEXT] TASK-4 - Delta (Done)",
				"  [NEXT] TASK-6 - Foxtrot (To Do)",
				"  [LATER] TASK-1 - Alpha (To Do)",
				"  TASK-5 - Echo (To Do)",
				"",
			].join("\n"),
		);
		expect(await jsonIds(["--sort", "priority"])).toEqual(taskIds(ORDER_FIXTURE_ORDERS.priority));
	});

	it("keeps the order of --sort id", async () => {
		expect(await plain(["--sort", "id"])).toBe(
			[
				"To Do:",
				"  [LATER] TASK-1 - Alpha",
				"  [NOW] TASK-3 - Charlie",
				"  TASK-5 - Echo",
				"  [NEXT] TASK-6 - Foxtrot",
				"",
				"In Progress:",
				"  [NOW] TASK-2 - Bravo",
				"",
				"Done:",
				"  [NEXT] TASK-4 - Delta",
				"",
				"",
			].join("\n"),
		);
		expect(await jsonIds(["--sort", "id"])).toEqual(taskIds(ORDER_FIXTURE_ORDERS.id));
	});

	it("keeps the order of --sort ordinal", async () => {
		expect(await plain(["--sort", "ordinal"])).toBe(
			[
				"To Do:",
				"  [NOW] TASK-3 - Charlie",
				"  [LATER] TASK-1 - Alpha",
				"  TASK-5 - Echo",
				"  [NEXT] TASK-6 - Foxtrot",
				"",
				"In Progress:",
				"  [NOW] TASK-2 - Bravo",
				"",
				"Done:",
				"  [NEXT] TASK-4 - Delta",
				"",
				"",
			].join("\n"),
		);
		expect(await jsonIds(["--sort", "ordinal"])).toEqual(taskIds(ORDER_FIXTURE_ORDERS.ordinal));
	});

	it("lists the same sections in the same order through MCP task_list", async () => {
		expect(await mcpTaskList({})).toBe(
			[
				"To Do:",
				"  [NOW] TASK-3 - Charlie",
				"  [LATER] TASK-1 - Alpha",
				"  [NEXT] TASK-6 - Foxtrot",
				"  TASK-5 - Echo",
				"In Progress:",
				"  [NOW] TASK-2 - Bravo",
				"Done:",
				"  [NEXT] TASK-4 - Delta",
			].join("\n"),
		);
	});

	it("keeps the MCP limit on the rows as they print, section by section", async () => {
		expect(await mcpTaskList({ limit: 5 })).toBe(
			[
				"To Do:",
				"  [NOW] TASK-3 - Charlie",
				"  [LATER] TASK-1 - Alpha",
				"  [NEXT] TASK-6 - Foxtrot",
				"  TASK-5 - Echo",
				"In Progress:",
				"  [NOW] TASK-2 - Bravo",
			].join("\n"),
		);
	});
});
