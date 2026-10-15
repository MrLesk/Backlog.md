import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import {
	updateTaskDescription,
	updateTaskFinalSummary,
	updateTaskImplementationNotes,
	updateTaskImplementationPlan,
} from "../markdown/serializer.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import { McpServer } from "../mcp/server.ts";
import { TaskHandlers } from "../mcp/tools/tasks/handlers.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const sections = [
	{
		key: "description",
		title: "Description",
		marker: "DESCRIPTION",
		flag: "description",
		mcp: "description",
		update: updateTaskDescription,
	},
	{
		key: "implementationPlan",
		title: "Implementation Plan",
		marker: "PLAN",
		flag: "plan",
		mcp: "implementationPlan",
		update: updateTaskImplementationPlan,
	},
	{
		key: "implementationNotes",
		title: "Implementation Notes",
		marker: "NOTES",
		flag: "notes",
		mcp: "notesSet",
		update: updateTaskImplementationNotes,
	},
	{
		key: "finalSummary",
		title: "Final Summary",
		marker: "FINAL_SUMMARY",
		flag: "final-summary",
		mcp: "finalSummary",
		update: updateTaskFinalSummary,
	},
] as const;

const extraSection = "## Verification\n\nPROOF-LINE";
const legacyBody = `Old content\n\n${extraSection}`;
const criteria = "## Acceptance Criteria\n\n<!-- AC:BEGIN -->\n- [ ] #1 one\n<!-- AC:END -->";

function sectionBlock(section: (typeof sections)[number], body: string, marked = false): string {
	return [
		`## ${section.title}`,
		"",
		...(marked ? [`<!-- SECTION:${section.marker}:BEGIN -->`] : []),
		body,
		...(marked ? [`<!-- SECTION:${section.marker}:END -->`] : []),
	].join("\n");
}

function taskMarkdown(body: string, draft = false): string {
	return `---\nid: ${draft ? "draft-1" : "TASK-1"}\ntitle: Legacy task\nstatus: ${draft ? "Draft" : "To Do"}\nassignee: []\ncreated_date: '2026-10-15'\nlabels: []\ndependencies: []\n---\n\n${body}\n\n${criteria}\n`;
}

describe("legacy structured section replacement (issue #1110)", () => {
	for (const section of sections) {
		it(`refuses to replace or clear ambiguous ${section.title}`, () => {
			for (const replacement of ["New content", ""]) {
				expect(() => section.update(sectionBlock(section, legacyBody), replacement)).toThrow(
					`Cannot replace ${section.title} without section markers`,
				);
			}
		});

		it(`keeps ${section.title} append and explicit-marker behavior`, () => {
			const appended = section.update(sectionBlock(section, legacyBody), `${legacyBody}\n\nAppended`);
			expect(extractStructuredSection(appended, section.key)).toBe(`${legacyBody}\n\nAppended`);
			const marked = `${sectionBlock(section, "Old content", true)}\n\n${extraSection}`;
			for (const replacement of ["New content", ""]) {
				const updated = section.update(marked, replacement);
				expect(updated).toContain(extraSection);
				expect(updated).not.toContain("Old content");
			}
			expect(section.update(sectionBlock(section, "Old content"), "New content")).toContain("New content");
		});
	}

	it("ignores heading-shaped text inside code, HTML, and lower-level headings", () => {
		for (const body of [
			"```markdown\n## Example\n```",
			"~~~markdown\n## Example\n~~~",
			"````markdown\n```\n## Example\n````",
			"```markdown\n## Example",
			"<!--\n## Example\n-->",
			"<pre>\n## Example\n</pre>",
			"<div>\n## Example\n</div>",
			"    ## Indented code\n\n### Subheading\n\nInline ## Example",
		]) {
			expect(updateTaskImplementationNotes(sectionBlock(sections[2], body), "New content")).toContain("New content");
		}
	});

	it("still refuses a real heading after a code or HTML example", () => {
		for (const example of ["```\n## Example\n```", "<!--\n## Example\n-->", "<div>\n## Example\n</div>"]) {
			expect(() =>
				updateTaskImplementationNotes(sectionBlock(sections[2], `${example}\n\n${extraSection}`), "New content"),
			).toThrow('"## Verification"');
		}
	});

	it("does not interpret a legacy-looking section inside marked content as another section", () => {
		const content = sectionBlock(sections[0], sectionBlock(sections[2], legacyBody), true);
		expect(updateTaskDescription(content, "New description")).not.toContain("PROOF-LINE");
	});

	it("preserves ambiguous notes while updating another structured section", () => {
		const content = `${sectionBlock(sections[0], "Old description", true)}\n\n${sectionBlock(sections[2], legacyBody)}`;
		const updated = updateTaskDescription(content, "New description");
		expect(updated).toContain(extraSection);
		expect(extractStructuredSection(updated, "implementationNotes")).toBe(legacyBody);
	});

	it("also protects an ambiguous legacy copy after a marked copy of the same section", () => {
		const content = `${sectionBlock(sections[2], "Marked notes", true)}\n\n${sectionBlock(sections[2], legacyBody)}`;
		expect(() => updateTaskImplementationNotes(content, "New notes")).toThrow('"## Verification"');
	});
});

