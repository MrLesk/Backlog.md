import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { ContentStore } from "../core/content-store.ts";
import { parseTask } from "../markdown/parser.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const malformedDependencies = [
	["mapping entry", "dependencies:\n  - id: TASK-1\n    anchor: tenancy"],
	["nested list", "dependencies:\n  - [TASK-1, TASK-3]"],
	["mapping field", "dependencies: { id: TASK-1 }"],
] as const;

function taskMarkdown(dependencies: string, id = "TASK-2"): string {
	return `---
id: ${id}
title: dependent
status: To Do
assignee: []
created_date: '2026-09-27'
labels: []
${dependencies}
---

Keep this body, including its trailing newline.
`;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve = () => {};
	const promise = new Promise<void>((accept) => {
		resolve = accept;
	});
	return { promise, resolve };
}

describe("task dependency structure", () => {
	it.each(malformedDependencies)("rejects a %s on every parse", (_label, dependencies) => {
		const content = taskMarkdown(dependencies);
		for (let attempt = 0; attempt < 2; attempt++) {
			expect(() => parseTask(content)).toThrow("Invalid dependencies in task TASK-2");
		}
	});

	it("identifies the malformed entry after valid task IDs", () => {
		expect(() => parseTask(taskMarkdown("dependencies: [TASK-1, { id: TASK-3 }]"))).toThrow("entry 2");
	});

	it("preserves existing scalar coercion and absent-field defaults", () => {
		expect(parseTask(taskMarkdown("dependencies: [task-001, BACK-2.3, 4, true, null]")).dependencies).toEqual([
			"task-001",
			"BACK-2.3",
			"4",
			"true",
			"null",
		]);
		for (const field of ["", "dependencies: []", "dependencies: null", "dependencies: true", "dependencies: 4"]) {
			expect(parseTask(taskMarkdown(field)).dependencies).toEqual([]);
		}
	});
});

