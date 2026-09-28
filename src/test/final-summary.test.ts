import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Final Summary", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-final-summary");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Final Summary Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("does not persist empty Final Summary sections", async () => {
		const core = new Core(TEST_DIR);
		const { task } = await core.createTaskFromInput({
			title: "Task without summary",
		});

		expect(task.rawContent).not.toContain("## Final Summary");
	});

	it("ignores Final Summary examples nested inside Description", () => {
		const content = [
			"## Description",
			"",
			"<!-- SECTION:DESCRIPTION:BEGIN -->",
			"Here is an example:",
			"```markdown",
			"## Final Summary",
			"",
			"<!-- SECTION:FINAL_SUMMARY:BEGIN -->",
			"### Example",
			"- Not the real summary",
			"<!-- SECTION:FINAL_SUMMARY:END -->",
			"```",
			"<!-- SECTION:DESCRIPTION:END -->",
			"",
			"## Final Summary",
			"",
			"<!-- SECTION:FINAL_SUMMARY:BEGIN -->",
			"Real summary content",
			"<!-- SECTION:FINAL_SUMMARY:END -->",
			"",
		].join("\n");

		expect(extractStructuredSection(content, "finalSummary")).toBe("Real summary content");
	});
});
