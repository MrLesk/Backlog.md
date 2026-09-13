import { afterEach, describe, expect, it } from "bun:test";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
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

describe("archived task IDs remain reserved", () => {
	let testDir: string;

	afterEach(async () => {
		if (testDir) await safeCleanup(testDir);
	});

	async function createProject(git = false): Promise<Core> {
		testDir = createUniqueTestDir("archived-task-id-allocation");
		const root = join(testDir, "repo");
		await mkdir(root, { recursive: true });
		const core = new Core(root);
		if (git) {
			await $`git init -b main`.cwd(root).quiet();
			await initializeTestProject(core, "Archived ID Test", true);
		} else {
			await initializeFilesystemTestProject(core, "Archived ID Test");
		}
		return core;
	}

	for (const git of [false, true]) {
		it(`the CLI increments after archiving every task (${git ? "Git" : "filesystem-only"})`, async () => {
			const core = await createProject(git);
			const root = core.fs.rootDir;
			await $`bun ${CLI_PATH} task create "Original task"`.cwd(root).quiet();
			await $`bun ${CLI_PATH} task archive TASK-1`.cwd(root).quiet();
			expect(await core.fs.listTasks()).toHaveLength(0);

			await $`bun ${CLI_PATH} task create "Next task"`.cwd(root).quiet();

			expect((await core.fs.loadTask("TASK-2"))?.title).toBe("Next task");
			expect((await core.fs.listArchivedTasks()).map((task) => task.id)).toEqual(["TASK-1"]);
		});
	}

	it("preserves custom prefixes and padding after archiving the highest task", async () => {
		const core = await createProject();
		const config = await core.fs.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		config.prefixes = { task: "MATH" };
		config.zeroPaddedIds = 3;
		await core.fs.saveConfig(config);

		await core.createTaskFromInput({ title: "First" }, false);
		const highest = await core.createTaskFromInput({ title: "Highest" }, false);
		expect(highest.task.id).toBe("MATH-002");
		expect((await core.archiveTask(highest.task.id, false)).success).toBe(true);

		const next = await core.createTaskFromInput({ title: "Next" }, false);
		expect(next.task.id).toBe("MATH-003");
	});

	it("increments padded child IDs after archiving the highest child", async () => {
		const core = await createProject();
		const config = await core.fs.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		config.prefixes = { task: "MATH" };
		config.zeroPaddedIds = 3;
		await core.fs.saveConfig(config);
		const parent = await core.createTaskFromInput({ title: "Parent" }, false);
		const child = await core.createTaskFromInput({ title: "First child", parentTaskId: parent.task.id }, false);
		expect(child.task.id).toBe("MATH-001.01");
		expect((await core.archiveTask(child.task.id, false)).success).toBe(true);

		const next = await core.createTaskFromInput({ title: "Next child", parentTaskId: "1" }, false);
		expect(next.task.id).toBe("MATH-001.02");
		expect(next.task.parentTaskId).toBe(parent.task.id);
	});

	it("promotes a draft using the next task ID after the archive", async () => {
		const core = await createProject();
		const original = await core.createTaskFromInput({ title: "Archived task" }, false);
		expect((await core.archiveTask(original.task.id, false)).success).toBe(true);
		const draft = await core.createTaskFromInput({ title: "Promoted task", status: "Draft" }, false);

		expect(await core.promoteDraft(draft.task.id, false)).toBe(true);
		expect((await core.fs.loadTask("TASK-2"))?.title).toBe("Promoted task");
		expect(await core.fs.loadDraft(draft.task.id)).toBeNull();
	});

	it("reserves an archived filename even when its Markdown cannot be parsed", async () => {
		const core = await createProject();
		const archivedPath = join(core.fs.archiveTasksDir, "task-009 - Malformed.md");
		await Bun.write(archivedPath, "---\nid: [unclosed\n---\nMalformed archived task\n");

		const next = await core.createTaskFromInput({ title: "After malformed archive" }, false);

		expect(next.task.id).toBe("TASK-10");
		expect(await Bun.file(archivedPath).text()).toContain("id: [unclosed");
	});

	it("reserves both identities when archived filenames and frontmatter disagree", async () => {
		const core = await createProject();
		const contentPath = join(core.fs.archiveTasksDir, "task-005 - Content identity.md");
		const content = "---\nid: TASK-017\ntitle: Content identity\n---\nPreserved history\n";
		await Bun.write(contentPath, content);
		const afterContent = await core.createTaskFromInput({ title: "After content identity" }, false);
		expect(afterContent.task.id).toBe("TASK-18");

		const filenamePath = join(core.fs.archiveTasksDir, "task-025 - Filename identity.md");
		const filenameContent = "---\nid: TASK-003\ntitle: Filename identity\n---\nPreserved history\n";
		await Bun.write(filenamePath, filenameContent);
		const afterFilename = await core.createTaskFromInput({ title: "After filename identity" }, false);
		expect(afterFilename.task.id).toBe("TASK-26");
		expect(await Bun.file(contentPath).text()).toBe(content);
		expect(await Bun.file(filenamePath).text()).toBe(filenameContent);
	});

	it("reserves an uncommitted archived task in a sibling worktree", async () => {
		const core = await createProject(true);
		const sibling = join(testDir, "sibling");
		await $`git worktree add ${sibling} -b sibling-archive`.cwd(core.fs.rootDir).quiet();
		const siblingCore = new Core(sibling);
		const archived = await siblingCore.createTaskFromInput({ title: "Sibling task" }, false);
		expect((await siblingCore.archiveTask(archived.task.id, false)).success).toBe(true);
		expect(await siblingCore.fs.listTasks()).toHaveLength(0);

		const next = await core.createTaskFromInput({ title: "Main task" }, false);

		expect(next.task.id).toBe("TASK-2");
	});

	it("reserves uppercase filenames and differing archive IDs in a sibling worktree", async () => {
		const core = await createProject(true);
		const sibling = join(testDir, "sibling");
		await $`git worktree add ${sibling} -b sibling-archive-drift`.cwd(core.fs.rootDir).quiet();
		const siblingCore = new Core(sibling);
		const archivedPath = join(siblingCore.fs.archiveTasksDir, "TASK-005 - Archive drift.md");
		const content = "---\nid: TASK-017\ntitle: Archive drift\n---\nPreserved history\n";
		await Bun.write(archivedPath, content);

		const next = await core.createTaskFromInput({ title: "Main task" }, false);

		expect(next.task.id).toBe("TASK-18");
		expect(await Bun.file(archivedPath).text()).toBe(content);
	});

	it("reserves an archived task committed only on another branch", async () => {
		const core = await createProject(true);
		const root = core.fs.rootDir;
		await $`git switch -c branch-archive`.cwd(root).quiet();
		const branchCore = new Core(root);
		const archived = await branchCore.createTaskFromInput({ title: "Branch task" }, false);
		expect((await branchCore.archiveTask(archived.task.id, false)).success).toBe(true);
		await $`git add backlog`.cwd(root).quiet();
		await $`git commit -m "Archive branch task"`.cwd(root).quiet();
		await $`git switch main`.cwd(root).quiet();
		const mainCore = new Core(root);
		expect(await mainCore.fs.listTasks()).toHaveLength(0);
		expect(await mainCore.fs.listArchivedTasks()).toHaveLength(0);

		const next = await mainCore.createTaskFromInput({ title: "Main task" }, false);

		expect(next.task.id).toBe("TASK-2");
	});

	for (const git of [false, true]) {
		it(`reserves noncanonical archived frontmatter through the CLI (${git ? "Git" : "filesystem-only"})`, async () => {
			const core = await createProject(git);
			const config = await core.fs.loadConfig();
			if (!config) throw new Error("Expected initialized config");
			config.prefixes = { task: "MATH" };
			config.zeroPaddedIds = 3;
			await core.fs.saveConfig(config);
			const archivePath = join(core.fs.archiveTasksDir, "history.md");
			const content = "---\nid: mAtH-050\ntitle: Renamed history\n---\nPreserved bytes\n";
			await Bun.write(archivePath, content);

			await $`bun ${CLI_PATH} task create "After renamed history"`.cwd(core.fs.rootDir).quiet();

			expect((await core.fs.listTasks()).map((task) => task.id)).toEqual(["MATH-051"]);
			expect(await Bun.file(archivePath).text()).toBe(content);
		});
	}

	it("reserves a noncanonical padded child archive", async () => {
		const core = await createProject();
		const config = await core.fs.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		config.prefixes = { task: "MATH" };
		config.zeroPaddedIds = 3;
		await core.fs.saveConfig(config);
		const parent = await core.createTaskFromInput({ title: "Parent" }, false);
		const archivePath = join(core.fs.archiveTasksDir, "child-history.md");
		const content = "---\nid: math-001.09\ntitle: Renamed child\n---\nPreserved bytes\n";
		await Bun.write(archivePath, content);

		const next = await core.createTaskFromInput({ title: "Next child", parentTaskId: parent.task.id }, false);

		expect(next.task.id).toBe("MATH-001.10");
		expect(await Bun.file(archivePath).text()).toBe(content);
	});

	it("reserves noncanonical archived frontmatter in an uncommitted sibling worktree", async () => {
		const core = await createProject(true);
		const sibling = join(testDir, "sibling");
		await $`git worktree add ${sibling} -b sibling-renamed-history`.cwd(core.fs.rootDir).quiet();
		const siblingCore = new Core(sibling);
		const archivePath = join(siblingCore.fs.archiveTasksDir, "history.md");
		const content = "---\nid: TASK-050\ntitle: Renamed history\n---\nPreserved bytes\n";
		await Bun.write(archivePath, content);

		const next = await core.createTaskFromInput({ title: "Main task" }, false);

		expect(next.task.id).toBe("TASK-51");
		expect(await Bun.file(archivePath).text()).toBe(content);
	});

	it("reserves noncanonical archived frontmatter committed only on another branch", async () => {
		const core = await createProject(true);
		const root = core.fs.rootDir;
		await $`git switch -c renamed-archive-branch`.cwd(root).quiet();
		const archivePath = join(core.fs.archiveTasksDir, "history.md");
		const content = "---\nid: TASK-050\ntitle: Renamed history\n---\nPreserved bytes\n";
		await Bun.write(archivePath, content);
		await $`git add backlog`.cwd(root).quiet();
		await $`git commit -m "Retain renamed history"`.cwd(root).quiet();
		await $`git switch main`.cwd(root).quiet();

		const next = await new Core(root).createTaskFromInput({ title: "Main task" }, false);

		expect(next.task.id).toBe("TASK-51");
		expect(await $`git show renamed-archive-branch:backlog/archive/tasks/history.md`.cwd(root).text()).toBe(content);
	});

	it("allocates distinct IDs above noncanonical archives in simultaneous sibling CLI processes", async () => {
		const core = await createProject(true);
		const sibling = join(testDir, "sibling");
		await $`git worktree add ${sibling} -b concurrent-renamed-history`.cwd(core.fs.rootDir).quiet();
		const siblingCore = new Core(sibling);
		const archivePath = join(siblingCore.fs.archiveTasksDir, "history.md");
		const content = "---\nid: TASK-050\ntitle: Renamed history\n---\nPreserved bytes\n";
		await Bun.write(archivePath, content);

		await Promise.all([
			$`bun ${CLI_PATH} task create "Concurrent main"`.cwd(core.fs.rootDir).quiet(),
			$`bun ${CLI_PATH} task create "Concurrent sibling"`.cwd(sibling).quiet(),
		]);

		const ids = [...(await core.fs.listTasks()), ...(await siblingCore.fs.listTasks())].map((task) => task.id);
		expect(ids.sort()).toEqual(["TASK-51", "TASK-52"]);
		expect(await Bun.file(archivePath).text()).toBe(content);
	});

	it("reserves both archived branch identities and reuses their immutable blob cache", async () => {
		const core = await createProject(true);
		const root = core.fs.rootDir;
		await $`git switch -c conflicting-archive-branch`.cwd(root).quiet();
		const history = [
			["TASK-005 - Content identity.md", "---\nid: task-017\ntitle: Content identity\n---\nHistory\n"],
			["task-025 - Filename identity.md", "---\nid: TASK-003\ntitle: Filename identity\n---\nHistory\n"],
			["task-030 - Malformed.md", "---\nid: [unclosed\n---\nHistory\n"],
		] as const;
		for (const [filename, content] of history) await Bun.write(join(core.fs.archiveTasksDir, filename), content);
		await $`git add backlog`.cwd(root).quiet();
		await $`git commit -m "Preserve conflicting archive identities"`.cwd(root).quiet();
		await $`git switch main`.cwd(root).quiet();
		// The added frontmatter reservation must not become a lifecycle winner:
		// this live record remains visible under the pre-existing branch rules.
		await Bun.write(
			join(core.fs.tasksDir, "task-017 - Current record.md"),
			"---\nid: TASK-017\ntitle: Current record\nstatus: To Do\n---\nCurrent evidence\n",
		);
		const mainCore = new Core(root);
		const showFile = mainCore.gitOps.showFile.bind(mainCore.gitOps);
		let archiveReads = 0;
		mainCore.gitOps.showFile = async (commit, path) => {
			if (path.includes("/archive/tasks/")) archiveReads += 1;
			return showFile(commit, path);
		};
		try {
			const first = await mainCore.getOccupiedTaskIds();
			expect(first).toEqual(expect.arrayContaining(["TASK-005", "TASK-017", "TASK-025", "TASK-003", "TASK-030"]));
			expect(await mainCore.getOccupiedTaskIds()).toEqual(first);
			expect((await mainCore.queryTasks()).map((task) => task.id)).toEqual(["TASK-017"]);
			expect(archiveReads).toBe(history.length);
			const next = await mainCore.createTaskFromInput({ title: "After conflicting history" }, false);
			expect(next.task.id).toBe("TASK-31");
			expect(archiveReads).toBe(history.length);
		} finally {
			mainCore.gitOps.showFile = showFile;
			mainCore.disposeSearchService();
			mainCore.disposeContentStore();
		}
		for (const [filename, content] of history) {
			expect(await $`git show ${`conflicting-archive-branch:backlog/archive/tasks/${filename}`}`.cwd(root).text()).toBe(
				content,
			);
		}
	});

	for (const siblingArchive of [false, true]) {
		it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
			`fails closed when a noncanonical ${siblingArchive ? "sibling" : "local"} archive cannot be read`,
			async () => {
				const core = await createProject(siblingArchive);
				let archiveCore = core;
				if (siblingArchive) {
					const sibling = join(testDir, "sibling");
					await $`git worktree add ${sibling} -b unreadable-archive`.cwd(core.fs.rootDir).quiet();
					archiveCore = new Core(sibling);
				}
				const path = join(archiveCore.fs.archiveTasksDir, "history.md");
				const content = "---\nid: TASK-050\ntitle: Preserved history\n---\nHistory\n";
				await Bun.write(path, content);
				await chmod(path, 0o000);
				try {
					await expect(core.createTaskFromInput({ title: "Must not be allocated" }, false)).rejects.toThrow();
					expect(await core.fs.listTasks()).toHaveLength(0);
				} finally {
					await chmod(path, 0o644);
				}
				expect(await Bun.file(path).text()).toBe(content);
			},
		);
	}

	it("refuses partial branch reservations after an archive read error and retries safely", async () => {
		const core = await createProject(true);
		const root = core.fs.rootDir;
		await $`git switch -c unreadable-archive-branch`.cwd(root).quiet();
		const path = join(core.fs.archiveTasksDir, "history.md");
		await Bun.write(path, "---\nid: TASK-050\ntitle: Preserved history\n---\nHistory\n");
		await $`git add backlog`.cwd(root).quiet();
		await $`git commit -m "Preserve archive identity"`.cwd(root).quiet();
		await $`git switch main`.cwd(root).quiet();
		const mainCore = new Core(root);
		const showFile = mainCore.gitOps.showFile.bind(mainCore.gitOps);
		mainCore.gitOps.showFile = async (commit, filename) => {
			if (filename.endsWith("archive/tasks/history.md")) throw new Error("injected archive blob read failure");
			return showFile(commit, filename);
		};
		try {
			await expect(mainCore.createTaskFromInput({ title: "Must not be allocated" }, false)).rejects.toThrow(
				"incomplete",
			);
			expect(await mainCore.fs.listTasks()).toHaveLength(0);
			for (const title of ["Alpha", "Beta"]) {
				await Bun.write(
					join(mainCore.fs.tasksDir, `task-1 - ${title}.md`),
					`---\nid: TASK-1\ntitle: ${title}\nstatus: To Do\n---\n${title} body\n`,
				);
			}
			await expect(mainCore.previewDuplicateTaskIdRepair({ includeBranches: true })).rejects.toThrow("incomplete");
		} finally {
			mainCore.gitOps.showFile = showFile;
		}
		try {
			const recovered = await mainCore.previewDuplicateTaskIdRepair({ includeBranches: true });
			expect(recovered.changes.map((change) => change.newId)).toEqual(["TASK-51"]);
			const next = await mainCore.createTaskFromInput({ title: "After recovered read" }, false);
			expect(next.task.id).toBe("TASK-51");
		} finally {
			mainCore.disposeSearchService();
			mainCore.disposeContentStore();
		}
	});
});
