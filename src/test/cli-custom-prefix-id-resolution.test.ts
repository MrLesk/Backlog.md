import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
let TEST_DIR: string;

/**
 * Every command that takes a task or draft ID must resolve it through the same identity path,
 * so a bare numeric ID works wherever a prefixed ID works - including under a custom ID prefix.
 */
async function initCustomPrefixProject(): Promise<Core> {
	const core = new Core(TEST_DIR);
	await initializeFilesystemTestProject(core, "Custom Prefix ID Resolution");
	const config = await core.filesystem.loadConfig();
	if (!config) throw new Error("Expected config to be loaded");
	await core.filesystem.saveConfig({ ...config, prefixes: { ...config.prefixes, task: "BACK" } });
	return core;
}

async function createTask(
	core: Core,
	id: string,
	title: string,
	extra: { status?: string; parentTaskId?: string } = {},
): Promise<void> {
	await core.filesystem.saveTask({
		id,
		title,
		status: extra.status ?? "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-08-08",
		rawContent: "",
		...(extra.parentTaskId ? { parentTaskId: extra.parentTaskId } : {}),
	});
}

async function createDraft(core: Core, id: string, title: string): Promise<void> {
	await core.filesystem.saveDraft({
		id,
		title,
		status: "Draft",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-08-08",
		rawContent: "",
	});
}

/** One case per ID-accepting command, run once with a bare numeric ID and once with a prefixed ID. */
interface IdCommandCase {
	name: string;
	/** Receives the ID form under test and returns the CLI arguments to run. */
	args: (id: string) => string[];
	/** Fresh fixtures, because most of these commands move or rewrite the task they target. */
	setup: (core: Core) => Promise<void>;
	/** Expected on stdout for both ID forms. */
	expected: string;
}

const idCommandCases: IdCommandCase[] = [
	{
		name: "task <id>",
		args: (id) => ["task", id, "--plain"],
		setup: async (core) => createTask(core, "BACK-1", "Target task"),
		expected: "BACK-1 - Target task",
	},
	{
		name: "task view",
		args: (id) => ["task", "view", id, "--plain"],
		setup: async (core) => createTask(core, "BACK-1", "Target task"),
		expected: "BACK-1 - Target task",
	},
	{
		name: "task edit",
		args: (id) => ["task", "edit", id, "-s", "In Progress"],
		setup: async (core) => createTask(core, "BACK-1", "Target task"),
		expected: "Updated task BACK-1",
	},
	{
		name: "task archive",
		args: (id) => ["task", "archive", id],
		setup: async (core) => createTask(core, "BACK-1", "Target task"),
		expected: "Archived task BACK-1",
	},
	{
		name: "task complete",
		args: (id) => ["task", "complete", id],
		setup: async (core) => createTask(core, "BACK-1", "Target task", { status: "Done" }),
		expected: "Completed task BACK-1.",
	},
	{
		name: "task demote",
		args: (id) => ["task", "demote", id],
		setup: async (core) => createTask(core, "BACK-1", "Target task"),
		expected: "Demoted task BACK-1",
	},
	{
		name: "task list --parent",
		args: (id) => ["task", "list", "--parent", id, "--plain"],
		setup: async (core) => {
			await createTask(core, "BACK-1", "Target task");
			await createTask(core, "BACK-1.1", "Child task", { parentTaskId: "BACK-1" });
		},
		expected: "BACK-1.1 - Child task",
	},
	{
		name: "task create --parent",
		args: (id) => ["task", "create", "Child", "--parent", id],
		setup: async (core) => createTask(core, "BACK-1", "Target task"),
		expected: "Created task BACK-1.1",
	},
	{
		name: "task create --dep",
		args: (id) => ["task", "create", "Dependent", "--dep", id],
		setup: async (core) => createTask(core, "BACK-1", "Target task"),
		expected: "Created task BACK-2",
	},
	{
		name: "task edit --dep",
		args: (id) => ["task", "edit", "BACK-2", "--dep", id],
		setup: async (core) => {
			await createTask(core, "BACK-1", "Target task");
			await createTask(core, "BACK-2", "Dependent task");
		},
		expected: "Updated task BACK-2",
	},
];

