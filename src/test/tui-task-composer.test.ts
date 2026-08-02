import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { appendFile, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { getCreatedTaskBoardOutcome, renderBoardTui, upsertBoardTask } from "../ui/board.ts";
import {
	createTaskComposerValues,
	getTaskComposerLayout,
	getTaskComposerPriorityChoices,
	getTaskComposerStatusChoices,
	getTaskComposerTypeChoices,
	openTaskComposer,
	TaskComposerController,
	toTaskCreateInput,
} from "../ui/components/task-composer.ts";
import { createScreen } from "../ui/tui.ts";
import { watchTasks } from "../utils/task-watcher.ts";
import { initializeTestProject, withTimeout } from "./test-utils.ts";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "TASK-1",
		title: "Created task",
		status: "To Do",
		assignee: [],
		createdDate: "2026-07-15 00:00",
		labels: [],
		dependencies: [],
		...overrides,
	};
}

async function initializeGitRepository(testDir: string): Promise<void> {
	await $`git init -b main`.cwd(testDir).quiet();
	await $`git config user.email test@example.com`.cwd(testDir).quiet();
	await $`git config user.name "Test User"`.cwd(testDir).quiet();
	await $`git add backlog`.cwd(testDir).quiet();
	await $`git commit -m init`.cwd(testDir).quiet();
}

async function installHook(testDir: string, hook: string, body: string, hooksDir = join(testDir, ".git", "hooks")) {
	await mkdir(hooksDir, { recursive: true });
	const hookPath = join(hooksDir, hook);
	await writeFile(hookPath, `#!/bin/sh\n${body}\n`);
	await chmod(hookPath, 0o755);
	return hookPath;
}

async function installFailingHook(testDir: string, body = "exit 1"): Promise<string> {
	return installHook(testDir, "pre-commit", body);
}

type TestWidget = {
	_clines?: { length: number };
	content?: string;
	children?: unknown[];
	getCursor?: () => { x: number; y: number };
	getValue?: () => string;
	height?: number;
	hidden?: boolean;
	items?: TestWidget[];
	label?: string;
	left?: number | string;
	options?: { label?: string };
	position?: { top?: number | string; left?: number | string; width?: number | string; height?: number | string };
	selected?: number;
	style?: { inverse?: boolean; bold?: boolean; border?: { fg?: string } };
	top?: number;
	width?: number | string;
	emit?: (event: string, ...args: unknown[]) => void;
	setValue?: (value: string) => void;
};

function collectWidgets(root: { children?: unknown[] }): TestWidget[] {
	const widgets: TestWidget[] = [];
	const visit = (node: TestWidget) => {
		widgets.push(node);
		for (const child of node.children ?? []) visit(child as TestWidget);
	};
	visit(root as TestWidget);
	return widgets;
}

async function waitUntil(predicate: () => boolean, message: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		if (predicate()) return;
		await Bun.sleep(10);
	}
	throw new Error(`Timed out waiting for ${message}`);
}

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const shift = name.startsWith("S-");
	const keyName = shift ? name.slice(2) : name;
	const key = { name: keyName, full: name, shift };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

function typeText(widget: TestWidget | undefined, value: string): void {
	for (const character of value) {
		pressKey(widget, character, character);
	}
}

