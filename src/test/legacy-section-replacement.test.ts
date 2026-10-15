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
		clear: { description: "" },
		update: updateTaskDescription,
	},
	{
		key: "implementationPlan",
		title: "Implementation Plan",
		marker: "PLAN",
		flag: "plan",
		mcp: "implementationPlan",
		clear: { planClear: true },
		update: updateTaskImplementationPlan,
	},
	{
		key: "implementationNotes",
		title: "Implementation Notes",
		marker: "NOTES",
		flag: "notes",
		mcp: "notesSet",
		clear: { notesClear: true },
		update: updateTaskImplementationNotes,
	},
	{
		key: "finalSummary",
		title: "Final Summary",
		marker: "FINAL_SUMMARY",
		flag: "final-summary",
		mcp: "finalSummary",
		clear: { finalSummaryClear: true },
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
			expect(appended).not.toContain(`<!-- SECTION:${section.marker}:BEGIN -->`);
			for (const replacement of ["New content", ""]) {
				expect(() => section.update(appended, replacement)).toThrow("## Verification");
			}
			const marked = `${sectionBlock(section, "Old content", true)}\n\n${extraSection}`;
			for (const replacement of ["New content", ""]) {
				const updated = section.update(marked, replacement);
				expect(updated).toContain(extraSection);
				expect(updated).not.toContain("Old content");
			}
			expect(section.update(sectionBlock(section, "Old content"), "New content")).toContain("New content");
		});

		it(`protects indented headings in legacy ${section.title}`, () => {
			for (const indent of [" ", "  ", "   "]) {
				const body = `Old content\n\n${indent}${extraSection}`;
				for (const replacement of ["New content", ""]) {
					expect(() => section.update(sectionBlock(section, body), replacement)).toThrow("## Verification");
				}
			}
		});

		it(`protects empty level-two headings in legacy ${section.title}`, () => {
			for (const heading of ["##", "## ", "   ##\t"]) {
				for (const replacement of ["New content", ""]) {
					expect(() =>
						section.update(sectionBlock(section, `Old content\n${heading}\nPROOF-LINE`), replacement),
					).toThrow("may be a separate section");
				}
			}
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
			'<widget label=">">\n## Example\n</widget>',
			"<widget label='>'>\n## Example\n</widget>",
			`<widget label='a <b> "c"' enabled>\n## Example\n</widget>`,
			"- ```markdown\n  ## Example\n  ```",
			"1. ~~~markdown\n   ## Example\n   ~~~",
			"2. ```markdown\n   ## Example\n   ```",
			"- - ```markdown\n    ## Example\n    ```",
			"- item\n\n  ```markdown\n  ## Example\n  ```",
			"    ## Indented code\n\n### Subheading\n\nInline ## Example",
		]) {
			expect(updateTaskImplementationNotes(sectionBlock(sections[2], body), "New content")).toContain("New content");
		}
	});

	it("does not let a custom HTML tag interrupt paragraph text and hide a real heading", () => {
		for (const tag of ["<widget>", '<widget label=">">', "</widget>"]) {
			for (const replacement of ["New content", ""]) {
				expect(() =>
					updateTaskImplementationNotes(sectionBlock(sections[2], `Old content\n${tag}\n${extraSection}`), replacement),
				).toThrow("## Verification");
			}
		}
		for (const body of [
			`Old content\n2. <widget>\n   ${extraSection}`,
			`Old content\n2. \n<widget>\n${extraSection}`,
		]) {
			expect(() => updateTaskImplementationNotes(sectionBlock(sections[2], body), "New notes")).toThrow(
				"## Verification",
			);
		}
	});

	it("permits custom HTML blocks after blank lines and other completed blocks", () => {
		for (const prefix of ["Paragraph\n\n", "### Heading\n", "```\ncode\n```\n", "---\n", "<!-- comment -->\n"]) {
			const body = `${prefix}<widget>\n## Example\n</widget>`;
			expect(updateTaskImplementationNotes(sectionBlock(sections[2], body), "New content")).toContain("New content");
		}
	});

	it("does not hide real headings after leaving a list's fenced or HTML block", () => {
		for (const prefix of ["- ```markdown\n  code", "- <widget>\n  text", "- <pre>\n  text"]) {
			expect(() =>
				updateTaskImplementationNotes(sectionBlock(sections[2], `${prefix}\n${extraSection}`), "New notes"),
			).toThrow("## Verification");
		}
	});

	it("ends raw-text HTML blocks at any permitted closing raw-text tag", () => {
		for (const open of ["pre", "script", "style", "textarea"]) {
			for (const close of ["pre", "script", "style", "textarea"]) {
				const body = `<${open}>\nexample\n</${close}>\n${extraSection}`;
				expect(() => updateTaskImplementationNotes(sectionBlock(sections[2], body), "New notes")).toThrow(
					"## Verification",
				);
			}
		}
	});

	it("does not start a raw-text HTML block at a directly self-closing tag", () => {
		for (const tag of ["pre", "script", "style", "textarea"]) {
			expect(() =>
				updateTaskImplementationNotes(sectionBlock(sections[2], `<${tag}/>\n${extraSection}`), "New notes"),
			).toThrow("## Verification");
			expect(updateTaskImplementationNotes(sectionBlock(sections[2], `<${tag} />\n## Example`), "New notes")).toContain(
				"New notes",
			);
		}
	});

	it("accepts custom HTML blocks after a quoted heading or fenced block", () => {
		for (const quote of ["> # Quoted heading", "> ```\n> quoted code\n> ```", "> > # Nested heading"]) {
			const body = `${quote}\n<widget>\n## Example\n</widget>`;
			expect(updateTaskImplementationNotes(sectionBlock(sections[2], body), "New notes")).toContain("New notes");
		}
	});

	it("requires a closing angle bracket after a block-tag slash", () => {
		for (const tag of ["div", "section", "table"]) {
			for (const opening of [`<${tag}/garbage`, `</${tag}/garbage`, `<${tag}/`]) {
				expect(() =>
					updateTaskImplementationNotes(sectionBlock(sections[2], `${opening}\n${extraSection}`), "New notes"),
				).toThrow("## Verification");
			}
			expect(updateTaskImplementationNotes(sectionBlock(sections[2], `<${tag}/>\n## Example`), "New notes")).toContain(
				"New notes",
			);
		}
	});

	it("uses visual tab columns when a heading exits a list-contained HTML block", () => {
		for (const marker of ["-\t", "1.\t", "  -\t"]) {
			expect(() =>
				updateTaskImplementationNotes(sectionBlock(sections[2], `${marker}<widget>\n   ${extraSection}`), "New notes"),
			).toThrow("## Verification");
		}
		expect(
			updateTaskImplementationNotes(sectionBlock(sections[2], "-\t<widget>\n\t## Example"), "New notes"),
		).toContain("New notes");
	});

	it("keeps HTML comments open until the literal closing delimiter", () => {
		const body = "<!--\n--!>\n## Example\n-->";
		expect(updateTaskImplementationNotes(sectionBlock(sections[2], body), "New notes")).toContain("New notes");
		expect(() =>
			updateTaskImplementationNotes(sectionBlock(sections[2], `${body}\n${extraSection}`), "New notes"),
		).toThrow("## Verification");
	});

	it("protects level-two Setext headings", () => {
		for (const section of sections) {
			for (const replacement of ["New content", ""]) {
				expect(() =>
					section.update(sectionBlock(section, "Old content\n\nVerification\n---\n\nPROOF-LINE"), replacement),
				).toThrow("Verification");
			}
		}
	});

	it("keeps ambiguous legacy sections unmarked when another structured section changes", () => {
		for (const section of sections) {
			const other = section.key === "description" ? sections[2] : sections[0];
			const original = `${sectionBlock(section, legacyBody)}\n\n${sectionBlock(other, "Other content", true)}`;
			const updated = other.update(original, "Updated content");
			expect(updated).toContain(extraSection);
			expect(updated).not.toContain(`<!-- SECTION:${section.marker}:BEGIN -->`);
			expect(() => section.update(updated, "New content")).toThrow("## Verification");
		}
	});

	it("preserves safe sequential edits when legacy prose has extra blank lines", () => {
		for (const section of sections) {
			for (const gap of ["\n\n\n", "\n\n\n\n"]) {
				const body = legacyBody.replaceAll("\n\n", gap);
				const other = section.key === "description" ? sections[2] : sections[0];
				const original = `${sectionBlock(section, body)}\n\n${sectionBlock(other, "Other content", true)}`;
				const updated = other.update(original, "Updated content");
				const appended = section.update(updated, `${body}\n\nAppended`);
				expect(appended).toContain("PROOF-LINE");
				expect(appended).toContain("Appended");
				expect(appended).not.toContain(`<!-- SECTION:${section.marker}:BEGIN -->`);
				expect(() => section.update(appended, "New content")).toThrow("## Verification");
			}
		}
	});

	it("still refuses a real heading after a code or HTML example", () => {
		for (const example of [
			"```\n## Example\n```",
			"<!--\n## Example\n-->",
			"<div>\n## Example\n</div>",
			'<widget label=">">\n## Example\n</widget>',
		]) {
			expect(() =>
				updateTaskImplementationNotes(sectionBlock(sections[2], `${example}\n\n${extraSection}`), "New content"),
			).toThrow('"## Verification"');
		}
	});

	it("does not hide headings after an invalid custom HTML tag", () => {
		for (const tag of ['<widget label="unterminated>', '<widget 1invalid="value">']) {
			expect(() =>
				updateTaskImplementationNotes(sectionBlock(sections[2], `${tag}\n${extraSection}`), "New notes"),
			).toThrow("## Verification");
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

		it(`MCP clearing ${section.title} refuses ambiguous content before saving other fields`, async () => {
			const original = taskMarkdown(sectionBlock(section, legacyBody));
			await Bun.write(taskPath, original);
			const server = new McpServer(testDir, "Test instructions");
			try {
				await expect(
					new TaskHandlers(server).editTask({ id: "TASK-1", ...section.clear, title: "Must not be saved" }),
				).rejects.toThrow(`Cannot replace ${section.title} without section markers`);
				expect(await Bun.file(taskPath).text()).toBe(original);
				expect(await readdir(core.fs.tasksDir)).toEqual(["task-1 - Legacy-task.md"]);
			} finally {
				await server.stop();
			}
		});

		it(`MCP clearing ${section.title} removes marked and unambiguous legacy bodies`, async () => {
			for (const marked of [true, false]) {
				await Bun.write(taskPath, taskMarkdown(sectionBlock(section, "Old content", marked)));
				const server = new McpServer(testDir, "Test instructions");
				try {
					await new TaskHandlers(server).editTask({ id: "TASK-1", ...section.clear });
					const updated = await Bun.file(taskPath).text();
					expect(updated).not.toContain(`## ${section.title}`);
					expect(updated).not.toContain("Old content");
					expect(updated).toContain(criteria);
				} finally {
					await server.stop();
				}
			}
		});
	}

	it("CLI empty description refuses ambiguous content without applying a combined edit", async () => {
		const original = taskMarkdown(sectionBlock(sections[0], legacyBody));
		await Bun.write(taskPath, original);
		const result =
			await $`${process.execPath} ${getTestCliPath()} task edit TASK-1 --description ${""} --title "Must not be saved"`
				.cwd(testDir)
				.quiet()
				.nothrow();
		expect(result.exitCode).toBe(1);
		expect(await Bun.file(taskPath).text()).toBe(original);
	});

	it("CLI and MCP preserve bytes for paragraph-interrupting tags and empty headings", async () => {
		for (const body of [
			`Old content\n<widget>\n${extraSection}`,
			"Old content\n##\nPROOF-LINE",
			`<pre>\nexample\n</script>\n${extraSection}`,
			`<pre/>\n${extraSection}`,
			`<div/garbage\n${extraSection}`,
			`-\t<widget>\n   ${extraSection}`,
		]) {
			const original = taskMarkdown(sectionBlock(sections[2], body));
			await Bun.write(taskPath, original);
			const result =
				await $`${process.execPath} ${getTestCliPath()} task edit TASK-1 --notes "New notes" --title "Must not be saved"`
					.cwd(testDir)
					.quiet()
					.nothrow();
			expect(result.exitCode).toBe(1);
			expect(await Bun.file(taskPath).text()).toBe(original);
			const server = new McpServer(testDir, "Test instructions");
			try {
				await expect(
					new TaskHandlers(server).editTask({ id: "TASK-1", notesSet: "New notes", title: "Must not be saved" }),
				).rejects.toThrow("may be a separate section");
				expect(await Bun.file(taskPath).text()).toBe(original);
			} finally {
				await server.stop();
			}
		}
	});

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

	it("CLI and MCP keep later replacements protected after appends and unrelated edits", async () => {
		for (const surface of ["cli", "mcp"]) {
			await Bun.write(
				taskPath,
				taskMarkdown(
					`${sectionBlock(sections[0], "Old description", true)}\n\n${sectionBlock(sections[2], legacyBody.replaceAll("\n\n", "\n\n\n"))}`,
				),
			);
			const server = new McpServer(testDir, "Test instructions");
			try {
				const handlers = new TaskHandlers(server);
				if (surface === "cli") {
					const result =
						await $`${process.execPath} ${getTestCliPath()} task edit TASK-1 --append-notes "Appended" --description "Updated description"`
							.cwd(testDir)
							.quiet()
							.nothrow();
					expect(result.exitCode).toBe(0);
				} else {
					await handlers.editTask({ id: "TASK-1", notesAppend: ["Appended"], description: "Updated description" });
				}
				const appended = await Bun.file(taskPath).text();
				expect(appended).toContain(extraSection);
				expect(appended).toContain("Appended");
				expect(appended).toContain("Updated description");
				expect(appended).not.toContain("<!-- SECTION:NOTES:BEGIN -->");
				if (surface === "cli") {
					const result =
						await $`${process.execPath} ${getTestCliPath()} task edit TASK-1 --notes "New notes" --title "Must not be saved"`
							.cwd(testDir)
							.quiet()
							.nothrow();
					expect(result.exitCode).toBe(1);
				} else {
					await expect(
						handlers.editTask({ id: "TASK-1", notesSet: "New notes", title: "Must not be saved" }),
					).rejects.toThrow("## Verification");
				}
				expect(await Bun.file(taskPath).text()).toBe(appended);
			} finally {
				await server.stop();
			}
		}
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
