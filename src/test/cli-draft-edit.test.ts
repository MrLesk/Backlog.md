import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { $ } from "bun";
import { pickTaskForEditWizard } from "../commands/task-wizard.ts";
import { isTaskLockError } from "../file-system/operations.ts";
import { Core } from "../index.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { findDuplicateDraftFilenameGroups } from "../utils/task-path.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	createUniqueTestDir,
	initializeFilesystemTestProject,
	initializeTestProject,
	safeCleanup,
} from "./test-utils.ts";

const normalizeCliOutput = (output: string) => output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();
const CLI_RUNTIME = process.env.TUI_TEST_CLI_RUNTIME?.trim() ?? "bun";

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
		expect(output).toContain("Rename one file to a distinct numeric id, then make its frontmatter agree");
		expect(output).not.toContain("doctor");
	});

	it("fails closed when padded and unpadded files claim the same numeric id", async () => {
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const write = (filename: string, id: string, title: string) =>
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
		await write("draft-1 - Alpha.md", "DRAFT-1", "Alpha");
		await write("draft-001 - Beta.md", "DRAFT-001", "Beta");

		const result = await $`bun ${CLI_PATH} draft edit 1 -t X`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Draft ID DRAFT-1 is ambiguous; 2 files match:");
		expect(output).toContain("draft-1 - Alpha.md");
		expect(output).toContain("draft-001 - Beta.md");
		expect(output).not.toContain("Updated draft");

		const core = new Core(TEST_DIR);
		expect((await core.filesystem.loadDraft("DRAFT-1"))?.title).toBe("Alpha");
		expect((await core.filesystem.loadDraft("DRAFT-001"))?.title).toBe("Beta");
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

	it("fails closed when a draft's frontmatter id drifted from its filename", async () => {
		const draft = await createDraft("Drifted draft");
		const draftPath = draft.filePath;
		if (!draftPath) throw new Error("expected draft file path");
		const drifted = serializeTask({
			id: "DRAFT-99",
			title: "Drifted draft",
			status: "Draft",
			assignee: [],
			createdDate: "2026-08-24 10:00",
			labels: [],
			dependencies: [],
		});
		await Bun.write(draftPath, drifted);
		const before = await Bun.file(draftPath).text();

		const result = await $`bun ${CLI_PATH} draft edit 1 -t X`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain(basename(draftPath));
		expect(output).toContain("DRAFT-99");
		expect(output).toContain("does not match its filename");
		expect(output).toContain("Fix the frontmatter id or rename the file so they agree");
		expect(output).not.toContain("doctor");

		const after = await Bun.file(draftPath).text();
		expect(after).toBe(before);
		const core = new Core(TEST_DIR);
		expect(await core.filesystem.loadDraft("DRAFT-99")).toBeNull();
	});

	it("resolves zero-padded drafts through the same loose numeric rule as the TUI", async () => {
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		await Bun.write(
			join(draftsDir, "draft-001 - Padded.md"),
			serializeTask({
				id: "DRAFT-001",
				title: "Padded",
				status: "Draft",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			}),
		);

		const shorthand = await $`bun ${CLI_PATH} draft edit 1 -t "Padded edited"`.cwd(TEST_DIR).nothrow().quiet();
		expect(shorthand.exitCode).toBe(0);

		const paddedInput = await $`bun ${CLI_PATH} draft edit 01 -a @alex`.cwd(TEST_DIR).nothrow().quiet();
		expect(paddedInput.exitCode).toBe(0);

		const core = new Core(TEST_DIR);
		const reloaded = await core.filesystem.loadDraft("DRAFT-001");
		expect(reloaded?.title).toBe("Padded edited");
		expect(reloaded?.assignee).toEqual(["@alex"]);
	});

	it("keeps one damaged draft from blocking edits of its siblings and names the damaged file", async () => {
		const healthy = await createDraft("Healthy sibling");
		await createDraft("Damaged sibling");
		const core = new Core(TEST_DIR);
		const drafts = await core.filesystem.listDrafts();
		const damaged = drafts.find((draft) => draft.title === "Damaged sibling");
		if (!damaged?.filePath) throw new Error("expected damaged draft file path");
		await Bun.write(damaged.filePath, "---\nid: [unclosed\ntitle: Damaged sibling\n---\nbroken yaml");

		const healthyEdit = await $`bun ${CLI_PATH} draft edit ${healthy.id} -t "Still editable"`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();
		expect(healthyEdit.exitCode).toBe(0);
		expect((await core.filesystem.loadDraft(healthy.id))?.title).toBe("Still editable");

		const damagedEdit = await $`bun ${CLI_PATH} draft edit 2 -t X`.cwd(TEST_DIR).nothrow().quiet();
		const damagedOutput = normalizeCliOutput(damagedEdit.stdout.toString() + damagedEdit.stderr.toString());
		expect(damagedEdit.exitCode).toBe(1);
		expect(damagedOutput).toContain("could not be parsed");
		expect(damagedOutput).toContain(basename(damaged.filePath));
	});

	it("keeps healthy drafts listed for interactive selection when a sibling is damaged", async () => {
		const healthy = await createDraft("Healthy wizard target");
		await createDraft("Damaged wizard target");
		const core = new Core(TEST_DIR);
		expect((await core.filesystem.listHealthyDrafts()).length).toBe(2);

		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const files = await Array.fromAsync(new Bun.Glob("draft-*.md").scan({ cwd: draftsDir }));
		for (const file of files) {
			if (file.includes("Damaged")) {
				await Bun.write(join(draftsDir, file), "---\nid: [unclosed\ntitle: Damaged\n---\nbroken yaml");
			}
		}

		expect((await core.filesystem.listDrafts()).length).toBe(0);
		const afterDamage = await core.filesystem.listHealthyDrafts();
		expect(afterDamage.length).toBe(1);
		expect(afterDamage[0]?.id).toBe(healthy.id);
	});

	it("points recovery guidance at the draft commands", async () => {
		const draft = await createDraft("Guidance target");

		const result = await $`bun ${CLI_PATH} draft edit ${draft.id} --check-ac 7`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain(`backlog draft view ${draft.id} --plain`);
		expect(output).toContain(`backlog draft edit ${draft.id} --help`);
		expect(output).not.toContain("backlog task view");
		expect(output).not.toContain("backlog task edit");
	});

	it("requires a task id outside interactive mode like task edit does", async () => {
		const result = await $`bun ${CLI_PATH} draft edit -t X`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain("missing required argument 'taskId'");
	});
});

