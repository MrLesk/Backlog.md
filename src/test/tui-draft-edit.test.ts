import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

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

describe("Core.editTaskInTui draft resolution", () => {
	let testDir: string;
	let core: Core;
	let originalEditor: string | undefined;
	const screen = createMockScreen();

	const setEditor = async (editorCommand: string) => {
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected config to be initialized");
		}
		const updated: BacklogConfig = { ...config, defaultEditor: editorCommand };
		await core.filesystem.saveConfig(updated);
	};

	const createEditorScript = async (name: string, source: string): Promise<string> => {
		const scriptPath = join(testDir, name);
		await writeFile(scriptPath, source);
		return scriptPath;
	};

	const createDraft = async (): Promise<Task> => {
		const { task } = await core.createTaskFromInput({ title: "Draft under edit", status: "Draft" });
		return task;
	};

	beforeEach(async () => {
		originalEditor = process.env.EDITOR;
		delete process.env.EDITOR;

		testDir = createUniqueTestDir("test-tui-draft-edit");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir, { enableWatchers: true });
		await initializeTestProject(core, "TUI Draft Edit Test");

		await core.createTask(
			{
				id: "task-1",
				title: "Regular task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			},
			false,
		);
	});

	afterEach(async () => {
		if (originalEditor !== undefined) {
			process.env.EDITOR = originalEditor;
		} else {
			delete process.env.EDITOR;
		}
		await safeCleanup(testDir);
	});

	it("opens the selected draft instead of reporting it missing", async () => {
		const draft = await createDraft();
		const noopScript = await createEditorScript("noop-editor.js", "process.exit(0);\n");
		await setEditor(`node ${noopScript}`);

		const result = await core.editTaskInTui(draft.id, screen, draft);

		expect(result.reason).toBeUndefined();
		expect(result.changed).toBe(false);
		expect(result.task?.id).toBe(draft.id);
	});

	it("persists editor changes to the draft file and refreshes the draft", async () => {
		const draft = await createDraft();
		const editScript = await createEditorScript(
			"append-editor.js",
			`import { appendFileSync } from "node:fs";
const filePath = process.argv[2];
if (filePath) {
	appendFileSync(filePath, "\\nEdited draft body\\n");
}
process.exit(0);
`,
		);
		await setEditor(`node ${editScript}`);

		const result = await core.editTaskInTui(draft.id, screen, draft);

		expect(result.changed).toBe(true);
		expect(result.task?.id).toBe(draft.id);
		expect(result.task?.updatedDate).toBeTruthy();

		const reloaded = await core.filesystem.loadDraft(draft.id);
		expect(reloaded).not.toBeNull();
		expect(reloaded?.status).toBe("Draft");
		expect(reloaded?.rawContent).toContain("Edited draft body");

		const taskReloaded = await core.filesystem.loadTask("task-1");
		expect(taskReloaded?.rawContent ?? "").not.toContain("Edited draft body");
	});

	it("resolves a draft id even when no selected task context is passed", async () => {
		const draft = await createDraft();
		const noopScript = await createEditorScript("noop-editor.js", "process.exit(0);\n");
		await setEditor(`node ${noopScript}`);

		const result = await core.editTaskInTui(draft.id, screen);

		expect(result.reason).toBeUndefined();
		expect(result.task?.id).toBe(draft.id);
	});
});
