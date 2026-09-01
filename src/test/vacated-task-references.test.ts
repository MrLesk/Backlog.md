import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { loadTaskDetail } from "../core/task-detail.ts";
import type { Task } from "../types/index.ts";
import { taskIdsEqual } from "../utils/task-id.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

/**
 * Archiving and demoting both hand a task ID back to the allocator. A reference left behind stops
 * meaning what it said the moment the next created task is given that ID: it resolves to an
 * unrelated task instead of failing closed. Completion is the deliberate exception - a completed
 * dependency is exactly what readiness reads.
 */
describe("references to a vacated task ID", () => {
	const cliPath = getTestCliPath();
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-vacated-references");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Vacated References Project");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	const loadCompleted = async (taskId: string) =>
		(await core.filesystem.listCompletedTasks()).find((task) => taskIdsEqual(task.id, taskId));

	/** What the dependency graph actually resolves the stored references to. */
	const dependencyTitles = async (task: Task | undefined | null) => {
		if (!task) return null;
		const detail = await loadTaskDetail(core, task);
		return detail.dependencyGraph.nodes
			.filter((node) => node.dependencyDepth === 1)
			.map((node) => `${node.id} - ${node.title ?? node.state}`);
	};

	it("does not let an archived ID rebind a completed dependent to the next created task", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Completed dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);
		expect(await core.completeTask(dependent.id, false)).toBe(true);

		const archived = await core.archiveTask(target.id, false);
		expect(archived.success).toBe(true);
		expect(archived.cleanedTaskIds).toEqual([dependent.id]);

		// The archived ID is free again, so the next task is allocated exactly the vacated slot.
		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });
		expect(taskIdsEqual(unrelated.id, target.id)).toBe(true);

		const completedDependent = await loadCompleted(dependent.id);
		expect(completedDependent?.dependencies ?? []).toEqual([]);
		expect(await dependencyTitles(completedDependent)).toEqual([]);
	});

	it("does not let a demoted ID rebind an active dependent to the next created task", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Active dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		const demotion = await core.demoteTask(target.id, false);
		expect(demotion.success).toBe(true);
		expect(demotion.cleanedTaskIds).toEqual([dependent.id]);

		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });
		expect(taskIdsEqual(unrelated.id, target.id)).toBe(true);

		// The reference is removed, not rewritten to the draft the record became.
		const drafts = await core.filesystem.listDrafts();
		expect(drafts).toHaveLength(1);
		const updatedDependent = await core.filesystem.loadTask(dependent.id);
		expect(updatedDependent?.dependencies ?? []).toEqual([]);
		expect(await dependencyTitles(updatedDependent)).toEqual([]);
	});

	it("cleans references when an edit demotes a task into the Draft status", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent of edited task" });
		const { task: target } = await core.createTaskFromInput({ title: "Edited into a draft" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id], references: [target.id] }, false);

		const demoted = await core.editTaskOrDraft(target.id, { status: "Draft" }, false);
		expect(demoted.id.startsWith("DRAFT-")).toBe(true);

		const updatedDependent = await core.filesystem.loadTask(dependent.id);
		expect(updatedDependent?.dependencies ?? []).toEqual([]);
		expect(updatedDependent?.references ?? []).toEqual([]);
	});

	it("removes archived references from the completed corpus and the working copy alike", async () => {
		const { task: activeDependent } = await core.createTaskFromInput({ title: "Active dependent" });
		const { task: completedDependent } = await core.createTaskFromInput({ title: "Completed dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		await core.updateTaskFromInput(activeDependent.id, { dependencies: [target.id] }, false);
		await core.updateTaskFromInput(completedDependent.id, { references: [target.id] }, false);
		expect(await core.completeTask(completedDependent.id, false)).toBe(true);

		const archived = await core.archiveTask(target.id, false);
		expect(archived.success).toBe(true);
		expect(archived.cleanedTaskIds).toEqual([activeDependent.id, completedDependent.id]);

		expect((await core.filesystem.loadTask(activeDependent.id))?.dependencies ?? []).toEqual([]);
		expect((await loadCompleted(completedDependent.id))?.references ?? []).toEqual([]);
	});

	it("keeps references to a completed task, because completion does not vacate its ID", async () => {
		const { task: predecessor } = await core.createTaskFromInput({ title: "Predecessor", status: "Done" });
		const { task: dependent } = await core.createTaskFromInput({
			title: "Dependent on a completed task",
			dependencies: [predecessor.id],
		});
		const { task: completedDependent } = await core.createTaskFromInput({
			title: "Completed dependent on a completed task",
			dependencies: [predecessor.id],
			status: "Done",
		});
		expect(await core.completeTask(completedDependent.id, false)).toBe(true);

		expect(await core.completeTask(predecessor.id, false)).toBe(true);

		expect((await core.filesystem.loadTask(dependent.id))?.dependencies).toEqual([predecessor.id]);
		expect((await loadCompleted(completedDependent.id))?.dependencies).toEqual([predecessor.id]);
	});

	it("reports the cleaned tasks from the archive and demote commands", async () => {
		await $`bun ${cliPath} task create "Dependent one"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task create "Dependent two"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task create "Shared target"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task edit TASK-1 --dep TASK-3`.cwd(testDir).quiet();
		await $`bun ${cliPath} task edit TASK-2 --dep TASK-3`.cwd(testDir).quiet();

		const archived = await $`bun ${cliPath} task archive TASK-3`.cwd(testDir).quiet();
		expect(archived.exitCode).toBe(0);
		expect(archived.stdout.toString()).toContain("Archived task TASK-3");
		expect(archived.stdout.toString()).toContain("Removed references to TASK-3 from TASK-1, TASK-2");

		await $`bun ${cliPath} task edit TASK-2 --dep TASK-1`.cwd(testDir).quiet();
		const demoted = await $`bun ${cliPath} task demote TASK-1`.cwd(testDir).quiet();
		expect(demoted.exitCode).toBe(0);
		expect(demoted.stdout.toString()).toContain("Demoted task TASK-1");
		expect(demoted.stdout.toString()).toContain("Removed references to TASK-1 from TASK-2");
	});

	it("says nothing about cleanup when no other record referenced the task", async () => {
		await $`bun ${cliPath} task create "Lonely target"`.cwd(testDir).quiet();

		const archived = await $`bun ${cliPath} task archive TASK-1`.cwd(testDir).quiet();
		expect(archived.exitCode).toBe(0);
		expect(archived.stdout.toString()).toContain("Archived task TASK-1");
		expect(archived.stdout.toString()).not.toContain("Removed references");
	});
});
