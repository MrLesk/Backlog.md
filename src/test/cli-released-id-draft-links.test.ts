import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createTestDirOutsideRepository, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
const URL_WITH_THE_ID = "https://example.com/TASK-1";

let TEST_DIR: string;
let core: Core;
let urlDraftPath: string;

/** Run `backlog task <args>` in the test project and return what a caller of the CLI sees. */
async function task(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const result = await $`bun ${[CLI_PATH, "task", ...args]}`.cwd(TEST_DIR).nothrow().quiet();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function record(
	id: string,
	title: string,
	links: Pick<Task, "dependencies" | "references"> = { dependencies: [] },
): Task {
	return {
		id,
		title,
		status: id.startsWith("draft") ? "Draft" : "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		...links,
	};
}

async function linksOf(draftId: string): Promise<{ dependencies: string[]; references: string[] }> {
	const draft = await core.filesystem.loadDraft(draftId);
	if (!draft) throw new Error(`Expected ${draftId}`);
	return { dependencies: draft.dependencies ?? [], references: draft.references ?? [] };
}

/**
 * Deleting or demoting a task releases its ID, and the next created task receives it. A draft that
 * kept its dependency on, or its reference to, the old task would then point at the new one.
 */
describe("drafts that link to a task whose ID is released", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("test-cli-released-id-draft-links");
		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Released ID Draft Links");
		await core.createTask(record("task-1", "Target"), false);
		await core.filesystem.saveDraft(
			record("draft-1", "Linked draft", { dependencies: ["TASK-1"], references: ["TASK-1", URL_WITH_THE_ID] }),
		);
		// A URL that merely contains the ID is not a link to the task.
		urlDraftPath = await core.filesystem.saveDraft(
			record("draft-2", "Draft with a URL", { dependencies: [], references: [URL_WITH_THE_ID] }),
		);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it.each([
		[
			"delete",
			"Deleted task TASK-1",
			async () => {
				await task("archive", "1");
				return await task("delete", "1");
			},
		],
		["demote", "Demoted task TASK-1", async () => await task("demote", "1")],
	])(
		"%s removes the draft's dependency and reference, names the draft, and the reused ID is not linked",
		async (_operation, confirmation, release) => {
			expect(await linksOf("draft-1")).toEqual({ dependencies: ["TASK-1"], references: ["TASK-1", URL_WITH_THE_ID] });
			const urlDraftBefore = await Bun.file(urlDraftPath).text();

			const released = await release();

			expect(released.exitCode).toBe(0);
			expect(released.stdout).toBe(`${confirmation}\nRemoved references to TASK-1 from DRAFT-1\n`);
			expect(await linksOf("draft-1")).toEqual({ dependencies: [], references: [URL_WITH_THE_ID] });
			expect(await Bun.file(urlDraftPath).text()).toBe(urlDraftBefore);

			// The next created task receives the released ID, and the draft does not link to it.
			const created = await task("create", "Reuses the ID", "--plain");
			expect(created.stdout).toContain("Task TASK-1 - Reuses the ID");
			expect(await linksOf("draft-1")).toEqual({ dependencies: [], references: [URL_WITH_THE_ID] });
		},
	);
});