const draftCommandCases: IdCommandCase[] = [
	{
		name: "draft <id>",
		args: (id) => ["draft", id, "--plain"],
		setup: async (core) => createDraft(core, "DRAFT-1", "Target draft"),
		expected: "DRAFT-1 - Target draft",
	},
	{
		name: "draft view",
		args: (id) => ["draft", "view", id, "--plain"],
		setup: async (core) => createDraft(core, "DRAFT-1", "Target draft"),
		expected: "DRAFT-1 - Target draft",
	},
	{
		name: "draft archive",
		args: (id) => ["draft", "archive", id],
		setup: async (core) => createDraft(core, "DRAFT-1", "Target draft"),
		expected: "Archived draft DRAFT-1",
	},
	{
		name: "draft promote",
		args: (id) => ["draft", "promote", id],
		setup: async (core) => createDraft(core, "DRAFT-1", "Target draft"),
		expected: "Promoted draft DRAFT-1",
	},
];

describe("CLI task ID resolution with a custom ID prefix", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-custom-prefix-id-resolution");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	for (const testCase of idCommandCases) {
		for (const [form, id] of [
			["bare numeric", "1"],
			["prefixed", "BACK-1"],
		] as const) {
			it(`resolves a ${form} ID for ${testCase.name}`, async () => {
				const core = await initCustomPrefixProject();
				await testCase.setup(core);

				const result = await $`bun ${CLI_PATH} ${testCase.args(id)}`.cwd(TEST_DIR).nothrow().quiet();

				expect(result.stderr.toString()).not.toContain("not found");
				expect(result.exitCode).toBe(0);
				expect(result.stdout.toString()).toContain(testCase.expected);
			});
		}
	}

	for (const testCase of draftCommandCases) {
		for (const [form, id] of [
			["bare numeric", "1"],
			["prefixed", "DRAFT-1"],
		] as const) {
			it(`resolves a ${form} ID for ${testCase.name}`, async () => {
				const core = await initCustomPrefixProject();
				await testCase.setup(core);

				const result = await $`bun ${CLI_PATH} ${testCase.args(id)}`.cwd(TEST_DIR).nothrow().quiet();

				expect(result.stderr.toString()).not.toContain("not found");
				expect(result.exitCode).toBe(0);
				expect(result.stdout.toString()).toContain(testCase.expected);
			});
		}
	}

	it("stores the canonical dependency ID when a bare numeric ID is supplied", async () => {
		const core = await initCustomPrefixProject();
		await createTask(core, "BACK-1", "Target task");
		await createTask(core, "BACK-2", "Dependent task");

		const result = await $`bun ${CLI_PATH} task edit 2 --dep 1`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("BACK-2"))?.dependencies).toEqual(["BACK-1"]);
	});

	it("reports missing IDs with the configured prefix instead of the default one", async () => {
		const core = await initCustomPrefixProject();
		await createTask(core, "BACK-1", "Target task");

		const parentFilter = await $`bun ${CLI_PATH} task list --parent 999 --plain`.cwd(TEST_DIR).nothrow().quiet();
		expect(parentFilter.exitCode).toBe(1);
		expect(parentFilter.stderr.toString()).toContain("Parent task BACK-999 not found.");

		const parentCreate = await $`bun ${CLI_PATH} task create Child --parent 999`.cwd(TEST_DIR).nothrow().quiet();
		expect(parentCreate.exitCode).toBe(1);
		expect(parentCreate.stderr.toString()).toContain("Parent task BACK-999 not found.");
	});

	it("fails closed on every ID-accepting command when the ID is ambiguous", async () => {
		const core = await initCustomPrefixProject();
		await createTask(core, "BACK-1", "Target task");
		// A zero-padded twin claims the same identity, so nothing may guess a winner.
		const tasksDir = core.filesystem.tasksDir;
		await Bun.write(
			join(tasksDir, "back-01 - Duplicate.md"),
			await Bun.file(join(tasksDir, "back-1 - Target-task.md")).text(),
		);

		for (const args of [
			["task", "1", "--plain"],
			["task", "view", "1", "--plain"],
			["task", "edit", "1", "-s", "In Progress"],
			["task", "archive", "1"],
			["task", "complete", "1"],
			["task", "demote", "1"],
		]) {
			const result = await $`bun ${CLI_PATH} ${args}`.cwd(TEST_DIR).nothrow().quiet();

			expect(result.exitCode).not.toBe(0);
			const output = `${result.stdout.toString()}${result.stderr.toString()}`;
			expect(output).toContain("is ambiguous");
			expect(output).toContain("back-01 - Duplicate.md");
		}

		// The mutation attempts above must have left the conflicting files untouched.
		expect(await Bun.file(join(tasksDir, "back-1 - Target-task.md")).exists()).toBe(true);
		expect(await Bun.file(join(tasksDir, "back-01 - Duplicate.md")).exists()).toBe(true);
	});
});
