import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerDefinitionOfDoneTools } from "../mcp/tools/definition-of-done/index.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let testDir: string;
let server: McpServer;

async function loadConfigOrThrow(mcpServer: McpServer) {
	const config = await mcpServer.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load config");
	}
	return config;
}

describe("MCP Definition of Done default tools", () => {
	beforeEach(async () => {
		testDir = createUniqueTestDir("mcp-dod-defaults");
		server = new McpServer(testDir, "Test instructions");
		await server.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		await server.initializeProject("Test Project");

		const config = await loadConfigOrThrow(server);
		registerTaskTools(server, config);
		registerDefinitionOfDoneTools(server);
	});

	afterEach(async () => {
		try {
			await server.stop();
		} catch {
			// ignore
		}
		await safeCleanup(testDir);
	});

	it("gets and upserts project Definition of Done defaults", async () => {
		const initial = await server.testInterface.callTool({
			params: {
				name: "definition_of_done_defaults_get",
				arguments: {},
			},
		});

		expect(getText(initial.content)).toContain("Project Definition of Done defaults (0):");
		expect(getText(initial.content)).toContain("(none)");

		const upsert = await server.testInterface.callTool({
			params: {
				name: "definition_of_done_defaults_upsert",
				arguments: {
					items: ["  Run tests  ", "", "Update docs"],
				},
			},
		});

		const upsertText = getText(upsert.content);
		expect(upsertText).toContain("Updated project Definition of Done defaults.");
		expect(upsertText).toContain("1. Run tests");
		expect(upsertText).toContain("2. Update docs");

		const reloaded = await loadConfigOrThrow(server);
		expect(reloaded.definitionOfDone).toEqual(["Run tests", "Update docs"]);
	});

	it("applies updated project defaults to task creation and supports per-task override behavior", async () => {
		await server.testInterface.callTool({
			params: {
				name: "definition_of_done_defaults_upsert",
				arguments: {
					items: ["Run tests", "Update docs"],
				},
			},
		});

		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Task with defaults",
				},
			},
		});

		const withDefaults = await server.testInterface.callTool({
			params: {
				name: "task_view",
				arguments: {
					id: "task-1",
				},
			},
		});

		const withDefaultsText = getText(withDefaults.content);
		expect(withDefaultsText).toContain("- [ ] #1 Run tests");
		expect(withDefaultsText).toContain("- [ ] #2 Update docs");

		await server.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Task without defaults",
					disableDefinitionOfDoneDefaults: true,
					definitionOfDoneAdd: ["Custom per-task DoD"],
				},
			},
		});

		const withoutDefaults = await server.testInterface.callTool({
			params: {
				name: "task_view",
				arguments: {
					id: "task-2",
				},
			},
		});

		const withoutDefaultsText = getText(withoutDefaults.content);
		expect(withoutDefaultsText).toContain("- [ ] #1 Custom per-task DoD");
		expect(withoutDefaultsText).not.toContain("Run tests");
	});

	it("rejects delimiter-sensitive DoD defaults (commas) to prevent config corruption", async () => {
		await server.testInterface.callTool({
			params: {
				name: "definition_of_done_defaults_upsert",
				arguments: {
					items: ["Run tests", "Update docs"],
				},
			},
		});

		const result = await server.testInterface.callTool({
			params: {
				name: "definition_of_done_defaults_upsert",
				arguments: {
					items: ["Run unit, integration, and e2e tests"],
				},
			},
		});

		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("cannot contain commas");

		const reloaded = await loadConfigOrThrow(server);
		expect(reloaded.definitionOfDone).toEqual(["Run tests", "Update docs"]);
	});
});
