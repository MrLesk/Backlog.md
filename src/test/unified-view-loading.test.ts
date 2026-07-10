import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { getDuplicateTaskStartupWarning, loadTasksForUnifiedView } from "../ui/unified-view.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("loadTasksForUnifiedView", () => {
	let testDir: string;
	let core: Core;

	beforeEach(() => {
		testDir = createUniqueTestDir("unified-view-load");
		core = new Core(testDir);
	});

	afterEach(async () => {
		try {
			await safeCleanup(testDir);
		} catch {
			// Ignore cleanup failures in tests
		}
	});

	it("uses provided loader progress and closes the loading screen", async () => {
		const updates: string[] = [];
		let closed = false;

		const result = await loadTasksForUnifiedView(core, {
			tasksLoader: async (updateProgress) => {
				updateProgress("step one");
				return { tasks: [], statuses: ["To Do", "In Progress"] };
			},
			loadingScreenFactory: async () => ({
				update: (msg: string) => {
					updates.push(msg);
				},
				close: async () => {
					closed = true;
				},
			}),
		});

		expect(updates).toContain("step one");
		expect(closed).toBe(true);
		expect(result.statuses).toEqual(["To Do", "In Progress"]);
	});

	it("builds a concise board warning from active and completed collisions", async () => {
		await core.filesystem.ensureBacklogStructure();
		const makeTask = (id: string, title: string): Task => ({
			id,
			title,
			status: "To Do",
			assignee: [],
			createdDate: "2026-01-01",
			labels: [],
			dependencies: [],
			rawContent: "## Description\n\nTask body",
		});
		await Bun.write(join(core.filesystem.tasksDir, "task-1 - Active.md"), serializeTask(makeTask("TASK-1", "Active")));
		await Bun.write(
			join(core.filesystem.completedDir, "task-01 - Completed.md"),
			serializeTask(makeTask("TASK-01", "Completed")),
		);

		expect(await getDuplicateTaskStartupWarning(core)).toBe(
			"Duplicate task IDs detected: TASK-1. Run 'backlog doctor' to preview a safe repair.",
		);
	});
});
