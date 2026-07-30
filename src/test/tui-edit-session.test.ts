import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { editTaskFromTui } from "../ui/task-lifecycle.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

async function initializeGitRepository(root: string): Promise<void> {
	await $`git init -q -b main`.cwd(root);
	await $`git config user.name "TUI Editor Test"`.cwd(root);
	await $`git config user.email tui-editor@example.com`.cwd(root);
	await $`git add .`.cwd(root);
	await $`git commit -q -m baseline`.cwd(root);
}

function createMockScreen(): Parameters<Core["editTaskInTui"]>[1] {
	return {
		program: {
			disableMouse: () => {},
			enableMouse: () => {},
			hideCursor: () => {},
			showCursor: () => {},
			input: process.stdin,
			pause: () => () => {},
			flush: () => {},
			put: {
				keypad_local: () => {},
				keypad_xmit: () => {},
			},
		},
		leave: () => {},
		enter: () => {},
		render: () => {},
		clearRegion: () => {},
		width: 120,
		height: 40,
		emit: () => {},
	};
}

describe("Core.editTaskInTui", () => {
	let testDir: string;
	let core: Core;
	let taskId: string;
	let originalEditor: string | undefined;
	const screen = createMockScreen();

	const setEditor = async (editorCommand: string) => {
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected config to be initialized");
		}
		const updated: BacklogConfig = {
			...config,
			defaultEditor: editorCommand,
		};
		await core.filesystem.saveConfig(updated);
	};

	const createEditorScript = async (name: string, source: string): Promise<string> => {
		const scriptPath = join(testDir, name);
		await writeFile(scriptPath, source);
		return scriptPath;
	};

	beforeEach(async () => {
		originalEditor = process.env.EDITOR;
		delete process.env.EDITOR;

		testDir = createUniqueTestDir("test-tui-edit-session");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir, { enableWatchers: true });
		await initializeTestProject(core, "TUI Edit Session Test");

		const task: Task = {
			id: "task-1",
			title: "Editor Flow Task",
			status: "To Do",
			assignee: [],
			createdDate: "2026-02-11 20:00",
			labels: [],
			dependencies: [],
			rawContent: "## Description\n\nOriginal body",
		};
		await core.createTask(task, false);
		taskId = task.id;
	});

	afterEach(async () => {
		if (originalEditor !== undefined) {
			process.env.EDITOR = originalEditor;
		} else {
			delete process.env.EDITOR;
		}
		await safeCleanup(testDir);
	});

	it("returns unchanged result when editor makes no file modifications", async () => {
		const noopScript = await createEditorScript("noop-editor.js", "process.exit(0);\n");
		await setEditor(`node ${noopScript}`);

		const result = await core.editTaskInTui(taskId, screen);
		expect(result.changed).toBe(false);
		expect(result.reason).toBeUndefined();

		const reloaded = await core.filesystem.loadTask(taskId);
		expect(reloaded?.updatedDate).toBeUndefined();
	});

	it("updates updated_date when editor changes task content", async () => {
		const editScript = await createEditorScript(
			"append-editor.js",
			`import { appendFileSync } from "node:fs";
const filePath = process.argv[2];
if (filePath) {
	appendFileSync(filePath, "\\nEdited from test\\n");
}
process.exit(0);
`,
		);
		await setEditor(`node ${editScript}`);

		const result = await core.editTaskInTui(taskId, screen);
		expect(result.changed).toBe(true);
		expect(result.reason).toBeUndefined();
		expect(result.task).toBeTruthy();
		expect(result.task?.updatedDate).toBeTruthy();

		const taskContent = await core.getTaskContent(taskId);
		expect(taskContent).toContain("updated_date:");
		expect(taskContent).toContain("Edited from test");
	});

	it("amends owned edits, reports replacement, and honors invocation force-new", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected config to be initialized");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		const unrelatedPath = join(testDir, "unrelated.txt");
		const unstagedPath = join(testDir, "unstaged.txt");
		await Promise.all([writeFile(unrelatedPath, "baseline\n"), writeFile(unstagedPath, "baseline\n")]);
		await initializeGitRepository(testDir);
		await core.updateTaskFromInput(taskId, { title: "Owned editor task" });
		core.consumeAutoCommitNotices();
		const ownedHead = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();
		const ownedCount = Number((await $`git rev-list --count HEAD`.cwd(testDir).text()).trim());
		await writeFile(unrelatedPath, "staged user work\n");
		await $`git add unrelated.txt`.cwd(testDir);
		await writeFile(unstagedPath, "unstaged user work\n");
		core.openEditor = async (filePath) => {
			await writeFile(filePath, `${await Bun.file(filePath).text()}\nFirst editor update\n`);
			return false;
		};

		const ownedTask = await core.filesystem.loadTask(taskId);
		if (!ownedTask) throw new Error("Expected owned task");
		const amended = await editTaskFromTui(core, ownedTask, screen);
		const amendedHead = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();
		expect(amended.changed).toBe(true);
		expect(amended.warning).toBe("editor_failed_after_changes");
		expect(amendedHead).not.toBe(ownedHead);
		expect(Number((await $`git rev-list --count HEAD`.cwd(testDir).text()).trim())).toBe(ownedCount);
		expect(amended.notices).toEqual([
			`Amended Backlog commit ${ownedHead.slice(0, 12)} as ${amendedHead.slice(0, 12)}.`,
		]);

		const forceNewCore = new Core(testDir, { enableWatchers: false, autoCommit: { forceNew: true } });
		forceNewCore.openEditor = async (filePath) => {
			await writeFile(filePath, `${await Bun.file(filePath).text()}\nForced new editor update\n`);
			return true;
		};
		const taskBeforeForceNew = await forceNewCore.filesystem.loadTask(taskId);
		if (!taskBeforeForceNew) throw new Error("Expected task before force-new edit");
		const forced = await editTaskFromTui(forceNewCore, taskBeforeForceNew, screen);
		expect(forced.changed).toBe(true);
		expect(Number((await $`git rev-list --count HEAD`.cwd(testDir).text()).trim())).toBe(ownedCount + 1);
		expect(forced.notices).toEqual([]);
		expect(await $`git show HEAD:unrelated.txt`.cwd(testDir).text()).toBe("baseline\n");
		expect(await $`git show :unrelated.txt`.cwd(testDir).text()).toBe("staged user work\n");
		expect(await Bun.file(unstagedPath).text()).toBe("unstaged user work\n");
		expect(await $`git show HEAD:unstaged.txt`.cwd(testDir).text()).toBe("baseline\n");
	}, 20_000);

	it("rejects malformed current config before opening the editor or writing", async () => {
		let editorCalls = 0;
		core.openEditor = async (filePath) => {
			editorCalls += 1;
			await writeFile(filePath, `${await Bun.file(filePath).text()}\nMust not be written\n`);
			return true;
		};
		const beforeContent = await core.getTaskContent(taskId);
		const selectedTask = await core.filesystem.loadTask(taskId);
		if (!selectedTask) throw new Error("Expected selected task");
		const configPath = join(testDir, "backlog", "config.yml");
		await writeFile(configPath, `${await Bun.file(configPath).text()}\nauto_commit_mode: "amend-own\n`);

		await expect(editTaskFromTui(core, selectedTask, screen)).rejects.toThrow(
			"auto_commit_mode must be new or amend-own",
		);
		expect(editorCalls).toBe(0);
		expect(await core.getTaskContent(taskId)).toBe(beforeContent);
	});

	it("rejects identity collisions and malformed edited content before metadata or cache updates", async () => {
		await core.createTask(
			{
				id: "task-2",
				title: "Collision target",
				status: "To Do",
				assignee: [],
				createdDate: "2026-02-11 20:00",
				labels: [],
				dependencies: [],
				rawContent: "Collision body",
			},
			false,
		);
		const store = await core.getContentStore();
		const selectedTask = await core.filesystem.loadTask(taskId);
		if (!selectedTask?.filePath) throw new Error("Expected selected task path");
		const originalContent = await Bun.file(selectedTask.filePath).text();
		const scenarios = [
			{
				content: originalContent.replace(/^id:.*$/m, "id: TASK-2"),
				error: "changed task identity from TASK-1 to TASK-2",
			},
			{
				content: originalContent.replace(/^id:.*$/m, 'id: ["unterminated"'),
				error: "left invalid task content",
			},
		] as const;

		for (const scenario of scenarios) {
			await writeFile(selectedTask.filePath, originalContent);
			core.openEditor = async (filePath) => {
				await writeFile(filePath, scenario.content);
				return true;
			};
			await expect(editTaskFromTui(core, selectedTask, screen)).rejects.toThrow(scenario.error);
			expect(await Bun.file(selectedTask.filePath).text()).toBe(scenario.content);
			expect(scenario.content.includes("updated_date:")).toBe(false);
			expect(
				store
					.getTasks()
					.map((task) => task.id)
					.sort(),
			).toEqual(["TASK-1", "TASK-2"]);
		}
	});

	it("reports an editor-deleted task as an uncommitted recovery state", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected config to be initialized");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "new" });
		await initializeGitRepository(testDir);
		const selectedTask = await core.filesystem.loadTask(taskId);
		if (!selectedTask?.filePath) throw new Error("Expected selected task path");
		const beforeHead = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();
		core.openEditor = async (filePath) => {
			await unlink(filePath);
			return true;
		};

		await expect(editTaskFromTui(core, selectedTask, screen)).rejects.toThrow("Editor removed or moved the task file");
		expect((await $`git rev-parse HEAD`.cwd(testDir).text()).trim()).toBe(beforeHead);
		expect(await $`git status --short`.cwd(testDir).text()).toContain(
			` D "backlog/tasks/task-1 - Editor-Flow-Task.md"`,
		);
	});

	it("reports an editor-renamed task with the new path preserved for recovery", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected config to be initialized");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "new" });
		await initializeGitRepository(testDir);
		const selectedTask = await core.filesystem.loadTask(taskId);
		if (!selectedTask?.filePath) throw new Error("Expected selected task path");
		const renamedPath = join(testDir, "backlog", "tasks", "task-1 - Renamed-by-editor.md");
		const beforeHead = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();
		core.openEditor = async (filePath) => {
			await rename(filePath, renamedPath);
			return true;
		};

		await expect(editTaskFromTui(core, selectedTask, screen)).rejects.toThrow("Editor removed or moved the task file");
		expect((await $`git rev-parse HEAD`.cwd(testDir).text()).trim()).toBe(beforeHead);
		expect(await Bun.file(renamedPath).exists()).toBe(true);
		const status = await $`git status --short`.cwd(testDir).text();
		expect(status).toContain(` D "backlog/tasks/task-1 - Editor-Flow-Task.md"`);
		expect(status).toContain(`?? "backlog/tasks/task-1 - Renamed-by-editor.md"`);
	});

	it("returns editor_failed without mutating metadata when editor exits non-zero", async () => {
		const failScript = await createEditorScript("fail-editor.js", "process.exit(2);\n");
		await setEditor(`node ${failScript}`);

		const beforeContent = await core.getTaskContent(taskId);
		const result = await core.editTaskInTui(taskId, screen);
		const afterContent = await core.getTaskContent(taskId);

		expect(result.changed).toBe(false);
		expect(result.reason).toBe("editor_failed");
		expect(afterContent).toBe(beforeContent);

		const reloaded = await core.filesystem.loadTask(taskId);
		expect(reloaded?.updatedDate).toBeUndefined();
	});
});
