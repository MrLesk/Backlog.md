import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { writeProjectRegistry } from "../utils/project-registry.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let testDir: string;

async function createProjectCore(projectKey: string, projectName: string): Promise<Core> {
	const core = new Core(testDir, {
		backlogRoot: join(testDir, "backlog", projectKey),
	});
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName,
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});
	await core.ensureConfigLoaded();
	return core;
}

describe("project isolation", () => {
	beforeEach(async () => {
		testDir = createUniqueTestDir("project-isolation");
		await mkdir(join(testDir, "packages", "xx01"), { recursive: true });
		await mkdir(join(testDir, "packages", "xx02"), { recursive: true });

		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [
				{ key: "xx01", path: "packages/xx01" },
				{ key: "xx02", path: "packages/xx02" },
			],
		});
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("rejects task dependencies that resolve outside the active project", async () => {
		const xx01 = await createProjectCore("xx01", "Project XX01");
		const xx02 = await createProjectCore("xx02", "Project XX02");

		await xx02.createTaskFromInput({
			title: "Other project dependency target",
			status: "To Do",
		});

		await expect(
			xx01.createTaskFromInput({
				title: "Bad dependency",
				status: "To Do",
				dependencies: ["task-1"],
			}),
		).rejects.toThrow(/same project/i);
	});
});
