import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { utimes } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Document, Task } from "../types/index.ts";
import { AmbiguousTaskIdError } from "../utils/task-path.ts";
import {
	commitSamePathBranchTaskVariant,
	createUniqueTestDir,
	initializeTestProject,
	safeCleanup,
} from "./test-utils.ts";

let TEST_DIR: string;

const toPosixPath = (path: string): string => path.replace(/\\/g, "/");

// Branch records are only visible inside the rolling activeBranchDays window,
// so commit dates must stay relative to the test run, never absolute.
function recentCommitDate(minutesAgo: number): string {
	return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

describe("Core", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-core");
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();

		// Initialize git repository for testing
		await $`git init -b main`.cwd(TEST_DIR).quiet();
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("initialization", () => {
		it("should have filesystem and git operations available", () => {
			expect(core.filesystem).toBeDefined();
			expect(core.gitOps).toBeDefined();
		});

		it("should initialize project with default config", async () => {
			await initializeTestProject(core, "Test Project", true);

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Test Project");
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("To Do");
		});

		it("should use root backlog.config.yml for custom backlog directories", async () => {
			await initializeTestProject(core, "Custom Root Project", false, "planning/backlog-data");

			expect(await Bun.file(join(TEST_DIR, "backlog.config.yml")).exists()).toBe(true);
			expect(await Bun.file(join(TEST_DIR, "planning", "backlog-data", "config.yml")).exists()).toBe(false);

			const freshCore = new Core(TEST_DIR);
			const config = await freshCore.filesystem.loadConfig();
			expect(config?.projectName).toBe("Custom Root Project");
			expect(freshCore.filesystem.backlogDirName).toBe("planning/backlog-data");
		});
	});

	describe("task operations", () => {
		const sampleTask: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-06-07",
			labels: ["test"],
			dependencies: [],
			description: "This is a test task",
		};

		beforeEach(async () => {
			await initializeTestProject(core, "Test Project");
		});

		async function commitPaddedTaskLifecycleVariant(type: "archived" | "completed"): Promise<void> {
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected config to be loaded");
			}
			await core.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				taskResolutionStrategy: "most_progressed",
				prefixes: { ...config.prefixes, task: "back" },
			});

			const taskPath = await core.filesystem.saveTask({
				...sampleTask,
				id: "BACK-1",
				title: "Local task version",
				status: "To Do",
			});
			const localDate = recentCommitDate(3);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`GIT_AUTHOR_DATE="${localDate}" GIT_COMMITTER_DATE="${localDate}" git commit -m "Add local task"`
				.cwd(TEST_DIR)
				.quiet();

			await $`git switch -c progressed-task-variant`.cwd(TEST_DIR).quiet();
			await Bun.write(
				taskPath,
				serializeTask({
					...sampleTask,
					id: "BACK-001",
					title: "Progressed branch version",
					status: "Done",
				}),
			);
			const progressedDate = recentCommitDate(2);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`GIT_AUTHOR_DATE="${progressedDate}" GIT_COMMITTER_DATE="${progressedDate}" git commit -m "Progress padded task variant"`
				.cwd(TEST_DIR)
				.quiet();

			await $`git switch -c ${`${type}-task-variant`}`.cwd(TEST_DIR).quiet();
			const destinationDir = type === "archived" ? core.filesystem.archiveTasksDir : core.filesystem.completedDir;
			const destinationPath = join(destinationDir, "back-1 - Local-task-version.md");
			await $`git mv -- ${taskPath} ${destinationPath}`.cwd(TEST_DIR).quiet();
			const lifecycleDate = recentCommitDate(1);
			await $`GIT_AUTHOR_DATE="${lifecycleDate}" GIT_COMMITTER_DATE="${lifecycleDate}" git commit -m ${`${type} padded task variant`}`
				.cwd(TEST_DIR)
				.quiet();

			await $`git switch main`.cwd(TEST_DIR).quiet();
			await utimes(taskPath, new Date(localDate), new Date(localDate));
		}

		it("should create task without auto-commit", async () => {
			await core.createTask(sampleTask, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("TASK-1");
			expect(loadedTask?.title).toBe("Test Task");
		});

		it("should create task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			// Check if task file was created
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("TASK-1");

			// Check git status to see if there are uncommitted changes
			const lastCommit = await core.gitOps.getLastCommitMessage();
			// For now, just check that we have a commit (could be initialization or task)
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("should update task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			// Check original task
			const originalTask = await core.filesystem.loadTask("task-1");
			expect(originalTask?.title).toBe("Test Task");

			await core.updateTaskFromInput("task-1", { title: "Updated Task" }, true);

			// Check if task was updated
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.title).toBe("Updated Task");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			// For now, just check that we have a commit (could be initialization or task)
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("reads a completed-only task while keeping it unavailable to mutations", async () => {
			await core.createTask(sampleTask, false);
			expect(await core.filesystem.completeTask(sampleTask.id)).toBe(true);

			const completed = await core.getTask(sampleTask.id);

			expect(completed?.id).toBe("TASK-1");
			expect(completed?.source).toBe("completed");
			await expect(core.updateTaskFromInput(sampleTask.id, { title: "Must not change" }, false)).rejects.toThrow(
				"Task not found",
			);
		});

		it("refreshes one coherent active and completed identity snapshot before mutation", async () => {
			await core.createTask(sampleTask, false);
			await core.getContentStore();

			const activePath = (await core.filesystem.loadTask(sampleTask.id))?.filePath;
			if (!activePath) throw new Error("Expected active task path");
			const completedPath = join(core.filesystem.completedDir, "task-01 - Completed collision.md");
			await Bun.write(completedPath, serializeTask({ ...sampleTask, id: "TASK-01", title: "Completed collision" }));

			const originalListTasks = core.filesystem.listTasks.bind(core.filesystem);
			const originalListCompletedTasks = core.filesystem.listCompletedTasks.bind(core.filesystem);
			let activeLoads = 0;
			let completedLoads = 0;
			core.filesystem.listTasks = async (...args) => {
				activeLoads += 1;
				return await originalListTasks(...args);
			};
			core.filesystem.listCompletedTasks = async (...args) => {
				completedLoads += 1;
				return await originalListCompletedTasks(...args);
			};

			try {
				await expect(
					core.updateTaskFromInput(sampleTask.id, { title: "Must not change" }, false),
				).rejects.toBeInstanceOf(AmbiguousTaskIdError);
			} finally {
				core.filesystem.listTasks = originalListTasks;
				core.filesystem.listCompletedTasks = originalListCompletedTasks;
			}

			expect(activeLoads).toBe(1);
			expect(completedLoads).toBe(1);
			expect(await Bun.file(activePath).text()).not.toContain("Must not change");
		});

		it("publishes completed lifecycle identity state atomically", async () => {
			await core.createTask(sampleTask, false);
			const store = await core.getContentStore();
			const observed: Array<{
				read: string;
				mutation: string;
				active: string[];
				completed: string[];
			}> = [];
			const unsubscribe = store.subscribe((event) => {
				if (event.type !== "tasks") return;
				const snapshot = store.getTaskCorpusSnapshot();
				observed.push({
					read: store.resolveTaskForRead(sampleTask.id).status,
					mutation: store.resolveTaskForMutation(sampleTask.id).status,
					active: snapshot.activeTasks.map((task) => task.id),
					completed: snapshot.completedTasks.map((task) => task.id),
				});
			});

			expect(await core.completeTask(sampleTask.id, false)).toBe(true);
			unsubscribe();

			expect(observed[0]).toEqual({
				read: "found",
				mutation: "not-found",
				active: [],
				completed: ["TASK-1"],
			});
		});

		it("publishes archived lifecycle identity state atomically", async () => {
			await core.createTask(sampleTask, false);
			const store = await core.getContentStore();
			const observed: Array<{ read: string; mutation: string; active: string[]; completed: string[] }> = [];
			const unsubscribe = store.subscribe((event) => {
				if (event.type !== "tasks") return;
				const snapshot = store.getTaskCorpusSnapshot();
				observed.push({
					read: store.resolveTaskForRead(sampleTask.id).status,
					mutation: store.resolveTaskForMutation(sampleTask.id).status,
					active: snapshot.activeTasks.map((task) => task.id),
					completed: snapshot.completedTasks.map((task) => task.id),
				});
			});

			expect((await core.archiveTask(sampleTask.id, false)).success).toBe(true);
			unsubscribe();

			expect(observed[0]).toEqual({ read: "not-found", mutation: "not-found", active: [], completed: [] });
		});

		it("completes the exact resolved path when the frontmatter ID differs from the filename", async () => {
			const taskPath = join(core.filesystem.tasksDir, "task-999 - Exact-path.md");
			await Bun.write(taskPath, serializeTask({ ...sampleTask, id: "TASK-1", status: "Done" }));
			await core.getContentStore();

			expect(await core.completeTask("TASK-1", false)).toBe(true);
			expect(await Bun.file(taskPath).exists()).toBe(false);
			expect(await Bun.file(join(core.filesystem.completedDir, "task-999 - Exact-path.md")).exists()).toBe(true);
		});

		it("archives the exact resolved path when the frontmatter ID differs from the filename", async () => {
			const taskPath = join(core.filesystem.tasksDir, "task-999 - Exact-path.md");
			await Bun.write(taskPath, serializeTask({ ...sampleTask, id: "TASK-1" }));
			await core.getContentStore();

			expect((await core.archiveTask("TASK-1", false)).success).toBe(true);
			expect(await Bun.file(taskPath).exists()).toBe(false);
			expect(await Bun.file(join(core.filesystem.archiveTasksDir, "task-999 - Exact-path.md")).exists()).toBe(true);
		});

		it("auto-commits an update through the exact resolved path instead of re-resolving its filename", async () => {
			const taskPath = join(core.filesystem.tasksDir, "task-999 - Exact-path.md");
			await Bun.write(taskPath, serializeTask({ ...sampleTask, id: "TASK-1" }));
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add mismatched task identity"`.cwd(TEST_DIR).quiet();
			await core.getContentStore();

			await core.updateTaskFromInput("TASK-1", { title: "Updated exact path" }, true);

			expect(await Bun.file(taskPath).text()).toContain("title: Updated exact path");
			expect(await core.gitOps.getLastCommitMessage()).toContain("Update task TASK-1");
			expect((await $`git status --short`.cwd(TEST_DIR).text()).trim()).toBe("");
		});

		it("does not update a longer legacy sibling for a shorter numeric ID", async () => {
			await core.createTask({ ...sampleTask, id: "BACK-1-EXTRA", title: "Longer sibling" }, false);

			await expect(core.updateTaskFromInput("BACK-1", { title: "Wrong target" }, false)).rejects.toThrow(
				"Task not found: BACK-1",
			);
			expect((await core.filesystem.loadTask("BACK-1-EXTRA"))?.title).toBe("Longer sibling");
		});

		it("should archive task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			const archived = await core.archiveTask("task-1", true);
			expect(archived.success).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Archive task TASK-1");
		});

		it("dispatches demote auto-commit with both moved paths", async () => {
			await core.createTask(sampleTask, false);
			const originalCommitFiles = core.gitOps.commitFiles.bind(core.gitOps);
			let resolveCommit: (commit: { message: string; paths: string[] }) => void = () => undefined;
			const commitCalled = new Promise<{ message: string; paths: string[] }>((resolve) => {
				resolveCommit = resolve;
			});
			core.gitOps.commitFiles = async (message, paths) => {
				resolveCommit({ message, paths });
			};

			try {
				const demoted = await core.demoteTask("task-1", true);
				expect(demoted.success).toBe(true);

				const commit = await commitCalled;
				expect(commit.message).toContain("backlog: Demote task TASK-1");
				expect(commit.paths.map(toPosixPath).some((path) => path.includes("/tasks/"))).toBe(true);
				expect(commit.paths.map(toPosixPath).some((path) => path.includes("/drafts/"))).toBe(true);
			} finally {
				core.gitOps.commitFiles = originalCommitFiles;
			}
		});

		it("should resolve tasks using flexible ID formats", async () => {
			const standardTask: Task = { ...sampleTask, id: "task-5", title: "Standard" };
			const paddedTask: Task = { ...sampleTask, id: "task-007", title: "Padded" };
			await core.createTask(standardTask, false);
			await core.createTask(paddedTask, false);

			const uppercase = await core.getTask("TASK-5");
			expect(uppercase?.id).toBe("TASK-5");

			const bare = await core.getTask("5");
			expect(bare?.id).toBe("TASK-5");

			const zeroPadded = await core.getTask("0007");
			expect(zeroPadded?.id).toBe("TASK-007");

			const mixedCase = await core.getTask("Task-007");
			expect(mixedCase?.id).toBe("TASK-007");
		});

		it("returns the local task when merge policy selects a same-path padded ID variant", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected config to be loaded");
			}
			await core.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				taskResolutionStrategy: "most_progressed",
				prefixes: { ...config.prefixes, task: "back" },
			});

			const localTask: Task = {
				...sampleTask,
				id: "BACK-1",
				title: "Local task version",
				status: "To Do",
			};
			await commitSamePathBranchTaskVariant(core, localTask, {
				...localTask,
				id: "BACK-001",
				title: "Progressed branch version",
				status: "Done",
			});

			const loaded = await core.getTask("BACK-1");
			expect(loaded?.id).toBe("BACK-1");
			expect(loaded?.title).toBe("Local task version");
			expect(loaded?.status).toBe("To Do");
		});

		it("fails closed when merge policy selects a padded ID variant at a different path", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected config to be loaded");
			}
			await core.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				taskResolutionStrategy: "most_progressed",
				prefixes: { ...config.prefixes, task: "back" },
			});

			const localTask: Task = {
				...sampleTask,
				id: "BACK-1",
				title: "Local task version",
				status: "To Do",
			};
			await commitSamePathBranchTaskVariant(
				core,
				localTask,
				{
					...localTask,
					id: "BACK-001",
					title: "Progressed branch version",
					status: "Done",
				},
				join(core.filesystem.tasksDir, "back-001 - Progressed-branch-version.md"),
			);

			await expect(core.getTask("BACK-1")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
		});

		it("fails closed when branch-only canonical ID variants use different paths", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected config to be loaded");
			}
			await core.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				taskResolutionStrategy: "most_progressed",
				prefixes: { ...config.prefixes, task: "back" },
			});
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Configure branch task loading"`.cwd(TEST_DIR).quiet();

			await $`git switch -c branch-task-one`.cwd(TEST_DIR).quiet();
			await Bun.write(
				join(core.filesystem.tasksDir, "back-1 - Branch-one.md"),
				serializeTask({ ...sampleTask, id: "BACK-1", title: "Branch one", status: "To Do" }),
			);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add first branch task"`.cwd(TEST_DIR).quiet();

			await $`git switch main`.cwd(TEST_DIR).quiet();
			await $`git switch -c branch-task-two`.cwd(TEST_DIR).quiet();
			await Bun.write(
				join(core.filesystem.tasksDir, "back-001 - Branch-two.md"),
				serializeTask({ ...sampleTask, id: "BACK-001", title: "Branch two", status: "Done" }),
			);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add second branch task"`.cwd(TEST_DIR).quiet();
			await $`git switch main`.cwd(TEST_DIR).quiet();

			await expect(core.getTask("BACK-1")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
		});

		it("refreshes branch identities before resolving a long-lived Core read", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected config to be loaded");
			await core.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				prefixes: { ...config.prefixes, task: "back" },
			});

			await core.filesystem.saveTask({ ...sampleTask, id: "BACK-1", title: "Local identity" });
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add local identity"`.cwd(TEST_DIR).quiet();

			expect((await core.getTask("BACK-1"))?.title).toBe("Local identity");

			await $`git switch -c late-distinct-identity`.cwd(TEST_DIR).quiet();
			await Bun.write(
				join(core.filesystem.tasksDir, "back-1 - Late-distinct-identity.md"),
				serializeTask({ ...sampleTask, id: "BACK-1", title: "Late distinct identity" }),
			);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add late distinct identity"`.cwd(TEST_DIR).quiet();
			await $`git switch main`.cwd(TEST_DIR).quiet();

			await expect(core.getTask("BACK-1")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
		});

		it("hydrates every branch-only logical identity that shares one exact ID spelling", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected config to be loaded");
			await core.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				prefixes: { ...config.prefixes, task: "back" },
			});
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Configure branch identity loading"`.cwd(TEST_DIR).quiet();

			await $`git switch -c exact-id-active`.cwd(TEST_DIR).quiet();
			await Bun.write(
				join(core.filesystem.tasksDir, "back-1 - Active-branch-identity.md"),
				serializeTask({ ...sampleTask, id: "BACK-1", title: "Active branch identity" }),
			);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add active branch identity"`.cwd(TEST_DIR).quiet();

			await $`git switch main`.cwd(TEST_DIR).quiet();
			await $`git switch -c exact-id-completed`.cwd(TEST_DIR).quiet();
			await Bun.write(
				join(core.filesystem.completedDir, "back-1 - Completed-branch-identity.md"),
				serializeTask({
					...sampleTask,
					id: "BACK-1",
					title: "Completed branch identity",
					status: "Done",
				}),
			);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add completed branch identity"`.cwd(TEST_DIR).quiet();
			await $`git switch main`.cwd(TEST_DIR).quiet();

			const included = await core.loadTasks(undefined, undefined, { includeCompleted: true });
			expect(included.map((task) => task.title).sort()).toEqual([
				"Active branch identity",
				"Completed branch identity",
			]);
			core.git.listRecentBranches = async () => {
				throw new Error("Statistics must not use the legacy local-branch loader");
			};
			core.git.listRecentRemoteBranches = async () => {
				throw new Error("Statistics must not use the legacy remote-branch loader");
			};
			const statistics = (await core.loadAllTasksForStatistics()).tasks;
			expect(statistics.map((task) => task.title).sort()).toEqual([
				"Active branch identity",
				"Completed branch identity",
			]);
		});

		it("loads other local branches while the current branch is unborn", async () => {
			const currentConfig = await core.filesystem.loadConfig();
			if (!currentConfig) throw new Error("Expected config to be loaded");
			const branchConfig = {
				...currentConfig,
				checkActiveBranches: true,
				remoteOperations: false,
			};
			await core.filesystem.saveConfig(branchConfig);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Configure orphan branch loading"`.cwd(TEST_DIR).quiet();

			await $`git switch -c feature/unborn-source`.cwd(TEST_DIR).quiet();
			await core.filesystem.saveTask({ ...sampleTask, id: "TASK-2", title: "Task on another branch" });
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add branch-only task"`.cwd(TEST_DIR).quiet();
			await $`git switch main`.cwd(TEST_DIR).quiet();
			await $`git switch --orphan blank`.cwd(TEST_DIR).quiet();
			await core.filesystem.ensureBacklogStructure();
			await core.filesystem.saveConfig(branchConfig);

			expect((await core.loadTasks()).map((task) => task.title)).toEqual(["Task on another branch"]);
		});

		it("fails closed when an archive snapshot would otherwise hide distinct active paths", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected config to be loaded");
			}
			await core.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				prefixes: { ...config.prefixes, task: "back" },
			});

			const localTaskPath = await core.filesystem.saveTask({
				...sampleTask,
				id: "BACK-1",
				title: "Local active path",
			});
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add local active task"`.cwd(TEST_DIR).quiet();

			await $`git switch -c distinct-active-path`.cwd(TEST_DIR).quiet();
			await $`git rm -- ${localTaskPath}`.cwd(TEST_DIR).quiet();
			await Bun.write(
				join(core.filesystem.tasksDir, "back-001 - Distinct-branch-path.md"),
				serializeTask({
					...sampleTask,
					id: "BACK-001",
					title: "Distinct branch path",
				}),
			);
			const activeDate = recentCommitDate(2);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`GIT_AUTHOR_DATE="${activeDate}" GIT_COMMITTER_DATE="${activeDate}" git commit -m "Move task to a distinct active path"`
				.cwd(TEST_DIR)
				.quiet();

			await $`git switch -c archive-shadow`.cwd(TEST_DIR).quiet();
			await Bun.write(
				join(core.filesystem.archiveTasksDir, "back-1 - Local-active-path.md"),
				serializeTask({ ...sampleTask, id: "BACK-1", title: "Archived local path" }),
			);
			const archiveDate = recentCommitDate(1);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`GIT_AUTHOR_DATE="${archiveDate}" GIT_COMMITTER_DATE="${archiveDate}" git commit -m "Archive the original path"`
				.cwd(TEST_DIR)
				.quiet();
			await $`git switch main`.cwd(TEST_DIR).quiet();
			const localMtime = new Date(recentCommitDate(3));
			await utimes(localTaskPath, localMtime, localMtime);

			await expect(core.getTask("BACK-1")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
		});

		it("keeps an ID occupied when equal-time branch records are active and archived", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected config to be loaded");
			}
			await core.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				prefixes: { ...config.prefixes, task: "back" },
			});
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Configure identity loading"`.cwd(TEST_DIR).quiet();

			await $`git switch -c equal-time-states`.cwd(TEST_DIR).quiet();
			await Bun.write(
				join(core.filesystem.archiveTasksDir, "back-1 - Archived-version.md"),
				serializeTask({ ...sampleTask, id: "BACK-1", title: "Archived version" }),
			);
			await Bun.write(
				join(core.filesystem.tasksDir, "back-001 - Active-version.md"),
				serializeTask({ ...sampleTask, id: "BACK-001", title: "Active version" }),
			);
			const commitDate = recentCommitDate(3);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`GIT_AUTHOR_DATE="${commitDate}" GIT_COMMITTER_DATE="${commitDate}" git commit -m "Add equal-time states"`
				.cwd(TEST_DIR)
				.quiet();
			await $`git switch main`.cwd(TEST_DIR).quiet();

			expect(await core.generateNextId()).toBe("BACK-2");
		});

		it("keeps active and completed identities at distinct paths when completed tasks are included", async () => {
			const activePath = await core.filesystem.saveTask({
				...sampleTask,
				id: "TASK-1",
				title: "Active identity",
			});
			const completedPath = join(core.filesystem.completedDir, "task-001 - Completed-identity.md");
			await Bun.write(
				completedPath,
				serializeTask({
					...sampleTask,
					id: "TASK-001",
					title: "Completed identity",
					status: "Done",
				}),
			);

			const tasks = await core.loadTasks(undefined, undefined, { includeCompleted: true });
			expect(tasks.map((task) => task.title).sort()).toEqual(["Active identity", "Completed identity"]);
			expect((await core.loadTasks()).map((task) => task.title)).toEqual(["Active identity"]);
			const statisticsTasks = (await core.loadAllTasksForStatistics()).tasks;
			expect(statisticsTasks.map((task) => task.title).sort()).toEqual(["Active identity", "Completed identity"]);
			expect(activePath).not.toBe(completedPath);
			await expect(core.getTask("TASK-1")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
		});

		it("normalizes local and Git paths for a nested project with a custom backlog directory", async () => {
			const nestedRoot = join(TEST_DIR, "packages", "app");
			const nestedCore = new Core(nestedRoot);
			await initializeTestProject(nestedCore, "Nested Project", false, "planning/backlog-data");
			const config = await nestedCore.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected nested config to be loaded");
			}
			await nestedCore.filesystem.saveConfig({
				...config,
				checkActiveBranches: true,
				remoteOperations: false,
				prefixes: { ...config.prefixes, task: "back" },
			});

			const taskPath = await nestedCore.filesystem.saveTask({
				...sampleTask,
				id: "BACK-1",
				title: "Nested local version",
			});
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add nested local task"`.cwd(TEST_DIR).quiet();
			await $`git switch -c nested-task-version`.cwd(TEST_DIR).quiet();
			await Bun.write(
				taskPath,
				serializeTask({
					...sampleTask,
					id: "BACK-001",
					title: "Nested branch version",
					status: "Done",
				}),
			);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Progress nested task"`.cwd(TEST_DIR).quiet();
			await $`git switch main`.cwd(TEST_DIR).quiet();

			const loaded = await new Core(nestedRoot).getTask("BACK-1");
			expect(loaded?.id).toBe("BACK-1");
			expect(loaded?.title).toBe("Nested local version");
		});

		it("keeps the working-copy task active when a branch archives the same padded identity path", async () => {
			await commitPaddedTaskLifecycleVariant("archived");

			const tasks = await core.loadTasks();
			const task = tasks.find((candidate) => candidate.id === "BACK-1" || candidate.id === "BACK-001");
			expect(task?.id).toBe("BACK-1");
			expect(task?.source).toBe("local");
			expect(await core.generateNextId()).toBe("BACK-2");
		});

		it("keeps the working-copy task active when a branch completes the same padded identity path", async () => {
			await commitPaddedTaskLifecycleVariant("completed");

			const tasks = await core.loadTasks(undefined, undefined, { includeCompleted: true });
			const task = tasks.find((candidate) => candidate.id === "BACK-1" || candidate.id === "BACK-001");
			expect(task?.id).toBe("BACK-1");
			expect(task?.source).toBe("local");
		});

		it("should resolve an exact legacy task ID without guessing", async () => {
			await Bun.write(
				join(core.filesystem.tasksDir, "task-prefixed - Legacy task.md"),
				serializeTask({ ...sampleTask, id: "TASK-PREFIXED", title: "Legacy task" }),
			);

			const loaded = await core.getTask("task-prefixed");
			expect(loaded?.id).toBe("TASK-PREFIXED");
			expect(loaded?.title).toBe("Legacy task");
		});

		it("should fail closed on duplicate exact legacy task IDs", async () => {
			await Bun.write(
				join(core.filesystem.tasksDir, "task-prefixed - Legacy one.md"),
				serializeTask({ ...sampleTask, id: "TASK-PREFIXED", title: "Legacy one" }),
			);
			await Bun.write(
				join(core.filesystem.tasksDir, "task-prefixed - Legacy two.md"),
				serializeTask({ ...sampleTask, id: "task-prefixed", title: "Legacy two" }),
			);

			await expect(core.getTask("TASK-PREFIXED")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
			try {
				await core.getTask("TASK-PREFIXED");
			} catch (error) {
				const message = toPosixPath(String(error));
				expect(message).toContain("task-prefixed - Legacy one.md");
				expect(message).toContain("task-prefixed - Legacy two.md");
				expect(message).toContain("backlog doctor");
			}
		});

		it("should resolve numeric-only IDs with custom prefix (BACK-364)", async () => {
			// Configure custom prefix
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected config to be loaded");
			}
			await core.filesystem.saveConfig({
				...config,
				prefixes: { task: "back" },
			});

			// Create tasks with custom prefix
			const task1: Task = { ...sampleTask, id: "back-358", title: "Custom Prefix Task" };
			const task2: Task = { ...sampleTask, id: "back-5.1", title: "Custom Prefix Subtask" };
			await core.createTask(task1, false);
			await core.createTask(task2, false);

			// Numeric-only lookup should find task with custom prefix
			const byNumeric = await core.getTask("358");
			expect(byNumeric?.id).toBe("BACK-358");
			expect(byNumeric?.title).toBe("Custom Prefix Task");

			// Dotted numeric lookup should find subtask
			const byDotted = await core.getTask("5.1");
			expect(byDotted?.id).toBe("BACK-5.1");
			expect(byDotted?.title).toBe("Custom Prefix Subtask");

			// Full prefixed ID should also work (case-insensitive)
			const byFullId = await core.getTask("BACK-358");
			expect(byFullId?.id).toBe("BACK-358");

			const byLowercase = await core.getTask("back-358");
			expect(byLowercase?.id).toBe("BACK-358");
		});

		it("assigns ordinal 1000 to the first created task when none exist", async () => {
			const { task } = await core.createTaskFromInput({ title: "First ordinal task" });
			expect(task.ordinal).toBe(1000);

			const loadedTask = await core.filesystem.loadTask(task.id);
			expect(loadedTask?.ordinal).toBe(1000);
		});

		it("assigns the next tail ordinal when existing tasks already have ordinals", async () => {
			await core.createTask({
				...sampleTask,
				id: "task-10",
				title: "Seed 1000",
				ordinal: 1000,
			});
			await core.createTask({
				...sampleTask,
				id: "task-11",
				title: "Seed 4000",
				ordinal: 4000,
			});

			const { task } = await core.createTaskFromInput({ title: "Appended ordinal task" });
			expect(task.ordinal).toBe(5000);
		});

		it("preserves explicit ordinals on create input", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Explicit ordinal task",
				ordinal: 2750,
			});
			expect(task.ordinal).toBe(2750);
		});

		it("rejects non-finite ordinals on create input", async () => {
			await expect(
				core.createTaskFromInput({
					title: "Invalid ordinal task",
					ordinal: Number.POSITIVE_INFINITY,
				}),
			).rejects.toThrow("Ordinal must be a non-negative number.");
		});

		it("ignores tasks without ordinals when computing the next tail ordinal", async () => {
			await core.createTask({
				...sampleTask,
				id: "task-20",
				title: "No ordinal seed",
			});
			await core.createTask({
				...sampleTask,
				id: "task-21",
				title: "Ordinal seed",
				ordinal: 3000,
			});

			const { task } = await core.createTaskFromInput({ title: "Mixed ordinal task" });
			expect(task.ordinal).toBe(4000);
		});

		it("preserves legacy no-ordinal ordering when no existing tasks have ordinals", async () => {
			await core.createTask({
				...sampleTask,
				id: "task-20",
				title: "Legacy no ordinal seed",
			});

			const { task } = await core.createTaskFromInput({ title: "Legacy appended task" });
			expect(task.ordinal).toBeUndefined();

			const loadedTask = await core.filesystem.loadTask(task.id);
			expect(loadedTask?.ordinal).toBeUndefined();
		});

		it("rejects non-finite ordinals on update input", async () => {
			const { task } = await core.createTaskFromInput({ title: "Ordinal update target" });

			await expect(core.updateTaskFromInput(task.id, { ordinal: Number.POSITIVE_INFINITY })).rejects.toThrow(
				"Ordinal must be a non-negative number.",
			);
		});

		it("should NOT match numeric ID with typos when using custom prefix (BACK-364)", async () => {
			// Configure custom prefix
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected config to be loaded");
			}
			await core.filesystem.saveConfig({
				...config,
				prefixes: { task: "back" },
			});

			// Create task with custom prefix
			const task: Task = { ...sampleTask, id: "back-358", title: "Custom Prefix Task" };
			await core.createTask(task, false);

			// Typos should NOT match (prevent parseInt coercion bug)
			const withTypo = await core.getTask("358a");
			expect(withTypo).toBeNull();

			const withTypo2 = await core.getTask("35x8");
			expect(withTypo2).toBeNull();
		});

		it("should return false when archiving non-existent task", async () => {
			const archived = await core.archiveTask("non-existent", true);
			expect(archived.success).toBe(false);
		});

		it("should apply default status when task has empty status", async () => {
			const taskWithoutStatus: Task = {
				...sampleTask,
				status: "",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.status).toBe("To Do"); // Should use default from config
		});

		it("should not override existing status", async () => {
			const taskWithStatus: Task = {
				...sampleTask,
				status: "In Progress",
			};

			await core.createTask(taskWithStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.status).toBe("In Progress");
		});

		it("should preserve description text when saving without header markers", async () => {
			const taskNoHeader: Task = {
				...sampleTask,
				id: "task-2",
				description: "Just text",
			};

			await core.createTask(taskNoHeader, false);
			const loaded = await core.filesystem.loadTask("task-2");
			expect(loaded?.description).toBe("Just text");
			const body = await core.getTaskContent("task-2");
			const matches = (body?.match(/## Description/g) ?? []).length;
			expect(matches).toBe(1);
		});

		it("should not duplicate description header in saved content", async () => {
			const taskWithHeader: Task = {
				...sampleTask,
				id: "task-3",
				description: "Existing",
			};

			await core.createTask(taskWithHeader, false);
			const body = await core.getTaskContent("task-3");
			const matches = (body?.match(/## Description/g) ?? []).length;
			expect(matches).toBe(1);
		});

		it("should handle task creation without auto-commit when git fails", async () => {
			// Create task in directory without git
			const nonGitCore = new Core(join(TEST_DIR, "no-git"));
			await nonGitCore.filesystem.ensureBacklogStructure();

			// This should succeed even without git
			await nonGitCore.createTask(sampleTask, false);

			const loadedTask = await nonGitCore.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("TASK-1");
		});

		it("should normalize assignee for string and array inputs", async () => {
			const stringTask = {
				...sampleTask,
				id: "task-2",
				title: "String Assignee",
				assignee: "@alice",
			} as unknown as Task;
			await core.createTask(stringTask, false);
			const loadedString = await core.filesystem.loadTask("task-2");
			expect(loadedString?.assignee).toEqual(["@alice"]);

			const arrayTask: Task = {
				...sampleTask,
				id: "task-3",
				title: "Array Assignee",
				assignee: ["@bob"],
			};
			await core.createTask(arrayTask, false);
			const loadedArray = await core.filesystem.loadTask("task-3");
			expect(loadedArray?.assignee).toEqual(["@bob"]);
		});

		it("should normalize assignee when updating tasks", async () => {
			await core.createTask(sampleTask, false);

			await core.updateTaskFromInput("task-1", { assignee: ["@carol"] }, false);
			let loaded = await core.filesystem.loadTask("task-1");
			expect(loaded?.assignee).toEqual(["@carol"]);

			await core.updateTaskFromInput("task-1", { assignee: ["@dave"] }, false);
			loaded = await core.filesystem.loadTask("task-1");
			expect(loaded?.assignee).toEqual(["@dave"]);
		});

		it("should create sub-tasks with proper hierarchical IDs", async () => {
			await initializeTestProject(core, "Subtask Project", true);

			// Create parent task
			const { task: parent } = await core.createTaskFromInput({
				title: "Parent Task",
				status: "To Do",
			});
			expect(parent.id).toBe("TASK-1");

			// Create first sub-task
			const { task: child1 } = await core.createTaskFromInput({
				title: "First Child",
				parentTaskId: parent.id,
				status: "To Do",
			});
			expect(child1.id).toBe("TASK-1.1");
			expect(child1.parentTaskId).toBe("TASK-1");

			// Create second sub-task
			const { task: child2 } = await core.createTaskFromInput({
				title: "Second Child",
				parentTaskId: parent.id,
				status: "To Do",
			});
			expect(child2.id).toBe("TASK-1.2");
			expect(child2.parentTaskId).toBe("TASK-1");

			// Create another parent task to ensure sequential numbering still works
			const { task: parent2 } = await core.createTaskFromInput({
				title: "Second Parent",
				status: "To Do",
			});
			expect(parent2.id).toBe("TASK-2");
		});
	});

	describe("document operations", () => {
		const baseDocument: Document = {
			id: "doc-1",
			title: "Operations Guide",
			type: "guide",
			createdDate: "2025-06-07",
			rawContent: "# Ops Guide",
		};

		beforeEach(async () => {
			await initializeTestProject(core, "Test Project", false);
		});

		it("updates a document title without leaving the previous file behind", async () => {
			await core.createDocument(baseDocument, false);

			const [initialFile] = await Array.fromAsync(
				new Bun.Glob("doc-*.md").scan({ cwd: core.filesystem.docsDir, followSymlinks: true }),
			);
			expect(initialFile).toBe("doc-1 - Operations-Guide.md");

			const documents = await core.filesystem.listDocuments();
			const existingDoc = documents[0];
			if (!existingDoc) {
				throw new Error("Expected document to exist after creation");
			}
			expect(existingDoc.title).toBe("Operations Guide");

			await core.updateDocument({ ...existingDoc, title: "Operations Guide Updated" }, "# Updated content", false);

			const docFiles = await Array.fromAsync(
				new Bun.Glob("doc-*.md").scan({ cwd: core.filesystem.docsDir, followSymlinks: true }),
			);
			expect(docFiles).toHaveLength(1);
			expect(docFiles[0]).toBe("doc-1 - Operations-Guide-Updated.md");

			const updatedDocs = await core.filesystem.listDocuments();
			expect(updatedDocs[0]?.title).toBe("Operations Guide Updated");
		});

		it("creates and moves documents through core input methods", async () => {
			const created = await core.createDocumentFromInput({
				title: "Setup Guide",
				content: "# Setup",
				type: "guide",
				path: "guides / setup",
				tags: ["setup", "guide"],
			});

			expect(created.id).toBe("doc-1");
			expect(created.path).toBe("guides/setup/doc-1 - Setup-Guide.md");

			const updated = await core.updateDocumentFromInput({
				id: created.id,
				title: "Install Guide",
				content: "# Install",
				path: "runbooks",
			});

			expect(updated.title).toBe("Install Guide");
			expect(updated.path).toBe("runbooks/doc-1 - Install-Guide.md");
			expect(updated.rawContent).toBe("# Install");

			const docFiles = await Array.fromAsync(
				new Bun.Glob("**/doc-*.md").scan({ cwd: core.filesystem.docsDir, followSymlinks: true }),
			);
			expect(docFiles.map(toPosixPath)).toEqual(["runbooks/doc-1 - Install-Guide.md"]);
		});

		it("preserves document path when updating without an explicit path", async () => {
			const created = await core.createDocumentFromInput({
				title: "Nested",
				content: "Initial",
				path: "guides",
			});

			const updated = await core.updateDocumentFromInput({
				id: created.id,
				content: "Updated",
				title: "Nested Updated",
			});

			expect(updated.path).toBe("guides/doc-1 - Nested-Updated.md");
		});

		it("rejects unsupported document types in core input methods", async () => {
			await expect(
				core.createDocumentFromInput({
					title: "Invalid",
					content: "Content",
					type: "unexpected",
				} as unknown as Parameters<typeof core.createDocumentFromInput>[0]),
			).rejects.toThrow("Document type must be one of");

			const created = await core.createDocumentFromInput({
				title: "Valid",
				content: "Content",
				type: "guide",
			});

			await expect(
				core.updateDocumentFromInput({
					id: created.id,
					content: "Updated",
					type: "unexpected",
				} as unknown as Parameters<typeof core.updateDocumentFromInput>[0]),
			).rejects.toThrow("Document type must be one of");
		});

		it("shows a git rename when the document title changes", async () => {
			await core.createDocument(baseDocument, true);

			const renamedDoc: Document = {
				...baseDocument,
				title: "Operations Guide Renamed",
			};

			await core.updateDocument(renamedDoc, "# Ops Guide", false);

			await $`git add -A`.cwd(TEST_DIR).quiet();
			const diffResult = await $`git diff --name-status -M HEAD`.cwd(TEST_DIR).quiet();
			const diff = diffResult.stdout.toString();
			const previousPath = "backlog/docs/doc-1 - Operations-Guide.md";
			const renamedPath = "backlog/docs/doc-1 - Operations-Guide-Renamed.md";
			const escapeForRegex = (value: string) => value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
			expect(diff).toMatch(
				new RegExp(`^R\\d*\\t${escapeForRegex(previousPath)}\\t${escapeForRegex(renamedPath)}`, "m"),
			);
		});
	});

	describe("draft operations", () => {
		beforeEach(async () => {
			await initializeTestProject(core, "Draft Project");
		});

		it("should create draft without auto-commit", async () => {
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Draft Task",
					status: "Draft",
					description: "Draft task",
				},
				false,
			);

			const loaded = await core.filesystem.loadDraft(draft.id);
			expect(loaded?.id).toBe("DRAFT-1");
		});

		it("should create draft with auto-commit", async () => {
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Draft Task",
					status: "Draft",
					description: "Draft task",
				},
				true,
			);

			const loaded = await core.filesystem.loadDraft(draft.id);
			expect(loaded?.id).toBe("DRAFT-1");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("should promote draft with auto-commit", async () => {
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Draft Task",
					status: "Draft",
					description: "Draft task",
				},
				true,
			);

			const promoted = await core.promoteDraft(draft.id, true);
			expect(promoted).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain(`backlog: Promote draft ${draft.id.toUpperCase()}`);
		});

		it("should archive draft with auto-commit", async () => {
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Draft Task",
					status: "Draft",
					description: "Draft task",
				},
				true,
			);

			const archived = await core.archiveDraft(draft.id, true);
			expect(archived).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain(`backlog: Archive draft ${draft.id.toUpperCase()}`);
		});

		it("should preserve draft metadata through the canonical create path", async () => {
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Draft Array",
					status: "Draft",
					description: "Draft task",
					assignee: ["@frank"],
					labels: ["draft"],
				},
				false,
			);

			const loaded = await core.filesystem.loadDraft(draft.id);
			expect(loaded?.assignee).toEqual(["@frank"]);
			expect(loaded?.labels).toEqual(["draft"]);
		});
	});

	describe("integration with config", () => {
		it("should use custom default status from config", async () => {
			// Initialize with custom config
			await initializeTestProject(core, "Custom Project");

			// Update config with custom default status
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.defaultStatus = "Custom Status";
				await core.filesystem.saveConfig(config);
			}

			const taskWithoutStatus: Task = {
				id: "task-custom",
				title: "Custom Task",
				status: "",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Task without status",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-custom");
			expect(loadedTask?.status).toBe("Custom Status");
		});

		it("should fall back to To Do when config has no default status", async () => {
			// Initialize project
			await initializeTestProject(core, "Fallback Project");

			// Update config to remove default status
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.defaultStatus = undefined;
				await core.filesystem.saveConfig(config);
			}

			const taskWithoutStatus: Task = {
				id: "task-fallback",
				title: "Fallback Task",
				status: "",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Task without status",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-fallback");
			expect(loadedTask?.status).toBe("To Do");
		});

		// createTaskFromInput is the shared create path for every surface (CLI, wizard, TUI, Web, MCP),
		// so applying defaultAssignee here is what keeps the surfaces consistent.
		it("should apply defaultAssignee to tasks and drafts created without an assignee", async () => {
			await initializeTestProject(core, "Default Assignee Project");
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected config");
			config.defaultAssignee = ["@alice", "@bob"];
			await core.filesystem.saveConfig(config);

			const { task } = await core.createTaskFromInput({ title: "Inherits default" }, false);
			expect(task.assignee).toEqual(["@alice", "@bob"]);

			const { task: draft } = await core.createTaskFromInput(
				{ title: "Draft inherits default", status: "Draft" },
				false,
			);
			expect(draft.assignee).toEqual(["@alice", "@bob"]);
		});

		it("should let an explicit assignee replace defaultAssignee entirely", async () => {
			await initializeTestProject(core, "Override Assignee Project");
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected config");
			config.defaultAssignee = ["@alice", "@bob"];
			await core.filesystem.saveConfig(config);

			const { task } = await core.createTaskFromInput({ title: "Explicit assignee", assignee: ["@carol"] }, false);
			expect(task.assignee).toEqual(["@carol"]);
		});

		// An explicit empty list is how every surface says "unassigned": CLI/draft `-a ""`,
		// MCP `assignee: []`, and the Web edit payload all reach this method that way.
		it("should let an explicit empty assignee override defaultAssignee", async () => {
			await initializeTestProject(core, "Explicit Unassign Project");
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected config");
			config.defaultAssignee = ["@alice", "@bob"];
			await core.filesystem.saveConfig(config);

			const { task } = await core.createTaskFromInput({ title: "Explicitly unassigned", assignee: [] }, false);
			expect(task.assignee).toEqual([]);

			const { task: draft } = await core.createTaskFromInput(
				{ title: "Explicitly unassigned draft", status: "Draft", assignee: [] },
				false,
			);
			expect(draft.assignee).toEqual([]);
		});

		it("should leave new tasks unassigned when defaultAssignee is empty", async () => {
			await initializeTestProject(core, "Empty Assignee Project");
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected config");
			config.defaultAssignee = [];
			await core.filesystem.saveConfig(config);

			const { task } = await core.createTaskFromInput({ title: "No default assignee" }, false);
			expect(task.assignee).toEqual([]);
		});

		// createTaskFromInput is the shared create path for every surface (CLI, wizard, TUI, Web, MCP),
		// so applying defaultReporter here is what keeps the surfaces consistent. There is no
		// per-task reporter override surface yet, so unlike defaultAssignee this is a one-way default.
		it("should apply defaultReporter to tasks and drafts created without one", async () => {
			await initializeTestProject(core, "Default Reporter Project");
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected config");
			config.defaultReporter = "@dana";
			await core.filesystem.saveConfig(config);

			const { task } = await core.createTaskFromInput({ title: "Inherits default reporter" }, false);
			expect(task.reporter).toBe("@dana");

			const loadedTask = await core.filesystem.loadTask(task.id);
			expect(loadedTask?.reporter).toBe("@dana");

			const { task: draft } = await core.createTaskFromInput(
				{ title: "Draft inherits default reporter", status: "Draft" },
				false,
			);
			expect(draft.reporter).toBe("@dana");
		});

		it("should leave new tasks without a reporter when defaultReporter is unset", async () => {
			await initializeTestProject(core, "No Default Reporter Project");

			const { task } = await core.createTaskFromInput({ title: "No default reporter" }, false);
			expect(task.reporter).toBeUndefined();

			const loadedTask = await core.filesystem.loadTask(task.id);
			expect(loadedTask?.reporter).toBeUndefined();
		});
	});

	describe("directory accessor integration", () => {
		it("should use FileSystem directory accessors for git operations", async () => {
			await initializeTestProject(core, "Accessor Test");

			const task: Task = {
				id: "task-accessor",
				title: "Accessor Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Testing directory accessors",
			};

			// Create task without auto-commit to avoid potential git timing issues
			await core.createTask(task, false);

			// Verify the task file was created in the correct directory
			// List all files to see what was actually created
			const allFiles = await core.filesystem.listTasks();

			// Check that a task with the expected ID exists
			const createdTask = allFiles.find((t) => t.id === "TASK-ACCESSOR");
			expect(createdTask).toBeDefined();
			expect(createdTask?.title).toBe("Accessor Test Task");
		}, 10000);
	});
});
