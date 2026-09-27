import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { AcceptanceCriteriaManager, DefinitionOfDoneManager } from "../markdown/structured-sections.ts";
import { McpServer } from "../mcp/server.ts";
import { TaskHandlers } from "../mcp/tools/tasks/handlers.ts";
import { BacklogServer } from "../server/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const families = [
	{ family: "AC", title: "Acceptance Criteria", flag: "ac", manager: AcceptanceCriteriaManager },
	{ family: "DOD", title: "Definition of Done", flag: "dod", manager: DefinitionOfDoneManager },
] as const;

function checklist(family: (typeof families)[number], rows: string, marked = true): string {
	return [
		`## ${family.title}`,
		...(marked ? [`<!-- ${family.family}:BEGIN -->`] : []),
		rows,
		...(marked ? [`<!-- ${family.family}:END -->`] : []),
	].join("\n");
}

function taskMarkdown(body: string): string {
	return `---
id: TASK-1
title: Mixed checklist
status: To Do
assignee: []
created_date: '2026-09-27'
labels: []
dependencies: []
---

${body}
`;
}

const mixedRows = "- [~] alpha\n- [ ] #2 bravo\n- [ ] #3 charlie";

describe("shared checklist mark validation", () => {
	for (const family of families) {
		it(`${family.family} indexed mutations reject unsupported marks in marked and legacy sections`, () => {
			for (const marked of [true, false]) {
				for (const mark of ["~", "X", "-"]) {
					const row = `- [${mark}] alpha`;
					const content = checklist(family, `${row}\n- [ ] #2 bravo\n- [x] #3 charlie`, marked);
					for (const mutate of [
						() => family.manager.checkCriterionByIndex(content, 2, true),
						() => family.manager.checkCriterionByIndex(content, 2, false),
						() => family.manager.removeCriterionByIndex(content, 2),
					]) {
						expect(mutate).toThrow(`Invalid ${family.title} checkbox mark in row "${row}"`);
					}
				}
			}
		});

		it(`${family.family} reports an unsupported row even when no valid rows remain`, () => {
			const content = checklist(family, "- [~] alpha");
			expect(() => family.manager.checkCriterionByIndex(content, 1, true)).toThrow('row "- [~] alpha"');
			expect(family.manager.parseAllCriteria(content)).toEqual([]);
		});

		it(`${family.family} keeps valid indexing and surrounding Markdown`, () => {
			const preserved = [
				"Keep [~] as an inline example.",
				"- [link] ordinary Markdown",
				"```markdown",
				"- [~] fenced example",
				"```",
				"~~~markdown",
				"- [X] another fenced example",
				"~~~",
				"<!-- SECTION:CUSTOM:BEGIN -->",
				"- [~] opaque example",
				"<!-- SECTION:CUSTOM:END -->",
			].join("\n");
			const other = families.find((candidate) => candidate !== family);
			if (!other) throw new Error("Other checklist family missing");
			const otherSection = checklist(other, "- [~] unrelated row");
			const content = [
				"## Description\n\n- [~] ordinary description",
				checklist(family, `- [ ] #1 alpha\n${preserved}\n- [x] #2 bravo\n- [ ] #3 charlie`),
				otherSection,
				"## Custom Notes\n\n- [~] unrelated prose",
			].join("\n\n");
			const checked = family.manager.checkCriterionByIndex(content, 3, true);
			expect(checked).toContain("- [x] #3 charlie");
			expect(checked).toContain("- [ ] #1 alpha");
			expect(checked).toContain(preserved);
			expect(checked).toContain(otherSection);
			expect(checked).toContain("## Custom Notes\n\n- [~] unrelated prose");
			const unchecked = family.manager.checkCriterionByIndex(checked, 2, false);
			expect(unchecked).toContain("- [ ] #2 bravo");
			const removed = family.manager.removeCriterionByIndex(unchecked, 2);
			expect(removed).not.toContain("bravo");
			expect(removed).toContain("- [x] #2 charlie");
			expect(removed).toContain(preserved);
		});

		it(`${family.family} ignores a namesake checklist heading inside a fenced example`, () => {
			const content = `\`\`\`markdown\n${checklist(family, "- [~] example", false)}\n\`\`\``;
			expect(() => family.manager.checkCriterionByIndex(content, 1, true)).toThrow("#1 not found");
		});
	}
});