async function settleComposerFocus(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("TUI task composer model", () => {
	it("rests on the first configured workflow status and never Draft", () => {
		const values = createTaskComposerValues(["Review", "Ready", "Done"]);
		expect(values.status).toBe("Review");
		expect(values.type).toBe("");
		expect(values.priority).toBe("");
	});

	it("offers Draft only in the opened status choices without changing the resting value", () => {
		const values = createTaskComposerValues(["Backlog", "Doing", "Done"]);
		const choices = getTaskComposerStatusChoices(["Backlog", "Doing", "Done"]);

		expect(choices.map((choice) => choice.value)).toEqual(["Draft", "Backlog", "Doing", "Done"]);
		expect(values.status).toBe("Backlog");
	});

	it("uses configured type and priority choices with explicit unset options", () => {
		expect(getTaskComposerTypeChoices(["Incident", "Feature"])).toEqual([
			{ label: "None", value: "" },
			{ label: "Incident", value: "Incident" },
			{ label: "Feature", value: "Feature" },
		]);
		expect(getTaskComposerPriorityChoices(["Urgent", "Eventually"])).toEqual([
			{ label: "None", value: "" },
			{ label: "Urgent", value: "urgent" },
			{ label: "Eventually", value: "eventually" },
		]);
	});

	it("builds the canonical first-slice payload and omits unset fields", () => {
		expect(
			toTaskCreateInput({
				title: "  Capture intent  ",
				description: "Line one\nLine two",
				status: "Review",
				type: "Feature",
				priority: "urgent",
			}),
		).toEqual({
			title: "Capture intent",
			description: "Line one\nLine two",
			status: "Review",
			type: "Feature",
			priority: "urgent",
		});

		expect(toTaskCreateInput({ title: "Minimal", description: "", status: "To Do", type: "", priority: "" })).toEqual({
			title: "Minimal",
			status: "To Do",
		});
	});

	it("keeps the composer compact at 100x30 and 80x24, then stacks details at 50x18", () => {
		expect(getTaskComposerLayout(100, 30)).toMatchObject({
			compact: false,
			popupHeight: 20,
			descriptionHeight: 6,
			detailsTop: 9,
			detailsHeight: 3,
			actionsTop: 12,
		});
		expect(getTaskComposerLayout(80, 24)).toMatchObject({ compact: false, popupHeight: 20, actionsTop: 12 });
		expect(getTaskComposerLayout(50, 18)).toMatchObject({
			compact: true,
			popupHeight: 16,
			descriptionHeight: 3,
			detailsTop: 6,
			detailsHeight: 4,
			actionsTop: 10,
		});
	});

	it("does not persist invalid input and preserves values after a failed attempt", async () => {
		const controller = new TaskComposerController(["Review", "Done"]);
		let calls = 0;
		const persist = async (_input: TaskCreateInput) => {
			calls += 1;
			throw new Error("Disk is read-only");
		};

		expect(await controller.create(persist)).toBeNull();
		expect(calls).toBe(0);
		expect(controller.error).toBe("Title is required.");

		controller.values.title = "Retry me";
		controller.values.description = "Keep this description";
		expect(await controller.create(persist)).toBeNull();
		expect(calls).toBe(1);
		expect(controller.error).toBe("Disk is read-only");
		expect(controller.values).toEqual({
			title: "Retry me",
			description: "Keep this description",
			status: "Review",
			type: "",
			priority: "",
		});
	});
});

describe("TUI task composer canonical persistence", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-tui-composer-"));
		core = new Core(testDir);
		await initializeTestProject(core, "TUI Composer Test");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	async function afterNextIdGenerated<T>(
		setup: (id: string) => Promise<void>,
		operation: () => Promise<T>,
	): Promise<T> {
		const generateNextId = core.generateNextId.bind(core);
		let didSetup = false;
		core.generateNextId = async (type, parent) => {
			const id = await generateNextId(type, parent);
			if (!didSetup) {
				didSetup = true;
				await setup(id);
			}
			return id;
		};

		try {
			return await operation();
		} finally {
			core.generateNextId = generateNextId;
		}
	}

	it("routes normal and explicitly selected Draft values through canonical creation", async () => {
		const normal = new TaskComposerController(["To Do", "Done"]);
		normal.values.title = "Normal task";
		const createdTask = await normal.create(async (input) => (await core.createTaskFromInput(input, false)).task);

		const draft = new TaskComposerController(["To Do", "Done"]);
		draft.values.title = "Draft task";
		draft.values.status = "Draft";
		const createdDraft = await draft.create(async (input) => (await core.createTaskFromInput(input, false)).task);

		expect(createdTask?.id).toBe("TASK-1");
		expect(await core.fs.loadTask("TASK-1")).not.toBeNull();
		expect(createdDraft?.id).toBe("DRAFT-1");
		expect(await core.fs.loadDraft("DRAFT-1")).not.toBeNull();
		expect(await core.fs.loadTask("DRAFT-1")).toBeNull();
	});

	it("rolls back a task when auto-commit fails and retries with the same ID", async () => {
		await initializeGitRepository(testDir);
		const addAndCommitTaskFile = core.gitOps.addAndCommitTaskFile.bind(core.gitOps);
		core.gitOps.addAndCommitTaskFile = async (_taskId, filePath, _action, onStaged) => {
			await core.gitOps.addFile(filePath);
			const stagedEntries = await core.gitOps.getIndexEntries(filePath);
			onStaged?.(stagedEntries);
			throw new Error("simulated auto-commit failed");
		};

		const controller = new TaskComposerController(["To Do", "Done"]);
		controller.values.title = "Retry without a duplicate";
		controller.values.description = "Preserve this value";
		const persist = async (input: TaskCreateInput) => (await core.createTaskFromInput(input, true)).task;

		try {
			expect(await controller.create(persist)).toBeNull();
			expect(controller.error).toContain("failed");
			expect(await core.fs.loadTask("TASK-1")).toBeNull();
			expect((await core.gitOps.getStatus()).trim()).toBe("");
			expect(controller.values.description).toBe("Preserve this value");
		} finally {
			core.gitOps.addAndCommitTaskFile = addAndCommitTaskFile;
		}

		const retried = await controller.create(persist);
		expect(retried?.id).toBe("TASK-1");
		expect(await core.fs.loadTask("TASK-2")).toBeNull();
		expect((await core.gitOps.getStatus()).trim()).toBe("");
	});

	it("never deletes or unstages a later edit while a failing hook is running", async () => {
		await initializeGitRepository(testDir);
		const markerPath = join(testDir, "hook-started");
		await installFailingHook(testDir, `echo attempt >> "${markerPath}"\nsleep 0.4\nexit 1`);

		const creation = core.createTaskFromInput({ title: "Slow failing create" }, true);
		for (let attempt = 0; attempt < 100 && !(await Bun.file(markerPath).exists()); attempt += 1) {
			await Bun.sleep(10);
		}
		expect(await Bun.file(markerPath).exists()).toBe(true);
		const created = await core.fs.loadTask("TASK-1");
		expect(created?.filePath).toBeDefined();
		const laterContent = "Later user edit must survive.\n";
		await writeFile(created?.filePath as string, laterContent);

		await expect(creation).rejects.toThrow();
		expect(await readFile(created?.filePath as string, "utf8")).toBe(laterContent);
		expect((await $`git diff --cached --name-only`.cwd(testDir).text()).trim()).toBe("");
		expect((await readFile(markerPath, "utf8")).trim().split("\n")).toHaveLength(1);
	});

	it("preserves hook-modified task bytes and explains the recovery state", async () => {
		await initializeGitRepository(testDir);
		await installFailingHook(
			testDir,
			'for file in backlog/tasks/*.md; do printf "\\nHook edit must survive.\\n" >> "$file"; done\nexit 1',
		);

		const creation = core.createTaskFromInput({ title: "Hook modified" }, true);
		await expect(creation).rejects.toThrow("TASK-1 remains in use");

		const created = await core.fs.loadTask("TASK-1");
		expect(created?.filePath).toBeDefined();
		expect(await readFile(created?.filePath as string, "utf8")).toContain("Hook edit must survive.");
		expect((await $`git diff --cached --name-only`.cwd(testDir).text()).trim()).toBe("");
		expect((await $`git status --short -- ${created?.filePath as string}`.cwd(testDir).text()).trim()).toStartWith(
			"?? ",
		);

		const next = await core.createTaskFromInput({ title: "Next task" }, false);
		expect(next.task.id).toBe("TASK-2");
	});

	it("preserves both file and staged state when same-path index ownership is lost", async () => {
		await initializeGitRepository(testDir);
		const originalCommitFiles = core.gitOps.commitFiles.bind(core.gitOps);
		let createdContent = "";
		core.gitOps.commitFiles = async (_message, paths) => {
			const filePath = paths[0] as string;
			createdContent = await readFile(filePath, "utf8");
			await writeFile(filePath, `${createdContent}\nConcurrent staged edit must survive.\n`);
			await $`git add ${filePath}`.cwd(testDir).quiet();
			await writeFile(filePath, createdContent);
			throw new Error("simulated commit failure after concurrent staging");
		};

		try {
			let error: Error | undefined;
			try {
				await core.createTaskFromInput({ title: "Lost index ownership" }, true);
			} catch (caught) {
				error = caught instanceof Error ? caught : new Error(String(caught));
			}
			const created = await core.fs.loadTask("TASK-1");
			if (!created?.filePath) throw new Error("Expected TASK-1 to remain on disk");

			expect(error?.message).toContain(created.filePath);
			expect(error?.message).toContain("TASK-1 remains in use");
			expect(error?.message).toContain("manual Git review is required");
			expect(await readFile(created.filePath, "utf8")).toBe(createdContent);
			const relativeCreatedPath = created.filePath.slice(testDir.length + 1).replaceAll("\\", "/");
			expect(await $`git show :${relativeCreatedPath}`.cwd(testDir).text()).toContain(
				"Concurrent staged edit must survive.",
			);
			expect((await $`git status --short -- ${created.filePath}`.cwd(testDir).text()).trim()).toStartWith("AM ");

			const next = await core.createTaskFromInput({ title: "Next task" }, false);
			expect(next.task.id).toBe("TASK-2");
		} finally {
			core.gitOps.commitFiles = originalCommitFiles;
		}
	});

	it("commits the owned staged blob when the worktree changes before commit", async () => {
		await initializeGitRepository(testDir);
		const originalCommitFiles = core.gitOps.commitFiles.bind(core.gitOps);
		core.gitOps.commitFiles = async (message, paths, repoRoot) => {
			await appendFile(paths[0] as string, "\nLater worktree edit must not be committed.\n");
			await originalCommitFiles(message, paths, repoRoot);
		};

		try {
			const result = await core.createTaskFromInput({ title: "Staged ownership" }, true);
			const relativeCreatedPath = (result.filePath as string).slice(testDir.length + 1).replaceAll("\\", "/");
			const committedContent = await $`git show HEAD:${relativeCreatedPath}`.cwd(testDir).text();
			expect(committedContent).not.toContain("Later worktree edit must not be committed.");
			expect(await readFile(result.filePath as string, "utf8")).toContain("Later worktree edit must not be committed.");
			expect((await $`git diff --name-only`.cwd(testDir).text()).trim().replaceAll("\\", "/")).toBe(
				relativeCreatedPath,
			);
		} finally {
			core.gitOps.commitFiles = originalCommitFiles;
		}
	});

	it("preserves commit.gpgSign for selected-path auto-commits", async () => {
		await initializeGitRepository(testDir);
		const signingKeyPath = join(testDir, "test-signing-key");
		const keygen = Bun.spawn(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", signingKeyPath], {
			cwd: testDir,
			stdout: "ignore",
			stderr: "pipe",
		});
		const stderrPromise = new Response(keygen.stderr).text();
		const [exitCode, stderr] = await Promise.all([keygen.exited, stderrPromise]);
		if (exitCode !== 0) {
			throw new Error(`ssh-keygen failed with exit code ${exitCode}: ${stderr}`);
		}
		await $`git config gpg.format ssh`.cwd(testDir).quiet();
		await $`git config user.signingKey ${signingKeyPath}`.cwd(testDir).quiet();
		await $`git config commit.gpgSign true`.cwd(testDir).quiet();

		const result = await core.createTaskFromInput({ title: "Signed task" }, true);
		const relativeCreatedPath = (result.filePath as string).slice(testDir.length + 1).replaceAll("\\", "/");
		const rawCommit = await $`git cat-file commit HEAD`.cwd(testDir).text();

		expect(rawCommit).toContain("gpgsig -----BEGIN SSH SIGNATURE-----");
		expect((await $`git show HEAD:${relativeCreatedPath}`.cwd(testDir).text()).length).toBeGreaterThan(0);
	});

	it("runs commit hooks once on Git versions before git hook run existed", async () => {
		await initializeGitRepository(testDir);
		const hooksDir = join(testDir, ".custom-hooks");
		const markerPath = join(testDir, "legacy-hook-ran");
		await $`git config core.hooksPath .custom-hooks`.cwd(testDir).quiet();
		await installHook(
			testDir,
			"pre-commit",
			`test -d backlog/tasks || exit 9\nprintf '%s\\n' "$GIT_INDEX_FILE" "$GIT_EDITOR" >> "${markerPath}"`,
			hooksDir,
		);

		const git = core.gitOps as unknown as {
			execGit: (
				args: string[],
				options?: {
					readOnly?: boolean;
					cwd?: string;
					input?: string;
					env?: Record<string, string>;
					acceptedExitCodes?: readonly number[];
				},
			) => Promise<{ stdout: string; stderr: string }>;
		};
		const originalExecGit = git.execGit.bind(core.gitOps);
		let hookRunCalls = 0;
		git.execGit = async (args, options) => {
			if (args[0] === "version") return { stdout: "git version 2.35.8\n", stderr: "" };
			if (args[0] === "hook") {
				hookRunCalls += 1;
				throw new Error("git hook must not run on Git 2.35");
			}
			return originalExecGit(args, options);
		};

		try {
			await core.createTaskFromInput({ title: "Legacy hook runner" }, true);
			const marker = (await readFile(markerPath, "utf8")).trim().split("\n");
			expect(hookRunCalls).toBe(0);
			expect(marker[0]).toContain("backlog-git-commit-");
			expect(marker[1]).toBe(":");
		} finally {
			git.execGit = originalExecGit;
		}
	});

	it("rebuilds the selected commit on a concurrently advanced HEAD", async () => {
		await initializeGitRepository(testDir);
		const git = core.gitOps as unknown as {
			execGit: (
				args: string[],
				options?: { readOnly?: boolean; cwd?: string; input?: string; env?: Record<string, string> },
			) => Promise<{ stdout: string; stderr: string }>;
		};
		const originalExecGit = git.execGit.bind(core.gitOps);
		let advanced = false;
		git.execGit = async (args, options) => {
			if (args[0] === "update-ref" && !advanced) {
				advanced = true;
				await writeFile(join(testDir, "concurrent.txt"), "Concurrent HEAD content.\n");
				await $`git add concurrent.txt`.cwd(testDir).quiet();
				await $`git commit --only -m "concurrent commit" -- concurrent.txt`.cwd(testDir).quiet();
			}
			return originalExecGit(args, options);
		};

		try {
			const beforeCount = Number((await $`git rev-list --count HEAD`.cwd(testDir).text()).trim());
			const result = await core.createTaskFromInput({ title: "Concurrent head" }, true);
			const relativeCreatedPath = (result.filePath as string).slice(testDir.length + 1).replaceAll("\\", "/");

			expect(advanced).toBe(true);
			expect(await $`git show HEAD:concurrent.txt`.cwd(testDir).text()).toBe("Concurrent HEAD content.\n");
			expect((await $`git show HEAD:${relativeCreatedPath}`.cwd(testDir).text()).length).toBeGreaterThan(0);
			expect(Number((await $`git rev-list --count HEAD`.cwd(testDir).text()).trim())).toBe(beforeCount + 2);
			expect((await core.gitOps.getStatus()).trim()).toBe("");
		} finally {
			git.execGit = originalExecGit;
		}
	});

	it("refuses selected-path auto-commit without disturbing an in-progress merge", async () => {
		await initializeGitRepository(testDir);
		const mergeFile = join(testDir, "merge-state.txt");
		await writeFile(mergeFile, "base\n");
		await $`git add merge-state.txt`.cwd(testDir).quiet();
		await $`git commit -m "merge base"`.cwd(testDir).quiet();
		await $`git checkout -b merge-topic`.cwd(testDir).quiet();
		await writeFile(mergeFile, "topic\n");
		await $`git commit -am "topic change"`.cwd(testDir).quiet();
		await $`git checkout main`.cwd(testDir).quiet();
		await writeFile(mergeFile, "main\n");
		await $`git commit -am "main change"`.cwd(testDir).quiet();
		const merge = await $`git merge merge-topic`.cwd(testDir).nothrow().quiet();
		expect(merge.exitCode).not.toBe(0);

		const headBefore = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();
		const mergeHeadBefore = (await $`git rev-parse MERGE_HEAD`.cwd(testDir).text()).trim();
		const mergeIndexBefore = await $`git ls-files -u -- merge-state.txt`.cwd(testDir).text();

		await expect(core.createTaskFromInput({ title: "Blocked by merge" }, true)).rejects.toThrow(
			"Git merge is in progress",
		);

		expect((await $`git rev-parse HEAD`.cwd(testDir).text()).trim()).toBe(headBefore);
		expect((await $`git rev-parse MERGE_HEAD`.cwd(testDir).text()).trim()).toBe(mergeHeadBefore);
		expect(await $`git ls-files -u -- merge-state.txt`.cwd(testDir).text()).toBe(mergeIndexBefore);
		expect(await core.fs.loadTask("TASK-1")).toBeNull();
	});

	it("keeps hook-staged unrelated paths out while committing hook-staged task changes", async () => {
		await initializeGitRepository(testDir);
		await installFailingHook(
			testDir,
			'for file in backlog/tasks/*.md; do printf "\\nHook-owned task edit.\\n" >> "$file"; git add "$file"; done\nprintf "Unrelated hook bytes.\\n" > hook-unrelated.txt\ngit add hook-unrelated.txt\nexit 0',
		);

		const result = await core.createTaskFromInput({ title: "Constrained hook" }, true);
		const relativeCreatedPath = (result.filePath as string).slice(testDir.length + 1).replaceAll("\\", "/");
		const committedTask = await $`git show HEAD:${relativeCreatedPath}`.cwd(testDir).text();
		const unrelatedLookup = await $`git cat-file -e HEAD:hook-unrelated.txt`.cwd(testDir).nothrow().quiet();

		expect(committedTask).toContain("Hook-owned task edit.");
		expect(unrelatedLookup.exitCode).not.toBe(0);
		expect(await readFile(join(testDir, "hook-unrelated.txt"), "utf8")).toBe("Unrelated hook bytes.\n");
		expect((await $`git diff --cached --name-only`.cwd(testDir).text()).trim()).toBe("");
		expect((await $`git status --short hook-unrelated.txt`.cwd(testDir).text()).trim()).toBe("?? hook-unrelated.txt");
	});

	it("freezes selected task bytes before message hooks", async () => {
		await initializeGitRepository(testDir);
		await installHook(
			testDir,
			"pre-commit",
			'for file in backlog/tasks/*.md; do printf "\\nPre-commit bytes.\\n" >> "$file"; git add "$file"; done',
		);
		await installHook(
			testDir,
			"prepare-commit-msg",
			'for file in backlog/tasks/*.md; do printf "\\nPrepare-message bytes.\\n" >> "$file"; git add "$file"; done',
		);
		await installHook(
			testDir,
			"commit-msg",
			'for file in backlog/tasks/*.md; do printf "\\nCommit-message bytes.\\n" >> "$file"; git add "$file"; done',
		);

		const result = await core.createTaskFromInput({ title: "Hook phase boundary" }, true);
		const relativeCreatedPath = (result.filePath as string).slice(testDir.length + 1).replaceAll("\\", "/");
		const committedTask = await $`git show HEAD:${relativeCreatedPath}`.cwd(testDir).text();
		const worktreeTask = await readFile(result.filePath as string, "utf8");

		expect(committedTask).toContain("Pre-commit bytes.");
		expect(committedTask).not.toContain("Prepare-message bytes.");
		expect(committedTask).not.toContain("Commit-message bytes.");
		expect(worktreeTask).toContain("Prepare-message bytes.");
		expect(worktreeTask).toContain("Commit-message bytes.");
		expect((await $`git diff --name-only -- ${relativeCreatedPath}`.cwd(testDir).text()).trim()).toBe(
			relativeCreatedPath,
		);
	});

	it("runs post-commit hooks against the real index", async () => {
		await initializeGitRepository(testDir);
		const unrelatedPath = join(testDir, "unrelated.txt");
		const postCommitPath = join(testDir, "post-commit-index.txt");
		await writeFile(unrelatedPath, "baseline\n");
		await $`git add unrelated.txt`.cwd(testDir).quiet();
		await $`git commit -m "unrelated baseline"`.cwd(testDir).quiet();
		await writeFile(unrelatedPath, "staged user bytes\n");
		await $`git add unrelated.txt`.cwd(testDir).quiet();
		await installHook(
			testDir,
			"post-commit",
			`if git diff --cached --quiet -- unrelated.txt; then printf "missing\\n" > "${postCommitPath}"; else printf "visible\\n" > "${postCommitPath}"; fi\ngit add "${postCommitPath}"`,
		);

		await core.createTaskFromInput({ title: "Real post-commit index" }, true);

		expect(await readFile(postCommitPath, "utf8")).toBe("visible\n");
		expect(await $`git show :unrelated.txt`.cwd(testDir).text()).toBe("staged user bytes\n");
		expect(await $`git show :post-commit-index.txt`.cwd(testDir).text()).toBe("visible\n");
		const committedPostFile = await $`git cat-file -e HEAD:post-commit-index.txt`.cwd(testDir).nothrow().quiet();
		expect(committedPostFile.exitCode).not.toBe(0);
	});

	for (const status of ["To Do", "Draft"] as const) {
		it(`compensates a ${status === "Draft" ? "draft" : "task"} safely when index reconciliation prevents the commit`, async () => {
			await initializeGitRepository(testDir);
			const originalRestore = core.gitOps.restoreIndexEntriesIfMatches.bind(core.gitOps);
			const commitAttempts = status === "Draft" ? 1 : 3;
			let calls = 0;
			core.gitOps.restoreIndexEntriesIfMatches = async (...args) => {
				calls += 1;
				if (calls <= commitAttempts) throw new Error("simulated index reconciliation failure");
				return originalRestore(...args);
			};
			const beforeHead = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();

			try {
				await expect(core.createTaskFromInput({ title: "Reconcile safely", status }, true)).rejects.toThrow(
					"index reconciliation failure",
				);
				expect((await $`git rev-parse HEAD`.cwd(testDir).text()).trim()).toBe(beforeHead);
				expect(status === "Draft" ? await core.fs.loadDraft("DRAFT-1") : await core.fs.loadTask("TASK-1")).toBeNull();
				expect((await core.gitOps.getStatus()).trim()).toBe("");
			} finally {
				core.gitOps.restoreIndexEntriesIfMatches = originalRestore;
			}
		});
	}

	for (const status of ["To Do", "Draft"] as const) {
		it(`does not publish a ${status === "Draft" ? "draft" : "task"} when pre-write index inspection fails`, async () => {
			await initializeGitRepository(testDir);
			const originalGetIndexEntries = core.gitOps.getIndexEntries.bind(core.gitOps);
			let calls = 0;
			core.gitOps.getIndexEntries = async () => {
				calls += 1;
				throw new Error("simulated index inspection failure");
			};

			try {
				await expect(core.createTaskFromInput({ title: "Index inspection", status }, true)).rejects.toThrow(
					"index inspection failure",
				);
				expect(calls).toBe(1);
				expect(status === "Draft" ? await core.fs.loadDraft("DRAFT-1") : await core.fs.loadTask("TASK-1")).toBeNull();
				expect((await core.gitOps.getStatus()).trim()).toBe("");
			} finally {
				core.gitOps.getIndexEntries = originalGetIndexEntries;
			}
		});
	}

	for (const status of ["To Do", "Draft"] as const) {
		it(`does not retain a staged phantom when a ${status === "Draft" ? "draft" : "task"} is staged immediately after publication`, async () => {
			await initializeGitRepository(testDir);
			await installFailingHook(
				testDir,
				'for file in backlog/tasks/*.md backlog/drafts/*.md; do test -e "$file" && rm "$file"; done\nexit 1',
			);
			const save = status === "Draft" ? core.fs.saveDraft.bind(core.fs) : core.fs.saveTask.bind(core.fs);
			const method = status === "Draft" ? "saveDraft" : "saveTask";
			core.fs[method] = async (task) => {
				const filePath = await save(task);
				await core.gitOps.addFile(filePath);
				return filePath;
			};

			try {
				await expect(core.createTaskFromInput({ title: "Snapshot race", status }, true)).rejects.toThrow();
				expect(status === "Draft" ? await core.fs.loadDraft("DRAFT-1") : await core.fs.loadTask("TASK-1")).toBeNull();
				expect((await $`git diff --cached --name-only`.cwd(testDir).text()).trim()).toBe("");
				expect((await core.gitOps.getStatus()).trim()).toBe("");

				await rm(join(testDir, ".git", "hooks", "pre-commit"));
				const retry = await core.createTaskFromInput({ title: "Snapshot retry", status }, false);
				expect(retry.task.id).toBe(status === "Draft" ? "DRAFT-1" : "TASK-1");
			} finally {
				core.fs[method] = save;
			}
		});
	}

	it("does not inspect Git index ownership when auto-commit is disabled", async () => {
		let calls = 0;
		const originalGetIndexEntries = core.gitOps.getIndexEntries.bind(core.gitOps);
		core.gitOps.getIndexEntries = async () => {
			calls += 1;
			throw new Error("index inspection must not run");
		};

		try {
			const result = await core.createTaskFromInput({ title: "Filesystem-only create" }, false);
			expect(result.task.id).toBe("TASK-1");
			expect(calls).toBe(0);
			expect(await core.fs.loadTask("TASK-1")).not.toBeNull();
		} finally {
			core.gitOps.getIndexEntries = originalGetIndexEntries;
		}
	});

	it("restores pre-existing bytes when a failed create temporarily reuses their path", async () => {
		await initializeGitRepository(testDir);
		const preExistingPath = join(testDir, "backlog", "tasks", "task-1 - Preexisting.md");
		const preExistingContent = "This is not a parseable task and must be restored.\n";

		await afterNextIdGenerated(
			async (id) => {
				expect(id).toBe("TASK-1");
				await writeFile(preExistingPath, preExistingContent);
				await installFailingHook(testDir);
			},
			async () => await expect(core.createTaskFromInput({ title: "Preexisting" }, true)).rejects.toThrow(),
		);

		expect(await readFile(preExistingPath, "utf8")).toBe(preExistingContent);
		expect((await $`git diff --cached --name-only`.cwd(testDir).text()).trim()).toBe("");
	});

	for (const status of ["To Do", "Draft"] as const) {
		it(`restores prior same-path index and worktree bytes after failed ${status === "Draft" ? "draft" : "task"} creation`, async () => {
			await initializeGitRepository(testDir);
			const title = status === "Draft" ? "Preexisting Draft" : "Preexisting Task";
			const relativePath = `backlog/${status === "Draft" ? "drafts/draft" : "tasks/task"}-1 - ${title.replaceAll(" ", "-")}.md`;
			const targetPath = join(testDir, relativePath);
			const baselineContent = "HEAD baseline bytes.\n";
			const stagedContent = "Prior staged user bytes.\n";
			const worktreeContent = "Prior unstaged user bytes.\n";
			await afterNextIdGenerated(
				async (id) => {
					expect(id).toBe(status === "Draft" ? "DRAFT-1" : "TASK-1");
					await writeFile(targetPath, baselineContent);
					await $`git add ${relativePath}`.cwd(testDir).quiet();
					await $`git commit -m "add prior target"`.cwd(testDir).quiet();
					await writeFile(targetPath, stagedContent);
					await $`git add ${relativePath}`.cwd(testDir).quiet();
					await writeFile(targetPath, worktreeContent);
					await installFailingHook(testDir);
				},
				async () => await expect(core.createTaskFromInput({ title, status }, true)).rejects.toThrow(),
			);

			expect(await readFile(targetPath, "utf8")).toBe(worktreeContent);
			expect(await $`git show :${relativePath}`.cwd(testDir).text()).toBe(stagedContent);
			expect(await $`git show HEAD:${relativePath}`.cwd(testDir).text()).toBe(baselineContent);
			expect((await $`git diff --cached --name-only`.cwd(testDir).text()).trim()).toBe(relativePath);
			expect((await $`git diff --name-only`.cwd(testDir).text()).trim()).toBe(relativePath);
		});

		it(`restores prior same-path bytes when a failing hook deletes the generated ${status === "Draft" ? "draft" : "task"}`, async () => {
			await initializeGitRepository(testDir);
			const title = status === "Draft" ? "Deleted Draft" : "Deleted Task";
			const relativePath = `backlog/${status === "Draft" ? "drafts/draft" : "tasks/task"}-1 - ${title.replaceAll(" ", "-")}.md`;
			const targetPath = join(testDir, relativePath);
			const baselineContent = "HEAD baseline bytes.\n";
			const stagedContent = "Prior staged user bytes.\n";
			const worktreeContent = "Prior unstaged user bytes.\n";
			await afterNextIdGenerated(
				async (id) => {
					expect(id).toBe(status === "Draft" ? "DRAFT-1" : "TASK-1");
					await writeFile(targetPath, baselineContent);
					await $`git add ${relativePath}`.cwd(testDir).quiet();
					await $`git commit -m "add prior target"`.cwd(testDir).quiet();
					await writeFile(targetPath, stagedContent);
					await $`git add ${relativePath}`.cwd(testDir).quiet();
					await writeFile(targetPath, worktreeContent);
					await installFailingHook(testDir, `rm "${targetPath}"\nexit 1`);
				},
				async () => await expect(core.createTaskFromInput({ title, status }, true)).rejects.toThrow(),
			);

			expect(await readFile(targetPath, "utf8")).toBe(worktreeContent);
			expect(await $`git show :${relativePath}`.cwd(testDir).text()).toBe(stagedContent);
			expect(await $`git show HEAD:${relativePath}`.cwd(testDir).text()).toBe(baselineContent);
			expect((await $`git diff --cached --name-only`.cwd(testDir).text()).trim()).toBe(relativePath);
			expect((await $`git diff --name-only`.cwd(testDir).text()).trim()).toBe(relativePath);
		});

		it(`auto-commits only the created ${status === "Draft" ? "draft" : "task"} and preserves unrelated staged work`, async () => {
			await initializeGitRepository(testDir);
			const unrelatedPath = join(testDir, "unrelated.txt");
			await writeFile(unrelatedPath, "baseline\n");
			await $`git add unrelated.txt`.cwd(testDir).quiet();
			await $`git commit -m "add unrelated baseline"`.cwd(testDir).quiet();
			await writeFile(unrelatedPath, "staged user work\n");
			await $`git add unrelated.txt`.cwd(testDir).quiet();

			const result = await core.createTaskFromInput({ title: `Created ${status}`, status }, true);

			expect(await readFile(unrelatedPath, "utf8")).toBe("staged user work\n");
			expect(await $`git show :unrelated.txt`.cwd(testDir).text()).toBe("staged user work\n");
			expect(await $`git show HEAD:unrelated.txt`.cwd(testDir).text()).toBe("baseline\n");
			const relativeCreatedPath = (result.filePath as string).slice(testDir.length + 1).replaceAll("\\", "/");
			expect((await $`git show HEAD:${relativeCreatedPath}`.cwd(testDir).text()).length).toBeGreaterThan(0);
		});

		it(`preserves unrelated staged work when ${status === "Draft" ? "draft" : "task"} auto-commit fails`, async () => {
			await initializeGitRepository(testDir);
			const unrelatedPath = join(testDir, "unrelated.txt");
			await writeFile(unrelatedPath, "baseline\n");
			await $`git add unrelated.txt`.cwd(testDir).quiet();
			await $`git commit -m "add unrelated baseline"`.cwd(testDir).quiet();
			await writeFile(unrelatedPath, "staged user work\n");
			await $`git add unrelated.txt`.cwd(testDir).quiet();
			await installFailingHook(testDir);

			await expect(core.createTaskFromInput({ title: `Failed ${status}`, status }, true)).rejects.toThrow();

			expect(await readFile(unrelatedPath, "utf8")).toBe("staged user work\n");
			expect(await $`git show :unrelated.txt`.cwd(testDir).text()).toBe("staged user work\n");
			expect(await $`git show HEAD:unrelated.txt`.cwd(testDir).text()).toBe("baseline\n");
			const stagedNames = await $`git diff --cached --name-only`.cwd(testDir).text();
			expect(stagedNames.trim()).toBe("unrelated.txt");
		});
	}

	it("retries a transient path-limited task commit without disturbing the index", async () => {
		await initializeGitRepository(testDir);
		const counterPath = join(testDir, ".git", "transient-hook-seen");
		await installFailingHook(
			testDir,
			`if [ ! -f "${counterPath}" ]; then\n  : > "${counterPath}"\n  exit 1\nfi\nexit 0`,
		);
		const beforeCount = Number((await $`git rev-list --count HEAD`.cwd(testDir).text()).trim());

		const result = await core.createTaskFromInput({ title: "Transient retry" }, true);

		expect(result.task.id).toBe("TASK-1");
		expect(Number((await $`git rev-list --count HEAD`.cwd(testDir).text()).trim())).toBe(beforeCount + 1);
		expect((await core.gitOps.getStatus()).trim()).toBe("");
	});

	it("keeps watcher delivery idempotent with the board optimistic upsert", async () => {
		let resolveAdded!: (created: Task) => void;
		const added = new Promise<Task>((resolve) => {
			resolveAdded = resolve;
		});
		const watcher = watchTasks(core, { onTaskAdded: resolveAdded }, []);
		try {
			const controller = new TaskComposerController(["To Do", "Done"]);
			controller.values.title = "Watched task";
			const created = await controller.create(async (input) => (await core.createTaskFromInput(input, false)).task);
			expect(created).not.toBeNull();

			const optimistic = upsertBoardTask([], created as Task);
			const watched = await withTimeout(added, "TUI composer watcher delivery", 3000);
			const reconciled = upsertBoardTask(optimistic, watched);
			expect(reconciled.map((candidate) => candidate.id)).toEqual(["TASK-1"]);
		} finally {
			watcher.stop();
		}
	});
});