describe("atomic draft editing", () => {
	let TEST_DIR: string;
	let setup: Core;
	let originalGlobalLockEnv: string | undefined;

	beforeEach(async () => {
		originalGlobalLockEnv = process.env.USE_GLOBAL_TASK_ID_LOCK;
		delete process.env.USE_GLOBAL_TASK_ID_LOCK;

		TEST_DIR = createUniqueTestDir("test-atomic-draft-edit");
		await mkdir(TEST_DIR, { recursive: true });
		setup = new Core(TEST_DIR);
		await initializeFilesystemTestProject(setup, "Atomic Draft Edit Test");
	});

	afterEach(async () => {
		setup.disposeContentStore();
		if (originalGlobalLockEnv === undefined) {
			delete process.env.USE_GLOBAL_TASK_ID_LOCK;
		} else {
			process.env.USE_GLOBAL_TASK_ID_LOCK = originalGlobalLockEnv;
		}
		await safeCleanup(TEST_DIR);
	});

	it("never silently loses concurrent draft edits: winners land, losers fail loudly", async () => {
		const created = await $`bun ${CLI_PATH} draft create "Contended draft"`.cwd(TEST_DIR).quiet();
		const match = created.stdout.toString().match(/Created draft (\S+)/);
		const draftId = match?.[1];
		if (!draftId) throw new Error("draft create did not report a draft id");
		const reference = await setup.filesystem.resolveDraftReference(draftId);
		if (!reference) throw new Error("expected draft reference");

		// Separate Cores race like separate processes: without serialization each one mutates
		// the same pre-write snapshot and all but one label disappear from the file.
		const writerCount = 6;
		const labels = Array.from({ length: writerCount }, (_, index) => `label-${index + 1}`);
		const writers = labels.map((label) => ({ label, core: new Core(TEST_DIR) }));
		let outcomes: PromiseSettledResult<Task>[];
		try {
			outcomes = await Promise.allSettled(
				writers.map(({ label, core }) => core.updateDraftFromInput(reference, { addLabels: [label] }, false)),
			);
		} finally {
			for (const { core } of writers) core.disposeContentStore();
		}

		const succeeded = labels.filter((_, index) => outcomes[index]?.status === "fulfilled");
		expect(succeeded.length).toBeGreaterThanOrEqual(1);

		for (const outcome of outcomes) {
			if (outcome.status === "fulfilled") continue;
			expect(isTaskLockError(outcome.reason)).toBe(true);
		}

		const core = new Core(TEST_DIR);
		const reloaded = await core.filesystem.loadDraft(draftId);
		expect([...(reloaded?.labels ?? [])].sort()).toEqual([...succeeded].sort());
	});

	it.skipIf(process.platform === "win32")(
		"archive fails fast while an edit holds the draft lock, leaving the draft intact",
		async () => {
			const created = await $`bun ${CLI_PATH} draft create "Archive race"`.cwd(TEST_DIR).quiet();
			const match = created.stdout.toString().match(/Created draft (\S+)/);
			const draftId = match?.[1];
			if (!draftId) throw new Error("draft create did not report a draft id");
			const reference = await setup.filesystem.resolveDraftReference(draftId);
			if (!reference) throw new Error("expected draft reference");

			let release: () => void = () => {};
			try {
				const held = new Promise<void>((resolveHeld) => {
					void setup.fs.withDraftLock(reference, async () => {
						resolveHeld();
						await new Promise<void>((resolveRelease) => {
							release = resolveRelease;
						});
					});
				});
				await held;

				const racingCore = new Core(TEST_DIR);
				try {
					let failure: unknown;
					try {
						await racingCore.archiveDraft(draftId, false);
						throw new Error("expected contended archive to fail fast");
					} catch (error) {
						if ((error as Error).message.startsWith("expected contended")) throw error;
						failure = error;
					}
					expect(isTaskLockError(failure)).toBe(true);
				} finally {
					racingCore.disposeContentStore();
				}
			} finally {
				release();
			}

			const core = new Core(TEST_DIR);
			const reloaded = await core.filesystem.loadDraft(draftId);
			expect(reloaded?.title).toBe("Archive race");
			const archivedFiles = (await readdir(join(TEST_DIR, "backlog", "archive", "drafts")).catch(() => [])).length;
			expect(archivedFiles).toBe(0);

			// After release, archiving succeeds cleanly.
			expect(await core.archiveDraft(draftId, false)).toBe(true);
			expect(await core.filesystem.loadDraft(draftId)).toBeNull();
		},
	);

	it("picker lists unrelated healthy drafts beside colliding ones and only selection fails closed", async () => {
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const writeTwin = (filename: string, id: string, title: string) =>
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
		await writeTwin("draft-1 - Alpha.md", "DRAFT-1", "Alpha");
		await writeTwin("draft-01 - Alpha twin.md", "DRAFT-01", "Alpha twin");
		await $`bun ${CLI_PATH} draft create "Unrelated gamma"`.cwd(TEST_DIR).nothrow().quiet();

		const rows = await setup.filesystem.listHealthyDrafts();
		expect(rows.length).toBe(3);

		const unrelated = await $`bun ${CLI_PATH} draft edit DRAFT-2 -t "Gamma edited"`.cwd(TEST_DIR).nothrow().quiet();
		expect(unrelated.exitCode).toBe(0);

		const colliding = await $`bun ${CLI_PATH} draft edit 01 -t X`.cwd(TEST_DIR).nothrow().quiet();
		const collidingOutput = normalizeCliOutput(colliding.stdout.toString() + colliding.stderr.toString());
		expect(colliding.exitCode).toBe(1);
		expect(collidingOutput).toContain("is ambiguous");
	});

	it("promotion fails fast while an edit holds the draft lock, then succeeds cleanly", async () => {
		const created = await $`bun ${CLI_PATH} draft create "Promotion race"`.cwd(TEST_DIR).quiet();
		const match = created.stdout.toString().match(/Created draft (\S+)/);
		const draftId = match?.[1];
		if (!draftId) throw new Error("draft create did not report a draft id");
		const reference = await setup.filesystem.resolveDraftReference(draftId);
		if (!reference) throw new Error("expected draft reference");

		let release: () => void = () => {};
		const held = new Promise<void>((resolveHeld) => {
			void setup.fs.withDraftLock(reference, async () => {
				resolveHeld();
				await new Promise<void>((resolveRelease) => {
					release = resolveRelease;
				});
			});
		});
		await held;

		const racingCore = new Core(TEST_DIR);
		try {
			let failure: unknown;
			try {
				await racingCore.promoteDraft(draftId, false);
				throw new Error("expected contended promotion to fail fast");
			} catch (error) {
				if ((error as Error).message.startsWith("expected contended")) throw error;
				failure = error;
			}
			expect(isTaskLockError(failure)).toBe(true);
		} finally {
			release();
			racingCore.disposeContentStore();
		}

		// No dual records were produced by the contended attempt; promotion then succeeds.
		const promotingCore = new Core(TEST_DIR);
		try {
			expect(await promotingCore.filesystem.loadDraft(draftId)).not.toBeNull();
			expect(await promotingCore.promoteDraft(draftId, false)).toBe(true);
			expect(await promotingCore.filesystem.loadDraft(draftId)).toBeNull();
		} finally {
			promotingCore.disposeContentStore();
		}
	});

	it("does not contend with a task that shares the draft's id, but still fails fast on real contention", async () => {
		await $`bun ${CLI_PATH} draft create "Namespaced draft"`.cwd(TEST_DIR).quiet();
		const draftReference = await setup.filesystem.resolveDraftReference("DRAFT-1");
		if (!draftReference) throw new Error("expected draft reference");
		await setup.createTask(
			{
				id: "draft-1",
				title: "Task twin",
				status: "To Do",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			},
			false,
		);
		const taskTwin = await setup.filesystem.loadTask("draft-1");
		if (!taskTwin?.filePath) throw new Error("expected task twin");

		let releaseTaskLock: (() => void) | undefined;
		try {
			// Holding the TASK lock on the colliding id must not block the draft edit.
			const taskLockHeld = new Promise<void>((resolveHeld) => {
				void setup.fs.withTaskLock(taskTwin, async () => {
					resolveHeld();
					await new Promise<void>((resolveRelease) => {
						releaseTaskLock = resolveRelease;
					});
				});
			});
			await taskLockHeld;

			const editingCore = new Core(TEST_DIR);
			try {
				const updated = await editingCore.updateDraftFromInput(draftReference, { addLabels: ["no-contention"] }, false);
				expect(updated.labels).toContain("no-contention");
			} finally {
				editingCore.disposeContentStore();
			}
		} finally {
			releaseTaskLock?.();
		}

		// Genuine same-file contention still fails fast with the shared error style.
		let releaseDraftLock: (() => void) | undefined;
		try {
			const holdingCore = new Core(TEST_DIR);
			const draftLockHeld = new Promise<void>((resolveHeld) => {
				void holdingCore.fs.withDraftLock(draftReference, async () => {
					resolveHeld();
					await new Promise<void>((resolveRelease) => {
						releaseDraftLock = resolveRelease;
					});
				});
			});
			await draftLockHeld;

			const losingCore = new Core(TEST_DIR);
			try {
				let lockFailure: unknown;
				try {
					await losingCore.updateDraftFromInput(draftReference, { addLabels: ["lost"] }, false);
					throw new Error("expected same-file contention to fail fast");
				} catch (error) {
					if ((error as Error).message.startsWith("expected same-file")) throw error;
					lockFailure = error;
				}
				expect(isTaskLockError(lockFailure)).toBe(true);
			} finally {
				losingCore.disposeContentStore();
			}
		} finally {
			releaseDraftLock?.();
		}
	});
});