describe("malformed dependencies cannot be rewritten by unrelated edits", () => {
	let testDir: string;
	let core: Core;
	let taskPath: string;
	let store: ContentStore | undefined;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-malformed-dependencies");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Malformed dependencies");
		taskPath = join(core.filesystem.tasksDir, "task-2 - dependent.md");
	});

	afterEach(async () => {
		store?.dispose();
		store = undefined;
		await safeCleanup(testDir);
	});

	it.each(malformedDependencies)("CLI rejects a %s without changing source bytes", async (_label, dependencies) => {
		const original = taskMarkdown(dependencies);
		await Bun.write(taskPath, original);
		const filenames = await readdir(core.filesystem.tasksDir);

		const edited = await $`${process.execPath} ${getTestCliPath()} task edit TASK-2 --title "dependent v2"`
			.cwd(testDir)
			.quiet()
			.nothrow();

		expect(edited.exitCode).toBe(1);
		expect(edited.stderr.toString()).toContain("Invalid dependencies in task TASK-2");
		expect(edited.stderr.toString()).not.toContain("not found");
		expect(edited.stdout.toString()).not.toContain("Updated task");
		expect(await Bun.file(taskPath).text()).toBe(original);
		expect(await readdir(core.filesystem.tasksDir)).toEqual(filenames);
	});

	it.each([
		false,
		true,
	])("shared mutation rejects malformed source with cross-branch reads=%s", async (includeCrossBranch) => {
		await Bun.write(taskPath, taskMarkdown("dependencies: [TASK-1]"));
		store = await core.getContentStore();
		expect((await core.getTask("TASK-2"))?.title).toBe("dependent");
		const original = taskMarkdown(malformedDependencies[0][1]);
		await Bun.write(taskPath, original);

		await expect(
			core.updateTaskFromInput("TASK-2", { title: "dependent v2" }, false, { includeCrossBranch }),
		).rejects.toThrow("Invalid dependencies in task TASK-2");
		expect(await Bun.file(taskPath).text()).toBe(original);
	});

	it("refuses to save a stale task after the source becomes malformed", async () => {
		await Bun.write(taskPath, taskMarkdown("dependencies: [TASK-1]"));
		store = await core.getContentStore();
		const stale = await core.getTask("TASK-2");
		expect(stale).not.toBeNull();
		if (!stale) throw new Error("Expected the initial task");
		const original = taskMarkdown(malformedDependencies[1][1]);
		await Bun.write(taskPath, original);

		await expect(core.updateTask({ ...stale, title: "dependent v2" }, false)).rejects.toThrow(
			"Invalid dependencies in task TASK-2",
		);
		expect(await Bun.file(taskPath).text()).toBe(original);
	});

	it("keeps healthy tasks available while explicit malformed-task reads explain the error", async () => {
		const original = taskMarkdown(malformedDependencies[0][1]);
		await Bun.write(taskPath, original);
		await Bun.write(join(core.filesystem.tasksDir, "task-1 - healthy.md"), taskMarkdown("dependencies: []", "TASK-1"));

		expect((await core.filesystem.listTasks()).map((task) => task.id)).toEqual(["TASK-1"]);
		await expect(core.filesystem.loadTask("TASK-2")).rejects.toThrow("Invalid dependencies in task TASK-2");
		await expect(core.loadTaskById("TASK-2", { includeCrossBranch: false })).rejects.toThrow(
			"Invalid dependencies in task TASK-2",
		);
		store = await core.getContentStore();
		await expect(core.getTask("TASK-2")).rejects.toThrow("Invalid dependencies in task TASK-2");
		await core.updateTaskFromInput("TASK-1", { title: "Healthy edit" }, false, { includeCrossBranch: false });
		expect((await core.filesystem.loadTask("TASK-1"))?.title).toBe("Healthy edit");
		expect(await Bun.file(taskPath).text()).toBe(original);
	});

	it.each(["missing", "malformed"])("retries a project switch while diagnosing a %s task", async (source) => {
		if (source === "malformed") await Bun.write(taskPath, taskMarkdown(malformedDependencies[0][1]));
		const nextRoot = join(testDir, "next-project");
		const setup = new Core(nextRoot);
		await initializeFilesystemTestProject(setup, "Next project");
		await Bun.write(
			join(setup.filesystem.tasksDir, "task-2 - current.md"),
			taskMarkdown("dependencies: []").replace("title: dependent", "title: Current project task"),
		);
		store = await core.getContentStore();
		const oldFilesystem = core.filesystem;
		const loadOldTask = oldFilesystem.loadTask.bind(oldFilesystem);
		const lookupStarted = deferred();
		const lookupGate = deferred();
		oldFilesystem.loadTask = async (id) => {
			lookupStarted.resolve();
			await lookupGate.promise;
			return await loadOldTask(id);
		};

		try {
			const reading = core.getTask("TASK-2", { refreshCrossBranch: false });
			await lookupStarted.promise;
			core.reinitializeProjectRoot(nextRoot);
			lookupGate.resolve();

			expect((await reading)?.title).toBe("Current project task");
		} finally {
			core.disposeContentStore();
		}
	});

	it("allows unrelated CLI edits without changing valid dependency values", async () => {
		await Bun.write(taskPath, taskMarkdown("dependencies: [task-001, BACK-2.3, 4]"));
		const edited = await $`${process.execPath} ${getTestCliPath()} task edit TASK-2 --title "dependent v2"`
			.cwd(testDir)
			.quiet()
			.nothrow();

		expect(edited.exitCode).toBe(0);
		expect(edited.stdout.toString()).toContain("Updated task TASK-2");
		const task = await core.filesystem.loadTask("TASK-2");
		expect(task?.title).toBe("dependent v2");
		expect(task?.dependencies).toEqual(["task-001", "BACK-2.3", "4"]);
	});
});
