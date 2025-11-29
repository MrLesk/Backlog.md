import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
	_loadAgentGuideline,
	AGENT_GUIDELINES,
	addAgentInstructions,
	CLAUDE_GUIDELINES,
	COPILOT_GUIDELINES,
	ensureMcpGuidelines,
	GEMINI_GUIDELINES,
	README_GUIDELINES,
} from "../index.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("addAgentInstructions", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-agent-instructions");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("creates guideline files when none exist", async () => {
		await addAgentInstructions(TEST_DIR);
		const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		const claude = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();
		const gemini = await Bun.file(join(TEST_DIR, "GEMINI.md")).text();
		const copilot = await Bun.file(join(TEST_DIR, ".github/copilot-instructions.md")).text();

		// Check that files contain the markers and content
		expect(agents).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(agents).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(agents).toContain(await _loadAgentGuideline(AGENT_GUIDELINES));

		expect(claude).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(claude).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(claude).toContain(await _loadAgentGuideline(CLAUDE_GUIDELINES));

		expect(gemini).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(gemini).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(gemini).toContain(await _loadAgentGuideline(GEMINI_GUIDELINES));

		expect(copilot).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(copilot).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(copilot).toContain(await _loadAgentGuideline(COPILOT_GUIDELINES));
	});

	it("appends guideline files when they already exist", async () => {
		await Bun.write(join(TEST_DIR, "AGENTS.md"), "Existing\n");
		await addAgentInstructions(TEST_DIR);
		const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		expect(agents.startsWith("Existing\n")).toBe(true);
		expect(agents).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(agents).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(agents).toContain(await _loadAgentGuideline(AGENT_GUIDELINES));
	});

	it("creates only selected files", async () => {
		await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md", "README.md"]);

		const agentsExists = await Bun.file(join(TEST_DIR, "AGENTS.md")).exists();
		const claudeExists = await Bun.file(join(TEST_DIR, "CLAUDE.md")).exists();
		const geminiExists = await Bun.file(join(TEST_DIR, "GEMINI.md")).exists();
		const copilotExists = await Bun.file(join(TEST_DIR, ".github/copilot-instructions.md")).exists();
		const readme = await Bun.file(join(TEST_DIR, "README.md")).text();

		expect(agentsExists).toBe(true);
		expect(claudeExists).toBe(false);
		expect(geminiExists).toBe(false);
		expect(copilotExists).toBe(false);
		expect(readme).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(readme).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(readme).toContain(await _loadAgentGuideline(README_GUIDELINES));
	});

	it("loads guideline content from file paths", async () => {
		const pathGuideline = join(__dirname, "../guidelines/agent-guidelines.md");
		const content = await _loadAgentGuideline(pathGuideline);
		expect(content).toContain("# Instructions for the usage of Backlog.md CLI Tool");
	});

	it("does not duplicate content when run multiple times (idempotent)", async () => {
		// First run
		await addAgentInstructions(TEST_DIR);
		const firstRun = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();

		// Second run - should not duplicate content
		await addAgentInstructions(TEST_DIR);
		const secondRun = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();

		expect(firstRun).toBe(secondRun);
	});

	it("preserves existing content and adds Backlog.md content only once", async () => {
		const existingContent = "# My Existing Claude Instructions\n\nThis is my custom content.\n";
		await Bun.write(join(TEST_DIR, "CLAUDE.md"), existingContent);

		// First run
		await addAgentInstructions(TEST_DIR, undefined, ["CLAUDE.md"]);
		const firstRun = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();

		// Second run - should not duplicate Backlog.md content
		await addAgentInstructions(TEST_DIR, undefined, ["CLAUDE.md"]);
		const secondRun = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();

		expect(firstRun).toBe(secondRun);
		expect(firstRun).toContain(existingContent);
		expect(firstRun).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(firstRun).toContain("<!-- BACKLOG.MD GUIDELINES END -->");

		// Count occurrences of the marker to ensure it's only there once
		const startMarkerCount = (firstRun.match(/<!-- BACKLOG\.MD GUIDELINES START -->/g) || []).length;
		const endMarkerCount = (firstRun.match(/<!-- BACKLOG\.MD GUIDELINES END -->/g) || []).length;
		expect(startMarkerCount).toBe(1);
		expect(endMarkerCount).toBe(1);
	});

	it("handles different file types with appropriate markers", async () => {
		const existingContent = "existing content\n";

		// Test AGENTS.md (markdown with HTML comments)
		await Bun.write(join(TEST_DIR, "AGENTS.md"), existingContent);
		await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md"]);
		const agentsContent = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		expect(agentsContent).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(agentsContent).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
	});

	it("replaces CLI guidelines with MCP nudge when switching modes", async () => {
		const agentsPath = join(TEST_DIR, "AGENTS.md");
		const cliBlock = [
			"Preface content",
			"<!-- BACKLOG.MD GUIDELINES START -->",
			"CLI instructions here",
			"<!-- BACKLOG.MD GUIDELINES END -->",
			"Footer line",
			"",
		].join("\n");
		await Bun.write(agentsPath, cliBlock);

		await ensureMcpGuidelines(TEST_DIR, "AGENTS.md");
		const updated = await Bun.file(agentsPath).text();

		expect(updated).not.toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(updated).not.toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(updated).toContain("<!-- BACKLOG.MD MCP GUIDELINES START -->");
		expect(updated).toContain("<!-- BACKLOG.MD MCP GUIDELINES END -->");
		expect(updated).toContain("Preface content");
		expect(updated).toContain("Footer line");
	});

	it("replaces MCP nudge with CLI guidelines when switching modes", async () => {
		const agentsPath = join(TEST_DIR, "AGENTS.md");
		const mcpBlock = [
			"Header",
			"<!-- BACKLOG.MD MCP GUIDELINES START -->",
			"MCP reminder here",
			"<!-- BACKLOG.MD MCP GUIDELINES END -->",
			"",
		].join("\n");
		await Bun.write(agentsPath, mcpBlock);

		await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md"]);
		const updated = await Bun.file(agentsPath).text();

		expect(updated).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(updated).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(updated).not.toContain("<!-- BACKLOG.MD MCP GUIDELINES START -->");
		expect(updated).not.toContain("<!-- BACKLOG.MD MCP GUIDELINES END -->");
		expect(updated).toContain("Header");
	});
});
