import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, rmdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { findLocalDuplicateTaskIds } from "../core/duplicate-task-repair.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { AmbiguousTaskIdError } from "../utils/task-path.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let testDir: string;
let core: Core;

function makeTask(id: string, title: string, description = `${title} body`): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies: [],
		description,
		rawContent: `## Description\n\n${description}\n\nCustom content for ${title}.`,
	};
}

async function writeTask(directory: string, filename: string, task: Task): Promise<string> {
	await mkdir(directory, { recursive: true });
	const path = join(directory, filename);
	await Bun.write(path, serializeTask(task));
	return path;
}

beforeEach(async () => {
	testDir = createUniqueTestDir("duplicate-task-repair");
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "Duplicate repair",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});
});

afterEach(async () => {
	core.disposeSearchService();
	core.disposeContentStore();
	await safeCleanup(testDir);
});

describe("duplicate task diagnosis", () => {
	it("detects three-way, active/completed, and zero-padded collisions while ignoring archive reuse", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		await writeTask(core.filesystem.tasksDir, "task-01 - Beta.md", makeTask("TASK-01", "Beta"));
		await writeTask(core.filesystem.completedDir, "task-001 - Gamma.md", makeTask("TASK-001", "Gamma"));
		await writeTask(core.filesystem.archiveTasksDir, "task-2 - Archived.md", makeTask("TASK-2", "Archived"));
		await writeTask(core.filesystem.tasksDir, "task-2 - Reused.md", makeTask("TASK-2", "Reused"));

		const groups = await findLocalDuplicateTaskIds(core);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.id).toBe("TASK-1");
		expect(groups[0]?.tasks).toHaveLength(3);
		expect(groups[0]?.tasks.map((task) => task.filePath)).toEqual([
			"backlog/completed/task-001 - Gamma.md",
			"backlog/tasks/task-01 - Beta.md",
			"backlog/tasks/task-1 - Alpha.md",
		]);
	});

	it("fails closed when an exact ID lookup matches active and completed files", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Active.md", makeTask("TASK-1", "Active"));
		await writeTask(core.filesystem.completedDir, "task-01 - Completed.md", makeTask("TASK-01", "Completed"));

		await expect(core.filesystem.loadTask("TASK-1")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
		try {
			await core.filesystem.loadTask("TASK-1");
		} catch (error) {
			expect(String(error)).toContain("backlog/tasks/task-1 - Active.md");
			expect(String(error)).toContain("backlog/completed/task-01 - Completed.md");
			expect(String(error)).toContain("backlog doctor");
		}
	});

	it("fails closed when frontmatter IDs collide even if one filename differs", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		await writeTask(core.filesystem.tasksDir, "task-2 - Misnamed.md", makeTask("TASK-1", "Misnamed"));

		await expect(core.filesystem.loadTask("TASK-1")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
	});

	it("does not overwrite either file through the low-level save path when lookup is ambiguous", async () => {
		const alphaPath = await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		const betaPath = await writeTask(core.filesystem.tasksDir, "task-01 - Beta.md", makeTask("TASK-01", "Beta"));
		const before = await Promise.all([alphaPath, betaPath].map(async (path) => await Bun.file(path).text()));

		await expect(core.filesystem.saveTask(makeTask("TASK-1", "Replacement"))).rejects.toBeInstanceOf(
			AmbiguousTaskIdError,
		);
		expect(await Promise.all([alphaPath, betaPath].map(async (path) => await Bun.file(path).text()))).toEqual(before);
	});

	it("reports path-distinct cross-branch collisions without preparing a repair", async () => {
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		config.checkActiveBranches = true;
		config.activeBranchDays = 30;
		config.remoteOperations = false;
		await core.filesystem.saveConfig(config);
		const alphaPath = await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		await $`git add .`.cwd(testDir).quiet();
		await $`git commit -m "main task"`.cwd(testDir).quiet();
		await $`git switch -c feature`.cwd(testDir).quiet();
		await unlink(alphaPath);
		await writeTask(core.filesystem.tasksDir, "task-1 - Beta.md", makeTask("TASK-1", "Beta"));
		await $`git add -A`.cwd(testDir).quiet();
		await $`git commit -m "feature task"`.cwd(testDir).quiet();
		await $`git switch main`.cwd(testDir).quiet();

		const plan = await core.previewDuplicateTaskIdRepair({ includeBranches: true });
		expect(plan.groups).toEqual([]);
		expect(plan.changes).toEqual([]);
		expect(plan.crossBranchFindings).toHaveLength(1);
		expect(plan.crossBranchFindings[0]?.id).toBe("TASK-1");
		expect(plan.crossBranchFindings[0]?.locations.map((location) => location.branch).sort()).toEqual([
			"feature",
			"main",
		]);
		expect(plan.repairable).toBe(false);
	});
});