describe("draft wizard selection binding", () => {
	let TEST_DIR: string;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-wizard-binding");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Draft Wizard Binding Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("hands the wizard selection back as the bound row handle", async () => {
		let capturedValue: string | undefined;
		const selected = await pickTaskForEditWizard({
			tasks: [{ id: "DRAFT-2", title: "Drifted row", value: "/drafts/draft-1 - Alpha.md" }],
			promptImpl: async (question) => {
				capturedValue = question.options?.at(0)?.value;
				return { taskId: question.options?.at(0)?.value };
			},
		});

		expect(capturedValue).toBe("/drafts/draft-1 - Alpha.md");
		expect(selected).toBe("/drafts/draft-1 - Alpha.md");
	});

	it("selecting a drifted row fails closed against that file and never edits its twin", async () => {
		const core = new Core(TEST_DIR);
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const drifted = serializeTask({
			id: "DRAFT-2",
			title: "Alpha",
			status: "Draft",
			assignee: [],
			createdDate: "2026-08-24 10:00",
			labels: [],
			dependencies: [],
		});
		await Bun.write(join(draftsDir, "draft-1 - Alpha.md"), drifted);
		await $`bun ${CLI_PATH} draft create "Beta"`.cwd(TEST_DIR).nothrow().quiet();

		const rows = await core.filesystem.listHealthyDrafts();
		const alphaRow = rows.find((row) => row.filePath?.includes("draft-1 - Alpha"));
		if (!alphaRow?.filePath) throw new Error("expected drifted row");

		await expect(core.filesystem.draftReferenceFromPath(alphaRow.filePath)).rejects.toThrow(
			"does not match its filename",
		);

		const betaRow = rows.find((row) => row.filePath?.includes("- Beta"));
		if (!betaRow?.filePath) throw new Error("expected beta row");
		await core.updateDraftFromInput(
			{ filePath: betaRow.filePath, canonicalId: betaRow.id },
			{ addLabels: ["touched-beta"] },
			false,
		);
		expect(await Bun.file(betaRow.filePath).text()).toContain("touched-beta");
		expect(await Bun.file(alphaRow.filePath).text()).not.toContain("touched-beta");
	});
});

