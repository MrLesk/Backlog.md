import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { Task, TaskListFilter } from "../types";
import { initializeTestProject } from "./test-utils.ts";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("atomic task creation", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-atomic-create-"));
		const core = new Core(testDir);
		await initializeTestProject(core, "Atomic Create Test", false);

		const config = await core.fs.loadConfig();
		if (config) {
			config.checkActiveBranches = false;
			await core.fs.saveConfig(config);
		}
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("assigns unique ids when two creates race in the same project", async () => {
		const first = new Core(testDir);
		const second = new Core(testDir);

		let waitingResolver: (() => void) | undefined;
		const waiting = new Promise<void>((resolve) => {
			waitingResolver = resolve;
		});
		let arrivals = 0;

		const patchListTasks = (core: Core) => {
			const original = core.fs.listTasks.bind(core.fs);
			core.fs.listTasks = (async (filter?: TaskListFilter): Promise<Task[]> => {
				arrivals += 1;
				if (arrivals === 2) {
					waitingResolver?.();
				}
				await Promise.race([waiting, sleep(100)]);
				return await original(filter);
			}) as typeof core.fs.listTasks;
		};

		patchListTasks(first);
		patchListTasks(second);

		const [createdA, createdB] = await Promise.all([
			first.createTaskFromInput({ title: "Alpha" }, false),
			second.createTaskFromInput({ title: "Beta" }, false),
		]);

		expect(new Set([createdA.task.id, createdB.task.id]).size).toBe(2);
	});
});