describe("legacy section refusals before persistence", () => {
	let testDir: string;
	let core: Core;
	let taskPath: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("legacy-section-replacement");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Legacy sections");
		taskPath = join(core.fs.tasksDir, "task-1 - Legacy-task.md");
	});

	afterEach(async () => {
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	for (const section of sections) {
		it(`CLI ${section.flag} refuses the whole edit and explains marker recovery`, async () => {
			for (const eol of ["\n", "\r\n"]) {
				const original = taskMarkdown(sectionBlock(section, legacyBody)).replaceAll("\n", eol);
				await Bun.write(taskPath, original);
				const result =
					await $`${process.execPath} ${getTestCliPath()} task edit TASK-1 ${`--${section.flag}`} "New content" --title "Must not be saved" --check-ac 1`
						.cwd(testDir)
						.quiet()
						.nothrow();
				expect(result.exitCode).toBe(1);
				const error = result.stderr.toString();
				expect(error).toContain(`Cannot replace ${section.title} without section markers`);
				expect(error).toContain('"## Verification"');
				expect(error).toContain(`<!-- SECTION:${section.marker}:BEGIN -->`);
				expect(error).toContain(`<!-- SECTION:${section.marker}:END -->`);
				expect(result.stdout.toString()).not.toContain("Updated task");
				expect(Buffer.from(await Bun.file(taskPath).arrayBuffer())).toEqual(Buffer.from(original));
				expect(await readdir(core.fs.tasksDir)).toEqual(["task-1 - Legacy-task.md"]);
			}
		});

		it(`MCP ${section.mcp} refuses the same replacement without saving`, async () => {
			const original = taskMarkdown(sectionBlock(section, legacyBody));
			await Bun.write(taskPath, original);
			const server = new McpServer(testDir, "Test instructions");
			try {
				await expect(
					new TaskHandlers(server).editTask({ id: "TASK-1", [section.mcp]: "New content", title: "Must not be saved" }),
				).rejects.toThrow(`Cannot replace ${section.title} without section markers`);
				expect(await Bun.file(taskPath).text()).toBe(original);
			} finally {
				await server.stop();
			}
		});
	}

	it("refuses --clear-final-summary without saving combined edits", async () => {
		const original = taskMarkdown(sectionBlock(sections[3], legacyBody));
		await Bun.write(taskPath, original);
		const result =
			await $`${process.execPath} ${getTestCliPath()} task edit TASK-1 --clear-final-summary --title "Must not be saved"`
				.cwd(testDir)
				.quiet()
				.nothrow();
		expect(result.exitCode).toBe(1);
		expect(await Bun.file(taskPath).text()).toBe(original);
	});

	it("protects draft edits too", async () => {
		const draftsDir = await core.fs.getDraftsDir();
		const path = join(draftsDir, "draft-1 - Legacy-task.md");
		const original = taskMarkdown(sectionBlock(sections[2], legacyBody), true);
		await Bun.write(path, original);
		const result =
			await $`${process.execPath} ${getTestCliPath()} draft edit draft-1 --notes "New content" --title "Must not be saved"`
				.cwd(testDir)
				.quiet()
				.nothrow();
		expect(result.exitCode).toBe(1);
		expect(await Bun.file(path).text()).toBe(original);
		expect(await readdir(draftsDir)).toEqual(["draft-1 - Legacy-task.md"]);
	});

	it("allows the same CLI replacement after the intended body is marked", async () => {
		await Bun.write(taskPath, taskMarkdown(`${sectionBlock(sections[2], "Old content", true)}\n\n${extraSection}`));
		const result = await $`${process.execPath} ${getTestCliPath()} task edit TASK-1 --notes "New content"`
			.cwd(testDir)
			.quiet()
			.nothrow();
		expect(result.exitCode).toBe(0);
		const updated = await Bun.file(taskPath).text();
		expect(updated).toContain(extraSection);
		expect(updated).toContain("New content");
		expect(updated).not.toContain("Old content");
	});
});
