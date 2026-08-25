import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
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

	it("fails closed when the selected draft's frontmatter id drifted from its filename", async () => {
		const draft = await createDraft();
		const draftPath = draft.filePath;
		if (!draftPath) throw new Error("expected draft file path");
		await Bun.write(
			draftPath,
			serializeTask({
				id: "DRAFT-42",
				title: "Drifted",
				status: "Draft",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			}),
		);
		const before = await Bun.file(draftPath).text();
		const noopScript = await createEditorScript("noop-editor.js", "process.exit(0);\n");
		await setEditor(`node ${noopScript}`);

		const selected = (await core.filesystem.listDrafts()).at(0);
		if (!selected) throw new Error("expected draft row");

		const result = await core.editTaskInTui(selected.id, screen, selected);

		expect(result.reason).toBe("identity_conflict");
		expect(result.changed).toBe(false);
		expect(await Bun.file(draftPath).text()).toBe(before);
	});

	it("fails closed on drift even when the record carries a non-Draft status", async () => {
		const draft = await createDraft();
		const draftPath = draft.filePath;
		if (!draftPath) throw new Error("expected draft file path");
		await Bun.write(
			draftPath,
			serializeTask({
				id: "DRAFT-42",
				title: "Drifted active",
				status: "In Progress",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			}),
		);
		const before = await Bun.file(draftPath).text();
		const noopScript = await createEditorScript("noop-editor.js", "process.exit(0);\n");
		await setEditor(`node ${noopScript}`);

		const selected = (await core.filesystem.listHealthyDrafts()).at(0);
		if (!selected) throw new Error("expected draft row");

		const result = await core.editTaskInTui(selected.id, screen, selected);

		expect(result.reason).toBe("identity_conflict");
		expect(result.changed).toBe(false);
		expect(await Bun.file(draftPath).text()).toBe(before);
	});

	it("opens the drafts-dir file when a task id collides with the draft id", async () => {
		// A task whose prefix is literally "draft" mints task ids identical to draft ids;
		// pressing E on the draft row must never fall through to the task file.
		await core.createTask(
			{
				id: "draft-1",
				title: "Task collision",
				status: "To Do",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			},
			false,
		);
		const { task: draftRow } = await core.createTaskFromInput({ title: "Draft collision", status: "Draft" });
		// The unified view feeds editTaskInTui rows produced by the listing APIs, which carry
		// the row's own filePath.
		const selected = (await core.filesystem.listHealthyDrafts()).find(
			(candidate) => candidate.id === draftRow.id && candidate.filePath !== undefined,
		);
		if (!selected?.filePath) throw new Error("expected selectable draft row");
		const taskPath = await core.filesystem.getTaskWritePath({
			id: "draft-1",
			title: "Task collision",
			status: "To Do",
			assignee: [],
			createdDate: "2026-08-24 10:00",
			labels: [],
			dependencies: [],
		});
		const draftPath = selected.filePath;
		const taskFileBefore = await Bun.file(taskPath).text();
		const editScript = await createEditorScript(
			"append-editor.js",
			`import { appendFileSync } from "node:fs";
const filePath = process.argv[2];
if (filePath) {
	appendFileSync(filePath, "\\nMarker\\n");
}
process.exit(0);
`,
		);
		await setEditor(`node ${editScript}`);

		const result = await core.editTaskInTui(selected.id, screen, selected);

		expect(result.changed).toBe(true);
		expect(result.task?.id).toBe(selected.id);
		expect(await Bun.file(draftPath).text()).toContain("Marker");
		expect(await Bun.file(taskPath).text()).toBe(taskFileBefore);
	});

	it("reports identity_conflict when an edit breaks filename/frontmatter identity", async () => {
		const draft = await createDraft();
		const editScript = await createEditorScript(
			"drift-editor.js",
			`import { readFileSync, writeFileSync } from "node:fs";
const filePath = process.argv[2];
if (filePath) {
	const content = readFileSync(filePath, "utf8").replace("id: DRAFT-1", "id: DRAFT-99");
	writeFileSync(filePath, content);
}
process.exit(0);
`,
		);
		await setEditor(`node ${editScript}`);

		const result = await core.editTaskInTui(draft.id, screen, draft);

		expect(result.reason).toBe("identity_conflict");
		expect(result.changed).toBe(false);

		const draftPath = draft.filePath;
		if (!draftPath) throw new Error("expected draft file path");
		const afterDrift = await Bun.file(draftPath).text();
		expect(afterDrift).toContain("DRAFT-99");

		const followUp = await core.editTaskInTui(draft.id, screen, draft);
		expect(followUp.reason).toBe("identity_conflict");
	});

	it("opens exactly the selected draft file when several files resolve to one id", async () => {
		const draftsDir = join(testDir, "backlog", "drafts");
		const draftFile = (filename: string, id: string, title: string) =>
			Bun.write(
				join(draftsDir, filename),
				serializeTask({
					id,
					title,
					status: "Draft",
					assignee: [],
					createdDate: "2026-08-24 10:00",
					labels: [],
					dependencies: [],
				}),
			);
		await draftFile("draft-3 - Alpha.md", "DRAFT-3", "Alpha");
		await draftFile("draft-03 - Beta.md", "DRAFT-03", "Beta");
		const selected = (await core.filesystem.listDrafts()).find((draft) =>
			draft.filePath?.endsWith("draft-03 - Beta.md"),
		);
		if (!selected?.filePath) throw new Error("expected beta draft row");
		const editScript = await createEditorScript(
			"append-editor.js",
			`import { appendFileSync } from "node:fs";
const filePath = process.argv[2];
if (filePath) {
	appendFileSync(filePath, "\\nMarker\\n");
}
process.exit(0);
`,
		);
		await setEditor(`node ${editScript}`);

		const result = await core.editTaskInTui(selected.id, screen, selected);

		expect(result.changed).toBe(true);
		expect(await Bun.file(selected.filePath).text()).toContain("Marker");
		expect(await Bun.file(join(draftsDir, "draft-3 - Alpha.md")).text()).not.toContain("Marker");
	});
});
