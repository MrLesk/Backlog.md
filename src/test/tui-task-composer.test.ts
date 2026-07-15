import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { getCreatedTaskBoardOutcome, upsertBoardTask } from "../ui/board.ts";
import {
	createTaskComposerValues,
	getTaskComposerPriorityChoices,
	getTaskComposerStatusChoices,
	getTaskComposerTypeChoices,
	TaskComposerController,
	toTaskCreateInput,
} from "../ui/components/task-composer.ts";
import { watchTasks } from "../utils/task-watcher.ts";
import { initializeTestProject, withTimeout } from "./test-utils.ts";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "TASK-1",
		title: "Created task",
		status: "To Do",
		assignee: [],
		createdDate: "2026-07-15 00:00",
		labels: [],
		dependencies: [],
		...overrides,
	};
}

describe("TUI task composer model", () => {
	it("rests on the first configured workflow status and never Draft", () => {
		const values = createTaskComposerValues(["Review", "Ready", "Done"]);
		expect(values.status).toBe("Review");
		expect(values.type).toBe("");
		expect(values.priority).toBe("");
	});

	it("offers Draft only in the opened status choices without changing the resting value", () => {
		const values = createTaskComposerValues(["Backlog", "Doing", "Done"]);
		const choices = getTaskComposerStatusChoices(["Backlog", "Doing", "Done"]);

		expect(choices.map((choice) => choice.value)).toEqual(["Draft", "Backlog", "Doing", "Done"]);
		expect(values.status).toBe("Backlog");
	});

	it("uses configured type and priority choices with explicit unset options", () => {
		expect(getTaskComposerTypeChoices(["Incident", "Feature"])).toEqual([
			{ label: "None", value: "" },
			{ label: "Incident", value: "Incident" },
			{ label: "Feature", value: "Feature" },
		]);
		expect(getTaskComposerPriorityChoices(["Urgent", "Eventually"])).toEqual([
			{ label: "None", value: "" },
			{ label: "Urgent", value: "urgent" },
			{ label: "Eventually", value: "eventually" },
		]);
	});

	it("builds the canonical first-slice payload and omits unset fields", () => {
		expect(
			toTaskCreateInput({
				title: "  Capture intent  ",
				description: "Line one\nLine two",
				status: "Review",
				type: "Feature",
				priority: "urgent",
			}),
		).toEqual({
			title: "Capture intent",
			description: "Line one\nLine two",
			status: "Review",
			type: "Feature",
			priority: "urgent",
		});

		expect(toTaskCreateInput({ title: "Minimal", description: "", status: "To Do", type: "", priority: "" })).toEqual({
			title: "Minimal",
			status: "To Do",
		});
	});

	it("does not persist invalid input and preserves values after a failed attempt", async () => {
		const controller = new TaskComposerController(["Review", "Done"]);
		let calls = 0;
		const persist = async (_input: TaskCreateInput) => {
			calls += 1;
			throw new Error("Disk is read-only");
		};

		expect(await controller.create(persist)).toBeNull();
		expect(calls).toBe(0);
		expect(controller.error).toBe("Title is required.");

		controller.values.title = "Retry me";
		controller.values.description = "Keep this description";
		expect(await controller.create(persist)).toBeNull();
		expect(calls).toBe(1);
		expect(controller.error).toBe("Disk is read-only");
		expect(controller.values).toEqual({
			title: "Retry me",
			description: "Keep this description",
			status: "Review",
			type: "",
			priority: "",
		});
	});
});

describe("TUI task composer canonical persistence", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-tui-composer-"));
		core = new Core(testDir);
		await initializeTestProject(core, "TUI Composer Test");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("routes normal and explicitly selected Draft values through canonical creation", async () => {
		const normal = new TaskComposerController(["To Do", "Done"]);
		normal.values.title = "Normal task";
		const createdTask = await normal.create(async (input) => (await core.createTaskFromInput(input, false)).task);

		const draft = new TaskComposerController(["To Do", "Done"]);
		draft.values.title = "Draft task";
		draft.values.status = "Draft";
		const createdDraft = await draft.create(async (input) => (await core.createTaskFromInput(input, false)).task);

		expect(createdTask?.id).toBe("TASK-1");
		expect(await core.fs.loadTask("TASK-1")).not.toBeNull();
		expect(createdDraft?.id).toBe("DRAFT-1");
		expect(await core.fs.loadDraft("DRAFT-1")).not.toBeNull();
		expect(await core.fs.loadTask("DRAFT-1")).toBeNull();
	});

	it("keeps watcher delivery idempotent with the board optimistic upsert", async () => {
		let resolveAdded!: (created: Task) => void;
		const added = new Promise<Task>((resolve) => {
			resolveAdded = resolve;
		});
		const watcher = watchTasks(core, { onTaskAdded: resolveAdded }, []);
		try {
			const controller = new TaskComposerController(["To Do", "Done"]);
			controller.values.title = "Watched task";
			const created = await controller.create(async (input) => (await core.createTaskFromInput(input, false)).task);
			expect(created).not.toBeNull();

			const optimistic = upsertBoardTask([], created as Task);
			const watched = await withTimeout(added, "TUI composer watcher delivery", 3000);
			const reconciled = upsertBoardTask(optimistic, watched);
			expect(reconciled.map((candidate) => candidate.id)).toEqual(["TASK-1"]);
		} finally {
			watcher.stop();
		}
	});
});

describe("TUI task creation board outcome", () => {
	it("focuses a visible created task and updates watcher duplicates in place", () => {
		const created = task();
		const tasks = upsertBoardTask([], created);
		const updated = upsertBoardTask(tasks, { ...created, title: "Watcher copy" });

		expect(updated).toHaveLength(1);
		expect(updated[0]?.title).toBe("Watcher copy");
		expect(getCreatedTaskBoardOutcome(created, true)).toEqual({
			focusTaskId: "TASK-1",
			message: "Created TASK-1.",
			tone: "green",
		});
	});

	it("explains why drafts and filtered tasks cannot be focused", () => {
		expect(getCreatedTaskBoardOutcome(task({ id: "DRAFT-1", status: "Draft" }), false)).toEqual({
			message: "Created DRAFT-1 as a draft. Drafts are not shown on the task board.",
			tone: "yellow",
		});
		expect(getCreatedTaskBoardOutcome(task(), false)).toEqual({
			message: "Created TASK-1, but it is hidden by the current board filters.",
			tone: "yellow",
		});
	});
});
