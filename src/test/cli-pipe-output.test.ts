import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup, withTimeout } from "./test-utils.ts";

const CLI = getTestCliPath();
const directory = createUniqueTestDir("cli-pipe-output");
const cases = [
	{ name: "grouped plain with its window footer", args: ["--plain", "--max-count", "20"] },
	{ name: "priority-sorted plain", args: ["--plain", "--sort", "priority"] },
];

describe("finite CLI output to a delayed pipe reader", () => {
	beforeAll(async () => {
		await mkdir(directory, { recursive: true });
		const core = new Core(directory);
		await initializeFilesystemTestProject(core, "Delayed pipe output");
		// Exceed both the OS pipe capacity and Bun.spawn's own eager read buffer.
		for (let index = 1; index <= 24; index++) {
			await core.createTask(
				{
					id: `TASK-${index}`,
					filePath: join(core.filesystem.tasksDir, `task-${index}.md`),
					title: `Task ${index} ${"slow reader é ".repeat(8_000)}`,
					status: ["To Do", "In Progress", "Done"][index % 3] ?? "To Do",
					createdDate: "2026-09-27",
					assignee: [],
					labels: [],
					dependencies: [],
				},
				false,
			);
		}
		core.disposeContentStore();
		core.disposeSearchService();
	});

	afterAll(async () => {
		await safeCleanup(directory);
	});

	it.each(cases)("preserves complete $name output", async ({ name, args }) => {
		const outputPath = join(directory, `${name}.txt`);
		const fileWriter = Bun.spawn(["bun", CLI, "task", "list", ...args], {
			cwd: directory,
			stdin: "ignore",
			stdout: Bun.file(outputPath),
			stderr: "pipe",
		});
		try {
			const [fileExit, fileError] = await withTimeout(
				Promise.all([fileWriter.exited, new Response(fileWriter.stderr).text()]),
				"finite CLI output to a file",
				3_000,
			);
			expect(fileExit).toBe(0);
			expect(fileError).toBe("");
		} finally {
			if (fileWriter.exitCode === null) fileWriter.kill("SIGKILL");
			await fileWriter.exited;
		}
		const expected = await readFile(outputPath);
		expect(expected.toString()).toContain("TASK-24");
		if (args.includes("--max-count")) expect(expected.toString()).toContain("Showing 1-20 of 24 items.");

		const child = Bun.spawn(["bun", CLI, "task", "list", ...args], {
			cwd: directory,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
		const error = new Response(child.stderr).text();
		try {
			await Bun.sleep(6_000);
			const [output, exitCode] = await withTimeout(
				Promise.all([new Response(child.stdout).arrayBuffer(), child.exited]),
				"finite CLI output and resource cleanup",
				3_000,
			);
			expect(exitCode).toBe(0);
			expect(await error).toBe("");
			const actual = Buffer.from(output);
			expect(actual.byteLength).toBe(expected.byteLength);
			expect(actual.equals(expected)).toBe(true);
		} finally {
			if (child.exitCode === null) child.kill("SIGKILL");
			await child.exited;
		}
	});
});
