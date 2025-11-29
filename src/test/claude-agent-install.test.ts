import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { installClaudeAgent } from "../agent-instructions.ts";
import { CLAUDE_AGENT_CONTENT } from "../constants/index.ts";
import { createTestDir } from "./test-utils.ts";

describe("installClaudeAgent", () => {
	let TEST_PROJECT: string;

	beforeEach(async () => {
		TEST_PROJECT = await createTestDir("test-claude-agent");
		await rm(TEST_PROJECT, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_PROJECT, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_PROJECT, { recursive: true, force: true }).catch(() => {});
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

		expect(content).toBe(CLAUDE_AGENT_CONTENT);
		expect(content).toContain("name: project-manager-backlog");
		expect(content).toContain(
			"You are an expert project manager specializing in the backlog.md task management system",
		);
	});

	it("overwrites existing agent file", async () => {
		const agentDir = join(TEST_PROJECT, ".claude", "agents");
		await mkdir(agentDir, { recursive: true });

		const agentPath = join(TEST_PROJECT, ".claude", "agents", "project-manager-backlog.md");
		await Bun.write(agentPath, "Old content");

		await installClaudeAgent(TEST_PROJECT);

		const content = await Bun.file(agentPath).text();
		expect(content).toBe(CLAUDE_AGENT_CONTENT);
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
