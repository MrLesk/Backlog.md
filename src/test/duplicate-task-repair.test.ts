import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, readdir, rmdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import {
	applyDuplicateTaskIdRepair,
	findLocalDuplicateTaskIds,
	installFileNoReplace,
} from "../core/duplicate-task-repair.ts";
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
			const message = String(error).replaceAll("\\", "/");
			expect(message).toContain("backlog/tasks/task-1 - Active.md");
			expect(message).toContain("backlog/completed/task-01 - Completed.md");
			expect(message).toContain("backlog doctor");
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
	it("preserves dotted subtask identity with parent-aware allocation", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Parent.md", makeTask("TASK-1", "Parent"));
		await writeTask(core.filesystem.tasksDir, "task-1.1 - Plain.md", {
			...makeTask("TASK-1.1", "Plain"),
			parentTaskId: "TASK-1",
		});
		await writeTask(core.filesystem.tasksDir, "task-1.01 - Padded.md", {
			...makeTask("TASK-1.01", "Padded"),
			parentTaskId: "TASK-1",
		});

		const plan = await core.previewDuplicateTaskIdRepair();
		expect(plan.blockedReasons).toEqual([]);
		expect(plan.repairable).toBe(true);
		expect(plan.changes).toHaveLength(1);
		expect(plan.changes[0]).toMatchObject({
			oldId: "TASK-1.01",
			newId: "TASK-1.2",
			targetPath: "backlog/tasks/task-1.2 - Padded.md",
		});
		await core.repairDuplicateTaskIds(plan.fingerprint);
		const repaired = await core.filesystem.loadTask("TASK-1.2");
		expect(repaired?.parentTaskId).toBe("TASK-1");
	});

	it("blocks dotted repair when parent identity is missing or mismatched", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1.1 - Missing.md", makeTask("TASK-1.1", "Missing"));
		await writeTask(core.filesystem.tasksDir, "task-1.01 - Mismatched.md", {
			...makeTask("TASK-1.01", "Mismatched"),
			parentTaskId: "TASK-9",
		});

		const plan = await core.previewDuplicateTaskIdRepair();
		expect(plan.repairable).toBe(false);
		expect(plan.changes).toEqual([]);
		expect(plan.blockedReasons.join("\n")).toContain("has no parent_task_id");
		expect(plan.blockedReasons.join("\n")).toContain("expected TASK-1");
	});

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

	it("allocates adjacent, padded, and dotted huge repair IDs without precision loss", async () => {
		await writeTask(
			core.filesystem.tasksDir,
			"task-9007199254740992 - Huge.md",
			makeTask("TASK-9007199254740992", "Huge"),
		);
		await writeTask(
			core.filesystem.tasksDir,
			"task-09007199254740992 - Huge padded.md",
			makeTask("TASK-09007199254740992", "Huge padded"),
		);
		await writeTask(
			core.filesystem.tasksDir,
			"task-9007199254740993 - Huge neighbor.md",
			makeTask("TASK-9007199254740993", "Huge neighbor"),
		);

		const parentId = "TASK-999999999999999999999999999999999999999";
		const childId = `${parentId}.999999999999999999999999999999999999999`;
		await writeTask(
			core.filesystem.tasksDir,
			"task-999999999999999999999999999999999999999 - Parent.md",
			makeTask(parentId, "Parent"),
		);
		await writeTask(
			core.filesystem.tasksDir,
			"task-999999999999999999999999999999999999999.999999999999999999999999999999999999999 - Child.md",
			{ ...makeTask(childId, "Child"), parentTaskId: parentId },
		);
		await writeTask(
			core.filesystem.tasksDir,
			"task-0999999999999999999999999999999999999999.0999999999999999999999999999999999999999 - Child padded.md",
			{
				...makeTask(
					"TASK-0999999999999999999999999999999999999999.0999999999999999999999999999999999999999",
					"Child padded",
				),
				parentTaskId: "TASK-0999999999999999999999999999999999999999",
			},
		);

		const plan = await core.previewDuplicateTaskIdRepair();
		expect(plan.blockedReasons).toEqual([]);
		expect(plan.repairable).toBe(true);
		expect(plan.changes.map((change) => change.newId)).toEqual([
			"TASK-1000000000000000000000000000000000000000",
			"TASK-999999999999999999999999999999999999999.1000000000000000000000000000000000000000",
		]);
		expect(plan.changes.some((change) => change.newId.toLowerCase().includes("e+"))).toBe(false);

		await core.repairDuplicateTaskIds(plan.fingerprint);
		expect(await findLocalDuplicateTaskIds(core)).toEqual([]);
	});

	it("repairs an exact legacy duplicate and reports only exact legacy references", async () => {
		await writeTask(core.filesystem.tasksDir, "task-prefixed - Alpha.md", makeTask("TASK-PREFIXED", "Alpha"));
		const betaPath = await writeTask(
			core.filesystem.tasksDir,
			"task-prefixed - Beta.md",
			makeTask("TASK-PREFIXED", "Beta"),
		);
		await writeTask(
			core.filesystem.tasksDir,
			"task-prefixed-extra - Longer.md",
			makeTask("TASK-PREFIXED-EXTRA", "Longer"),
		);
		await mkdir(core.filesystem.docsDir, { recursive: true });
		await Bun.write(
			join(core.filesystem.docsDir, "legacy-reference.md"),
			"See TASK-PREFIXED.\nDo not confuse TASK-PREFIXED-EXTRA.\n",
		);
		const betaBefore = await Bun.file(betaPath).text();

		const plan = await core.previewDuplicateTaskIdRepair();
		expect(plan.repairable).toBe(true);
		expect(plan.groups.map((group) => group.id)).toEqual(["TASK-PREFIXED"]);
		expect(plan.changes).toHaveLength(1);
		expect(plan.changes[0]).toMatchObject({
			sourcePath: "backlog/tasks/task-prefixed - Beta.md",
			targetPath: "backlog/tasks/task-1 - Beta.md",
			newId: "TASK-1",
		});
		expect(plan.references.filter((reference) => reference.path.endsWith("legacy-reference.md"))).toEqual([
			{
				path: "backlog/docs/legacy-reference.md",
				line: 1,
				text: "See TASK-PREFIXED.",
				ids: ["TASK-PREFIXED"],
			},
		]);

		await core.repairDuplicateTaskIds(plan.fingerprint);
		expect(await Bun.file(join(core.filesystem.tasksDir, "task-1 - Beta.md")).text()).toBe(
			betaBefore.replace("id: TASK-PREFIXED", "id: TASK-1"),
		);
		expect(await core.filesystem.loadTask("TASK-PREFIXED-EXTRA")).not.toBeNull();
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
		for (const directory of [core.filesystem.tasksDir, core.filesystem.completedDir]) {
			const files = await readdir(directory);
			expect(files.filter((file) => file.includes(".backlog-doctor-"))).toEqual([]);
		}
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

	it("atomically refuses a destination that appears after preflight", async () => {
		const stagedPath = join(core.filesystem.tasksDir, "late-target.tmp");
		const targetPath = join(core.filesystem.tasksDir, "late-target.md");
		await Bun.write(stagedPath, "staged repair content");
		expect(await Bun.file(targetPath).exists()).toBe(false);

		// Models an external writer winning after the preview/preflight check.
		await Bun.write(targetPath, "external content");
		try {
			await installFileNoReplace(stagedPath, targetPath);
			throw new Error("Expected no-replace install to fail");
		} catch (error) {
			expect((error as NodeJS.ErrnoException).code).toBe("EEXIST");
		}

		expect(await Bun.file(targetPath).text()).toBe("external content");
		expect(await Bun.file(stagedPath).text()).toBe("staged repair content");
	});

	it("rolls back the whole transaction when an external writer wins the second target", async () => {
		const alphaPath = await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		const betaPath = await writeTask(core.filesystem.tasksDir, "task-01 - Beta.md", makeTask("TASK-01", "Beta"));
		const gammaPath = await writeTask(
			core.filesystem.completedDir,
			"task-001 - Gamma.md",
			makeTask("TASK-001", "Gamma"),
		);
		const originals = await Promise.all(
			[alphaPath, betaPath, gammaPath].map(async (path) => await Bun.file(path).text()),
		);
		const plan = await core.previewDuplicateTaskIdRepair();
		const firstTarget = join(testDir, plan.changes[0]?.targetPath ?? "");
		const secondTarget = join(testDir, plan.changes[1]?.targetPath ?? "");

		await expect(
			applyDuplicateTaskIdRepair(core, plan.fingerprint, {
				installFile: async (stagedPath, targetPath, index) => {
					if (index === 1) {
						await Bun.write(targetPath, "external winner");
					}
					await installFileNoReplace(stagedPath, targetPath);
				},
			}),
		).rejects.toThrow("now exists; no files were changed");

		expect(
			await Promise.all([alphaPath, betaPath, gammaPath].map(async (path) => await Bun.file(path).text())),
		).toEqual(originals);
		expect(await Bun.file(firstTarget).exists()).toBe(false);
		expect(await Bun.file(secondTarget).text()).toBe("external winner");
		for (const directory of [core.filesystem.tasksDir, core.filesystem.completedDir]) {
			const files = await readdir(directory);
			expect(files.filter((file) => file.includes(".backlog-doctor-"))).toEqual([]);
		}
	});

	it("preserves a recreated source and its recoverable backup when rollback loses ownership", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		await writeTask(core.filesystem.tasksDir, "task-01 - Beta.md", makeTask("TASK-01", "Beta"));
		await writeTask(core.filesystem.completedDir, "task-001 - Gamma.md", makeTask("TASK-001", "Gamma"));
		const plan = await core.previewDuplicateTaskIdRepair();
		const firstChange = plan.changes[0];
		if (!firstChange) throw new Error("Expected a first repair change");
		const firstSource = join(testDir, firstChange.sourcePath);
		const originalSource = await Bun.file(firstSource).text();
		const externalSource = "external source winner\n";
		let failure: unknown;

		try {
			await applyDuplicateTaskIdRepair(core, plan.fingerprint, {
				installFile: async (stagedPath, targetPath, index) => {
					if (index === 1) {
						await Bun.write(firstSource, externalSource);
						throw new Error("forced later failure");
					}
					await installFileNoReplace(stagedPath, targetPath);
				},
			});
		} catch (error) {
			failure = error;
		}

		expect(String(failure)).toContain(firstChange.sourcePath);
		expect(String(failure)).toContain("preserved");
		expect(await Bun.file(firstSource).text()).toBe(externalSource);
		const sourceFilename = firstChange.sourcePath.split("/").at(-1) ?? "";
		const backupFilename = (await readdir(core.filesystem.tasksDir)).find(
			(file) => file.startsWith(`${sourceFilename}.backlog-doctor-`) && file.endsWith(".bak"),
		);
		expect(backupFilename).toBeDefined();
		expect(await Bun.file(join(core.filesystem.tasksDir, backupFilename ?? "")).text()).toBe(originalSource);
	});

	it("preserves an externally edited installed target when a later install fails", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		const betaPath = await writeTask(core.filesystem.tasksDir, "task-01 - Beta.md", makeTask("TASK-01", "Beta"));
		const gammaPath = await writeTask(
			core.filesystem.completedDir,
			"task-001 - Gamma.md",
			makeTask("TASK-001", "Gamma"),
		);
		const [betaOriginal, gammaOriginal] = await Promise.all([Bun.file(betaPath).text(), Bun.file(gammaPath).text()]);
		const plan = await core.previewDuplicateTaskIdRepair();
		const firstChange = plan.changes[0];
		if (!firstChange) throw new Error("Expected a first repair change");
		const firstTarget = join(testDir, firstChange.targetPath);
		const externalTarget = "external target edit\n";
		let failure: unknown;

		try {
			await applyDuplicateTaskIdRepair(core, plan.fingerprint, {
				installFile: async (stagedPath, targetPath, index) => {
					if (index === 1) {
						await Bun.write(firstTarget, externalTarget);
						throw new Error("forced later failure");
					}
					await installFileNoReplace(stagedPath, targetPath);
				},
			});
		} catch (error) {
			failure = error;
		}

		expect(String(failure)).toContain(firstChange.targetPath);
		expect(String(failure)).toContain("preserved");
		expect(await Bun.file(firstTarget).text()).toBe(externalTarget);
		expect(await Bun.file(betaPath).text()).toBe(betaOriginal);
		expect(await Bun.file(gammaPath).text()).toBe(gammaOriginal);
		for (const directory of [core.filesystem.tasksDir, core.filesystem.completedDir]) {
			const files = await readdir(directory);
			expect(files.filter((file) => file.includes(".backlog-doctor-"))).toEqual([]);
		}
	});

	it.skipIf(process.platform === "win32")("blocks repair when a reference file cannot be read", async () => {
		await writeTask(core.filesystem.tasksDir, "task-1 - Alpha.md", makeTask("TASK-1", "Alpha"));
		await writeTask(core.filesystem.tasksDir, "task-01 - Beta.md", makeTask("TASK-01", "Beta"));
		const docsDir = join(core.filesystem.backlogDir, "docs");
		const unreadablePath = join(docsDir, "unreadable.md");
		await mkdir(docsDir, { recursive: true });
		await Bun.write(unreadablePath, "See TASK-1");
		await chmod(unreadablePath, 0o000);

		const plan = await (async () => {
			try {
				return await core.previewDuplicateTaskIdRepair();
			} finally {
				await chmod(unreadablePath, 0o600);
			}
		})();

		expect(plan.referenceScanComplete).toBe(false);
		expect(plan.repairable).toBe(false);
		expect(plan.blockedReasons.join("\n")).toContain("Reference scan could not read backlog/docs/unreadable.md");
	});
});
