import { afterEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { registerWorkflowResources } from "../mcp/resources/workflow/index.ts";
import { createMcpServer, McpServer } from "../mcp/server.ts";
import { registerDefinitionOfDoneTools } from "../mcp/tools/definition-of-done/index.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { registerMilestoneTools } from "../mcp/tools/milestones/index.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { registerWorkflowTools } from "../mcp/tools/workflow/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let PROJECT_DIR: string;

/**
 * Set up two directories: one without backlog (simulates the cwd the
 * harness launches from), and one with a fully initialized project
 * (simulates the root that MCP roots would point to).
 */
async function setupDirs(): Promise<{ uninitializedDir: string; projectRoot: string }> {
	TEST_DIR = createUniqueTestDir("mcp-roots");

	// Directory without a backlog project
	const uninitializedDir = `${TEST_DIR}/no-backlog`;
	await $`mkdir -p ${uninitializedDir}`.quiet();

	// Directory with a valid backlog setup
	PROJECT_DIR = `${TEST_DIR}/real-project`;
	await $`mkdir -p ${PROJECT_DIR}`.quiet();

	const bootstrap = new McpServer(PROJECT_DIR, "Bootstrap");
	await bootstrap.filesystem.ensureBacklogStructure();
	await $`git init -b main`.cwd(PROJECT_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(PROJECT_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(PROJECT_DIR).quiet();
	await initializeTestProject(bootstrap, "Roots Test Project");
	await bootstrap.stop();

	return { uninitializedDir, projectRoot: PROJECT_DIR };
}

afterEach(async () => {
	if (TEST_DIR) await safeCleanup(TEST_DIR);
});

describe("MCP roots discovery", () => {
	it("createMcpServer enables roots discovery in fallback mode", async () => {
		const { uninitializedDir } = await setupDirs();

		const server = await createMcpServer(uninitializedDir);

		// Simulate client init completing (no real client, so roots check
		// returns early — readiness gate resolves, fallback state preserved)
		server.getServer().oninitialized?.();

		// Should be in fallback mode with only init-required resource
		const resources = await server.testInterface.listResources();
		expect(resources.resources.map((r) => r.uri)).toEqual(["backlog://init-required"]);
		// Resource name should include the directory path for debugging
		expect(resources.resources[0]?.name).toBe(`Backlog.md Not Initialized [${uninitializedDir}]`);

		// Should have no task tools
		const tools = await server.testInterface.listTools();
		expect(tools.tools).toEqual([]);

		await server.stop();
	});

	it("reinitializeProjectRoot switches Core to a different project", async () => {
		const { uninitializedDir, projectRoot } = await setupDirs();

		// Start with uninitialized dir (use McpServer directly, no roots discovery)
		const server = new McpServer(uninitializedDir, "Fallback instructions");

		// Verify it starts pointing at a dir with no config
		const configBefore = await server.filesystem.loadConfig();
		expect(configBefore).toBeNull();

		// Reinitialize to the real project
		server.reinitializeProjectRoot(projectRoot);
		await server.ensureConfigLoaded();
		const configAfter = await server.filesystem.loadConfig();
		expect(configAfter).toBeTruthy();
		expect(configAfter?.projectName).toBe("Roots Test Project");
		if (!configAfter) {
			throw new Error("Expected config after reinitializing to a valid project");
		}

		// Register full toolset on the reinitialized server
		registerWorkflowResources(server);
		registerWorkflowTools(server);
		registerTaskTools(server, configAfter);
		registerMilestoneTools(server);
		registerDefinitionOfDoneTools(server);
		registerDocumentTools(server, configAfter);

		const tools = await server.testInterface.listTools();
		const toolNames = tools.tools.map((t) => t.name);
		expect(toolNames).toContain("task_create");
		expect(toolNames).toContain("task_list");
		expect(toolNames).toContain("get_backlog_instructions");

		const resources = await server.testInterface.listResources();
		const uris = resources.resources.map((r) => r.uri);
		expect(uris).toContain("backlog://workflow/overview");

		await server.stop();
	});

	it("readiness gate blocks handlers until resolved", async () => {
		const { uninitializedDir } = await setupDirs();

		const server = new McpServer(uninitializedDir, "Fallback instructions");

		// Set up a controlled readiness gate
		let resolveReady!: () => void;
		const readyPromise = new Promise<void>((r) => {
			resolveReady = r;
		});
		(server as unknown as { _ready: Promise<void> })._ready = readyPromise;

		// Start a listTools call — it should be blocked by _ready
		let toolsResolved = false;
		const toolsPromise = server.testInterface.listTools().then((result) => {
			toolsResolved = true;
			return result;
		});

		// Give the event loop a chance to process
		await new Promise((r) => setTimeout(r, 10));
		expect(toolsResolved).toBe(false);

		// Resolve the readiness gate
		resolveReady();
		const tools = await toolsPromise;
		expect(toolsResolved).toBe(true);
		expect(tools.tools).toEqual([]); // No tools registered in this test

		await server.stop();
	});

	it("enableRootsDiscovery sets up oninitialized callback", async () => {
		const { uninitializedDir } = await setupDirs();

		const server = new McpServer(uninitializedDir, "Fallback instructions");
		server.enableRootsDiscovery();

		// The oninitialized callback should be set on the underlying SDK server
		expect(server.getServer().oninitialized).toBeDefined();

		// Trigger oninitialized to unblock the readiness gate (no client = no roots)
		server.getServer().oninitialized?.();
		// Wait for async resolution
		await new Promise((r) => setTimeout(r, 10));

		// Handlers should now work without blocking
		const tools = await server.testInterface.listTools();
		expect(tools.tools).toEqual([]);

		await server.stop();
	});

	it("normal mode has no roots discovery and no readiness delay", async () => {
		const { projectRoot } = await setupDirs();

		const server = await createMcpServer(projectRoot);

		// Should have full toolset immediately
		const tools = await server.testInterface.listTools();
		const toolNames = tools.tools.map((t) => t.name);
		expect(toolNames).toContain("task_create");
		expect(toolNames).toContain("get_backlog_instructions");

		// oninitialized should NOT be set
		expect(server.getServer().oninitialized).toBeUndefined();

		await server.stop();
	});
});
