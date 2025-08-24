import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI sequences --plain output", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-sequences");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize backlog project
		const core = new Core(TEST_DIR);
		await core.initializeProject("Sequences CLI Test");

		// Create tasks: 1,2 -> 4 ; 3 -> 5 -> 6
		await core.createTask(
			{
				id: "task-1",
				title: "A",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				body: "Test A",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-2",
				title: "B",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				body: "Test B",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-3",
				title: "C",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				body: "Test C",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-4",
				title: "D",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: ["task-1", "task-2"],
				body: "Test D",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-5",
				title: "E",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: ["task-3"],
				body: "Test E",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-6",
				title: "F",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: ["task-5"],
				body: "Test F",
			},
			false,
		);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	it("prints sequences in plain format", async () => {
		const result = await $`bun ${cliPath} sequence list --plain`.cwd(TEST_DIR).quiet();
		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}
		expect(result.exitCode).toBe(0);
		const out = result.stdout.toString().trim();
		const expected = [
			"Sequence 1:",
			"  task-1 - A",
			"  task-2 - B",
			"  task-3 - C",
			"Sequence 2:",
			"  task-4 - D",
			"  task-5 - E",
			"Sequence 3:",
			"  task-6 - F",
		];
		for (const line of expected) {
			expect(out).toContain(line);
		}
		// No TUI escape codes in plain output
		expect(out).not.toContain("[?1049h");
		expect(out).not.toContain("\x1b");
	});

	it("excludes Done tasks from sequences", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");
		const TEST_DIR2 = createUniqueTestDir("test-cli-sequences-done");
		await rm(TEST_DIR2, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR2, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR2).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR2).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR2).quiet();

		const core = new Core(TEST_DIR2);
		await core.initializeProject("Sequences Exclude Done Test");

		await core.createTask(
			{
				id: "task-1",
				title: "A",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				body: "Test",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-2",
				title: "B",
				status: "Done",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				body: "Test",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-3",
				title: "C",
				status: "In Progress",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: ["task-1"],
				body: "Test",
			},
			false,
		);

		const result = await $`bun ${cliPath} sequence list --plain`.cwd(TEST_DIR2).quiet();
		expect(result.exitCode).toBe(0);
		const out = result.stdout.toString();
		expect(out).toContain("task-1 - A");
		expect(out).toContain("task-3 - C");
		expect(out).not.toContain("task-2 - B");
	});
});
