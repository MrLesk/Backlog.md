import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { parseTask } from "../markdown/parser.ts";
import { updateTaskImplementationNotes } from "../markdown/serializer.ts";
import { extractStructuredSection, updateStructuredSections } from "../markdown/structured-sections.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

const NOTES_BEGIN = "<!-- SECTION:NOTES:BEGIN -->";
const NOTES_END = "<!-- SECTION:NOTES:END -->";

async function findTaskFile(dir: string, id: string): Promise<string> {
	const tasksDir = join(dir, "backlog", "tasks");
	const entries = await readdir(tasksDir);
	const name = entries.find((entry) => entry.startsWith(`${id} `) || entry.startsWith(`${id}-`));
	if (!name) throw new Error(`No file for ${id} in ${tasksDir}`);
	return join(tasksDir, name);
}

describe("Section marker safety (BACK-660, issue #932)", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-section-marker-safety");
		await mkdir(TEST_DIR, { recursive: true });
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Section Marker Safety Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("rejecting sentinel lines in section input", () => {
		it("rejects --notes payloads containing the notes marker line and keeps the file readable", async () => {
			const create = await $`bun ${[CLI_PATH, "task", "create", "Marker task", "--notes", "FIRST NOTE"]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(create.exitCode).toBe(0);

			// The read-modify-write pattern from issue #932: the payload carries the
			// existing marker lines back into --notes.
			const payload = `${NOTES_BEGIN}\nFIRST NOTE\n${NOTES_END}\n\nSECOND NOTE`;
			const edit = await $`bun ${[CLI_PATH, "task", "edit", "1", "--notes", payload]}`.cwd(TEST_DIR).quiet().nothrow();
			expect(edit.exitCode).not.toBe(0);
			expect(`${edit.stderr}${edit.stdout}`).toContain(
				'Implementation Notes content cannot contain the reserved marker line "<!-- SECTION:NOTES:BEGIN -->".',
			);

			const content = await Bun.file(await findTaskFile(TEST_DIR, "task-1")).text();
			expect(content.split(NOTES_BEGIN).length - 1).toBe(1);
			expect(content.split(NOTES_END).length - 1).toBe(1);
			expect(extractStructuredSection(content, "implementationNotes")).toBe("FIRST NOTE");
		});

		it("rejects marker lines in --append-notes and in create/plan/description/final summary input", async () => {
			const core = new Core(TEST_DIR);
			await expect(
				core.createTaskFromInput({ title: "Bad notes", implementationNotes: `x\n${NOTES_END}\ny` }),
			).rejects.toThrow("Implementation Notes content cannot contain the reserved marker line");
			await expect(
				core.createTaskFromInput({ title: "Bad description", description: "<!-- SECTION:DESCRIPTION:BEGIN -->" }),
			).rejects.toThrow("Description content cannot contain the reserved marker line");

			const create = await $`bun ${[CLI_PATH, "task", "create", "Append target"]}`.cwd(TEST_DIR).quiet().nothrow();
			expect(create.exitCode).toBe(0);

			const append = await $`bun ${[CLI_PATH, "task", "edit", "1", "--append-notes", `quoting:\n${NOTES_END}`]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(append.exitCode).not.toBe(0);
			expect(`${append.stderr}${append.stdout}`).toContain("reserved marker line");

			const plan = await $`bun ${[CLI_PATH, "task", "edit", "1", "--plan", "<!-- SECTION:PLAN:END -->"]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(plan.exitCode).not.toBe(0);
			expect(`${plan.stderr}${plan.stdout}`).toContain("Implementation Plan content cannot contain");
		});

		it("still accepts inline mentions, indented marker lines, and other sections' markers in fences", async () => {
			const inline = "The section ends at <!-- SECTION:NOTES:END --> on disk.";
			const indented = ` ${NOTES_END}`;
			const fencedForeign = "```\n<!-- SECTION:DESCRIPTION:BEGIN -->\nstill fenced\n```";
			const notes = [inline, indented, fencedForeign].join("\n\n");

			const create = await $`bun ${[CLI_PATH, "task", "create", "Literal marker talk", "--notes", notes]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(create.exitCode).toBe(0);

			const content = await Bun.file(await findTaskFile(TEST_DIR, "task-1")).text();
			expect(extractStructuredSection(content, "implementationNotes")).toBe(notes);
		});
	});

	describe("append with marker-like substrings (issue #932 second symptom)", () => {
		it("appends without truncating notes that mention the end marker inline", async () => {
			const existing = "Terminator is <!-- SECTION:NOTES:END --> inline\n\nTail content";
			const create = await $`bun ${[CLI_PATH, "task", "create", "Quoting task", "--notes", existing]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(create.exitCode).toBe(0);

			const filePath = await findTaskFile(TEST_DIR, "task-1");
			const sizeBefore = (await Bun.file(filePath).text()).length;

			const append = await $`bun ${[CLI_PATH, "task", "edit", "1", "--append-notes", "APPENDED"]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(append.exitCode).toBe(0);

			const content = await Bun.file(filePath).text();
			expect(content.length).toBeGreaterThan(sizeBefore);
			expect(extractStructuredSection(content, "implementationNotes")).toBe(`${existing}\n\nAPPENDED`);

			const view = await $`bun ${[CLI_PATH, "task", "view", "1", "--plain"]}`.cwd(TEST_DIR).quiet().nothrow();
			expect(view.stdout.toString()).toContain("Tail content");
			expect(view.stdout.toString()).toContain("APPENDED");
		});
	});

	describe("pre-existing nested-marker files (issue #932 corruption)", () => {
		const nestedBody = [
			"## Description",
			"",
			"<!-- SECTION:DESCRIPTION:BEGIN -->",
			"seed description",
			"<!-- SECTION:DESCRIPTION:END -->",
			"",
			"## Implementation Notes",
			"",
			NOTES_BEGIN,
			NOTES_BEGIN,
			"FIRST NOTE",
			NOTES_END,
			"",
			"SECOND NOTE",
			NOTES_END,
		].join("\n");

		const nestedFile = [
			"---",
			"id: task-1",
			"title: repro",
			"status: To Do",
			"assignee: []",
			"created_date: 2026-08-30 00:00",
			"labels: []",
			"dependencies: []",
			"---",
			"",
			nestedBody,
		].join("\n");

		it("keeps every note line readable instead of hiding content after the inner END", () => {
			const task = parseTask(nestedFile);
			expect(task.implementationNotes).toContain("FIRST NOTE");
			expect(task.implementationNotes).toContain("SECOND NOTE");
			expect(task.description).toBe("seed description");
		});

		it("shows the full nested interior in task view", async () => {
			const create = await $`bun ${[CLI_PATH, "task", "create", "repro"]}`.cwd(TEST_DIR).quiet().nothrow();
			expect(create.exitCode).toBe(0);
			const filePath = await findTaskFile(TEST_DIR, "task-1");
			await Bun.write(filePath, nestedFile);

			const view = await $`bun ${[CLI_PATH, "task", "view", "1", "--plain"]}`.cwd(TEST_DIR).quiet().nothrow();
			expect(view.exitCode).toBe(0);
			expect(view.stdout.toString()).toContain("FIRST NOTE");
			expect(view.stdout.toString()).toContain("SECOND NOTE");
		});

		it("repairs the nested markers on a clean --notes rewrite without stranding old text", async () => {
			const create = await $`bun ${[CLI_PATH, "task", "create", "repro"]}`.cwd(TEST_DIR).quiet().nothrow();
			expect(create.exitCode).toBe(0);
			const filePath = await findTaskFile(TEST_DIR, "task-1");
			await Bun.write(filePath, nestedFile);

			const edit = await $`bun ${[CLI_PATH, "task", "edit", "1", "--notes", "REPAIRED BODY"]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(edit.exitCode).toBe(0);

			const content = await Bun.file(filePath).text();
			expect(content.split(NOTES_BEGIN).length - 1).toBe(1);
			expect(content.split(NOTES_END).length - 1).toBe(1);
			expect(extractStructuredSection(content, "implementationNotes")).toBe("REPAIRED BODY");
			// The pre-fix bug stranded the displaced text above the notes header.
			expect(content).not.toContain("SECOND NOTE");
			expect(content.indexOf("## Implementation Notes")).toBeLessThan(content.indexOf(NOTES_BEGIN));
		});

		it("round-trips the nested body without growing or losing content", () => {
			const once = updateTaskImplementationNotes(
				nestedBody,
				extractStructuredSection(nestedBody, "implementationNotes") ?? "",
			);
			const twice = updateTaskImplementationNotes(once, extractStructuredSection(once, "implementationNotes") ?? "");
			expect(twice).toBe(once);
			expect(once).toContain("FIRST NOTE");
			expect(once).toContain("SECOND NOTE");
		});

		it("keeps updateStructuredSections stable across repeated serialization of clean content", () => {
			const notes = `Mentions ${NOTES_END} inline\n\nMore prose`;
			const once = updateStructuredSections("", { description: "desc", implementationNotes: notes });
			const twice = updateStructuredSections(once, {
				description: extractStructuredSection(once, "description") ?? "",
				implementationNotes: extractStructuredSection(once, "implementationNotes") ?? "",
			});
			expect(twice).toBe(once);
			expect(extractStructuredSection(once, "implementationNotes")).toBe(notes);
		});
	});
});
