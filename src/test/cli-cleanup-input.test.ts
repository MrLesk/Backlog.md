import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	createTestDirOutsideRepository,
	HAS_PSEUDO_TERMINAL,
	initializeFilesystemTestProject,
	runCliInPseudoTerminal,
	safeCleanup,
	withTimeout,
} from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
const itPty = HAS_PSEUDO_TERMINAL ? it : it.skip;
const TERMINAL_NOTICE = "Cleanup needs an interactive terminal";
const AGE_QUESTION = "Archive tasks if they are older than:";
const ESCAPE = "\x1b";

let testDir: string;

/** `backlog cleanup` the way a script runs it: no terminal, and whatever the script feeds to stdin. */
async function cleanupWithoutTerminal(stdin: "ignore" | Blob): Promise<{ exitCode: number; output: string }> {
	const child = Bun.spawn([process.execPath, CLI_PATH, "cleanup"], {
		cwd: testDir,
		stdin,
		stdout: "pipe",
		stderr: "pipe",
	});
	try {
		const [exitCode, stdout, stderr] = await withTimeout(
			Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]),
			"backlog cleanup",
			8_000,
		);
		return { exitCode, output: stdout + stderr };
	} finally {
		if (child.exitCode === null) child.kill("SIGKILL");
		await child.exited;
	}
}

async function folders(): Promise<{ tasks: string[]; archive: string[] }> {
	return {
		tasks: await readdir(join(testDir, "backlog", "tasks")),
		archive: await readdir(join(testDir, "backlog", "archive", "tasks")),
	};
}

describe("backlog cleanup and the terminal it needs", () => {
	beforeEach(async () => {
		// Outside the repository: cleanup archives tasks, and a run that outlives this directory must
		// not find the repository's own backlog.
		testDir = await createTestDirOutsideRepository("test-cli-cleanup-input");
		const core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Cleanup Input Project");
		const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		await core.createTask(
			{
				id: "task-1",
				title: "Old finished",
				status: "Done",
				assignee: [],
				createdDate: tenDaysAgo,
				updatedDate: tenDaysAgo,
				labels: [],
				dependencies: [],
			},
			false,
		);
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it.each([
		["stdin is redirected from /dev/null", "ignore" as const],
		["the answers are piped into stdin", new Blob(["\ny\n"])],
	])("exits non-zero, says why, draws no prompt and archives nothing when %s", async (_name, stdin) => {
		const result = await cleanupWithoutTerminal(stdin);

		expect(result.exitCode).toBe(1);
		expect(result.output).toContain(
			"Cleanup needs an interactive terminal for both its input and its output, because it asks which tasks to archive. Nothing was archived.",
		);
		expect(result.output).not.toContain(AGE_QUESTION);
		expect(result.output).not.toContain("Found 1 tasks");
		expect(await folders()).toEqual({ tasks: ["task-1 - Old-finished.md"], archive: [] });
	});

	itPty("still asks its first question in an interactive terminal", async () => {
		// Escape cancels the question once it has been drawn, so cleanup ends by itself.
		const result = await runCliInPseudoTerminal(CLI_PATH, ["cleanup"], testDir, {
			question: AGE_QUESTION,
			keys: ESCAPE,
		});

		expect(result.timedOut).toBe(false);
		expect(result.output).not.toContain(TERMINAL_NOTICE);
		expect(result.output).toContain("Found 1 tasks marked as Done.");
		expect(result.output).toContain(AGE_QUESTION);
		expect(result.output).toContain("Cleanup cancelled.");
		expect(result.exitCode).toBe(0);
		// The question was cancelled, so nothing was archived.
		expect(await folders()).toEqual({ tasks: ["task-1 - Old-finished.md"], archive: [] });
	});
});
