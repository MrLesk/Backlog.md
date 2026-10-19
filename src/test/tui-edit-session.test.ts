import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { screen as createBlessedScreen, program as createProgram, list } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

/** Stands in for the terminal's keyboard so a real blessed program can pause and resume it. */
class FakeTerminalInput extends EventEmitter {
	setRawMode(): this {
		return this;
	}

	pause(): this {
		return this;
	}

	resume(): this {
		return this;
	}
}

/** Stands in for the terminal's display; what blessed writes to it is discarded. */
class FakeTerminalOutput extends EventEmitter {
	isTTY = true;
	columns = 80;
	rows = 24;

	write(): boolean {
		return true;
	}
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

	it("turns mouse reporting back on after the editor closes", async () => {
		const noopScript = await createEditorScript("noop-editor.js", "process.exit(0);\n");
		await setEditor(`node ${noopScript}`);

		const program = createProgram({
			tput: false,
			terminal: "xterm",
			input: new FakeTerminalInput(),
			output: new FakeTerminalOutput(),
		});
		const terminalScreen = createBlessedScreen({ program, smartCSR: false });
		try {
			// A mouse-aware widget, like the task list, is what makes blessed ask for mouse events.
			list({ parent: terminalScreen, mouse: true });
			expect(program.mouseEnabled).toBe(true);

			await core.editTaskInTui(taskId, terminalScreen);

			expect(program.mouseEnabled).toBe(true);
		} finally {
			terminalScreen.destroy();
		}
	});
});
