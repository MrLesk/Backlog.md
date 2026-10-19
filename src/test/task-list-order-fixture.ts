import { mkdir } from "node:fs/promises";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";
import { initializeFilesystemTestProject } from "./test-utils.ts";

/**
 * One project for the tests that compare task list order across the plain, JSON, MCP, TUI and
 * browser lists. Its priorities are a configured list instead of high, medium and low. Status,
 * priority, ordinal and ID each put the tasks in a different order, and two tasks have no
 * ordinal, so the default order and every `--sort` value give a different list.
 */
export const ORDER_FIXTURE_PRIORITIES = ["now", "next", "later"];

// The date comes from the run clock so the fixture never ages.
const createdDate = new Date().toISOString().slice(0, 10);

const task = (id: number, title: string, status: string, priority?: string, ordinal?: number): Task => ({
	id: `TASK-${id}`,
	title,
	status,
	priority,
	ordinal,
	// Searching for "orchard" finds every To Do task and nothing else.
	description: status === "To Do" ? "Planted in the orchard." : "",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate,
});

export const ORDER_FIXTURE_TASKS: Task[] = [
	task(1, "Alpha", "To Do", "later", 400),
	task(2, "Bravo", "In Progress", "now", 100),
	task(3, "Charlie", "To Do", "now", 300),
	task(4, "Delta", "Done", "next", 200),
	task(5, "Echo", "To Do"),
	task(6, "Foxtrot", "To Do", "next"),
];

/** The task numbers of each order as one flat list, which is the order `--json` returns. */
export const ORDER_FIXTURE_ORDERS = {
	// Ordinal, then priority, then ID: the order without `--sort`.
	default: [2, 4, 3, 1, 6, 5],
	priority: [2, 3, 4, 6, 1, 5],
	id: [1, 2, 3, 4, 5, 6],
	ordinal: [2, 4, 3, 1, 5, 6],
};

export const taskIds = (numbers: number[]): string[] => numbers.map((number) => `TASK-${number}`);

export async function createOrderFixtureProject(projectDir: string): Promise<Core> {
	await mkdir(projectDir, { recursive: true });
	const core = new Core(projectDir);
	await initializeFilesystemTestProject(core, "Task List Order");
	const config = await core.filesystem.loadConfig();
	if (!config) throw new Error("Expected the fixture project to have a config");
	await core.filesystem.saveConfig({ ...config, priorities: ORDER_FIXTURE_PRIORITIES });
	for (const fixtureTask of ORDER_FIXTURE_TASKS) {
		await core.createTask(fixtureTask, false);
	}
	return core;
}
