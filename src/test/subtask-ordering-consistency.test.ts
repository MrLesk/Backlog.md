import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";
import { prepareBoardColumns } from "../ui/board.ts";
import { compareTaskIds } from "../utils/task-sorting.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const cliPath = getTestCliPath();

// One parent with more than nine subtasks, plus two-digit top-level ids, so any surface that
// compares ids as plain strings puts TASK-1.10 in front of TASK-1.2 (github.com/MrLesk/Backlog.md/issues/953).
const SUBTASK_IDS = Array.from({ length: 11 }, (_, index) => `TASK-1.${index + 1}`);
const EXPECTED_ORDER = ["TASK-1", ...SUBTASK_IDS.slice().sort(compareTaskIds), "TASK-2", "TASK-11"];

let TEST_DIR: string;
let core: Core;

const createTask = (id: string, overrides: Partial<Task> = {}): Task => ({
	id,
	title: `Task ${id}`,
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

function idsFromPlainOutput(output: string): string[] {
	return [...output.matchAll(/^\s*(TASK-[\d.]+)\s+-/gm)].map(([, id]) => id ?? "");
}

describe("subtask ordering consistency", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-subtask-ordering");
		await mkdir(TEST_DIR, { recursive: true });

		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Subtask Ordering Test");

		await core.createTask(createTask("TASK-1", { title: "Parent" }), false);
		// Created out of numeric order so no surface can pass by echoing creation order.
		for (const id of [...SUBTASK_IDS].reverse()) {
			await core.createTask(createTask(id, { parentTaskId: "TASK-1" }), false);
		}
		await core.createTask(createTask("TASK-11"), false);
		await core.createTask(createTask("TASK-2"), false);
	});

	afterEach(async () => {
		core.disposeContentStore();
		await safeCleanup(TEST_DIR);
	});

	it("orders the board's task corpus numerically, so TASK-1.9 precedes TASK-1.10", async () => {
		// The corpus `backlog board` hands to the unified view. Its task list renders this array
		// as-is, so this order is what the TUI list shows after Tab.
		const ids = (await core.loadTasks()).map((task) => task.id);

		expect(ids).toEqual(EXPECTED_ORDER);
		expect(ids.indexOf("TASK-1.9")).toBeLessThan(ids.indexOf("TASK-1.10"));
		expect(ids.indexOf("TASK-1.2")).toBeLessThan(ids.indexOf("TASK-1.11"));
	});

	it("agrees across every corpus reader", async () => {
		expect((await core.loadTasks()).map((task) => task.id)).toEqual(EXPECTED_ORDER);
		expect((await core.queryTasks()).map((task) => task.id)).toEqual(EXPECTED_ORDER);
		expect((await core.queryTasks({ includeCrossBranch: false })).map((task) => task.id)).toEqual(EXPECTED_ORDER);
		expect((await core.filesystem.listTasks()).map((task) => task.id)).toEqual(EXPECTED_ORDER);
	});

	it("agrees with the board columns and with the comparator the web list sorts by", async () => {
		const tasks = await core.loadTasks();
		const [column] = prepareBoardColumns(tasks, ["To Do"]);

		expect(column?.tasks.map((task) => task.id)).toEqual(EXPECTED_ORDER);
		// The web task list sorts with this same comparator, so a corpus already in its order
		// cannot disagree with it.
		expect(tasks.map((task) => task.id)).toEqual(
			[...tasks].sort((left, right) => compareTaskIds(left.id, right.id)).map((task) => task.id),
		);
	});

	it("agrees with the CLI plain and JSON task lists", async () => {
		const plain = await $`bun ${cliPath} task list --plain`.cwd(TEST_DIR).quiet();
		expect(plain.exitCode).toBe(0);
		expect(idsFromPlainOutput(plain.stdout.toString())).toEqual(EXPECTED_ORDER);

		const json = await $`bun ${cliPath} task list --json`.cwd(TEST_DIR).quiet();
		expect(json.exitCode).toBe(0);
		const payload = JSON.parse(json.stdout.toString()) as { tasks: Array<{ id: string }> };
		expect(payload.tasks.map((task) => task.id)).toEqual(EXPECTED_ORDER);
	});
});
