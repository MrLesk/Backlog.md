import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const cliPath = join(process.cwd(), "src/cli.ts");
let testDir: string;
let core: Core;

function makeTask(id: string, title: string): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies: [],
		rawContent: `## Description\n\n${title} content with TASK-1 reference.`,
	};
}

async function writeDuplicateTasks(): Promise<void> {
	await Bun.write(join(core.filesystem.tasksDir, "task-1 - Alpha.md"), serializeTask(makeTask("TASK-1", "Alpha")));
	await Bun.write(join(core.filesystem.tasksDir, "task-01 - Beta.md"), serializeTask(makeTask("TASK-01", "Beta")));
	await Bun.write(
		join(core.filesystem.completedDir, "task-001 - Gamma.md"),
		serializeTask(makeTask("TASK-001", "Gamma")),
	);
}

beforeEach(async () => {
	testDir = createUniqueTestDir("cli-doctor");
	await mkdir(testDir, { recursive: true });
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "CLI doctor",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});
	await writeDuplicateTasks();
});

afterEach(async () => {
	core.disposeSearchService();
	core.disposeContentStore();
	await safeCleanup(testDir);
});

describe("backlog doctor", () => {
	it("prints a path-qualified human repair preview without agent instructions", async () => {
		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Repair preview (no files changed)");
		expect(output).toContain("backlog/tasks/task-01 - Beta.md");
		expect(output).toContain("backlog/completed/task-001 - Gamma.md");
		expect(output).toContain("References requiring human review");
		expect(output.toLowerCase()).not.toContain("copy repair instructions");
		expect(output.toLowerCase()).not.toContain("agent");
	});

	it("repairs all duplicates noninteractively only with explicit --fix --yes", async () => {
		const result = await $`bun ${cliPath} doctor --fix --yes`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(0);
		expect(output).toContain("Repaired 2 duplicate task files");
		expect(output).toContain("Verification passed");
		expect((await core.previewDuplicateTaskIdRepair()).groups).toEqual([]);
	});

	it("requires --fix when --yes is supplied", async () => {
		const result = await $`bun ${cliPath} doctor --yes`.cwd(testDir).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("--yes can only be used together with --fix");
	});

	it("reports cross-branch collisions as diagnostic-only", async () => {
		await $`bun ${cliPath} doctor --fix --yes`.cwd(testDir).quiet();
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		config.checkActiveBranches = true;
		config.activeBranchDays = 30;
		config.remoteOperations = false;
		await core.filesystem.saveConfig(config);
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();
		const alphaPath = join(core.filesystem.tasksDir, "task-20 - Branch Alpha.md");
		await Bun.write(alphaPath, serializeTask(makeTask("TASK-20", "Branch Alpha")));
		await $`git add .`.cwd(testDir).quiet();
		await $`git commit -m "main task"`.cwd(testDir).quiet();
		await $`git switch -c feature`.cwd(testDir).quiet();
		await unlink(alphaPath);
		await Bun.write(
			join(core.filesystem.tasksDir, "task-20 - Branch Beta.md"),
			serializeTask(makeTask("TASK-20", "Branch Beta")),
		);
		await $`git add -A`.cwd(testDir).quiet();
		await $`git commit -m "feature task"`.cwd(testDir).quiet();
		await $`git switch main`.cwd(testDir).quiet();

		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Possible cross-branch ID collisions (diagnostic only)");
		expect(output).toContain("feature:backlog/tasks/task-20 - Branch Beta.md");
		expect(output).toContain("will not edit another branch");
	});
});

describe("CLI collision safety", () => {
	it("diagnoses collisions in plain list and search output", async () => {
		const list = await $`bun ${cliPath} task list --plain`.cwd(testDir).quiet().nothrow();
		const search = await $`bun ${cliPath} search Alpha --plain`.cwd(testDir).quiet().nothrow();
		for (const result of [list, search]) {
			const output = `${result.stdout}${result.stderr}`;
			expect(result.exitCode).toBe(1);
			expect(output).toContain("duplicate task ID");
			expect(output).toContain("backlog doctor");
			expect(output).toContain("backlog/tasks/task-1 - Alpha.md");
		}
	});

	it("blocks ambiguous reads and mutations without changing either file", async () => {
		const alphaPath = join(core.filesystem.tasksDir, "task-1 - Alpha.md");
		const betaPath = join(core.filesystem.tasksDir, "task-01 - Beta.md");
		const alphaBefore = await Bun.file(alphaPath).text();
		const betaBefore = await Bun.file(betaPath).text();
		const view = await $`bun ${cliPath} task view TASK-1 --plain`.cwd(testDir).quiet().nothrow();
		const edit = await $`bun ${cliPath} task edit TASK-1 --title Changed`.cwd(testDir).quiet().nothrow();

		for (const result of [view, edit]) {
			const output = `${result.stdout}${result.stderr}`;
			expect(result.exitCode).toBe(1);
			expect(output).toContain("is ambiguous");
			expect(output).toContain("task-1 - Alpha.md");
			expect(output).toContain("task-01 - Beta.md");
		}
		expect(await Bun.file(alphaPath).text()).toBe(alphaBefore);
		expect(await Bun.file(betaPath).text()).toBe(betaBefore);
	});
});
