import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { AmbiguousTaskIdError, LOCAL_TASK_LOOKUP_HINT } from "../utils/task-path.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let testDir: string;
let core: Core;
const CLI_PATH = getTestCliPath();

const parentTask: Task = {
	id: "TASK-1",
	title: "Fast local task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-10",
	labels: ["local"],
	dependencies: [],
	description: "Contains the distinctive local-search-token.",
};

function installCrossBranchTripwires(coreUnderTest: Core) {
	const error = new Error("Local task command crossed the branch-loading boundary");
	const loadTasks = spyOn(coreUnderTest, "loadTasks").mockRejectedValue(error);
	const fetch = spyOn(coreUnderTest.gitOps, "fetch").mockRejectedValue(error);
	const listRecentBranchTips = spyOn(coreUnderTest.gitOps, "listRecentBranchTips").mockRejectedValue(error);
	const listRecentBranches = spyOn(coreUnderTest.gitOps, "listRecentBranches").mockRejectedValue(error);
	const getRepositoryRoot = spyOn(coreUnderTest.gitOps, "getRepositoryRoot").mockRejectedValue(error);

	return {
		expectUntouched() {
			expect(loadTasks).toHaveBeenCalledTimes(0);
			expect(fetch).toHaveBeenCalledTimes(0);
			expect(listRecentBranchTips).toHaveBeenCalledTimes(0);
			expect(listRecentBranches).toHaveBeenCalledTimes(0);
			expect(getRepositoryRoot).toHaveBeenCalledTimes(0);
		},
		restore() {
			loadTasks.mockRestore();
			fetch.mockRestore();
			listRecentBranchTips.mockRestore();
			listRecentBranches.mockRestore();
			getRepositoryRoot.mockRestore();
		},
	};
}

