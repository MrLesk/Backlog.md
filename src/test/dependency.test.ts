import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { taskIdsEqual } from "../utils/task-path.ts";

describe("Task Dependencies", () => {
	let tempDir: string;
	let core: Core;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "backlog-dependency-test-"));

		// Initialize git repository first using the same pattern as other tests
		await $`git init -b main`.cwd(tempDir).quiet();

		core = new Core(tempDir);
		await initializeTestProject(core, "test-project");
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("should create task with dependencies", async () => {
		// Create base tasks first
		const task1: Task = {
			id: "task-1",
			title: "Base Task 1",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Base task",
		};

		const task2: Task = {
			id: "task-2",
			title: "Base Task 2",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Another base task",
		};

		await core.createTask(task1, false);
		await core.createTask(task2, false);

		// Create task with dependencies
		const dependentTask: Task = {
			id: "task-3",
			title: "Dependent Task",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1", "task-2"],
			description: "Task that depends on others",
		};

		await core.createTask(dependentTask, false);

		// Verify the task was created with dependencies
		const savedTask = await core.filesystem.loadTask("task-3");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should update task dependencies", async () => {
		// Create base tasks
		const task1: Task = {
			id: "task-1",
			title: "Base Task 1",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Base task",
		};

		const task2: Task = {
			id: "task-2",
			title: "Base Task 2",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Another base task",
		};

		const task3: Task = {
			id: "task-3",
			title: "Task without dependencies",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Task without dependencies initially",
		};

		await core.createTask(task1, false);
		await core.createTask(task2, false);
		await core.createTask(task3, false);

		// Update task to add dependencies
		await core.updateTaskFromInput(task3.id, { dependencies: ["task-1", "task-2"] }, false);

		// Verify the dependencies were updated
		const savedTask = await core.filesystem.loadTask("task-3");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["TASK-1", "TASK-2"]);
	});

	test("should handle tasks with dependencies in drafts", async () => {
		// Create a draft task
		const draftTask: Task = {
			id: "task-1",
			title: "Draft Task",
			status: "Draft",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Draft task",
		};

		await core.createTaskFromInput(
			{
				title: draftTask.title,
				status: "Draft",
				description: draftTask.description,
				dependencies: draftTask.dependencies,
			},
			false,
		);

		// Create task that depends on draft
		const task2: Task = {
			id: "task-2",
			title: "Task depending on draft",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"], // Depends on draft task
			description: "Task depending on draft",
		};

		await core.createTask(task2, false);

		// Verify the task was created with dependency on draft
		const savedTask = await core.filesystem.loadTask("task-2");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["task-1"]);
	});

	test("should serialize and deserialize dependencies correctly", async () => {
		const task: Task = {
			id: "task-1",
			title: "Task with multiple dependencies",
			status: "In Progress",
			assignee: ["@developer"],
			createdDate: "2024-01-01",
			labels: ["feature", "backend"],
			dependencies: ["task-2", "task-3", "task-4"],
			description: "Task with various metadata and dependencies",
		};

		// Create dependency tasks first
		for (let i = 2; i <= 4; i++) {
			const depTask: Task = {
				id: `task-${i}`,
				title: `Dependency Task ${i}`,
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01",
				labels: [],
				dependencies: [],
				description: `Dependency task ${i}`,
			};
			await core.createTask(depTask, false);
		}

		await core.createTask(task, false);

		// Load the task back and verify all fields
		const loadedTask = await core.filesystem.loadTask("task-1");
		expect(loadedTask).not.toBeNull();
		expect(loadedTask?.id).toBe("TASK-1");
		expect(loadedTask?.title).toBe("Task with multiple dependencies");
		expect(loadedTask?.status).toBe("In Progress");
		expect(loadedTask?.assignee).toEqual(["@developer"]);
		expect(loadedTask?.labels).toEqual(["feature", "backend"]);
		expect(loadedTask?.dependencies).toEqual(["task-2", "task-3", "task-4"]);
	});

	test("should handle empty dependencies array", async () => {
		const task: Task = {
			id: "task-1",
			title: "Task without dependencies",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Task without dependencies",
		};

		await core.createTask(task, false);

		const loadedTask = await core.filesystem.loadTask("task-1");
		expect(loadedTask).not.toBeNull();
		expect(loadedTask?.dependencies).toEqual([]);
	});

	test("should sanitize archived task dependencies across the working copy and the completed corpus", async () => {
		const archivedTarget: Task = {
			id: "task-1",
			title: "Archive target",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Task that will be archived",
		};

		const activeDependent: Task = {
			id: "task-2",
			title: "Active dependent task",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["TASK-1", "task-1"],
			description: "Depends on archive target",
		};

		const completedDependent: Task = {
			id: "task-3",
			title: "Completed dependent task",
			status: "Done",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"],
			description: "A completed record still resolves the ID, so it is cleaned too",
		};

		const childTask: Task = {
			id: "task-4",
			title: "Child task",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"],
			parentTaskId: "task-1",
			description: "Parent relationship is out of scope for archive sanitization",
		};

		await core.createTask(archivedTarget, false);
		await core.createTask(activeDependent, false);
		await core.createTask(completedDependent, false);
		await core.createTask(childTask, false);
		await core.completeTask("task-3", false);

		const archived = await core.archiveTask("task-1", false);
		expect(archived.success).toBe(true);
		expect(archived.cleanedTaskIds).toEqual(["TASK-2", "TASK-4", "TASK-3"]);

		const updatedActive = await core.filesystem.loadTask("task-2");
		const updatedChild = await core.filesystem.loadTask("task-4");
		const completedTasks = await core.filesystem.listCompletedTasks();
		const completed = completedTasks.find((task) => task.id === "TASK-3");

		expect(updatedActive?.dependencies).toEqual([]);
		expect(updatedChild?.dependencies).toEqual([]);
		expect(updatedChild?.parentTaskId).toBe("TASK-1");
		expect(completed?.dependencies).toEqual([]);
	});

	test("should sanitize archive links when archiving by numeric id with custom task prefix", async () => {
		const config = await core.filesystem.loadConfig();
		expect(config).not.toBeNull();
		if (!config) {
			return;
		}
		config.prefixes = { task: "back" };
		await core.filesystem.saveConfig(config);

		const { task: archiveTarget } = await core.createTaskFromInput({
			title: "Custom prefix target",
		});
		const { task: dependentTask } = await core.createTaskFromInput({
			title: "Custom prefix dependent",
			dependencies: [archiveTarget.id],
		});

		const archived = await core.archiveTask("1", false);
		expect(archived.success).toBe(true);

		const updatedDependent = await core.filesystem.loadTask(dependentTask.id);
		expect(updatedDependent?.dependencies).toEqual([]);
	});

	test("accepts a completed task as a dependency at create and edit time", async () => {
		const { task: predecessor } = await core.createTaskFromInput({ title: "Finished predecessor", status: "Done" });
		expect(await core.completeTask(predecessor.id, false)).toBe(true);

		const { task: created } = await core.createTaskFromInput({
			title: "Created after completion",
			dependencies: [predecessor.id],
		});
		expect(created.dependencies).toEqual([predecessor.id]);

		const { task: edited } = await core.createTaskFromInput({ title: "Edited after completion" });
		await core.updateTaskFromInput(edited.id, { dependencies: [predecessor.id] }, false);
		expect((await core.filesystem.loadTask(edited.id))?.dependencies).toEqual([predecessor.id]);
	});

	test("accepts an archived task as a dependency at create and edit time", async () => {
		const { task: predecessor } = await core.createTaskFromInput({ title: "Archived predecessor" });
		// Keep an active task with a higher ID so the allocator does not reuse the archived ID.
		const { task: edited } = await core.createTaskFromInput({ title: "Edited after archive" });
		expect((await core.archiveTask(predecessor.id, false)).success).toBe(true);

		const { task: created } = await core.createTaskFromInput({
			title: "Created after archive",
			dependencies: [predecessor.id],
		});
		expect(created.dependencies).toEqual([predecessor.id]);

		await core.updateTaskFromInput(edited.id, { dependencies: [predecessor.id] }, false);
		expect((await core.filesystem.loadTask(edited.id))?.dependencies).toEqual([predecessor.id]);
	});

	test("re-editing the dependency list of a task whose predecessor completed keeps working", async () => {
		const { task: predecessor } = await core.createTaskFromInput({ title: "Predecessor", status: "Done" });
		const { task: other } = await core.createTaskFromInput({ title: "Other target" });
		const { task: dependent } = await core.createTaskFromInput({
			title: "Dependent",
			dependencies: [predecessor.id],
		});

		expect(await core.completeTask(predecessor.id, false)).toBe(true);

		// --depends-on replaces the whole list, so the existing completed entry must revalidate too.
		await core.updateTaskFromInput(dependent.id, { dependencies: [predecessor.id, other.id] }, false);
		expect((await core.filesystem.loadTask(dependent.id))?.dependencies).toEqual([predecessor.id, other.id]);
	});

	test("still accepts drafts and rejects unknown dependency IDs", async () => {
		const { task: draft } = await core.createTaskFromInput({ title: "Draft target", status: "Draft" }, false);
		const { task } = await core.createTaskFromInput({ title: "Dependent task" });

		await core.updateTaskFromInput(task.id, { dependencies: [draft.id] }, false);
		expect((await core.filesystem.loadTask(task.id))?.dependencies).toEqual([draft.id]);

		await expect(core.updateTaskFromInput(task.id, { dependencies: ["task-999"] }, false)).rejects.toThrow(
			"The following dependencies do not exist: task-999",
		);
	});

	test("fails closed when a completed task and an active file claim the same identity", async () => {
		const { task: predecessor } = await core.createTaskFromInput({ title: "Predecessor", status: "Done" });
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent" });
		expect(await core.completeTask(predecessor.id, false)).toBe(true);

		// Recreate the completed task's file in the active tasks directory so two files claim its ID.
		const completed = (await core.filesystem.listCompletedTasks()).find((task) => task.id === predecessor.id);
		expect(completed?.filePath).toBeDefined();
		if (!completed?.filePath) return;
		const duplicatePath = join(core.filesystem.tasksDir, "task-1 - Duplicate.md");
		await Bun.write(duplicatePath, await Bun.file(completed.filePath).text());

		await expect(core.updateTaskFromInput(dependent.id, { dependencies: [predecessor.id] }, false)).rejects.toThrow(
			/ambiguous/,
		);
		expect((await core.filesystem.loadTask(dependent.id))?.dependencies ?? []).toEqual([]);
	});

	test("should not sanitize draft dependencies when archiving", async () => {
		const archiveTarget: Task = {
			id: "task-1",
			title: "Archive target",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Task that will be archived",
		};

		const draftTask: Task = {
			id: "draft-1",
			title: "Draft dependent task",
			status: "Draft",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"],
			description: "Draft should not be sanitized by archive cleanup",
		};

		await core.createTask(archiveTarget, false);
		await core.createTaskFromInput(
			{
				title: draftTask.title,
				status: "Draft",
				description: draftTask.description,
				dependencies: draftTask.dependencies,
			},
			false,
		);
		await core.archiveTask("task-1", false);

		const draft = await core.filesystem.loadDraft("draft-1");
		expect(draft?.dependencies).toEqual(["TASK-1"]);
	});
});

