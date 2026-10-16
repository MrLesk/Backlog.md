import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Command } from "commander";
import { Core } from "../core/backlog.ts";
import { createTestDirOutsideRepository, initializeFilesystemTestProject, safeCleanup } from "../test/test-utils.ts";
import { getCompletions, parseCompletionContext } from "./helper.ts";

describe("parseCompletionContext", () => {
	test("parses empty command line", () => {
		const context = parseCompletionContext("backlog ", 8);
		expect(context.command).toBeNull();
		expect(context.subcommand).toBeNull();
		expect(context.partial).toBe("");
		expect(context.lastFlag).toBeNull();
	});

	test("parses partial command", () => {
		const context = parseCompletionContext("backlog tas", 11);
		expect(context.command).toBeNull();
		expect(context.partial).toBe("tas");
	});

	test("parses complete command", () => {
		const context = parseCompletionContext("backlog task ", 13);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBeNull();
		expect(context.partial).toBe("");
	});

	test("parses partial subcommand", () => {
		const context = parseCompletionContext("backlog task ed", 15);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBeNull();
		expect(context.partial).toBe("ed");
	});

	test("parses complete subcommand", () => {
		const context = parseCompletionContext("backlog task edit ", 18);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBe("edit");
		expect(context.partial).toBe("");
	});

	test("parses partial argument", () => {
		const context = parseCompletionContext("backlog task edit task-", 23);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBe("edit");
		expect(context.partial).toBe("task-");
	});

	test("parses flag", () => {
		const context = parseCompletionContext("backlog task create --status ", 29);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBe("create");
		expect(context.lastFlag).toBe("--status");
		expect(context.partial).toBe("");
	});

	test("parses partial flag value", () => {
		const context = parseCompletionContext("backlog task create --status In", 31);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBe("create");
		expect(context.lastFlag).toBe("--status");
		expect(context.partial).toBe("In");
	});

	test("handles quoted strings", () => {
		const context = parseCompletionContext('backlog task create "test task" --status ', 41);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBe("create");
		expect(context.lastFlag).toBe("--status");
		expect(context.partial).toBe("");
	});

	test("handles multiple flags", () => {
		const context = parseCompletionContext("backlog task create --priority high --status ", 46);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBe("create");
		expect(context.lastFlag).toBe("--status");
		expect(context.partial).toBe("");
	});

	test("parses completion subcommand", () => {
		const context = parseCompletionContext("backlog completion install ", 27);
		expect(context.command).toBe("completion");
		expect(context.subcommand).toBe("install");
		expect(context.partial).toBe("");
	});

	test("handles cursor in middle of line", () => {
		// Cursor at position 13 is after "backlog task " (space included)
		const context = parseCompletionContext("backlog task edit", 13);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBeNull();
		expect(context.partial).toBe("");
	});

	test("counts argument position correctly", () => {
		const context = parseCompletionContext("backlog task edit task-1 ", 25);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBe("edit");
		expect(context.argPosition).toBe(1);
	});

	test("does not count flag values as arguments", () => {
		const context = parseCompletionContext("backlog task create --status Done ", 34);
		expect(context.command).toBe("task");
		expect(context.subcommand).toBe("create");
		expect(context.argPosition).toBe(0);
	});

	test("includes pwsh in --shell value completions", async () => {
		const line = "backlog completion install --shell ";
		const completions = await getCompletions(new Command(), line, line.length);

		expect(completions).toContain("pwsh");
		expect(completions).not.toContain("powershell");
	});

	test("filters pwsh shell completion by partial value", async () => {
		const line = "backlog completion install --shell pws";
		const completions = await getCompletions(new Command(), line, line.length);

		expect(completions).toEqual(["pwsh"]);
	});

	test("offers the commands help lists and never a hidden one", async () => {
		const program = new Command("backlog");
		const task = program.command("task");
		task.command("archive <taskId>");
		task.command("complete", { hidden: true });
		program.command("internal", { hidden: true });

		expect(await getCompletions(program, "backlog ", 8)).toEqual(["task"]);
		expect(await getCompletions(program, "backlog task ", 13)).toEqual(["archive"]);
		expect(await getCompletions(program, "backlog task comp", 17)).toEqual([]);
	});
});

describe("task and document ID completion", () => {
	let projectDir: string;
	const previousBacklogCwd = process.env.BACKLOG_CWD;

	beforeEach(async () => {
		projectDir = await createTestDirOutsideRepository("completion-record-ids");
		const core = new Core(projectDir);
		await initializeFilesystemTestProject(core, "Completion Test");
		await core.createTaskFromInput({ title: "On the board" }, false);
		await core.createTaskFromInput({ title: "In the archive" }, false);
		expect(await core.archiveTask("task-2", false)).toBe(true);
		await core.createDocumentFromInput({ title: "In the docs folder", content: "Body" }, false);
		await core.createDocumentFromInput({ title: "In the archive", content: "Body" }, false);
		expect(await core.archiveContentRecord("document", "doc-2", false)).not.toBeNull();
		// Completion finds its project the way every command does.
		process.env.BACKLOG_CWD = projectDir;
	});

	afterEach(async () => {
		if (previousBacklogCwd === undefined) delete process.env.BACKLOG_CWD;
		else process.env.BACKLOG_CWD = previousBacklogCwd;
		await safeCleanup(projectDir);
	});

	/** The IDs offered after `backlog <command> <subcommand> `, without the flags offered next to them. */
	async function idsOfferedFor(command: "task" | "doc", subcommand: string): Promise<string[]> {
		const program = new Command("backlog");
		const task = program.command("task");
		for (const name of ["edit", "archive", "restore", "delete"]) task.command(`${name} <taskId>`);
		const doc = program.command("doc");
		for (const name of ["view", "archive", "restore", "delete"]) doc.command(`${name} <docId>`);
		const line = `backlog ${command} ${subcommand} `;
		const completions = await getCompletions(program, line, line.length);
		return completions.filter((completion) => !completion.startsWith("-"));
	}

	test.each(["restore", "delete"])("offers archived tasks for task %s", async (subcommand) => {
		expect(await idsOfferedFor("task", subcommand)).toEqual(["TASK-2"]);
	});

	test.each(["edit", "archive"])("offers tasks on the board for task %s", async (subcommand) => {
		expect(await idsOfferedFor("task", subcommand)).toEqual(["TASK-1"]);
	});

	test.each(["restore", "delete"])("offers archived documents for doc %s", async (subcommand) => {
		expect(await idsOfferedFor("doc", subcommand)).toEqual(["doc-2"]);
	});

	test.each(["view", "archive"])("offers the documents in the docs folder for doc %s", async (subcommand) => {
		expect(await idsOfferedFor("doc", subcommand)).toEqual(["doc-1"]);
	});
});
