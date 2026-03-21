import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import {
	configureCursorProjectMcp,
	initializeProject,
	MCP_SERVER_NAME,
	mergeCursorMcpProjectJson,
} from "../core/init.ts";

/** Sandbox environments may forbid mkdir `.cursor`; production always uses `.cursor`. */
const TEST_CURSOR_DIR = "cursor-mcp-test";

describe("Cursor MCP init", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "cursor-mcp-init-"));
		process.env.BACKLOG_TEST_CURSOR_MCP_RELATIVE_DIR = TEST_CURSOR_DIR;
	});

	afterEach(async () => {
		delete process.env.BACKLOG_TEST_CURSOR_MCP_RELATIVE_DIR;
		try {
			await rm(tmpDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	test("mergeCursorMcpProjectJson adds backlog server and preserves peers", () => {
		const merged = mergeCursorMcpProjectJson({
			mcpServers: {
				other: { type: "stdio", command: "echo", args: ["hi"] },
			},
		});
		expect(merged.mcpServers).toEqual({
			other: { type: "stdio", command: "echo", args: ["hi"] },
			[MCP_SERVER_NAME]: {
				type: "stdio",
				command: "backlog",
				args: ["mcp", "start"],
			},
		});
	});

	test("mergeCursorMcpProjectJson rejects invalid mcpServers", () => {
		expect(() => mergeCursorMcpProjectJson({ mcpServers: "nope" as unknown as Record<string, unknown> })).toThrow();
	});

	test("configureCursorProjectMcp creates mcp.json with backlog stdio server", async () => {
		await configureCursorProjectMcp(tmpDir);
		const raw = await readFile(join(tmpDir, TEST_CURSOR_DIR, "mcp.json"), "utf-8");
		const parsed: { mcpServers: Record<string, unknown> } = JSON.parse(raw);
		expect(parsed.mcpServers[MCP_SERVER_NAME]).toEqual({
			type: "stdio",
			command: "backlog",
			args: ["mcp", "start"],
		});
	});

	test("configureCursorProjectMcp merges with existing mcpServers", async () => {
		await mkdir(join(tmpDir, TEST_CURSOR_DIR), { recursive: true });
		await writeFile(
			join(tmpDir, TEST_CURSOR_DIR, "mcp.json"),
			JSON.stringify({
				mcpServers: {
					other: { type: "stdio", command: "echo", args: ["hi"] },
				},
			}),
			"utf-8",
		);
		await configureCursorProjectMcp(tmpDir);
		const parsed: { mcpServers: Record<string, unknown> } = JSON.parse(
			await readFile(join(tmpDir, TEST_CURSOR_DIR, "mcp.json"), "utf-8"),
		);
		expect(parsed.mcpServers.other).toEqual({
			type: "stdio",
			command: "echo",
			args: ["hi"],
		});
		expect(parsed.mcpServers[MCP_SERVER_NAME]).toEqual({
			type: "stdio",
			command: "backlog",
			args: ["mcp", "start"],
		});
	});

	test("configureCursorProjectMcp rejects invalid JSON", async () => {
		await mkdir(join(tmpDir, TEST_CURSOR_DIR), { recursive: true });
		await writeFile(join(tmpDir, TEST_CURSOR_DIR, "mcp.json"), "not json", "utf-8");
		await expect(configureCursorProjectMcp(tmpDir)).rejects.toThrow(/valid JSON/);
	});

	test("initializeProject with cursor writes mcp config and mcpResults", async () => {
		const core = new Core(tmpDir);
		const result = await initializeProject(core, {
			projectName: "Cursor MCP Project",
			integrationMode: "mcp",
			mcpClients: ["cursor"],
			advancedConfig: { autoCommit: false },
		});
		expect(result.success).toBe(true);
		expect(result.mcpResults?.cursor).toContain(".cursor/mcp.json");
		const raw = await readFile(join(tmpDir, TEST_CURSOR_DIR, "mcp.json"), "utf-8");
		expect(JSON.parse(raw).mcpServers[MCP_SERVER_NAME].command).toBe("backlog");
	});
});
