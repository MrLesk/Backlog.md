import { afterEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
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

type ConnectedRootsClient = {
	client: Client;
	getRootsRequestCount: () => number;
};

async function createProject(projectRoot: string, projectName: string): Promise<void> {
	await $`mkdir -p ${projectRoot}`.quiet();

	const bootstrap = new McpServer(projectRoot, "Bootstrap");
	await bootstrap.filesystem.ensureBacklogStructure();
	await $`git init -b main`.cwd(projectRoot).quiet();
	await $`git config user.name "Test User"`.cwd(projectRoot).quiet();
	await $`git config user.email test@example.com`.cwd(projectRoot).quiet();
	await initializeTestProject(bootstrap, projectName);
	await bootstrap.stop();
}

async function setupDirs(): Promise<{
	uninitializedDir: string;
	projectRoot: string;
	secondProjectRoot: string;
}> {
	TEST_DIR = createUniqueTestDir("mcp-roots");

	const uninitializedDir = join(TEST_DIR, "no-backlog");
	const projectRoot = join(TEST_DIR, "real-project");
	const secondProjectRoot = join(TEST_DIR, "second-project");

	await $`mkdir -p ${uninitializedDir}`.quiet();
	await createProject(projectRoot, "Roots Test Project");
	await createProject(secondProjectRoot, "Roots Test Project 2");

	return { uninitializedDir, projectRoot, secondProjectRoot };
}

async function connectRootsClient(server: McpServer, rootsRef: { current: string[] }): Promise<ConnectedRootsClient> {
	let rootsRequestCount = 0;

	const client = new Client(
		{ name: "Roots Test Client", version: "1.0.0" },
		{
			capabilities: {
				roots: {
					listChanged: true,
				},
			},
		},
	);

	client.setRequestHandler(ListRootsRequestSchema, async () => {
		rootsRequestCount += 1;
		return {
			roots: rootsRef.current.map((uri) => ({ uri })),
		};
	});

	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	await server.getServer().connect(serverTransport);
	await client.connect(clientTransport);

	return {
		client,
		getRootsRequestCount: () => rootsRequestCount,
	};
}

afterEach(async () => {
	if (TEST_DIR) {
		await safeCleanup(TEST_DIR);
	}
});

describe("MCP roots discovery", () => {
	it("fallback mode stays init-required without an initialization callback", async () => {
		const { uninitializedDir } = await setupDirs();

		const server = await createMcpServer(uninitializedDir);

		expect(server.getServer().oninitialized).toBeUndefined();

		const resources = await server.testInterface.listResources();
		expect(resources.resources.map((resource) => resource.uri)).toEqual(["backlog://init-required"]);
		expect(resources.resources[0]?.name).toBe(`Backlog.md Not Initialized [${uninitializedDir}]`);

		const tools = await server.testInterface.listTools();
		expect(tools.tools).toEqual([]);

		await server.stop();
	});

	it("reinitializeProjectRoot switches Core to a different project", async () => {
		const { uninitializedDir, projectRoot } = await setupDirs();

		const server = new McpServer(uninitializedDir, "Fallback instructions");

		const configBefore = await server.filesystem.loadConfig();
		expect(configBefore).toBeNull();

		server.reinitializeProjectRoot(projectRoot);
		await server.ensureConfigLoaded();
		const configAfter = await server.filesystem.loadConfig();
		expect(configAfter).toBeTruthy();
		expect(configAfter?.projectName).toBe("Roots Test Project");
		if (!configAfter) {
			throw new Error("Expected config after reinitializing to a valid project");
		}

		registerWorkflowResources(server);
		registerWorkflowTools(server);
		registerTaskTools(server, configAfter);
		registerMilestoneTools(server);
		registerDefinitionOfDoneTools(server);
		registerDocumentTools(server, configAfter);

		const tools = await server.testInterface.listTools();
		const toolNames = tools.tools.map((tool) => tool.name);
		expect(toolNames).toContain("task_create");
		expect(toolNames).toContain("task_list");
		expect(toolNames).toContain("get_backlog_instructions");

		const resources = await server.testInterface.listResources();
		const uris = resources.resources.map((resource) => resource.uri);
		expect(uris).toContain("backlog://workflow/overview");

		await server.stop();
	});

	it("first request upgrades fallback mode via request-scoped directory roots and caches the result", async () => {
		const { uninitializedDir, projectRoot } = await setupDirs();

		const server = await createMcpServer(uninitializedDir);
		const rootsRef = { current: [pathToFileURL(projectRoot).toString()] };
		const { client, getRootsRequestCount } = await connectRootsClient(server, rootsRef);

		try {
			const tools = await client.listTools();
			const toolNames = tools.tools.map((tool) => tool.name);
			expect(toolNames).toContain("task_create");
			expect(toolNames).toContain("get_backlog_instructions");
			expect(server.filesystem.rootDir).toBe(projectRoot);
			expect(getRootsRequestCount()).toBe(1);

			const resources = await client.listResources();
			expect(resources.resources.map((resource) => resource.uri)).toContain("backlog://workflow/overview");
			expect(getRootsRequestCount()).toBe(1);
		} finally {
			await client.close();
			await server.stop();
		}
	});

	it("normalizes file roots to their parent directory", async () => {
		const { uninitializedDir, projectRoot } = await setupDirs();
		const readmePath = join(projectRoot, "README.md");
		await $`touch ${readmePath}`.quiet();

		const server = await createMcpServer(uninitializedDir);
		const rootsRef = { current: [pathToFileURL(readmePath).toString()] };
		const { client, getRootsRequestCount } = await connectRootsClient(server, rootsRef);

		try {
			const resources = await client.listResources();
			expect(resources.resources.map((resource) => resource.uri)).toContain("backlog://workflow/overview");
			expect(server.filesystem.rootDir).toBe(projectRoot);
			expect(getRootsRequestCount()).toBe(1);
		} finally {
			await client.close();
			await server.stop();
		}
	});

	it("skips invalid and inaccessible file roots before later valid roots", async () => {
		const { uninitializedDir, projectRoot } = await setupDirs();

		const server = await createMcpServer(uninitializedDir);
		const rootsRef = {
			current: [
				"file://not-a-local-host/path",
				pathToFileURL(join(TEST_DIR, "missing-root")).toString(),
				pathToFileURL(projectRoot).toString(),
			],
		};
		const { client, getRootsRequestCount } = await connectRootsClient(server, rootsRef);

		try {
			const tools = await client.listTools();
			expect(tools.tools.map((tool) => tool.name)).toContain("task_create");
			expect(server.filesystem.rootDir).toBe(projectRoot);
			expect(getRootsRequestCount()).toBe(1);
		} finally {
			await client.close();
			await server.stop();
		}
	});

	it("invalidates cached roots on roots/list_changed and re-resolves on the next request", async () => {
		const { uninitializedDir, projectRoot, secondProjectRoot } = await setupDirs();

		const server = await createMcpServer(uninitializedDir);
		const rootsRef = { current: [pathToFileURL(projectRoot).toString()] };
		const { client, getRootsRequestCount } = await connectRootsClient(server, rootsRef);

		try {
			await client.listTools();
			expect(server.filesystem.rootDir).toBe(projectRoot);
			expect(getRootsRequestCount()).toBe(1);

			rootsRef.current = [pathToFileURL(uninitializedDir).toString()];
			await client.sendRootsListChanged();
			expect(getRootsRequestCount()).toBe(1);

			const fallbackResources = await client.listResources();
			expect(fallbackResources.resources.map((resource) => resource.uri)).toEqual(["backlog://init-required"]);
			expect(server.filesystem.rootDir).toBe(uninitializedDir);
			expect(getRootsRequestCount()).toBe(2);

			rootsRef.current = [pathToFileURL(secondProjectRoot).toString()];
			await client.sendRootsListChanged();
			expect(getRootsRequestCount()).toBe(2);

			const recoveredTools = await client.listTools();
			expect(recoveredTools.tools.map((tool) => tool.name)).toContain("task_create");
			expect(server.filesystem.rootDir).toBe(secondProjectRoot);
			expect(getRootsRequestCount()).toBe(3);
		} finally {
			await client.close();
			await server.stop();
		}
	});

	it("normal mode does not issue roots/list requests", async () => {
		const { projectRoot } = await setupDirs();

		const server = await createMcpServer(projectRoot);
		const rootsRef = { current: [pathToFileURL(projectRoot).toString()] };
		const { client, getRootsRequestCount } = await connectRootsClient(server, rootsRef);

		try {
			const tools = await client.listTools();
			expect(tools.tools.map((tool) => tool.name)).toContain("task_create");
			expect(getRootsRequestCount()).toBe(0);
		} finally {
			await client.close();
			await server.stop();
		}
	});
});
