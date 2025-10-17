import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MCP_INIT_REQUIRED_GUIDE } from "../guidelines/mcp/index.ts";
import { createMcpServer } from "../mcp/server.ts";

describe("MCP Server Fallback Mode", () => {
	let tempDir: string;

	beforeEach(() => {
		// Create a temporary directory without backlog initialization
		tempDir = mkdtempSync(join(tmpdir(), "mcp-fallback-test-"));
	});

	afterEach(() => {
		// Clean up temp directory
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("should start successfully in non-backlog directory", async () => {
		// Should not throw an error
		const server = await createMcpServer(tempDir, { debug: false });

		expect(server).toBeDefined();
		expect(server.getServer()).toBeDefined();
	});

	test("should provide backlog://init-required resource in fallback mode", async () => {
		const server = await createMcpServer(tempDir, { debug: false });

		const resources = await server.testInterface.listResources();

		expect(resources.resources).toHaveLength(1);
		expect(resources.resources[0]?.uri).toBe("backlog://init-required");
		expect(resources.resources[0]?.name).toBe("Backlog.md Not Initialized");
	});

	test("should be able to read backlog://init-required resource", async () => {
		const server = await createMcpServer(tempDir, { debug: false });

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://init-required" },
		});

		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]?.uri).toBe("backlog://init-required");
		expect(result.contents[0]?.text).toBe(MCP_INIT_REQUIRED_GUIDE);
	});

	test("should not provide task tools in fallback mode", async () => {
		const server = await createMcpServer(tempDir, { debug: false });

		const tools = await server.testInterface.listTools();

		// In fallback mode, no task tools should be registered
		expect(tools.tools).toHaveLength(0);
	});
});
