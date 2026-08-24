import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const normalizeCliOutput = (output: string) => output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

describe("CLI draft edit", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-draft-edit");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Draft Edit Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	const createDraft = async (title: string): Promise<Task> => {
		const create = await $`bun ${CLI_PATH} draft create ${title}`.cwd(TEST_DIR).quiet();
		const match = create.stdout.toString().match(/Created draft (\S+)/);
		const draftId = match?.[1];
		if (!draftId) throw new Error("draft create did not report a draft id");
		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft(draftId);
		if (!draft) throw new Error(`expected draft ${draftId} to exist`);
		return draft;
	};

	it("applies non-interactive field flags to a draft through the shared mutation path", async () => {
		const draft = await createDraft("Editable draft");

		const result =
			await $`bun ${CLI_PATH} draft edit ${draft.id} -t "Renamed draft" -d "New body" -a @alice -l ui --priority high --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
		const output = normalizeCliOutput(result.stdout.toString());
		expect(result.exitCode).toBe(0);
		expect(output).toContain("Renamed draft");
		expect(output).not.toContain("Updated ");

		const core = new Core(TEST_DIR);
		const reloaded = await core.filesystem.loadDraft(draft.id);
		expect(reloaded?.title).toBe("Renamed draft");
		expect(reloaded?.description).toBe("New body");
		expect(reloaded?.assignee).toEqual(["@alice"]);
		expect(reloaded?.labels).toEqual(["ui"]);
		expect(reloaded?.status).toBe("Draft");
	});

	it("reports an unchanged no-flag edit without mutating the draft", async () => {
		const draft = await createDraft("Untouched draft");
		const draftFilePath = draft.filePath;
		if (!draftFilePath) throw new Error("expected draft file path");
		const before = await Bun.file(draftFilePath).text();

		const result = await $`bun ${CLI_PATH} draft edit ${draft.id}`.cwd(TEST_DIR).nothrow().quiet();
		expect(result.exitCode).toBe(0);
		expect(normalizeCliOutput(result.stdout.toString())).toContain(`Updated draft ${draft.id}`);

		const core = new Core(TEST_DIR);
		const reloaded = await core.filesystem.loadDraft(draft.id);
		expect(reloaded?.title).toBe("Untouched draft");
		const reloadedFilePath = reloaded?.filePath;
		if (!reloadedFilePath) throw new Error("expected reloaded draft file path");
		const after = await Bun.file(reloadedFilePath).text();
		expect(after.replace(/updated_date:[^\n]*\n/g, "")).toBe(before.replace(/updated_date:[^\n]*\n/g, ""));
	});

	it("keeps drafts on Draft status and rejects other statuses like task edit validates", async () => {
		const draft = await createDraft("Status guarded");

		const valid = await $`bun ${CLI_PATH} draft edit ${draft.id} -s draft`.cwd(TEST_DIR).nothrow().quiet();
		expect(valid.exitCode).toBe(0);

		const invalid = await $`bun ${CLI_PATH} draft edit ${draft.id} -s "To Do"`.cwd(TEST_DIR).nothrow().quiet();
		const invalidOutput = normalizeCliOutput(invalid.stdout.toString() + invalid.stderr.toString());
		expect(invalid.exitCode).toBe(1);
		expect(invalidOutput).toContain("Invalid status: To Do. Valid statuses are: Draft");

		const core = new Core(TEST_DIR);
		const reloaded = await core.filesystem.loadDraft(draft.id);
		expect(reloaded?.status).toBe("Draft");
	});

	it("fails closed for unknown draft ids without the cross-branch hint", async () => {
		const result = await $`bun ${CLI_PATH} draft edit DRAFT-99 -t X`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Draft DRAFT-99 not found.");
	});

	it("fails closed when several draft files claim the same id", async () => {
		const draft = async (title: string) =>
			serializeTask({
				id: "DRAFT-7",
				title,
				status: "Draft",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			});
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		await Bun.write(join(draftsDir, "draft-7 - Alpha.md"), await draft("Alpha"));
		await Bun.write(join(draftsDir, "draft-7 - Beta.md"), await draft("Beta"));

		const result = await $`bun ${CLI_PATH} draft edit 7 -t X`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Draft ID DRAFT-7 is ambiguous; 2 files match:");
		expect(output).toContain("draft-7 - Alpha.md");
		expect(output).toContain("draft-7 - Beta.md");
		expect(output).toContain("backlog doctor");
	});

	it("reuses the task edit flag validation rules", async () => {
		const draft = await createDraft("Flag guarded");

		const result = await $`bun ${CLI_PATH} draft edit ${draft.id} --clear-labels --label a`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Cannot combine --clear-labels with --label, --add-label, or --remove-label.");

		const conflict = await $`bun ${CLI_PATH} draft edit ${draft.id} --due-date 2026-01-01 --clear-due-date`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();
		expect(normalizeCliOutput(conflict.stderr.toString())).toContain(
			"Cannot use --due-date and --clear-due-date together.",
		);
	});

	it("requires a task id outside interactive mode like task edit does", async () => {
		const result = await $`bun ${CLI_PATH} draft edit -t X`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain("missing required argument 'taskId'");
	});
});