describe("TUI task composer interaction", () => {
	it("opens the actual composer and Cancel performs no write", async () => {
		const screen = createScreen({ smartCSR: false });
		let writes = 0;
		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async () => {
					writes += 1;
					return task();
				},
			});
			await new Promise<void>((resolve) => setImmediate(resolve));
			const descendants: Array<{ content?: string; children?: unknown[]; emit?: (event: string) => void }> = [];
			const visit = (node: { children?: unknown[] }) => {
				descendants.push(node);
				for (const child of node.children ?? []) visit(child as { children?: unknown[] });
			};
			visit(screen as unknown as { children?: unknown[] });
			const cancel = descendants.find((node) => node.content === "Cancel");
			expect(cancel).toBeDefined();
			cancel?.emit?.("key enter");

			expect(await withTimeout(resultPromise, "composer cancel", 1000)).toBeNull();
			expect(writes).toBe(0);
		} finally {
			screen.destroy();
		}
	});

	it("uses spatial arrows across every control while Tab remains inert", async () => {
		const screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
		const originalRender = screen.render.bind(screen);
		let renders = 0;
		screen.render = () => {
			renders += 1;
			originalRender();
		};
		const eventScreen = screen as unknown as { focused?: TestWidget; emit(event: string): void };
		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async () => task(),
			});
			await settleComposerFocus();

			expect(eventScreen.focused?.options?.label).toBe(" Title ");
			pressKey(eventScreen.focused, "tab", "\t");
			expect(eventScreen.focused?.options?.label).toBe(" Title ");
			expect(eventScreen.focused?.getValue?.()).toBe("");
			pressKey(eventScreen.focused, "S-tab", "\t");
			expect(eventScreen.focused?.options?.label).toBe(" Title ");
			expect(eventScreen.focused?.getValue?.()).toBe("");

			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.options?.label).toBe(" Description ");
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.content).toBe("Status: To Do ▼");
			expect(eventScreen.focused?.style).toMatchObject({ inverse: true, bold: true });
			pressKey(eventScreen.focused, "right");
			expect(eventScreen.focused?.content).toBe("Type: None ▼");
			pressKey(eventScreen.focused, "right");
			expect(eventScreen.focused?.content).toBe("Priority: None ▼");
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.content).toBe("Cancel");
			pressKey(eventScreen.focused, "left");
			expect(eventScreen.focused?.content).toBe("Create task");
			pressKey(eventScreen.focused, "tab", "\t");
			expect(eventScreen.focused?.content).toBe("Create task");

			pressKey(eventScreen.focused, "escape", "\x1b");
			expect(await withTimeout(resultPromise, "Esc from composer action", 1000)).toBeNull();
			renders = 0;
			eventScreen.emit("resize");
			expect(renders).toBe(0);
		} finally {
			screen.destroy();
		}
	});

	it("adapts the spatial focus graph to the narrow two-row selector layout", async () => {
		const screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 50, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 18, writable: true });
		const eventScreen = screen as unknown as { focused?: TestWidget };
		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async () => task(),
			});
			await settleComposerFocus();
			pressKey(eventScreen.focused, "down");
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.content).toBe("Status: To Do ▼");
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.content).toBe("Type: None ▼");
			pressKey(eventScreen.focused, "right");
			expect(eventScreen.focused?.content).toBe("Priority: None ▼");
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.content).toBe("Cancel");
			pressKey(eventScreen.focused, "left");
			expect(eventScreen.focused?.content).toBe("Create task");
			pressKey(eventScreen.focused, "escape", "\x1b");
			expect(await withTimeout(resultPromise, "narrow composer cancellation", 1000)).toBeNull();
		} finally {
			screen.destroy();
		}
	});

	it("preserves title caret editing and multiline description arrows", async () => {
		const screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
		const eventScreen = screen as unknown as { focused?: TestWidget };
		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async () => task(),
			});
			await settleComposerFocus();

			typeText(eventScreen.focused, "abc");
			pressKey(eventScreen.focused, "left");
			typeText(eventScreen.focused, "X");
			expect(eventScreen.focused?.getValue?.()).toBe("abXc");
			expect(eventScreen.focused?.options?.label).toBe(" Title ");

			pressKey(eventScreen.focused, "down");
			await settleComposerFocus();
			typeText(eventScreen.focused, "first");
			pressKey(eventScreen.focused, "enter", "\r");
			typeText(eventScreen.focused, "second");
			pressKey(eventScreen.focused, "up");
			expect(eventScreen.focused?.options?.label).toBe(" Description ");
			expect(eventScreen.focused?.getCursor?.().y).toBe(-1);
			pressKey(eventScreen.focused, "up");
			expect(eventScreen.focused?.options?.label).toBe(" Title ");

			pressKey(eventScreen.focused, "down");
			await settleComposerFocus();
			expect(eventScreen.focused?.getCursor?.().y).toBe(-1);
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.options?.label).toBe(" Description ");
			expect(eventScreen.focused?.getCursor?.().y).toBe(0);
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.content).toBe("Status: To Do ▼");

			pressKey(eventScreen.focused, "escape", "\x1b");
			expect(await withTimeout(resultPromise, "composer text navigation cancellation", 1000)).toBeNull();
		} finally {
			screen.destroy();
		}
	});

	it("opens selectors with Enter and restores focus after selection", async () => {
		const screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
		const eventScreen = screen as unknown as { focused?: TestWidget };
		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				types: ["Bug", "Feature"],
				priorities: ["High", "Low"],
				persist: async () => task(),
			});
			await settleComposerFocus();
			pressKey(eventScreen.focused, "down");
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.content).toBe("Status: To Do ▼");

			pressKey(eventScreen.focused, "enter", "\r");
			await settleComposerFocus();
			expect(eventScreen.focused?.items?.map((item) => item.content)).toEqual(["Draft", "To Do", "Done"]);
			pressKey(eventScreen.focused, "up");
			pressKey(eventScreen.focused, "enter", "\r");
			await settleComposerFocus();
			expect(eventScreen.focused?.content).toBe("Status: Draft ▼");
			expect(eventScreen.focused?.style).toMatchObject({ inverse: true, bold: true });

			pressKey(eventScreen.focused, "escape", "\x1b");
			expect(await withTimeout(resultPromise, "composer selector cancellation", 1000)).toBeNull();
		} finally {
			screen.destroy();
		}
	});

	it("keeps invalid values for correction and creates explicitly", async () => {
		const screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
		const eventScreen = screen as unknown as { focused?: TestWidget };
		const persisted: TaskCreateInput[] = [];
		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async (input) => {
					persisted.push(input);
					return task({ title: input.title });
				},
			});
			await settleComposerFocus();
			pressKey(eventScreen.focused, "down");
			pressKey(eventScreen.focused, "down");
			pressKey(eventScreen.focused, "down");
			expect(eventScreen.focused?.content).toBe("Create task");
			pressKey(eventScreen.focused, "enter", "\r");
			await waitUntil(() => eventScreen.focused?.options?.label === " Title ", "invalid title focus");
			expect(persisted).toHaveLength(0);
			expect(
				collectWidgets(screen as unknown as { children?: unknown[] }).some((widget) =>
					widget.content?.includes("Title is required."),
				),
			).toBe(true);

			eventScreen.focused?.setValue?.("Corrected task");
			pressKey(eventScreen.focused, "down");
			await settleComposerFocus();
			eventScreen.focused?.setValue?.("Kept description");
			pressKey(eventScreen.focused, "down");
			pressKey(eventScreen.focused, "down");
			pressKey(eventScreen.focused, "enter", "\r");

			const created = await withTimeout(resultPromise, "explicit task creation", 1000);
			expect(created?.title).toBe("Corrected task");
			expect(persisted).toEqual([
				{
					title: "Corrected task",
					description: "Kept description",
					status: "To Do",
				},
			]);
		} finally {
			screen.destroy();
		}
	});

	it("reflows an open composer between full and compact terminal sizes", async () => {
		const screen = createScreen({ smartCSR: false });
		const mutableScreen = screen as unknown as { width: number; height: number; emit(event: string): void };
		Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async () => task(),
			});
			await settleComposerFocus();
			let widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			let description = widgets.find((widget) => widget.options?.label === " Description ");
			let details = widgets.find((widget) => widget.options?.label === " Details ");
			let actions = widgets.find((widget) => widget.content === "Actions");
			let status = widgets.find((widget) => widget.content === "Status: To Do ▼");
			let type = widgets.find((widget) => widget.content === "Type: None ▼");
			expect(description?.position).toMatchObject({ top: 3, height: 6 });
			expect(details?.position).toMatchObject({ top: 9, height: 3 });
			expect(actions?.position).toMatchObject({ top: 12, height: 1 });
			expect(actions?.hidden).toBe(false);
			expect(status?.position).toMatchObject({ top: 0, left: 1 });
			expect(type?.position).toMatchObject({ top: 0, left: "34%" });
			expect(widgets.some((widget) => widget.content?.includes("[↑↓/←→]"))).toBe(true);

			mutableScreen.width = 50;
			mutableScreen.height = 18;
			mutableScreen.emit("resize");
			widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			description = widgets.find((widget) => widget.options?.label === " Description ");
			details = widgets.find((widget) => widget.options?.label === " Details ");
			actions = widgets.find((widget) => widget.content === "Actions");
			status = widgets.find((widget) => widget.content === "Status: To Do ▼");
			type = widgets.find((widget) => widget.content === "Type: None ▼");
			expect(description?.position).toMatchObject({ top: 3, height: 3 });
			expect(details?.position).toMatchObject({ top: 6, height: 4 });
			expect(actions?.position).toMatchObject({ top: 10, height: 1 });
			expect(actions?.hidden).toBe(true);
			expect(status?.position).toMatchObject({ top: 0, left: 1 });
			expect(type?.position).toMatchObject({ top: 1, left: 1, width: "48%" });
			expect(widgets.some((widget) => widget.content?.includes("[↑↓←→]"))).toBe(true);

			mutableScreen.width = 80;
			mutableScreen.height = 24;
			mutableScreen.emit("resize");
			widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			details = widgets.find((widget) => widget.options?.label === " Details ");
			type = widgets.find((widget) => widget.content === "Type: None ▼");
			expect(details?.position).toMatchObject({ top: 9, height: 3 });
			expect(type?.position).toMatchObject({ top: 0, left: "34%" });
			pressKey((screen as unknown as { focused?: TestWidget }).focused, "escape", "\x1b");
			expect(await withTimeout(resultPromise, "resized composer cancellation", 1000)).toBeNull();
		} finally {
			screen.destroy();
		}
	});

	it("opens the actual composer on an empty board and renders and focuses once after first-task creation", async () => {
		const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
		const screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
		const originalRender = screen.render.bind(screen);
		let renders = 0;
		screen.render = () => {
			renders += 1;
			originalRender();
		};
		let resolveCreate!: (created: Task) => void;
		const createResult = new Promise<Task>((resolve) => {
			resolveCreate = resolve;
		});
		try {
			const boardPromise = renderBoardTui([], ["To Do", "Done"], "horizontal", 20, {
				screen,
				createTask: async () => createResult,
			});
			(screen as unknown as { emit(event: string): void }).emit("key n");
			await waitUntil(
				() =>
					collectWidgets(screen as unknown as { children?: unknown[] }).some(
						(widget) => widget.content === "Create task",
					),
				"the real task composer",
			);
			await waitUntil(
				() => typeof (screen as unknown as { focused?: TestWidget }).focused?.setValue === "function",
				"the title field to receive focus",
			);
			const focused = (screen as unknown as { focused?: TestWidget }).focused;
			focused?.setValue?.("Actual composer task");
			pressKey((screen as unknown as { focused?: TestWidget }).focused, "down");
			pressKey((screen as unknown as { focused?: TestWidget }).focused, "down");
			pressKey((screen as unknown as { focused?: TestWidget }).focused, "down");
			const create = (screen as unknown as { focused?: TestWidget }).focused;
			expect(create?.content).toBe("Create task");
			pressKey(create, "enter", "\r");
			await new Promise<void>((resolve) => setImmediate(resolve));
			const rendersBeforeResolution = renders;
			resolveCreate(task({ id: "TASK-2", title: "Actual composer task" }));
			await waitUntil(() => {
				const boardFocus = (screen as unknown as { focused?: { items?: TestWidget[]; selected?: number } }).focused;
				return Boolean(boardFocus?.items?.[boardFocus.selected ?? 0]?.content?.includes("TASK-2"));
			}, "the created task to receive focus");
			expect(renders - rendersBeforeResolution).toBe(1);
			(screen as unknown as { emit(event: string): void }).emit("key q");
			await withTimeout(boardPromise, "board close after actual composer success", 1000);
		} finally {
			screen.destroy();
			if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
			else Reflect.deleteProperty(process.stdout, "isTTY");
		}
	});

	it("unwinds a rejected composer and applies future watcher updates", async () => {
		const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
		const screen = createScreen({ smartCSR: false });
		const initial = task({ title: "Existing" });
		const watched = task({ id: "TASK-2", title: "Watcher after rejection" });
		let subscriber: ((tasks: Task[], statuses: string[]) => void) | undefined;
		let composerCalls = 0;
		try {
			const boardPromise = renderBoardTui([initial], ["To Do", "Done"], "horizontal", 20, {
				screen,
				subscribeUpdates: (update) => {
					subscriber = update;
				},
				taskComposer: async () => {
					composerCalls += 1;
					if (composerCalls === 1) {
						subscriber?.([initial, watched], ["To Do", "Done"]);
						throw new Error("composer setup failed");
					}
					return null;
				},
			});
			(screen as unknown as { emit(event: string): void }).emit("key n");
			await waitUntil(() => composerCalls === 1, "the first composer rejection");
			await waitUntil(() => {
				const focused = (screen as unknown as { focused?: TestWidget }).focused;
				return Boolean(focused?.items?.some((item) => item.content?.includes("TASK-2")));
			}, "the queued watcher update");

			const later = task({ id: "TASK-3", title: "Future watcher update" });
			subscriber?.([initial, watched, later], ["To Do", "Done"]);
			await waitUntil(() => {
				const focused = (screen as unknown as { focused?: TestWidget }).focused;
				return Boolean(focused?.items?.some((item) => item.content?.includes("TASK-3")));
			}, "a future watcher update after rejection");
			(screen as unknown as { emit(event: string): void }).emit("key n");
			await waitUntil(() => composerCalls === 2, "the composer to reopen after rejection");
			(screen as unknown as { emit(event: string): void }).emit("key q");
			await withTimeout(boardPromise, "board close after composer rejection", 1000);
		} finally {
			screen.destroy();
			if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
			else Reflect.deleteProperty(process.stdout, "isTTY");
		}
	});

	for (const delivery of [
		"before persistence resolves",
		"before the composer closes",
		"after board success",
	] as const) {
		it(`handles watcher delivery ${delivery} with one board render and focused creation`, async () => {
			const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
			Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
			const screen = createScreen({ smartCSR: false });
			const originalRender = screen.render.bind(screen);
			let renders = 0;
			screen.render = () => {
				renders += 1;
				originalRender();
			};

			const initial = task({ id: "TASK-1", title: "Existing" });
			const created = task({ id: "TASK-2", title: "Created from N" });
			let subscriber: ((tasks: Task[], statuses: string[]) => void) | undefined;
			let composerCalls = 0;
			try {
				const boardPromise = renderBoardTui([initial], ["To Do", "Done"], "horizontal", 20, {
					screen,
					subscribeUpdates: (update) => {
						subscriber = update;
					},
					createTask: async () => {
						if (delivery === "before persistence resolves") subscriber?.([initial, created], ["To Do", "Done"]);
						return created;
					},
					taskComposer: async (options) => {
						composerCalls += 1;
						const result = await options.persist({ title: created.title, status: created.status });
						if (delivery === "before the composer closes") subscriber?.([initial, created], ["To Do", "Done"]);
						return result;
					},
				});
				expect(subscriber).toBeDefined();
				renders = 0;
				(screen as unknown as { emit(event: string): void }).emit("key n");

				for (let attempt = 0; attempt < 50 && renders < 1; attempt += 1) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
				expect(composerCalls).toBe(1);
				expect(renders).toBe(1);
				const focusedList = (
					screen as unknown as { focused?: { items?: Array<{ content?: string }>; selected?: number } }
				).focused;
				expect(focusedList?.items?.[focusedList.selected ?? 0]?.content).toContain("TASK-2");

				if (delivery === "after board success") {
					subscriber?.([initial, created], ["To Do", "Done"]);
				}
				expect(renders).toBe(1);

				(screen as unknown as { emit(event: string): void }).emit("key q");
				await withTimeout(boardPromise, "board close", 1000);
			} finally {
				screen.destroy();
				if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
				else Reflect.deleteProperty(process.stdout, "isTTY");
			}
		});
	}
});

describe("TUI task creation board outcome", () => {
	it("focuses a visible created task and updates watcher duplicates in place", () => {
		const created = task();
		const tasks = upsertBoardTask([], created);
		const updated = upsertBoardTask(tasks, { ...created, title: "Watcher copy" });

		expect(updated).toHaveLength(1);
		expect(updated[0]?.title).toBe("Watcher copy");
		expect(getCreatedTaskBoardOutcome(created, true)).toEqual({
			focusTaskId: "TASK-1",
			message: "Created TASK-1.",
			tone: "green",
		});
	});

	it("explains why drafts and filtered tasks cannot be focused", () => {
		expect(getCreatedTaskBoardOutcome(task({ id: "DRAFT-1", status: "Draft" }), false)).toEqual({
			message: "Created DRAFT-1 as a draft. Drafts are not shown on the task board.",
			tone: "yellow",
		});
		expect(getCreatedTaskBoardOutcome(task(), false)).toEqual({
			message: "Created TASK-1, but it is hidden by the current board filters.",
			tone: "yellow",
		});
	});
});
