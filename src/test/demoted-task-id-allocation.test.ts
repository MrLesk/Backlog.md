import { afterEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	createUniqueTestDir,
	initializeFilesystemTestProject,
	initializeTestProject,
	safeCleanup,
} from "./test-utils.ts";

const CLI_PATH = getTestCliPath();

describe("demoted task IDs remain reserved", () => {
	let testDir: string;

	afterEach(async () => {
		if (testDir) await safeCleanup(testDir);
	});

	async function createProject(git = false): Promise<Core> {
		testDir = createUniqueTestDir("demoted-task-id-allocation");
		const root = join(testDir, "repo");
		await mkdir(root, { recursive: true });
		const core = new Core(root);
		if (git) {
			await $`git init -b main`.cwd(root).quiet();
			await initializeTestProject(core, "Demoted ID Test", true);
		} else {
			await initializeFilesystemTestProject(core, "Demoted ID Test");
		}
		return core;
	}

	async function originalRecord(core: Core, id: string) {
		const task = await core.fs.loadTask(id);
		if (!task?.filePath) throw new Error(`Missing task file: ${id}`);
		return {
			path: task.filePath,
			archivedPath: join(core.fs.archiveTasksDir, basename(task.filePath)),
			content: await Bun.file(task.filePath).text(),
		};
	}

	for (const git of [false, true]) {
		it(`the CLI allocates TASK-4 after demoting TASK-3 (${git ? "Git" : "filesystem-only"})`, async () => {
			const core = await createProject(git);
			const root = core.fs.rootDir;
			for (const title of ["First", "Second", "Third"]) {
				await $`bun ${CLI_PATH} task create ${title}`.cwd(root).quiet();
			}
			const original = await originalRecord(core, "TASK-3");

			await $`bun ${CLI_PATH} task demote TASK-3`.cwd(root).quiet();
			await $`bun ${CLI_PATH} task create "After demotion"`.cwd(root).quiet();

			expect((await core.fs.loadTask("TASK-4"))?.title).toBe("After demotion");
			expect(await core.fs.loadTask("TASK-3")).toBeNull();
			expect((await core.fs.listDrafts()).map((draft) => draft.title)).toEqual(["Third"]);
			expect(await Bun.file(original.archivedPath).text()).toBe(original.content);
		});
	}

	it("editing a task into Draft preserves its original bytes while applying updates only to the draft", async () => {
		const core = await createProject();
		const { task } = await core.createTaskFromInput(
			{ title: "Original title", description: "Original description", status: "In Progress" },
			false,
		);
		const original = await originalRecord(core, task.id);

		await core.editTaskOrDraft(
			task.id,
			{ status: "Draft", title: "Revised draft title", description: "Revised draft description" },
			false,
		);

		expect(await Bun.file(original.archivedPath).text()).toBe(original.content);
		expect(await Bun.file(original.path).exists()).toBe(false);
		const drafts = await core.fs.listDrafts();
		expect(drafts).toHaveLength(1);
		expect(drafts[0]?.title).toBe("Revised draft title");
		expect(drafts[0]?.description).toBe("Revised draft description");
		expect(drafts[0]?.status).toBe("Draft");
		expect((await core.createTaskFromInput({ title: "Next" }, false)).task.id).toBe("TASK-2");
	});

	it("increments custom-prefix padded child IDs after demotion", async () => {
		const core = await createProject();
		const config = await core.fs.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		config.prefixes = { task: "MATH" };
		config.zeroPaddedIds = 3;
		await core.fs.saveConfig(config);
		const { task: parent } = await core.createTaskFromInput({ title: "Parent" }, false);
		const { task: child } = await core.createTaskFromInput({ title: "Child", parentTaskId: parent.id }, false);
		expect(child.id).toBe("MATH-001.01");

		expect((await core.demoteTask(child.id, false)).success).toBe(true);
		const next = await core.createTaskFromInput({ title: "Next child", parentTaskId: "1" }, false);

		expect(next.task.id).toBe("MATH-001.02");
		expect((await core.fs.listArchivedTasks()).map((task) => task.id)).toEqual([child.id]);
	});

	for (const editStatus of [false, true]) {
		it(`preserves retired IDs after demotion and ${editStatus ? "edit-status" : "direct"} promotion`, async () => {
			const core = await createProject();
			const { task } = await core.createTaskFromInput({ title: "Round trip" }, false);
			const original = await originalRecord(core, task.id);
			expect((await core.demoteTask(task.id, false)).success).toBe(true);
			const [draft] = await core.fs.listDrafts();
			if (!draft) throw new Error("Expected demoted draft");

			if (editStatus) {
				const result = await core.editTaskOrDraft(draft.id, { status: "To Do" }, false);
				expect(result.task.id).toBe("TASK-2");
			} else {
				expect(await core.promoteDraft(draft.id, false)).toBe(true);
			}

			expect((await core.fs.loadTask("TASK-2"))?.title).toBe("Round trip");
			expect(await core.fs.listDrafts()).toHaveLength(0);
			expect(await Bun.file(original.archivedPath).text()).toBe(original.content);
			expect((await core.createTaskFromInput({ title: "Next" }, false)).task.id).toBe("TASK-3");
		});
	}

	it("keeps the old task ID reserved after the resulting draft is archived", async () => {
		const core = await createProject();
		const { task } = await core.createTaskFromInput({ title: "Retired task" }, false);
		const original = await originalRecord(core, task.id);
		expect((await core.demoteTask(task.id, false)).success).toBe(true);
		const [draft] = await core.fs.listDrafts();
		if (!draft) throw new Error("Expected demoted draft");

		expect(await core.archiveDraft(draft.id, false)).toBe(true);

		expect(await core.fs.listTasks()).toHaveLength(0);
		expect(await core.fs.listDrafts()).toHaveLength(0);
		expect((await core.createTaskFromInput({ title: "Next" }, false)).task.id).toBe("TASK-2");
		expect(await Bun.file(original.archivedPath).text()).toBe(original.content);
	});

	it("the filesystem demote and promote paths retain the retired task identity", async () => {
		const core = await createProject();
		const { task } = await core.createTaskFromInput({ title: "Filesystem round trip" }, false);
		const original = await originalRecord(core, task.id);

		expect(await core.fs.demoteTask(task.id)).toBe(true);
		const [draft] = await core.fs.listDrafts();
		if (!draft) throw new Error("Expected demoted draft");
		expect(await core.fs.promoteDraft(draft.id)).toBe(true);

		expect((await core.fs.loadTask("TASK-2"))?.title).toBe("Filesystem round trip");
		expect(await Bun.file(original.archivedPath).text()).toBe(original.content);
	});

	it("reserves an uncommitted demoted task in a sibling worktree", async () => {
		const core = await createProject(true);
		const sibling = join(testDir, "sibling");
		await $`git worktree add ${sibling} -b sibling-demotion`.cwd(core.fs.rootDir).quiet();
		const siblingCore = new Core(sibling);
		const { task } = await siblingCore.createTaskFromInput({ title: "Sibling task" }, false);
		expect((await siblingCore.demoteTask(task.id, false)).success).toBe(true);

		expect((await core.createTaskFromInput({ title: "Main task" }, false)).task.id).toBe("TASK-2");
	});

	for (const editStatus of [false, true]) {
		it(`auto-commits the retired task so a fresh clone reserves its ID (${editStatus ? "edit-status" : "direct"})`, async () => {
			const core = await createProject(true);
			const { task } = await core.createTaskFromInput({ title: "Committed task" }, true);
			const original = await originalRecord(core, task.id);
			if (editStatus) {
				await core.editTaskOrDraft(task.id, { status: "Draft", title: "Committed draft" }, true);
			} else {
				expect((await core.demoteTask(task.id, true)).success).toBe(true);
			}

			const clone = join(testDir, "clone");
			await $`git clone --no-local ${core.fs.rootDir} ${clone}`.quiet();
			const cloneCore = new Core(clone);

			expect((await cloneCore.createTaskFromInput({ title: "Clone task" }, false)).task.id).toBe("TASK-2");
			expect(await Bun.file(join(cloneCore.fs.archiveTasksDir, basename(original.path))).text()).toBe(original.content);
		});
	}
});
