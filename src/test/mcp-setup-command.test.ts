import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("MCP setup command", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-mcp-setup");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize backlog project
		const core = new Core(TEST_DIR);
		await core.initializeProject("MCP Setup Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should display setup instructions for all agents", async () => {
		const result = await $`bun ${cliPath} mcp setup`.cwd(TEST_DIR).text();

		expect(result).toContain("Claude Code");
		expect(result).toContain("OpenAI Codex CLI");
		expect(result).toContain("Google Gemini CLI");
		expect(result).toContain("backlog mcp start");
	});

	it("should show CLI commands for CLI-based agents", async () => {
		const result = await $`bun ${cliPath} mcp setup`.cwd(TEST_DIR).text();

		// Claude Code (with -- separator)
		expect(result).toContain("claude mcp add");
		expect(result).toContain("--");

		// Gemini (space-separated, no --)
		expect(result).toContain("gemini mcp add");
		expect(result).toContain("backlog mcp start");
	});

	it("should show config file location for manual agents", async () => {
		const result = await $`bun ${cliPath} mcp setup`.cwd(TEST_DIR).text();

		// Only Codex is manual now
		expect(result).toContain("~/.codex/config.toml");
	});

	it("should show config examples for manual agents", async () => {
		const result = await $`bun ${cliPath} mcp setup`.cwd(TEST_DIR).text();

		// Codex TOML example
		expect(result).toContain("[mcp_servers.backlog]");
		expect(result).toContain('command = "backlog"');
	});

	it("should display documentation links", async () => {
		const result = await $`bun ${cliPath} mcp setup`.cwd(TEST_DIR).text();

		expect(result).toContain("https://");
		expect(result).toContain("docs");
	});

	it("should show testing instructions", async () => {
		const result = await $`bun ${cliPath} mcp setup`.cwd(TEST_DIR).text();

		expect(result).toContain("Restart");
		expect(result).toContain("Test");
		expect(result).toContain("Show me all tasks");
	});

	it("should handle mcp setup --help", async () => {
		const result = await $`bun ${cliPath} mcp setup --help`.cwd(TEST_DIR).text();

		expect(result).toContain("setup");
		expect(result).toContain("MCP");
	});
});
