import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { initializeTestProject } from "./test-utils.ts";

const TEST_DIR = join(tmpdir(), "backlog-permanent-ids");

/**
 * An ID is issued at most once for the life of a project:
 *  - tasks and drafts are allocated from ONE pool,
 *  - archived IDs stay counted,
 *  - promotion/demotion move a file without renumbering it.
 */
describe("permanent IDs", () => {
	let core: Core;
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(TEST_DIR);
		core = new Core(testDir);
		await initializeTestProject(core, "Permanent IDs", false);
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	const draftFiles = () => readdir(join(testDir, "backlog", "drafts"));

	it("allocates drafts from the task ID pool", async () => {
		await core.createTaskFromInput({ title: "A task" }, false);
		const draft = await core.createTaskFromInput({ title: "A draft", status: "Draft" }, false);

		expect(draft.task.id).toBe("TASK-2");
	});

	it("stores a draft as task-N and loads it back by that ID", async () => {
		// Regression: saveDraft once wrote `draft-task-2 - ....md`, which listDrafts
		// then could not find. Typecheck and unit tests both missed it - only a
		// round trip catches it.
		const created = await core.createTaskFromInput({ title: "Round trip", status: "Draft" }, false);
		expect(created.task.id).toBe("TASK-1");

		expect(await draftFiles()).toEqual(["task-1 - Round-trip.md"]);

		const listed = await core.fs.listDrafts();
		expect(listed.map((d) => d.id)).toEqual(["TASK-1"]);

		const loaded = await core.fs.loadDraft("task-1");
		expect(loaded?.title).toBe("Round trip");
	});

	it("keeps a draft's ID when it is promoted", async () => {
		await core.createTaskFromInput({ title: "Filler" }, false);
		const draft = await core.createTaskFromInput({ title: "Promote me", status: "Draft" }, false);
		expect(draft.task.id).toBe("TASK-2");

		expect(await core.promoteDraft("task-2", false)).toBe(true);

		const promoted = await core.fs.loadTask("task-2");
		expect(promoted?.title).toBe("Promote me");
		expect(promoted?.status).not.toBe("Draft");
		expect(await draftFiles()).toEqual([]);
	});

	it("keeps a task's ID when it is demoted back to a draft", async () => {
		await core.createTaskFromInput({ title: "Filler" }, false);
		await core.createTaskFromInput({ title: "Demote me" }, false);

		expect(await core.demoteTask("task-2", false)).toBe(true);

		// NOTE: Core.demoteTask does not rewrite the status (pre-existing upstream
		// behaviour, unrelated to IDs) - the file moves to drafts/ carrying whatever
		// status it had. Only the ID invariant is asserted here.
		const demoted = await core.fs.loadDraft("task-2");
		expect(demoted?.id).toBe("TASK-2");
		expect(await core.fs.loadTask("task-2")).toBeNull();
	});

	it("never returns an archived ID to the pool", async () => {
		await core.createTaskFromInput({ title: "One" }, false);
		await core.archiveTask("task-1", false);

		// Upstream would hand out TASK-1 again here.
		const next = await core.createTaskFromInput({ title: "Two" }, false);
		expect(next.task.id).toBe("TASK-2");

		await core.archiveTask("task-2", false);
		const third = await core.createTaskFromInput({ title: "Three" }, false);
		expect(third.task.id).toBe("TASK-3");
	});

	it("never returns an archived DRAFT's ID to the pool", async () => {
		const draft = await core.createTaskFromInput({ title: "Doomed draft", status: "Draft" }, false);
		expect(draft.task.id).toBe("TASK-1");

		expect(await core.archiveDraft("task-1", false)).toBe(true);

		const next = await core.createTaskFromInput({ title: "Next" }, false);
		expect(next.task.id).toBe("TASK-2");
	});

	it("counts an unpromoted draft, so a new task does not collide with it", async () => {
		const draft = await core.createTaskFromInput({ title: "Sitting draft", status: "Draft" }, false);
		expect(draft.task.id).toBe("TASK-1");

		const task = await core.createTaskFromInput({ title: "New task" }, false);
		expect(task.task.id).toBe("TASK-2");
	});

	it("gives drafts the configured task prefix", async () => {
		const config = await core.fs.loadConfig();
		if (!config) throw new Error("missing config");
		config.prefixes = { task: "JIRA" };
		await core.fs.saveConfig(config);

		await core.createTaskFromInput({ title: "A task" }, false);
		const draft = await core.createTaskFromInput({ title: "A draft", status: "Draft" }, false);

		// Same pool, same prefix - otherwise the two would diverge into separate pools.
		expect(draft.task.id).toBe("JIRA-2");
		expect(await draftFiles()).toEqual(["jira-2 - A-draft.md"]);
		expect((await core.fs.listDrafts()).map((d) => d.id)).toEqual(["JIRA-2"]);
	});
});
