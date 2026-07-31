import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { completeTasksForCleanup } from "../commands/cleanup.ts";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject } from "./test-utils.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createScenario(
	cachedAutoCommit: boolean,
): Promise<{ root: string; core: Core; task: Task; beforeCount: number }> {
	const root = createUniqueTestDir(`cleanup-plan-${cachedAutoCommit}`);
	roots.push(root);
	await mkdir(root, { recursive: true });
	await $`git init -q -b main`.cwd(root);
	await $`git config user.name "Test User"`.cwd(root);
	await $`git config user.email test@example.com`.cwd(root);
	const core = new Core(root);
	await initializeTestProject(core, "Cleanup plan");
	const config = await core.filesystem.loadConfig();
	if (!config) throw new Error("Expected cleanup config");
	await core.filesystem.saveConfig({ ...config, autoCommit: cachedAutoCommit, autoCommitMode: "new" });
	await core.createTask(
		{
			id: "task-1",
			title: "Cleanup candidate",
			status: "Done",
			assignee: [],
			createdDate: "2026-01-01",
			labels: [],
			dependencies: [],
			rawContent: "Cleanup candidate",
		},
		false,
	);
	await $`git add . && git commit -q -m "Initialize cleanup"`.cwd(root);
	const task = await core.filesystem.loadTask("task-1");
	if (!task) throw new Error("Expected cleanup task");
	await core.filesystem.loadConfig();
	const beforeCount = Number((await $`git rev-list --count HEAD`.cwd(root).text()).trim());
	return { root, core, task, beforeCount };
}

async function changeCurrentAutoCommit(root: string, enabled: boolean): Promise<void> {
	const configPath = join(root, "backlog", "config.yml");
	const content = await Bun.file(configPath).text();
	await Bun.write(configPath, content.replace(/auto_commit: (?:true|false)/, `auto_commit: ${enabled}`));
}

describe("cleanup automatic-commit plan", () => {
	it("stages moves when current bytes disable a stale cached enabled setting", async () => {
		const { root, core, task, beforeCount } = await createScenario(true);
		await changeCurrentAutoCommit(root, false);

		const result = await completeTasksForCleanup(core, [task]);

		expect(result.autoCommitEnabled).toBe(false);
		expect(result.stagedMoves).toBe(true);
		expect(result.successCount).toBe(1);
		expect(Number((await $`git rev-list --count HEAD`.cwd(root).text()).trim())).toBe(beforeCount);
		expect((await $`git diff --cached --name-status`.cwd(root).text()).trim()).toContain("task-1");
	});

	it("reports all-failed and partial exact-path staging truthfully", async () => {
		const tasks = [
			{ id: "task-1", title: "First", filePath: "/tasks/task-1.md" },
			{ id: "task-2", title: "Second", filePath: "/tasks/task-2.md" },
		] as Task[];
		for (const failedTaskIds of [["task-1", "task-2"], ["task-2"]]) {
			const stagedTaskIds: string[] = [];
			const fakeCore = {
				withAutoCommitPlan: async (_enabled: boolean | undefined, action: () => Promise<unknown>) => await action(),
				shouldAutoCommit: async () => false,
				getTask: async () => null,
				completeTask: async () => true,
				filesystem: { completedDir: "/completed" },
				gitOps: {
					isRepository: async () => true,
					stageFileMove: async (fromPath: string) => {
						const taskId = fromPath.includes("task-1") ? "task-1" : "task-2";
						if (failedTaskIds.includes(taskId)) throw new Error(`cannot stage ${taskId}`);
						stagedTaskIds.push(taskId);
					},
				},
			} as unknown as Core;

			const result = await completeTasksForCleanup(fakeCore, tasks);

			expect(result.successCount).toBe(2);
			expect(result.stageWarnings.map((warning) => warning.taskId)).toEqual(failedTaskIds);
			expect(result.stagedMoveCount).toBe(stagedTaskIds.length);
			expect(result.stagedMoves).toBe(stagedTaskIds.length > 0);
		}
	});

	it("commits moves without false staging output when current bytes enable a stale cached disabled setting", async () => {
		const { root, core, task, beforeCount } = await createScenario(false);
		await changeCurrentAutoCommit(root, true);

		const result = await completeTasksForCleanup(core, [task]);

		expect(result.autoCommitEnabled).toBe(true);
		expect(result.stagedMoves).toBe(false);
		expect(result.successCount).toBe(1);
		expect(Number((await $`git rev-list --count HEAD`.cwd(root).text()).trim())).toBe(beforeCount + 1);
		expect((await $`git diff --cached --name-only`.cwd(root).text()).trim()).toBe("");
		expect(await $`git ls-tree -r --name-only HEAD`.cwd(root).text()).toContain("backlog/completed/task-1");
	});
});
