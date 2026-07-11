import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
	_loadAgentGuideline,
	AGENT_GUIDELINES,
	addAgentInstructions,
	CLI_AGENT_NUDGE,
	ensureMcpGuidelines,
	README_GUIDELINES,
} from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("addAgentInstructions", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-agent-instructions");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
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
		expect(agents).toContain(CLI_AGENT_NUDGE);
		expect(agents).not.toContain("# Instructions for the usage of Backlog.md CLI Tool");

		expect(claude).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(claude).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(claude).toContain(CLI_AGENT_NUDGE);

		expect(gemini).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(gemini).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(gemini).toContain(CLI_AGENT_NUDGE);

		expect(copilot).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(copilot).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(copilot).toContain(CLI_AGENT_NUDGE);
	});

	it("generated CLI nudge requires phase-specific workflow guides", async () => {
		await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md"]);
		const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();

		expect(agents).toContain("Before task lifecycle actions, read the matching detailed guide:");
		expect(agents).toContain(
			"`backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work",
		);
		expect(agents).toContain(
			"`backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses",
		);
		expect(agents).not.toContain("Use the detailed guides when needed:");
	});

	it("appends guideline files when they already exist", async () => {
		await Bun.write(join(TEST_DIR, "AGENTS.md"), "Existing\n");
		const results = await addAgentInstructions(TEST_DIR);
		const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		expect(agents.startsWith("Existing\n")).toBe(true);
		expect(agents).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(agents).toContain("<!-- BACKLOG.MD GUIDELINES END -->");
		expect(agents).toContain(CLI_AGENT_NUDGE);
		expect(results.find((result) => result.fileName === "AGENTS.md")?.action).toBe("updated");
		expect(results.find((result) => result.fileName === "CLAUDE.md")?.action).toBe("created");
	});

	it("reports unchanged guideline files when the selected block already exists", async () => {
		await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md"]);
		const results = await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md"]);

		expect(results).toEqual([
			{
				action: "unchanged",
				fileName: "AGENTS.md",
				filePath: join(TEST_DIR, "AGENTS.md"),
			},
		]);
	});

	it("replaces stale generated CLI guideline blocks", async () => {
		const agentsPath = join(TEST_DIR, "AGENTS.md");
		await Bun.write(
			agentsPath,
			[
				"Existing header",
				"<!-- BACKLOG.MD GUIDELINES START -->",
				"Old generated Backlog guidance",
				"<!-- BACKLOG.MD GUIDELINES END -->",
				"Existing footer",
				"",
			].join("\n"),
		);

		const results = await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md"]);
		const agents = await Bun.file(agentsPath).text();

		expect(results).toEqual([
			{
				action: "updated",
				fileName: "AGENTS.md",
				filePath: agentsPath,
			},
		]);
		expect(agents).toContain("Existing header");
		expect(agents).toContain("Existing footer");
		expect(agents).toContain(CLI_AGENT_NUDGE);
		expect(agents).not.toContain("Old generated Backlog guidance");
		expect((agents.match(/<!-- BACKLOG\.MD GUIDELINES START -->/g) || []).length).toBe(1);
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

	// BACK-431 / issue #595: multi-line input guidance must lead with forms that pass
	// the tree-sitter AST walkers used by Claude Code, Codex, and similar agent sandboxes.
	// ANSI-C strings ($'...'), command substitutions ($(...)), and heredocs are rejected
	// outright; the section must lead with safe alternatives so headless agent runs do
	// not waste tokens cycling through rejections before falling back.
	it("agent guidelines lead multi-line input with sandbox-safe forms (BACK-431/#595)", async () => {
		const guideline = await _loadAgentGuideline(AGENT_GUIDELINES);
		const sectionMatch = guideline.match(/### Multi[‑-]line Input[\s\S]*?(?=\n### |\n## |$)/);
		expect(sectionMatch).not.toBeNull();
		const section = sectionMatch?.[0] ?? "";
		// Must mention --append-* as a primary safe approach.
		expect(section).toMatch(/--append-/);
		// Must mention real-newlines-in-quotes as a primary safe approach.
		expect(section).toMatch(/[Rr]eal newlines/);
		// Must call out that ANSI-C / command-substitution forms are sandbox-rejected.
		expect(section).toMatch(/sandbox|tree[\s-]sitter|reject/i);
		// Issue #595 must be linked so future readers can find the rationale.
		expect(section).toMatch(/#595|issues\/595/);
		// The safe alternatives must appear before the shell-specific shorthand list.
		const appendIdx = section.search(/--append-/);
		const ansiCIdx = section.search(/\$'/);
		expect(appendIdx).toBeGreaterThan(-1);
		expect(ansiCIdx).toBeGreaterThan(appendIdx);
	});

	it("agent guidelines document literal backtick shell quoting (BACK-270)", async () => {
		const guideline = await _loadAgentGuideline(AGENT_GUIDELINES);
		const sectionMatch = guideline.match(/### Literal Backticks in CLI Task Text[\s\S]*?(?=\n### |\n## |$)/);
		expect(sectionMatch).not.toBeNull();
		const section = sectionMatch?.[0] ?? "";

		expect(section).toContain("single-quoted CLI arguments");
		expect(section).toContain("backlog task create 'Document `backlog init` setup'");
		expect(section).toContain("Backlog.md cannot recover the original text after the shell has already executed it");
	});

	// BACK-431 / issue #595: option help text must not advertise shell forms that AI
	// agent sandboxes reject. Help text is what `--help` surfaces and what agents echo
	// when reasoning about how to call the CLI.
	it("CLI option help does not advertise sandbox-rejected shell forms (BACK-431/#595)", async () => {
		const cliPath = join(__dirname, "../cli.ts");
		const cliText = await Bun.file(cliPath).text();
		const helpLines = cliText.split("\n").filter((line) => line.includes("multi-line"));
		expect(helpLines.length).toBeGreaterThan(0);
		for (const line of helpLines) {
			expect(line).not.toMatch(/\$'/); // no ANSI-C quoting in help strings
			expect(line).not.toMatch(/\$\(printf/); // no command-substitution-with-printf in help strings
		}
	});

	// BACK-267: every installed instruction block carries a machine-readable version
	// marker derived from the running binary/package version, so tooling can compare
	// a project's local instructions against the bundled ones.
	it("writes a version marker matching package.json inside the guidelines block (BACK-267)", async () => {
		const { version } = await Bun.file(join(__dirname, "../../package.json")).json();
		const versionMarker = `<!-- backlog.md-instructions-version: ${version} -->`;

		await addAgentInstructions(TEST_DIR);
		for (const fileName of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"]) {
			const content = await Bun.file(join(TEST_DIR, fileName)).text();
			expect(content).toContain(versionMarker);
			// Marker lives inside the managed block, right after the start marker
			expect(content.indexOf(versionMarker)).toBeGreaterThan(content.indexOf("<!-- BACKLOG.MD GUIDELINES START -->"));
			expect(content.indexOf(versionMarker)).toBeLessThan(content.indexOf("<!-- BACKLOG.MD GUIDELINES END -->"));
			expect((content.match(/<!-- backlog\.md-instructions-version: /g) || []).length).toBe(1);
		}
	});

	it("refreshes a stale version marker when updating an existing block (BACK-267)", async () => {
		const { version } = await Bun.file(join(__dirname, "../../package.json")).json();
		const agentsPath = join(TEST_DIR, "AGENTS.md");
		await Bun.write(
			agentsPath,
			[
				"Existing header",
				"<!-- BACKLOG.MD GUIDELINES START -->",
				"<!-- backlog.md-instructions-version: 0.0.1 -->",
				"Old generated Backlog guidance",
				"<!-- BACKLOG.MD GUIDELINES END -->",
				"",
			].join("\n"),
		);

		await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md"]);
		const agents = await Bun.file(agentsPath).text();

		expect(agents).not.toContain("backlog.md-instructions-version: 0.0.1");
		expect(agents).toContain(`<!-- backlog.md-instructions-version: ${version} -->`);
		expect(agents).toContain("Existing header");
	});

	it("writes the version marker in MCP guideline blocks (BACK-267)", async () => {
		const { version } = await Bun.file(join(__dirname, "../../package.json")).json();

		await ensureMcpGuidelines(TEST_DIR, "AGENTS.md");
		const content = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		const versionMarker = `<!-- backlog.md-instructions-version: ${version} -->`;

		expect(content).toContain(versionMarker);
		expect(content.indexOf(versionMarker)).toBeGreaterThan(content.indexOf("<!-- BACKLOG.MD MCP GUIDELINES START -->"));
		expect(content.indexOf(versionMarker)).toBeLessThan(content.indexOf("<!-- BACKLOG.MD MCP GUIDELINES END -->"));
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
