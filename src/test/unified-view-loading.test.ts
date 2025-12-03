import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Core } from "../core/backlog.ts";
import { loadTasksForUnifiedView } from "../ui/unified-view.ts";
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
});