import { initializeTestProject } from "./test-utils.ts";

describe("Self-referential and cyclic dependencies", () => {
	let tempDir: string;
	let core: Core;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "backlog-dependency-cycle-test-"));
		await $`git init -b main`.cwd(tempDir).quiet();
		core = new Core(tempDir);
		await initializeTestProject(core, "test-project");
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("rejects a task depending on itself, in its own spelling and in alias forms", async () => {
		const { task } = await core.createTaskFromInput({ title: "Self" });
		const match = task.id.match(/^(.+)-0*(\d+)$/);
		expect(match).not.toBeNull();
		if (!match) return;
		const [, prefix, digits] = match;
		const aliases = [task.id, task.id.toLowerCase(), task.id.toUpperCase(), `${prefix}-00${digits}`];
		for (const alias of aliases) {
			await expect(core.updateTaskFromInput(task.id, { dependencies: [alias] }, false)).rejects.toThrow(
				"cannot depend on itself",
			);
			await expect(core.updateTaskFromInput(task.id, { addDependencies: [alias] }, false)).rejects.toThrow(
				"cannot depend on itself",
			);
		}
		expect((await core.filesystem.loadTask(task.id))?.dependencies ?? []).toEqual([]);
	});

	test("rejects a dependency that closes a two-task cycle, naming the path", async () => {
		const { task: first } = await core.createTaskFromInput({ title: "First" });
		const { task: second } = await core.createTaskFromInput({ title: "Second", dependencies: [first.id] });

		await expect(core.updateTaskFromInput(first.id, { addDependencies: [second.id] }, false)).rejects.toThrow(
			`These dependencies would create a cycle: ${first.id} -> ${second.id} -> ${first.id}`,
		);
		expect((await core.filesystem.loadTask(first.id))?.dependencies ?? []).toEqual([]);
	});

	test("rejects a dependency that closes a multi-hop cycle, naming the full path", async () => {
		const { task: first } = await core.createTaskFromInput({ title: "First" });
		const { task: second } = await core.createTaskFromInput({ title: "Second", dependencies: [first.id] });
		const { task: third } = await core.createTaskFromInput({ title: "Third", dependencies: [second.id] });

		await expect(core.updateTaskFromInput(first.id, { dependencies: [third.id] }, false)).rejects.toThrow(
			`These dependencies would create a cycle: ${first.id} -> ${third.id} -> ${second.id} -> ${first.id}`,
		);
		expect((await core.filesystem.loadTask(first.id))?.dependencies ?? []).toEqual([]);
	});

	test("rejects a create whose allocated ID would close a cycle through a dangling reference", async () => {
		// A dangling dependency on the next ID can only be stored out-of-band; materializing that ID
		// with a dependency pointing back must not store the cycle.
		await core.createTask(
			{
				id: "task-1",
				title: "Dangling forward reference",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01",
				labels: [],
				dependencies: ["task-2"],
			},
			false,
		);

		await expect(core.createTaskFromInput({ title: "Closes the loop", dependencies: ["task-1"] })).rejects.toThrow(
			"would create a cycle",
		);
		expect(await core.filesystem.loadTask("task-2")).toBeNull();
	});

	test("repairing a stored cycle by replacing the dependency list succeeds", async () => {
		const legacy = (id: string, dependencies: string[]): Task => ({
			id,
			title: `Legacy ${id}`,
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies,
		});
		await core.createTask(legacy("task-1", ["task-2"]), false);
		await core.createTask(legacy("task-2", ["task-1"]), false);
		const { task: other } = await core.createTaskFromInput({ title: "Clean target" });

		// The stored record's own outgoing edges must not veto the repair that removes them.
		await core.updateTaskFromInput("task-1", { dependencies: [other.id] }, false);
		expect((await core.filesystem.loadTask("task-1"))?.dependencies).toEqual([other.id]);

		// A proposed list that is itself cyclic stays rejected.
		await expect(core.updateTaskFromInput("task-1", { dependencies: ["task-2"] }, false)).rejects.toThrow(
			"would create a cycle",
		);
	});

	test("fails closed when a forward path crosses an ambiguous identity", async () => {
		const record = (id: string, title: string, dependencies: string[]): Task => ({
			id,
			title,
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies,
		});
		await core.createTask(record("task-1", "Root", []), false);
		await core.createTask(record("task-2", "Middle", ["task-3"]), false);
		// Two records claim TASK-3 across stores: one completed, one active. The graph refuses to
		// traverse the contested identity, so the return path behind it must fail the edit closed.
		await core.createTask({ ...record("task-3", "Contested", ["task-1"]), status: "Done" }, false);
		expect(await core.completeTask("task-3", false)).toBe(true);
		const completed = (await core.filesystem.listCompletedTasks()).find((task) => taskIdsEqual(task.id, "task-3"));
		expect(completed?.filePath).toBeDefined();
		if (!completed?.filePath) return;
		await Bun.write(
			join(tempDir, "backlog", "tasks", "task-3 - Contested twin.md"),
			await Bun.file(completed.filePath).text(),
		);

		await expect(core.updateTaskFromInput("task-1", { dependencies: ["task-2"] }, false)).rejects.toThrow(
			"more than one record claims",
		);
		expect((await core.filesystem.loadTask("task-1"))?.dependencies ?? []).toEqual([]);
	});

	test("rejects a promotion whose allocated ID would close a cycle through a dangling reference", async () => {
		await core.createTask(
			{
				id: "task-1",
				title: "Dangling forward reference",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01",
				labels: [],
				dependencies: ["task-2"],
			},
			false,
		);
		const { task: draft } = await core.createTaskFromInput(
			{ title: "Promotes into the loop", status: "Draft", dependencies: ["task-1"] },
			false,
		);

		await expect(core.editTaskOrDraft(draft.id, { status: "To Do" })).rejects.toThrow("would create a cycle");
		expect(await core.filesystem.loadDraft(draft.id)).not.toBeNull();
		expect(await core.filesystem.loadTask("task-2")).toBeNull();
	});

	test("rejects a demotion whose allocated draft ID would close a cycle through a dangling reference", async () => {
		await core.createTaskFromInput({ title: "Existing draft", status: "Draft" }, false);
		await core.createTask(
			{
				id: "task-1",
				title: "Dangling draft reference",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01",
				labels: [],
				dependencies: ["draft-2"],
			},
			false,
		);
		const { task: demotee } = await core.createTaskFromInput({
			title: "Demotes into the loop",
			dependencies: ["task-1"],
		});

		await expect(core.updateTaskFromInput(demotee.id, { status: "Draft" }, false)).rejects.toThrow(
			"would create a cycle",
		);
		expect(await core.filesystem.loadTask(demotee.id)).not.toBeNull();
		expect(await core.filesystem.loadDraft("draft-2")).toBeNull();
	});

	test("a bare-number dependency resolves to the existing draft, not the allocated task ID", async () => {
		const { task: draft } = await core.createTaskFromInput({ title: "Existing draft", status: "Draft" }, false);

		// With no tasks yet, creation allocates task-1; bare 1 must keep naming the record that
		// already claims it instead of being rejected as a self-dependency on the allocated ID.
		const { task } = await core.createTaskFromInput({ title: "Depends on the draft", dependencies: ["1"] }, false);
		expect(task.dependencies).toEqual([draft.id]);
	});

	test("rejects a promotion whose dangling reference equals the allocated task ID", async () => {
		// The reference resolves to nothing, so only the pre-resolution target check can catch it;
		// writing the record under the allocated ID would store a direct self-dependency.
		await core.filesystem.saveDraft({
			id: "draft-1",
			title: "Dangling reference to the next task ID",
			status: "Draft",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"],
		});

		await expect(core.editTaskOrDraft("draft-1", { status: "To Do" })).rejects.toThrow("cannot depend on itself");
		expect(await core.filesystem.loadDraft("draft-1")).not.toBeNull();
		expect(await core.filesystem.loadTask("task-1")).toBeNull();
	});

	test("rejects a demotion whose dangling reference equals the allocated draft ID", async () => {
		await core.createTask(
			{
				id: "task-1",
				title: "Dangling reference to the next draft ID",
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01",
				labels: [],
				dependencies: ["draft-1"],
			},
			false,
		);

		await expect(core.updateTaskFromInput("task-1", { status: "Draft" }, false)).rejects.toThrow(
			"cannot depend on itself",
		);
		expect(await core.filesystem.loadTask("task-1")).not.toBeNull();
		expect(await core.filesystem.loadDraft("draft-1")).toBeNull();
	});

	test("a stored self-dependency does not block adding an unrelated dependency", async () => {
		const { task: other } = await core.createTaskFromInput({ title: "Other" });
		const legacy: Task = {
			id: "task-9",
			title: "Legacy self-dependent",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-9"],
		};
		await core.createTask(legacy, false);

		await core.updateTaskFromInput(legacy.id, { addDependencies: [other.id] }, false);
		expect((await core.filesystem.loadTask(legacy.id))?.dependencies).toEqual(["task-9", other.id]);
	});
});