describe("local task command performance boundaries", () => {
	beforeEach(async () => {
		testDir = createUniqueTestDir("local-task-command-performance");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		core = new Core(testDir);
		await initializeTestProject(core, "Local task command performance");

		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		await core.filesystem.saveConfig({
			...config,
			checkActiveBranches: true,
			remoteOperations: true,
		});

		await core.filesystem.saveTask(parentTask);
		await core.filesystem.saveTask({
			...parentTask,
			id: "TASK-1.1",
			title: "Local child",
			parentTaskId: parentTask.id,
			description: "Child content",
		});
		await core.filesystem.saveTask({
			...parentTask,
			id: "TASK-2",
			title: "Unrelated local task",
			description: "No matching search content",
		});
	});

	afterEach(async () => {
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	it("lists and searches working-copy tasks without loading branches", async () => {
		await core.filesystem.saveTask({
			...parentTask,
			id: "TASK-0007.0024",
			title: "Padded task identity",
			description: "No matching search content",
		});
		const tripwires = installCrossBranchTripwires(core);
		try {
			const listed = await core.queryTasks({ includeCrossBranch: false });
			const searched = await core.queryTasks({
				query: "local-search-token",
				includeCrossBranch: false,
			});
			const searchedByPaddedSegment = await core.queryTasks({
				query: "7",
				includeCrossBranch: false,
			});

			expect(listed.map((task) => task.id).sort()).toEqual(["TASK-0007.0024", "TASK-1", "TASK-1.1", "TASK-2"]);
			expect(searched.map((task) => task.id)).toEqual(["TASK-1"]);
			expect(searchedByPaddedSegment.map((task) => task.id)).toContain("TASK-0007.0024");
			tripwires.expectUntouched();
		} finally {
			tripwires.restore();
		}
	});

	it("loads one working-copy task and its subtasks without loading branches", async () => {
		const tripwires = installCrossBranchTripwires(core);
		try {
			const loaded = await core.loadTaskById(parentTask.id, { includeCrossBranch: false });
			const withSubtasks = await core.getTaskWithSubtasks(parentTask.id, undefined, {
				includeCrossBranch: false,
			});

			expect(loaded?.title).toBe(parentTask.title);
			expect(withSubtasks?.subtaskSummaries).toEqual([{ id: "TASK-1.1", title: "Local child" }]);
			tripwires.expectUntouched();
		} finally {
			tripwires.restore();
		}
	});

	it("keeps CLI reads, parent resolution, and dependency validation scoped to the working copy", async () => {
		await $`git add .`.cwd(testDir).quiet();
		await $`git commit -m ${"Commit working copy"}`.cwd(testDir).quiet();
		await $`git switch -c branch-only`.cwd(testDir).quiet();
		await core.filesystem.saveTask({
			...parentTask,
			id: "TASK-99",
			title: "Branch-only task",
		});
		await $`git add .`.cwd(testDir).quiet();
		await $`git commit -m ${"Commit branch-only task"}`.cwd(testDir).quiet();
		await $`git switch main`.cwd(testDir).quiet();

		const view = await $`bun ${CLI_PATH} task view TASK-99 --plain`.cwd(testDir).nothrow().quiet();
		const shorthand = await $`bun ${CLI_PATH} task TASK-99 --plain`.cwd(testDir).nothrow().quiet();
		const edit = await $`bun ${CLI_PATH} task edit TASK-99 --title ${"Must remain absent"} --plain`
			.cwd(testDir)
			.nothrow()
			.quiet();
		const parentFilter = await $`bun ${CLI_PATH} task list --parent TASK-99 --plain`.cwd(testDir).nothrow().quiet();
		const parentCreate = await $`bun ${CLI_PATH} task create ${"Child of a branch task"} --parent TASK-99`
			.cwd(testDir)
			.nothrow()
			.quiet();
		const dependencyEdit = await $`bun ${CLI_PATH} task edit TASK-1 --dep TASK-99 --plain`
			.cwd(testDir)
			.nothrow()
			.quiet();

		const outputOf = (result: { stdout: Buffer; stderr: Buffer }) =>
			`${result.stdout.toString()}${result.stderr.toString()}`;
		// Every local miss names the working copy as the corpus it searched, so a task parked on
		// another branch reads as scope rather than as a missing task.
		for (const result of [view, shorthand, edit, parentFilter, parentCreate, dependencyEdit]) {
			expect(result.exitCode).not.toBe(0);
			expect(outputOf(result)).toContain(LOCAL_TASK_LOOKUP_HINT);
		}
		for (const result of [view, shorthand, edit]) {
			expect(outputOf(result)).toContain("Task TASK-99 not found.");
		}
		for (const result of [parentFilter, parentCreate]) {
			expect(outputOf(result)).toContain("Parent task TASK-99 not found.");
		}
		expect(outputOf(dependencyEdit)).toContain("The following dependencies do not exist: TASK-99");

		expect(await core.filesystem.loadTask("TASK-99")).toBeNull();
		expect(await core.filesystem.loadTask("TASK-99.1")).toBeNull();
		expect((await core.filesystem.loadTask("TASK-1"))?.dependencies ?? []).toEqual([]);
	});

	it("resolves a create parent from the working copy without loading branches", async () => {
		const tripwires = installCrossBranchTripwires(core);
		try {
			await expect(
				core.createTaskFromInput({ title: "Child of a missing parent", parentTaskId: "TASK-99" }, false),
			).rejects.toThrow("Parent task TASK-99 not found.");
			// The parent is rejected before an ID is allocated, which is the only step that may
			// legitimately look beyond the working copy.
			tripwires.expectUntouched();
		} finally {
			tripwires.restore();
		}

		const child = await core.createTaskFromInput({ title: "Child of a local parent", parentTaskId: "1" }, false);
		expect(child.task.id).toBe("TASK-1.2");
		expect(child.task.parentTaskId).toBe("TASK-1");
	});

	it("validates dependencies against the working copy without loading branches", async () => {
		const tripwires = installCrossBranchTripwires(core);
		try {
			const updated = await core.updateTaskFromInput("TASK-1", { addDependencies: ["2"] }, false, {
				includeCrossBranch: false,
			});
			expect(updated.dependencies).toEqual(["TASK-2"]);

			await expect(
				core.updateTaskFromInput("TASK-1", { dependencies: ["TASK-99"] }, false, { includeCrossBranch: false }),
			).rejects.toThrow("The following dependencies do not exist: TASK-99");
			tripwires.expectUntouched();
		} finally {
			tripwires.restore();
		}

		expect((await core.filesystem.loadTask("TASK-1"))?.dependencies).toEqual(["TASK-2"]);
	});

	it("fails closed on ambiguous parent and dependency identities without loading branches", async () => {
		await Bun.write(
			join(core.filesystem.completedDir, "task-02 - Completed-collision.md"),
			serializeTask({
				...parentTask,
				id: "TASK-02",
				title: "Completed collision",
				status: "Done",
			}),
		);
		const tripwires = installCrossBranchTripwires(core);
		try {
			await expect(
				core.createTaskFromInput({ title: "Child of an ambiguous parent", parentTaskId: "2" }, false),
			).rejects.toBeInstanceOf(AmbiguousTaskIdError);
			await expect(
				core.updateTaskFromInput("TASK-1", { addDependencies: ["2"] }, false, { includeCrossBranch: false }),
			).rejects.toBeInstanceOf(AmbiguousTaskIdError);
			tripwires.expectUntouched();
		} finally {
			tripwires.restore();
		}

		expect((await core.filesystem.loadTask("TASK-1"))?.dependencies ?? []).toEqual([]);
		expect(await core.filesystem.loadTask("TASK-2.1")).toBeNull();
	});

	it("edits a working-copy task without loading branches", async () => {
		const tripwires = installCrossBranchTripwires(core);
		try {
			const updated = await core.updateTaskFromInput(parentTask.id, { title: "Renamed locally" }, false, {
				includeCrossBranch: false,
			});

			expect(updated.title).toBe("Renamed locally");
			expect((await core.filesystem.listTasks()).find((task) => task.id === parentTask.id)?.title).toBe(
				"Renamed locally",
			);
			tripwires.expectUntouched();
		} finally {
			tripwires.restore();
		}
	});

	it("fails closed on a working-copy active/completed identity collision without loading branches", async () => {
		await Bun.write(
			join(core.filesystem.completedDir, "task-01 - Completed-collision.md"),
			serializeTask({
				...parentTask,
				id: "TASK-01",
				title: "Completed collision",
				status: "Done",
			}),
		);
		const tripwires = installCrossBranchTripwires(core);
		try {
			await expect(core.loadTaskById(parentTask.id, { includeCrossBranch: false })).rejects.toBeInstanceOf(
				AmbiguousTaskIdError,
			);
			await expect(
				core.getTaskWithSubtasks(parentTask.id, undefined, { includeCrossBranch: false }),
			).rejects.toBeInstanceOf(AmbiguousTaskIdError);
			await expect(
				core.updateTaskFromInput(parentTask.id, { title: "Must not change" }, false, {
					includeCrossBranch: false,
				}),
			).rejects.toBeInstanceOf(AmbiguousTaskIdError);
			tripwires.expectUntouched();
		} finally {
			tripwires.restore();
		}

		expect((await core.filesystem.listTasks()).find((task) => task.id === parentTask.id)?.title).toBe(parentTask.title);
	});
});