describe("malformed checklist edits preserve task bytes", () => {
	let testDir: string;
	let core: Core;
	let taskPath: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-malformed-checklist-marks");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Malformed checklist marks");
		taskPath = join(core.fs.tasksDir, "task-1 - Mixed-checklist.md");
	});

	afterEach(async () => {
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	async function expectUnchanged(original: string): Promise<void> {
		expect(Buffer.from(await Bun.file(taskPath).arrayBuffer())).toEqual(Buffer.from(original));
	}

	for (const family of families) {
		for (const operation of ["check", "uncheck", "remove"]) {
			it(`CLI ${operation}-${family.flag} rejects shifted indices without saving combined edits`, async () => {
				for (const lineEnding of ["\n", "\r\n"]) {
					const original = taskMarkdown(checklist(family, mixedRows)).replaceAll("\n", lineEnding);
					await Bun.write(taskPath, original);
					const result =
						await $`${process.execPath} ${getTestCliPath()} task edit TASK-1 ${`--${operation}-${family.flag}`} 2 --title "Must not be saved"`
							.cwd(testDir)
							.nothrow()
							.quiet();
					expect(result.exitCode).toBe(1);
					expect(result.stderr.toString()).toContain(`Invalid ${family.title} checkbox mark in row "- [~] alpha"`);
					expect(result.stdout.toString()).not.toContain("Updated task");
					await expectUnchanged(original);
				}
			});
		}

		it(`${family.family} rejects a no-op indexed edit before returning success`, async () => {
			const original = taskMarkdown(checklist(family, mixedRows));
			await Bun.write(taskPath, original);
			await expect(
				core.updateTaskFromInput(
					"TASK-1",
					family.family === "AC" ? { uncheckAcceptanceCriteria: [2] } : { uncheckDefinitionOfDone: [2] },
					false,
				),
			).rejects.toThrow(`Invalid ${family.title} checkbox mark`);
			await expectUnchanged(original);
		});

		it(`MCP ${family.family} indexed edits reject the same row`, async () => {
			const original = taskMarkdown(checklist(family, mixedRows));
			await Bun.write(taskPath, original);
			const server = new McpServer(testDir, "Test instructions");
			try {
				const handlers = new TaskHandlers(server);
				await expect(
					handlers.editTask({
						id: "TASK-1",
						...(family.family === "AC" ? { acceptanceCriteriaCheck: [2] } : { definitionOfDoneCheck: [2] }),
					}),
				).rejects.toThrow(`Invalid ${family.title} checkbox mark`);
				await expectUnchanged(original);
			} finally {
				await server.stop();
			}
		});
	}

	it("browser AC replacement and DoD indexed payloads reject malformed rows", async () => {
		const server = new BacklogServer(testDir);
		const handler = server as unknown as {
			handleUpdateTask(request: Request, taskId: string): Promise<Response>;
		};
		try {
			for (const family of families) {
				const original = taskMarkdown(checklist(family, mixedRows));
				await Bun.write(taskPath, original);
				const payload =
					family.family === "AC"
						? {
								acceptanceCriteriaItems: [
									{ index: 1, text: "bravo", checked: false },
									{ index: 2, text: "charlie", checked: true },
								],
							}
						: { definitionOfDoneCheck: [2] };
				const result = await handler.handleUpdateTask(
					new Request("http://localhost/api/tasks/TASK-1", {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					}),
					"TASK-1",
				);
				expect(result.ok).toBe(false);
				expect((await result.json()).error).toContain(`Invalid ${family.title} checkbox mark`);
				await expectUnchanged(original);
			}
		} finally {
			await server.stop();
		}
	});

	it("legacy Core indexed helpers also reject the malformed row", async () => {
		const original = taskMarkdown(checklist(families[0], mixedRows));
		await Bun.write(taskPath, original);
		await expect(core.checkAcceptanceCriteria("TASK-1", [2], true, false)).rejects.toThrow('row "- [~] alpha"');
		await expect(core.removeAcceptanceCriteria("TASK-1", [2], false)).rejects.toThrow('row "- [~] alpha"');
		await expectUnchanged(original);
	});

	it("reads and unrelated metadata edits still accept mixed and all-invalid checklists", async () => {
		for (const rows of [mixedRows, "- [~] alpha"]) {
			await Bun.write(taskPath, taskMarkdown(checklist(families[0], rows)));
			expect(await core.fs.loadTask("TASK-1")).not.toBeNull();
			await core.updateTaskFromInput("TASK-1", { addLabels: ["review"] }, false);
			expect(await Bun.file(taskPath).text()).toContain(rows);
			expect((await core.fs.loadTask("TASK-1"))?.labels).toEqual(["review"]);
		}
	});
});