describe("duplicate task repair", () => {
	it("keeps the ID spelling that matches the configured padding style", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Plain.md", makeTask("TASK-1", "Plain"));
		await writeTask(core.filesystem.tasksDir, "task-01 - Padded.md", makeTask("TASK-01", "Padded"));

		const plan = await core.previewDuplicateTaskIdRepair();
		expect(plan.changes).toHaveLength(1);
		expect(plan.changes[0]?.sourcePath).toBe("backlog/tasks/task-01 - Padded.md");
	});

	it("keeps the padded ID spelling when padding is configured", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		config.zeroPaddedIds = 3;
		await core.filesystem.saveConfig(config);
		await writeTask(core.filesystem.tasksDir, "task-1 - Plain.md", makeTask("TASK-1", "Plain"));
		await writeTask(core.filesystem.tasksDir, "task-001 - Padded.md", makeTask("TASK-001", "Padded"));

		const plan = await core.previewDuplicateTaskIdRepair();
		expect(plan.changes).toHaveLength(1);
		expect(plan.changes[0]?.sourcePath).toBe("backlog/tasks/task-1 - Plain.md");
		expect(plan.changes[0]?.newId).toBe("TASK-002");
	});

	it("previews and applies deterministic human repair without changing task bodies", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		const betaPath = await writeTask(
			core.filesystem.tasksDir,
			"task-1 - Beta.md",
			makeTask("TASK-1", "Beta", "Keep this exact body"),
		);
		await writeTask(core.filesystem.completedDir, "task-001 - Gamma.md", makeTask("TASK-001", "Gamma"));
		await writeTask(core.filesystem.tasksDir, "task-9 - Reference.md", {
			...makeTask("TASK-9", "Reference", "Depends on TASK-1"),
			dependencies: ["TASK-1"],
		});
		const betaBefore = await Bun.file(betaPath).text();

		const plan = await core.previewDuplicateTaskIdRepair();
		expect(plan.repairable).toBe(true);
		expect(plan.changes).toHaveLength(2);
		expect(plan.changes.map((change) => [change.sourcePath, change.newId])).toEqual([
			["backlog/tasks/task-1 - Beta.md", "TASK-10"],
			["backlog/completed/task-001 - Gamma.md", "TASK-11"],
		]);
		expect(plan.references.some((reference) => reference.path.endsWith("task-9 - Reference.md"))).toBe(true);

		const result = await core.repairDuplicateTaskIds(plan.fingerprint);
		expect(result.repairedFiles).toBe(2);
		expect(result.remainingGroups).toEqual([]);
		expect(await findLocalDuplicateTaskIds(core)).toEqual([]);

		const betaAfter = await Bun.file(join(core.filesystem.tasksDir, "task-10 - Beta.md")).text();
		expect(betaAfter).toBe(betaBefore.replace(/^id:\s*TASK-1$/m, "id: TASK-10"));
		expect(await Bun.file(betaPath).exists()).toBe(false);
	});

	it("changes only the ID line when a task contains mixed line endings", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		const betaPath = join(core.filesystem.tasksDir, "task-01 - Beta.md");
		const betaContent = serializeTask(makeTask("TASK-01", "Beta"))
			.replaceAll("\n", "\r\n")
			.replace("## Description\r\n\r\n", "## Description\n\n");
		await Bun.write(betaPath, betaContent);

		const plan = await core.previewDuplicateTaskIdRepair();
		const change = plan.changes[0];
		if (!change) throw new Error("Expected one repair change");
		await core.repairDuplicateTaskIds(plan.fingerprint);

		const repaired = await Bun.file(join(testDir, change.targetPath)).text();
		expect(repaired).toBe(betaContent.replace("id: TASK-01", `id: ${change.newId}`));
	});

	it("leaves every original file in place when a preview becomes stale", async () => {
		const alphaPath = await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		const betaPath = await writeTask(core.filesystem.tasksDir, "task-1 - Beta.md", makeTask("TASK-1", "Beta"));
		const plan = await core.previewDuplicateTaskIdRepair();
		const alphaBefore = await Bun.file(alphaPath).text();
		const betaBefore = await Bun.file(betaPath).text();
		await Bun.write(betaPath, `${betaBefore}\nConcurrent edit\n`);

		await expect(core.repairDuplicateTaskIds(plan.fingerprint)).rejects.toThrow("changed after the preview");
		expect(await Bun.file(alphaPath).text()).toBe(alphaBefore);
		expect(await Bun.file(betaPath).text()).toBe(`${betaBefore}\nConcurrent edit\n`);
		const files = await readdir(core.filesystem.tasksDir);
		expect(files.filter((file) => file.endsWith(".tmp") || file.endsWith(".bak"))).toEqual([]);
	});

	it("rolls back every file when an atomic repair fails after the transaction starts", async () => {
		const alphaPath = await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		const betaPath = await writeTask(core.filesystem.tasksDir, "task-01 - Beta.md", makeTask("TASK-01", "Beta"));
		const gammaPath = await writeTask(
			core.filesystem.completedDir,
			"task-001 - Gamma.md",
			makeTask("TASK-001", "Gamma"),
		);
		const before = await Promise.all([alphaPath, betaPath, gammaPath].map(async (path) => await Bun.file(path).text()));
		const plan = await core.previewDuplicateTaskIdRepair();
		const fixedTime = 1_800_000_000_000;
		const originalNow = Date.now;
		const secondChange = plan.changes[1];
		if (!secondChange) throw new Error("Expected two repair changes");
		const blockingBackupPath = join(
			testDir,
			`${secondChange.sourcePath}.backlog-doctor-${process.pid}-${fixedTime}-1.bak`,
		);
		await mkdir(blockingBackupPath);
		Date.now = () => fixedTime;

		try {
			await expect(core.repairDuplicateTaskIds(plan.fingerprint)).rejects.toThrow();
		} finally {
			Date.now = originalNow;
			await rmdir(blockingBackupPath);
		}

		expect(
			await Promise.all([alphaPath, betaPath, gammaPath].map(async (path) => await Bun.file(path).text())),
		).toEqual(before);
		for (const change of plan.changes) {
			expect(await Bun.file(join(testDir, change.targetPath)).exists()).toBe(false);
		}
		for (const directory of [core.filesystem.tasksDir, core.filesystem.completedDir]) {
			const files = await readdir(directory);
			expect(files.filter((file) => file.includes(".backlog-doctor-"))).toEqual([]);
		}
	});
});
