import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { installClaudeAgent } from "../agent-instructions.ts";
import { CLAUDE_AGENT_CONTENT } from "../constants/index.ts";
import { createUniqueTestDir } from "./test-utils.ts";

describe("installClaudeAgent", () => {
	let TEST_PROJECT: string;

	beforeEach(async () => {
		TEST_PROJECT = createUniqueTestDir("test-claude-agent");
		await mkdir(TEST_PROJECT, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_PROJECT, { recursive: true, force: true });
	});

	it("creates .claude/agents directory in project root if it doesn't exist", async () => {
		await installClaudeAgent(TEST_PROJECT);

		const agentDir = join(TEST_PROJECT, ".claude", "agents");
		expect(existsSync(agentDir)).toBe(true);
	});

	it("writes the project-manager-backlog.md file with correct content", async () => {
		await installClaudeAgent(TEST_PROJECT);

		const agentPath = join(TEST_PROJECT, ".claude", "agents", "project-manager-backlog.md");
		const content = await Bun.file(agentPath).text();

		expect(content).toContain(CLAUDE_AGENT_CONTENT.trimEnd());
		expect(content).toContain("name: project-manager-backlog");
		expect(content).toContain(
			"You are an expert project manager specializing in the backlog.md task management system",
		);
	});

	it("appends a version marker matching package.json (BACK-267)", async () => {
		await installClaudeAgent(TEST_PROJECT);

		const agentPath = join(TEST_PROJECT, ".claude", "agents", "project-manager-backlog.md");
		const content = await Bun.file(agentPath).text();
		const { version } = await Bun.file(join(__dirname, "../../package.json")).json();

		expect(content.trimEnd().endsWith(`<!-- backlog.md-instructions-version: ${version} -->`)).toBe(true);
	});

	it("overwrites existing agent file", async () => {
		const agentDir = join(TEST_PROJECT, ".claude", "agents");
		await mkdir(agentDir, { recursive: true });

		const agentPath = join(TEST_PROJECT, ".claude", "agents", "project-manager-backlog.md");
		await Bun.write(agentPath, "Old content");

		await installClaudeAgent(TEST_PROJECT);

		const content = await Bun.file(agentPath).text();
		expect(content).toContain(CLAUDE_AGENT_CONTENT.trimEnd());
		expect(content).not.toContain("Old content");
	});

	it("works with different project paths", async () => {
		const subProjectPath = join(TEST_PROJECT, "subproject");
		await mkdir(subProjectPath, { recursive: true });

		await installClaudeAgent(subProjectPath);

		const agentPath = join(subProjectPath, ".claude", "agents", "project-manager-backlog.md");
		expect(existsSync(agentPath)).toBe(true);
	});
});