describe("CLI draft edit auto-commit rename staging", () => {
	let TEST_DIR: string;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-rename-autocommit");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Draft Rename Autocommit Project", true);
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.autoCommit = true;
			await core.filesystem.saveConfig(config);
		}
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("stages the old path deletion together with the new path addition on a title rename", async () => {
		await $`bun ${CLI_PATH} draft create "Original title"`.cwd(TEST_DIR).quiet();
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m seed`.cwd(TEST_DIR).quiet();

		await $`bun ${CLI_PATH} draft edit 1 -t "Renamed title"`.cwd(TEST_DIR).nothrow().quiet();

		const status = await $`git status --porcelain`.cwd(TEST_DIR).quiet();
		expect(status.stdout.toString().trim()).toBe("");

		const nameStatus = await $`git show --no-renames --name-status --pretty=format:`.cwd(TEST_DIR).quiet();
		const lines = normalizeCliOutput(nameStatus.stdout.toString())
			.split("\n")
			.filter((line) => line.trim().length > 0);
		expect(lines.some((line) => line.startsWith("D") && line.includes("draft-1 - Original-title.md"))).toBe(true);
		expect(lines.some((line) => line.startsWith("A") && line.includes("draft-1 - Renamed-title.md"))).toBe(true);
	});
});

describe("draft identity sweep", () => {
	let TEST_DIR: string;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-sweep");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Draft Sweep Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	const writeDraftFile = async (filename: string, id: string, title: string): Promise<string> => {
		const filePath = join(TEST_DIR, "backlog", "drafts", filename);
		await Bun.write(
			filePath,
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
		return filePath;
	};

	it("converges a padded file to one file instead of minting a duplicate", async () => {
		await writeDraftFile("draft-001 - Padded.md", "DRAFT-1", "Padded");
		const draftsDir = join(TEST_DIR, "backlog", "drafts");

		const renamed = await $`bun ${CLI_PATH} draft edit 1 -t "Converged"`.cwd(TEST_DIR).nothrow().quiet();
		expect(renamed.exitCode).toBe(0);

		const afterRename = (await readdir(draftsDir)).sort();
		expect(afterRename).toEqual(["draft-001 - Converged.md"]);

		const relabeled = await $`bun ${CLI_PATH} draft edit 1 -a @alex`.cwd(TEST_DIR).nothrow().quiet();
		expect(relabeled.exitCode).toBe(0);
		expect((await readdir(draftsDir)).sort()).toEqual(["draft-001 - Converged.md"]);

		const core = new Core(TEST_DIR);
		const reloaded = await core.filesystem.loadDraft("DRAFT-001");
		expect(reloaded?.title).toBe("Converged");
		expect(reloaded?.assignee).toEqual(["@alex"]);
	});

	it("never deletes an unparsable padded twin during allocation or convergence", async () => {
		// Unparsable content: the numeric id is only proclaimed by the filename.
		const notesPath = join(TEST_DIR, "backlog", "drafts", "draft-001 - Notes.md");
		const brokenYaml = "---\nid: [oops\ntitle: Notes\n---\nbroken yaml";
		await Bun.write(notesPath, brokenYaml);

		const created = await $`bun ${CLI_PATH} draft create "Fresh work"`.cwd(TEST_DIR).nothrow().quiet();
		expect(created.exitCode).toBe(0);
		expect(created.stdout.toString()).toContain("Created draft DRAFT-2");

		expect(await Bun.file(notesPath).exists()).toBe(true);
		expect(await Bun.file(notesPath).text()).toBe(brokenYaml);

		// The unparsable file stays reported as unparsable, never silently consumed.
		const editBroken = await $`bun ${CLI_PATH} draft edit 1 -t X`.cwd(TEST_DIR).nothrow().quiet();
		const brokenOutput = normalizeCliOutput(editBroken.stdout.toString() + editBroken.stderr.toString());
		expect(editBroken.exitCode).toBe(1);
		expect(brokenOutput).toContain("could not be parsed");
		expect(brokenOutput).toContain("draft-001 - Notes.md");
	});

	it("groups colliding draft filenames for fail-closed picker rendering", () => {
		const groups = findDuplicateDraftFilenameGroups([
			"draft-2 - Beta.md",
			"draft-1 - Alpha.md",
			"draft-01 - Alpha.md",
			"task-1 - Not a draft.md",
		]);
		expect(groups).toEqual([["draft-01 - Alpha.md", "draft-1 - Alpha.md"]]);
		expect(findDuplicateDraftFilenameGroups(["draft-1 - Solo.md", "draft-2 - Other.md"])).toEqual([]);
	});
});

const EXPECT_PATH = Bun.which("expect");
const RUN_INTERACTIVE_TUI_TESTS = process.env.RUN_INTERACTIVE_TUI_TESTS === "1";
const itInteractive = EXPECT_PATH && RUN_INTERACTIVE_TUI_TESTS ? it : it.skip;

describe("interactive draft picker collision guard", () => {
	itInteractive(
		"renders unrelated healthy drafts beside an unparsable twin",
		async () => {
			const TEST_DIR = createUniqueTestDir("test-draft-picker-pty");
			await mkdir(TEST_DIR, { recursive: true });
			try {
				const core = new Core(TEST_DIR);
				await initializeFilesystemTestProject(core, "Picker Collision Project");
				const draftsDir = join(TEST_DIR, "backlog", "drafts");
				await Bun.write(
					join(draftsDir, "draft-1 - Alpha.md"),
					serializeTask({
						id: "DRAFT-1",
						title: "Alpha",
						status: "Draft",
						assignee: [],
						createdDate: "2026-08-24 10:00",
						labels: [],
						dependencies: [],
					}),
				);
				// The padded twin is unparsable: its numeric identity must still block the picker.
				await Bun.write(join(draftsDir, "draft-01 - Alpha.md"), "---\nid: [oops\ntitle: Alpha\n---\nbroken");

				const script = `log_user 1\nspawn {${CLI_RUNTIME}} {${CLI_PATH}} draft edit\nset timeout 15\nsleep 3\nsend "\\x03"\nexpect {\n\teof {}\n\ttimeout { exit 2 }\n}`;
				const proc = Bun.spawnSync({
					cmd: ["expect", "-c", script],
					env: { ...process.env, TERM: "xterm", BACKLOG_CWD: TEST_DIR },
					stdout: "pipe",
					stderr: "pipe",
				});
				const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
				// The pty interleaves frame borders and split SGR tails between bytes, so reduce
				// aggressively before asserting: the picker must render its choices even though an
				// unparsable padded twin occupies the same numeric identity.
				const cleaned = output
					.replace(/[\r\n]/g, "")
					.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g"), "");
				const letters = cleaned.replace(/[^A-Za-z0-9]/g, "").replace(/[0-9]+m/g, "");
				expect(letters).toContain("Selecttasktoedit");
				expect(letters).toContain("DRAFT1Alpha");
				expect(letters).not.toContain("isambiguous");
			} finally {
				await safeCleanup(TEST_DIR);
			}
		},
		{ timeout: 30_000 },
	);
});

describe("draft identity edge cases", () => {
	let TEST_DIR: string;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-edge");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Draft Edge Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("groups dotted-segment padding variants so direct ids and the picker fail closed", async () => {
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const twin = (filename: string, id: string, title: string) =>
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
		await twin("draft-1.1 - Sub.md", "DRAFT-1.1", "Sub");
		await twin("draft-1.01 - Twin.md", "DRAFT-1.01", "Twin");

		expect(findDuplicateDraftFilenameGroups(["draft-1.1 - Sub.md", "draft-1.01 - Twin.md"])).toHaveLength(1);

		const edit = await $`bun ${CLI_PATH} draft edit 1.1 -t X`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(edit.stdout.toString() + edit.stderr.toString());
		expect(edit.exitCode).toBe(1);
		expect(output).toContain("is ambiguous");
		expect(output).toContain("draft-1.01 - Twin.md");

		const after = (await readdir(draftsDir)).sort();
		expect(after).toEqual(["draft-1.01 - Twin.md", "draft-1.1 - Sub.md"]);
	});

	it("rejects absolute paths as the public taskId argument", async () => {
		const foreignDir = join(TEST_DIR, "outside");
		await mkdir(foreignDir, { recursive: true });
		const foreignPath = join(foreignDir, "draft-1 - Foreign.md");
		const foreignContent = "---\nid: DRAFT-1\ntitle: Foreign\nstatus: Draft\n---\nforeign body";
		await Bun.write(foreignPath, foreignContent);

		const result = await $`bun ${CLI_PATH} draft edit ${foreignPath} --title Hijacked`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Invalid draft id");
		expect(await Bun.file(foreignPath).text()).toBe(foreignContent);
		expect((await readdir(join(TEST_DIR, "backlog", "drafts"))).length).toBe(0);
	});

	it("fails closed when a path-form id names one member of a duplicate pair", async () => {
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const alphaPath = join(draftsDir, "draft-1 - Alpha.md");
		const twinPath = join(draftsDir, "draft-01 - Beta.md");
		await Bun.write(
			alphaPath,
			serializeTask({
				id: "DRAFT-1",
				title: "Alpha",
				status: "Draft",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			}),
		);
		await Bun.write(
			twinPath,
			serializeTask({
				id: "DRAFT-01",
				title: "Beta",
				status: "Draft",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			}),
		);

		const result = await $`bun ${CLI_PATH} draft edit ${alphaPath} --title Hijacked`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(result.stdout.toString() + result.stderr.toString());
		expect(result.exitCode).toBe(1);
		expect(output).toContain("is ambiguous");
		expect(output).toContain("Rename one file to a distinct numeric id, then make its frontmatter agree.");

		expect(await Bun.file(alphaPath).text()).toContain("Alpha");
		expect(await Bun.file(twinPath).text()).toContain("Beta");
		expect((await readdir(draftsDir)).sort()).toEqual(["draft-01 - Beta.md", "draft-1 - Alpha.md"]);
	});

	it("still accepts an in-drafts-dir path for a unique draft", async () => {
		await $`bun ${CLI_PATH} draft create "Solo draft"`.cwd(TEST_DIR).nothrow().quiet();
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const soloPath = (await readdir(draftsDir))
			.filter((file) => file.endsWith(".md"))
			.map((file) => join(draftsDir, file))
			.at(0);
		if (!soloPath) throw new Error("expected the created draft file");

		const result = await $`bun ${CLI_PATH} draft edit ${soloPath} -a @alex`.cwd(TEST_DIR).nothrow().quiet();
		expect(result.exitCode).toBe(0);

		const core = new Core(TEST_DIR);
		expect((await core.filesystem.loadDraft("DRAFT-1"))?.assignee).toEqual(["@alex"]);
	});

	it("lists the real supported fields in draft edit help", async () => {
		const help = await $`bun ${CLI_PATH} draft edit --help`.cwd(TEST_DIR).nothrow().quiet();
		const output = normalizeCliOutput(help.stdout.toString());
		for (const flag of [
			"--title",
			"--description",
			"--assignee",
			"--label",
			"--add-label",
			"--remove-label",
			"--priority",
			"--ordinal",
			"--milestone",
			"--due-date",
			"--clear-due-date",
			"--plan",
			"--append-plan",
			"--notes",
			"--comment",
			"--final-summary",
			"--depends-on",
			"--clear-deps",
			"--ref",
			"--add-ref",
			"--doc",
			"--check-ac",
			"--clear-ac",
			"--uncheck-ac",
			"--dod",
			"--check-dod",
			"--plain",
		]) {
			expect(output).toContain(flag);
		}
	});
});
