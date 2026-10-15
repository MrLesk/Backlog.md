import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, unlink } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { archiveTaskFromTui, formatArchiveConfirmation, formatArchiveNotice } from "../ui/task-lifecycle.ts";
import { generateDetailContent } from "../ui/task-viewer-with-search.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;

const createTask = async (task: Pick<Task, "id" | "title" | "status">) => {
	await core.createTask(
		{
			...task,
			assignee: [],
			createdDate: "2026-07-01",
			labels: [],
			dependencies: [],
			rawContent: "Test task",
		},
		false,
	);
};

/** Stands in for the confirm popup and counts how often a view would have opened it. */
const confirmWith = (answer: boolean) => {
	const popups: Array<{ title: string; message: string }> = [];
	return {
		popups,
		confirm: async (popup: { title: string; message: string }) => {
			popups.push(popup);
			return answer;
		},
	};
};

describe("TUI task lifecycle", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("tui-task-lifecycle");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "TUI Task Lifecycle Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("archives a task in any status and keeps its ID and status", async () => {
		await createTask({ id: "task-1", title: "Open task", status: "To Do" });
		await createTask({ id: "task-2", title: "Done task", status: "Done" });

		for (const id of ["task-1", "task-2"]) {
			const task = (await core.filesystem.loadTask(id)) as Task;
			const { popups, confirm } = confirmWith(true);

			const result = await archiveTaskFromTui(core, task, confirm);

			expect(result).toEqual({ archived: true });
			expect(popups).toEqual([{ title: "Archive Task", message: formatArchiveConfirmation(task.id) }]);
			expect(formatArchiveNotice(task, result)).toBe(` {green-fg}Archived ${task.id}{/}`);
			expect(await core.filesystem.loadTask(id)).toBeNull();
		}

		const archivedTasks = await core.filesystem.listArchivedTasks();
		expect(archivedTasks.map((task) => [task.id, task.status])).toEqual([
			["TASK-1", "To Do"],
			["TASK-2", "Done"],
		]);
	});

	it("refuses an archived task before asking, with the read-only line", async () => {
		await createTask({ id: "task-1", title: "Archived task", status: "Done" });
		expect(await core.archiveTask("task-1", false)).toBe(true);
		const archived = (await core.getTask("task-1")) as Task;
		expect(archived.source).toBe("archived");
		const { popups, confirm } = confirmWith(true);

		const result = await archiveTaskFromTui(core, archived, confirm);

		expect(result).toEqual({ archived: false, reason: "read_only" });
		expect(popups).toEqual([]);
		expect(formatArchiveNotice(archived, result)).toBe(" {red-fg}Task is read-only.{/}");
		expect((await core.filesystem.listArchivedTasks()).map((task) => task.id)).toEqual(["TASK-1"]);
	});

	it("refuses a task from another branch before asking, and names the branch", async () => {
		await createTask({ id: "task-1", title: "Branch task", status: "To Do" });
		const local = (await core.filesystem.loadTask("task-1")) as Task;
		const fromBranch: Task = { ...local, source: "local-branch", branch: "feature" };
		const { popups, confirm } = confirmWith(true);

		const result = await archiveTaskFromTui(core, fromBranch, confirm);

		expect(result).toEqual({ archived: false, reason: "read_only" });
		expect(popups).toEqual([]);
		expect(formatArchiveNotice(fromBranch, result)).toBe(" {red-fg}Task is read-only in branch feature.{/}");
		expect(await core.filesystem.loadTask("task-1")).not.toBeNull();
	});

	it("archives nothing and says nothing when the question is answered no", async () => {
		await createTask({ id: "task-1", title: "Kept task", status: "To Do" });
		const task = (await core.filesystem.loadTask("task-1")) as Task;

		const result = await archiveTaskFromTui(core, task, confirmWith(false).confirm);

		expect(result).toEqual({ archived: false, reason: "cancelled" });
		expect(formatArchiveNotice(task, result)).toBeNull();
		expect(await core.filesystem.loadTask("task-1")).not.toBeNull();
	});

	it("reports the reason when core refuses after the question was answered yes", async () => {
		await createTask({ id: "task-1", title: "Archived elsewhere", status: "To Do" });
		const stale = (await core.filesystem.loadTask("task-1")) as Task;
		// Another process archives the task while this view still shows it on the board.
		expect(await core.archiveTask("task-1", false)).toBe(true);

		const result = await archiveTaskFromTui(core, stale, confirmWith(true).confirm);

		expect(result).toEqual({
			archived: false,
			reason: "failed",
			error:
				"Task TASK-1 is archived. Archived tasks are read-only. Restore it to the board first: backlog task restore TASK-1",
		});
		expect(formatArchiveNotice(stale, result)).toBe(
			" {red-fg}Error archiving task: Task TASK-1 is archived. Archived tasks are read-only. Restore it to the board first: backlog task restore TASK-1{/}",
		);
	});

	it("says the task was not found when it left the working copy after the view loaded it", async () => {
		await createTask({ id: "task-1", title: "Removed elsewhere", status: "To Do" });
		const stale = (await core.filesystem.loadTask("task-1")) as Task;
		await unlink(stale.filePath as string);

		const result = await archiveTaskFromTui(core, stale, confirmWith(true).confirm);

		expect(result).toEqual({ archived: false, reason: "failed" });
		expect(formatArchiveNotice(stale, result)).toBe(" {red-fg}Task TASK-1 not found.{/}");
	});

	it("marks an archived task read-only in the detail view", async () => {
		await createTask({ id: "task-1", title: "Archived task", status: "Done" });
		const onBoard = (await core.getTask("task-1")) as Task;
		expect(generateDetailContent(onBoard).headerContent.join("\n")).not.toContain("Read-only");
		expect(await core.archiveTask("task-1", false)).toBe(true);
		const archived = (await core.getTask("task-1")) as Task;

		expect(generateDetailContent(archived).headerContent).toContain(
			" {yellow-fg}⚠ Read-only:{/} This task is archived.",
		);
	});

	it("asks one three-line question that fits the confirm popup", () => {
		const lines = formatArchiveConfirmation("TASK-1").split("\n");

		expect(lines).toEqual([
			"Archive {bold}TASK-1{/bold}?",
			"Moves it off the board and keeps",
			"its ID, record, and links.",
		]);
		// The confirm popup is 40 columns wide (src/ui/components/confirm-popup.ts). Its border takes
		// one column on each side and the message box is inset by one more, which leaves 36 for text.
		const visibleWidths = lines.map((line) => line.replace(/\{[^}]*\}/g, "").length);
		expect(Math.max(...visibleWidths)).toBeLessThanOrEqual(36);
	});
});
