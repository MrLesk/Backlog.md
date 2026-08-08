import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	commitSamePathBranchTaskVariant,
	createUniqueTestDir,
	initializeFilesystemTestProject,
	initializeTestProject,
	safeCleanup,
} from "./test-utils.ts";

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

	it("stores one dependency when equivalent ID forms name the same task", async () => {
		const core = await initCustomPrefixProject();
		await createTask(core, "BACK-1", "Target task");
		await createTask(core, "BACK-2", "Dependent task");

		const edited = await $`bun ${CLI_PATH} task edit 2 --dep 1,BACK-1`.cwd(TEST_DIR).nothrow().quiet();
		expect(edited.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("BACK-2"))?.dependencies).toEqual(["BACK-1"]);

		const created = await $`bun ${CLI_PATH} task create Dependent --dep BACK-1,1,back-001`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();
		expect(created.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("BACK-3"))?.dependencies).toEqual(["BACK-1"]);
	});

	it("fails closed when a dependency ID matches two files claiming one identity", async () => {
		const core = await initCustomPrefixProject();
		await createTask(core, "BACK-1", "Target task");
		await createTask(core, "BACK-2", "Dependent task");
		// BACK-01 is the same identity as BACK-1, so no dependency write may guess between them.
		// saveTask deletes same-identity files by design, so the twin is written straight to disk.
		const tasksDir = core.filesystem.tasksDir;
		await Bun.write(
			join(tasksDir, "back-01 - Duplicate-identity.md"),
			(await Bun.file(join(tasksDir, "back-1 - Target-task.md")).text()).replace("id: BACK-1", "id: BACK-01"),
		);

		for (const args of [
			["task", "edit", "2", "--dep", "1"],
			["task", "edit", "2", "--dep", "BACK-1"],
			["task", "create", "Dependent", "--dep", "1"],
		]) {
			const result = await $`bun ${CLI_PATH} ${args}`.cwd(TEST_DIR).nothrow().quiet();

			expect(result.exitCode).not.toBe(0);
			const output = `${result.stdout.toString()}${result.stderr.toString()}`;
			// The colliding identity is named, not the bare input the user typed.
			expect(output).toContain("Task ID BACK-1 is ambiguous");
			expect(output).toContain("backlog doctor");
		}

		expect((await core.filesystem.loadTask("BACK-2"))?.dependencies ?? []).toEqual([]);
		expect(await core.filesystem.loadTask("BACK-3")).toBeNull();
	});

	it("fails closed when a dependency ID matches two files declaring the exact same ID", async () => {
		const core = await initCustomPrefixProject();
		await createTask(core, "BACK-1", "Target task");
		await createTask(core, "BACK-2", "Dependent task");
		// Two files spelling the ID identically still collide. The task corpus keeps one entry per
		// ID, so only the identity index can see this; dependency writes must consult it.
		const tasksDir = core.filesystem.tasksDir;
		await Bun.write(
			join(tasksDir, "back-1 - Duplicate-file.md"),
			await Bun.file(join(tasksDir, "back-1 - Target-task.md")).text(),
		);

		for (const args of [
			["task", "edit", "2", "--dep", "1"],
			["task", "edit", "2", "--dep", "BACK-1"],
			["task", "create", "Dependent", "--dep", "1"],
		]) {
			const result = await $`bun ${CLI_PATH} ${args}`.cwd(TEST_DIR).nothrow().quiet();

			expect(result.exitCode).not.toBe(0);
			const output = `${result.stdout.toString()}${result.stderr.toString()}`;
			expect(output).toContain("Task ID BACK-1 is ambiguous");
		}

		expect((await core.filesystem.loadTask("BACK-2"))?.dependencies ?? []).toEqual([]);
		expect(await core.filesystem.loadTask("BACK-3")).toBeNull();
	});

	// Both collision shapes: a differently spelled twin (BACK-01) and an identically spelled one.
	for (const [shape, twinFile, rewrite] of [
		[
			"a zero-padded twin",
			"back-01 - Duplicate-identity.md",
			(text: string) => text.replace("id: BACK-1", "id: BACK-01"),
		],
		["an identical ID", "back-1 - Duplicate-file.md", (text: string) => text],
	] as const) {
		it(`fails closed instead of listing children when the parent filter ID collides with ${shape}`, async () => {
			const core = await initCustomPrefixProject();
			await createTask(core, "BACK-1", "Target task");
			await createTask(core, "BACK-1.1", "Child task", { parentTaskId: "BACK-1" });
			const tasksDir = core.filesystem.tasksDir;
			await Bun.write(
				join(tasksDir, twinFile),
				rewrite(await Bun.file(join(tasksDir, "back-1 - Target-task.md")).text()),
			);

			for (const parent of ["1", "BACK-1"]) {
				const result = await $`bun ${CLI_PATH} task list --parent ${parent} --plain`.cwd(TEST_DIR).nothrow().quiet();

				expect(result.exitCode).not.toBe(0);
				const output = `${result.stdout.toString()}${result.stderr.toString()}`;
				expect(output).toContain("Task ID BACK-1 is ambiguous");
				// The command must fail before emitting any child task data.
				expect(result.stdout.toString()).not.toContain("BACK-1.1 - Child task");
			}
		});
	}

	it("resolves the parent filter from the local corpus in every output mode", async () => {
		// A branch variant spelling BACK-1 as BACK-001 sits at its own path. The cross-branch corpus
		// therefore holds two entries for identity BACK-1 while the local corpus holds one, so the
		// parent filter must not resolve from a cross-branch list: whichever corpus a mode used would
		// otherwise decide whether the same argument is accepted.
		const core = new Core(TEST_DIR);
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name Test`.cwd(TEST_DIR).quiet();
		await initializeTestProject(core, "Cross Branch Parent Filter");
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected config to be loaded");
		await core.filesystem.saveConfig({
			...config,
			prefixes: { ...config.prefixes, task: "BACK" },
			checkActiveBranches: true,
			remoteOperations: false,
		});
		await createTask(core, "BACK-1.1", "Child task", { parentTaskId: "BACK-1" });
		await commitSamePathBranchTaskVariant(
			core,
			{
				id: "BACK-1",
				title: "Parent local",
				status: "To Do",
				assignee: [],
				labels: [],
				dependencies: [],
				createdDate: "2026-08-09",
				rawContent: "",
			},
			{
				id: "BACK-001",
				title: "Parent branch variant",
				status: "To Do",
				assignee: [],
				labels: [],
				dependencies: [],
				createdDate: "2026-08-09",
				rawContent: "",
			},
			join(core.filesystem.tasksDir, "back-001 - Parent-branch-variant.md"),
		);

		// The corpus the resolver reads sees one BACK-1; a cross-branch corpus would see two.
		const localMatches = (await core.queryTasks({ includeCrossBranch: false })).filter((task) =>
			["BACK-1", "BACK-001"].includes(task.id),
		);
		const crossBranchMatches = (await core.queryTasks()).filter((task) => ["BACK-1", "BACK-001"].includes(task.id));
		expect(localMatches).toHaveLength(1);
		expect(crossBranchMatches.length).toBeGreaterThan(1);

		// Selecting the parent from the local corpus finds exactly one candidate, and the shared
		// identity check then fails closed because the branch variant claims the same identity.
		const result = await $`bun ${CLI_PATH} task list --parent 1 --plain`.cwd(TEST_DIR).nothrow().quiet();
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(result.exitCode).not.toBe(0);
		expect(output).toContain("Task ID BACK-1 is ambiguous");
		expect(output).not.toContain("Parent task BACK-1 not found.");
		expect(result.stdout.toString()).not.toContain("BACK-1.1 - Child task");
	});

	it("archives and promotes the draft file named by the argument, not by its frontmatter ID", async () => {
		// A drifted draft file (filename draft-1, frontmatter DRAFT-2) alongside a real draft-2 must
		// not redirect the mutation onto the other file.
		const core = await initCustomPrefixProject();
		await createDraft(core, "DRAFT-2", "Two");
		const draftsDir = await core.filesystem.getDraftsDir();
		await Bun.write(
			join(draftsDir, "draft-1 - One.md"),
			(await Bun.file(join(draftsDir, "draft-2 - Two.md")).text()).replace("title: Two", "title: One"),
		);

		const archived = await $`bun ${CLI_PATH} draft archive 1`.cwd(TEST_DIR).nothrow().quiet();
		expect(archived.exitCode).toBe(0);
		expect(archived.stdout.toString()).toContain("Archived draft DRAFT-1");
		expect(await Bun.file(join(draftsDir, "draft-1 - One.md")).exists()).toBe(false);
		expect(await Bun.file(join(draftsDir, "draft-2 - Two.md")).exists()).toBe(true);

		// Same for promote: the remaining draft-2 file must be the one promoted when asked for 2.
		const promoted = await $`bun ${CLI_PATH} draft promote 2`.cwd(TEST_DIR).nothrow().quiet();
		expect(promoted.exitCode).toBe(0);
		expect(promoted.stdout.toString()).toContain("Promoted draft DRAFT-2");
		expect(await Bun.file(join(draftsDir, "draft-2 - Two.md")).exists()).toBe(false);
	});

	it("fails closed when a bare dependency ID matches both a task and a draft", async () => {
		const core = await initCustomPrefixProject();
		await createTask(core, "BACK-1", "Target task");
		await createTask(core, "BACK-2", "Dependent task");
		// Task and draft IDs come from separate counters, so a bare 1 names two different tasks.
		await createDraft(core, "DRAFT-1", "Target draft");

		const ambiguous = await $`bun ${CLI_PATH} task edit 2 --dep 1`.cwd(TEST_DIR).nothrow().quiet();
		expect(ambiguous.exitCode).not.toBe(0);
		const output = `${ambiguous.stdout.toString()}${ambiguous.stderr.toString()}`;
		expect(output).toContain("Dependency ID 1 is ambiguous");
		expect(output).toContain("back-1 - Target-task.md");
		expect(output).toContain("draft-1 - Target-draft.md");
		expect((await core.filesystem.loadTask("BACK-2"))?.dependencies ?? []).toEqual([]);

		// A fully qualified ID still names exactly one of them, in either namespace.
		const onTask = await $`bun ${CLI_PATH} task edit 2 --dep BACK-1`.cwd(TEST_DIR).nothrow().quiet();
		expect(onTask.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("BACK-2"))?.dependencies).toEqual(["BACK-1"]);

		const onDraft = await $`bun ${CLI_PATH} task edit 2 --dep DRAFT-1`.cwd(TEST_DIR).nothrow().quiet();
		expect(onDraft.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("BACK-2"))?.dependencies).toEqual(["DRAFT-1"]);
	});

	it("rejects a blank parent filter instead of listing every task", async () => {
		const core = await initCustomPrefixProject();
		await createTask(core, "BACK-1", "Target task");
		await createTask(core, "BACK-2", "Other task");

		for (const parent of ["   ", ""]) {
			const result = await $`bun ${CLI_PATH} task list --parent ${parent} --plain`.cwd(TEST_DIR).nothrow().quiet();

			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain(
				"Cannot use an empty value with --parent. Omit the flag to list every task.",
			);
			expect(result.stdout.toString()).not.toContain("BACK-2 - Other task");
		}

		// Omitting the flag still lists everything.
		const unfiltered = await $`bun ${CLI_PATH} task list --plain`.cwd(TEST_DIR).nothrow().quiet();
		expect(unfiltered.exitCode).toBe(0);
		expect(unfiltered.stdout.toString()).toContain("BACK-2 - Other task");
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
