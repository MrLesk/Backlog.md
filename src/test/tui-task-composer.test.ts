import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { appendFile, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { getCreatedTaskBoardOutcome, renderBoardTui, upsertBoardTask } from "../ui/board.ts";
import { openSingleSelectFilterPopup } from "../ui/components/filter-popup.ts";
import {
	createTaskComposerValues,
	deleteLastChar,
	deleteLastWord,
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
	content?: string;
	children?: unknown[];
	height?: number;
	items?: TestWidget[];
	label?: string;
	top?: number;
	emit?: (event: string) => void;
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

	it("rests on canonical To Do even when it is not first, matching the CLI wizard", () => {
		expect(createTaskComposerValues(["Backlog", "To Do", "Done"]).status).toBe("To Do");
	});

	it("deletes the last character and last word from a value", () => {
		expect(deleteLastChar("abc")).toBe("ab");
		expect(deleteLastChar("")).toBe("");
		expect(deleteLastWord("hello world")).toBe("hello ");
		expect(deleteLastWord("hello ")).toBe("");
		expect(deleteLastWord("one")).toBe("");
		expect(deleteLastWord("")).toBe("");
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

	it("uses a compact layout at 80x24 and 50x18 but the full layout at 100x30", () => {
		expect(getTaskComposerLayout(100, 30)).toMatchObject({ compact: false, popupHeight: 30 });
		expect(getTaskComposerLayout(80, 24)).toMatchObject({ compact: true, popupHeight: 22 });
		expect(getTaskComposerLayout(50, 18)).toMatchObject({ compact: true, popupHeight: 16 });
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
		const hookPath = await installFailingHook(testDir);

		const controller = new TaskComposerController(["To Do", "Done"]);
		controller.values.title = "Retry without a duplicate";
		controller.values.description = "Preserve this value";
		const persist = async (input: TaskCreateInput) => (await core.createTaskFromInput(input, true)).task;

		expect(await controller.create(persist)).toBeNull();
		expect(controller.error).toContain("failed");
		expect(await core.fs.loadTask("TASK-1")).toBeNull();
		expect((await core.gitOps.getStatus()).trim()).toBe("");
		expect(controller.values.description).toBe("Preserve this value");

		await rm(hookPath);
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

	it("edits Title and Description with Backspace and Ctrl+W", async () => {
		const screen = createScreen({ smartCSR: false });
		type EditableWidget = { getValue(): string; setValue(value: string): void; emit(event: string): void };
		const focused = () => (screen as unknown as { focused?: EditableWidget }).focused;
		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async () => task(),
			});
			await new Promise<void>((resolve) => setImmediate(resolve));

			const title = focused();
			expect(title).toBeDefined();
			title?.setValue("hello world");
			title?.emit("key backspace");
			expect(title?.getValue()).toBe("hello worl");
			title?.emit("key C-w");
			expect(title?.getValue()).toBe("hello ");

			title?.emit("key tab");
			const description = focused();
			expect(description).not.toBe(title);
			description?.setValue("alpha beta");
			description?.emit("key backspace");
			expect(description?.getValue()).toBe("alpha bet");
			description?.emit("key C-w");
			expect(description?.getValue()).toBe("alpha ");

			focused()?.emit("key escape");
			expect(await withTimeout(resultPromise, "edit inputs", 1000)).toBeNull();
		} finally {
			screen.destroy();
		}
	});

	it("preselects the current value so Enter keeps it instead of Draft", async () => {
		const screen = createScreen({ smartCSR: false });
		try {
			const pickerPromise = openSingleSelectFilterPopup({
				screen,
				title: "Task Status",
				choices: getTaskComposerStatusChoices(["To Do", "Done"]),
				selectedValue: "To Do",
			});
			await new Promise<void>((resolve) => setImmediate(resolve));
			(screen as unknown as { focused?: { emit(event: string): void } }).focused?.emit("key enter");
			expect(await withTimeout(pickerPromise, "picker enter", 1000)).toBe("To Do");
		} finally {
			screen.destroy();
		}
	});

	it("traverses every focusable control and Esc cancels with resize handlers cleaned up", async () => {
		for (let fieldIndex = 0; fieldIndex < 7; fieldIndex += 1) {
			const screen = createScreen({ smartCSR: false });
			const originalRender = screen.render.bind(screen);
			let renders = 0;
			screen.render = () => {
				renders += 1;
				originalRender();
			};
			const eventScreen = screen as unknown as {
				focused?: TestWidget;
				emit(event: string): void;
			};
			try {
				const resultPromise = openTaskComposer({
					screen,
					statuses: ["To Do", "Done"],
					persist: async () => task(),
				});
				await new Promise<void>((resolve) => setImmediate(resolve));
				for (let step = 0; step < fieldIndex; step += 1) {
					eventScreen.focused?.emit?.("key tab");
				}
				expect(eventScreen.focused).toBeDefined();
				eventScreen.focused?.emit?.("key escape");
				expect(await withTimeout(resultPromise, `Esc from composer field ${fieldIndex}`, 1000)).toBeNull();
				renders = 0;
				eventScreen.emit("resize");
				expect(renders).toBe(0);
			} finally {
				screen.destroy();
			}
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
			await new Promise<void>((resolve) => setImmediate(resolve));
			let widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			let create = widgets.find((widget) => widget.content === "Create");
			expect(create).toMatchObject({ top: 22, height: 3 });
			expect(widgets.some((widget) => widget.content?.includes("[Tab/Shift+Tab]"))).toBe(true);

			mutableScreen.width = 50;
			mutableScreen.height = 18;
			mutableScreen.emit("resize");
			widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			create = widgets.find((widget) => widget.content === "Create");
			expect(create).toMatchObject({ top: 10, height: 1 });
			expect(widgets.some((widget) => widget.content?.includes("[Tab]"))).toBe(true);
			expect(widgets.some((widget) => widget.content?.startsWith("Status: To Do"))).toBe(true);

			mutableScreen.width = 100;
			mutableScreen.height = 30;
			mutableScreen.emit("resize");
			widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			create = widgets.find((widget) => widget.content === "Create");
			expect(create).toMatchObject({ top: 22, height: 3 });
			(screen as unknown as { focused?: TestWidget }).focused?.emit?.("key escape");
			expect(await withTimeout(resultPromise, "resized composer cancellation", 1000)).toBeNull();
		} finally {
			screen.destroy();
		}
	});

	it("opens the actual composer on an empty board and renders and focuses once after first-task creation", async () => {
		const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
		const screen = createScreen({ smartCSR: false });
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
					collectWidgets(screen as unknown as { children?: unknown[] }).some((widget) => widget.content === "Create"),
				"the real task composer",
			);
			await waitUntil(
				() => typeof (screen as unknown as { focused?: TestWidget }).focused?.setValue === "function",
				"the title field to receive focus",
			);
			const focused = (screen as unknown as { focused?: TestWidget }).focused;
			focused?.setValue?.("Actual composer task");
			for (let step = 0; step < 5; step += 1) {
				(screen as unknown as { focused?: TestWidget }).focused?.emit?.("key tab");
			}
			const create = (screen as unknown as { focused?: TestWidget }).focused;
			expect(create?.content).toBe("Create");
			create?.emit?.("key enter");
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
