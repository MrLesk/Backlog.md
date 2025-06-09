import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	AGENT_GUIDELINES,
	CLAUDE_GUIDELINES,
	CURSOR_GUIDELINES,
	README_GUIDELINES,
	addAgentInstructions,
} from "../index.ts";

const TEST_DIR = join(process.cwd(), "test-agents");

describe("addAgentInstructions", () => {
	beforeEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	it("creates guideline files when none exist", async () => {
		await addAgentInstructions(TEST_DIR);
		const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		const claude = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();
		const cursor = await Bun.file(join(TEST_DIR, ".cursorrules")).text();
		expect(agents).toBe(AGENT_GUIDELINES);
		expect(claude).toBe(CLAUDE_GUIDELINES);
		expect(cursor).toBe(CURSOR_GUIDELINES);
	});

	it("appends guideline files when they already exist", async () => {
		await Bun.write(join(TEST_DIR, "AGENTS.md"), "Existing\n");
		await addAgentInstructions(TEST_DIR);
		const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		expect(agents.startsWith("Existing\n")).toBe(true);
		expect(agents.trimEnd()).toBe(`Existing\n${AGENT_GUIDELINES}`.trimEnd());
	});

	it("creates only selected files", async () => {
		await addAgentInstructions(TEST_DIR, undefined, ["AGENTS.md", "readme.md"]);

		const agentsExists = await Bun.file(join(TEST_DIR, "AGENTS.md")).exists();
		const claudeExists = await Bun.file(join(TEST_DIR, "CLAUDE.md")).exists();
		const cursorExists = await Bun.file(join(TEST_DIR, ".cursorrules")).exists();
		const readme = await Bun.file(join(TEST_DIR, "readme.md")).text();

		expect(agentsExists).toBe(true);
		expect(claudeExists).toBe(false);
		expect(cursorExists).toBe(false);
		expect(readme.trim()).toBe(README_GUIDELINES.trim());
	});
});
