import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { $ } from "bun";
import { type GitCommitResult, GitOperations } from "../git/operations.ts";
import type { BacklogConfig } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

type PrivateGit = {
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

async function initializeRepository(root: string, options: { baseline?: boolean; reflogs?: boolean } = {}) {
	await mkdir(root, { recursive: true });
	await $`git init -q -b main`.cwd(root);
	await $`git config user.name "Original Author"`.cwd(root);
	await $`git config user.email original@example.com`.cwd(root);
	if (options.reflogs === false) await $`git config core.logAllRefUpdates false`.cwd(root);
	if (options.baseline !== false) {
		await Bun.write(join(root, "base.txt"), "base\n");
		await $`git add base.txt`.cwd(root);
		await $`git commit -q -m baseline`.cwd(root);
	}
	return new GitOperations(root, { bypassGitHooks: false } as BacklogConfig);
}

async function commitSelected(
	root: string,
	git: GitOperations,
	operation: string,
	content: string,
	options: { amendOwned?: boolean } = {},
): Promise<GitCommitResult> {
	const path = join(root, "selected.txt");
	await Bun.write(path, content);
	const repoRoot = await git.stageFiles([path]);
	const result = await git.commitFiles(operation, [path], repoRoot, options);
	if (!result) throw new Error("Expected a selected-path commit");
	return result;
}

async function commitCount(root: string): Promise<number> {
	return Number((await $`git rev-list --count HEAD`.cwd(root).text()).trim());
}

async function head(root: string): Promise<string> {
	return (await $`git rev-parse HEAD`.cwd(root).text()).trim();
}

async function installHook(root: string, name: string, body: string): Promise<void> {
	const configured = (await $`git rev-parse --git-path hooks`.cwd(root).text()).trim();
	const hooksDir = isAbsolute(configured) ? configured : join(root, configured);
	const path = join(hooksDir, name);
	await Bun.write(path, `#!/bin/sh\n${body}\n`);
	await chmod(path, 0o755);
}

describe("owned automatic commit replacement", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = createUniqueTestDir("owned-commit-replacement");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("replaces a repeatedly owned tip while preserving parents and author metadata", async () => {
		const git = await initializeRepository(testDir);
		const baseline = await head(testDir);
		const first = await commitSelected(testDir, git, "backlog: Update task BACK-1", "one\n");
		const firstAuthor = (await $`git show -s --format=%an%x00%ae%x00%aI HEAD`.cwd(testDir).text()).trim();
		expect(first.amended).toBe(false);
		expect(first.ownershipRecorded).toBe(true);

		const second = await commitSelected(testDir, git, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(second.amended).toBe(true);
		expect(second.previousCommitId).toBe(first.commitId);
		expect(second.ownershipRecorded).toBe(true);
		expect((await $`git rev-parse HEAD^`.cwd(testDir).text()).trim()).toBe(baseline);
		expect((await $`git show -s --format=%an%x00%ae%x00%aI HEAD`.cwd(testDir).text()).trim()).toBe(firstAuthor);
		expect(await commitCount(testDir)).toBe(2);
		expect(await $`git show HEAD:selected.txt`.cwd(testDir).text()).toBe("two\n");
		expect(await $`git show -s --format=%s HEAD`.cwd(testDir).text()).toBe("backlog: Update tasks BACK-1, BACK-2\n");

		const third = await commitSelected(testDir, git, "backlog: Archive task BACK-3", "three\n", {
			amendOwned: true,
		});
		expect(third.amended).toBe(true);
		expect(third.ownershipRecorded).toBe(true);
		expect(await commitCount(testDir)).toBe(2);
		expect(await $`git show -s --format=%s HEAD`.cwd(testDir).text()).toBe("backlog: 3 changes\n");
	});

	it("replaces owned root commits without inventing a parent", async () => {
		const git = await initializeRepository(testDir, { baseline: false });
		await commitSelected(testDir, git, "backlog: Add task BACK-1", "one\n");
		const replacement = await commitSelected(testDir, git, "backlog: Add task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(replacement.amended).toBe(true);
		expect(await commitCount(testDir)).toBe(1);
		expect((await $`git rev-list --parents -n 1 HEAD`.cwd(testDir).text()).trim().split(/\s+/)).toHaveLength(1);
	});

	it("keeps detached and evidence-unavailable sequences in new-commit mode", async () => {
		const detachedRoot = join(testDir, "detached");
		const detachedGit = await initializeRepository(detachedRoot);
		await commitSelected(detachedRoot, detachedGit, "backlog: Update task BACK-1", "one\n");
		await $`git checkout -q --detach`.cwd(detachedRoot);
		const detachedSecond = await commitSelected(detachedRoot, detachedGit, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		const detachedThird = await commitSelected(detachedRoot, detachedGit, "backlog: Update task BACK-3", "three\n", {
			amendOwned: true,
		});
		expect([detachedSecond.amended, detachedThird.amended]).toEqual([false, false]);
		expect([detachedSecond.ownershipRecorded, detachedThird.ownershipRecorded]).toEqual([false, false]);
		expect(await commitCount(detachedRoot)).toBe(4);

		const noReflogRoot = join(testDir, "no-reflog");
		const noReflogGit = await initializeRepository(noReflogRoot, { reflogs: false });
		const first = await commitSelected(noReflogRoot, noReflogGit, "backlog: Update task BACK-1", "one\n");
		const second = await commitSelected(noReflogRoot, noReflogGit, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		const third = await commitSelected(noReflogRoot, noReflogGit, "backlog: Update task BACK-3", "three\n", {
			amendOwned: true,
		});
		expect([first.ownershipRecorded, second.ownershipRecorded, third.ownershipRecorded]).toEqual([false, false, false]);
		expect([second.amended, third.amended]).toEqual([false, false]);
		expect(await commitCount(noReflogRoot)).toBe(4);
	}, 30_000);

	it("fails closed across manual commit, amend, reset, lookalike, and clone boundaries", async () => {
		const scenarios = ["manual-commit", "manual-amend", "reset", "lookalike"];
		for (const scenario of scenarios) {
			const root = join(testDir, scenario);
			const git = await initializeRepository(root);
			const first = await commitSelected(root, git, "backlog: Update task BACK-1", "one\n");
			if (scenario === "manual-commit") {
				await Bun.write(join(root, "manual.txt"), "manual\n");
				await $`git add manual.txt && git commit -q -m manual`.cwd(root);
			} else if (scenario === "manual-amend") {
				await Bun.write(join(root, "manual.txt"), "manual\n");
				await $`git add manual.txt && git commit -q --amend --no-edit`.cwd(root);
			} else if (scenario === "reset") {
				await Bun.write(join(root, "manual.txt"), "manual\n");
				await $`git add manual.txt && git commit -q -m manual`.cwd(root);
				await $`git reset -q --hard ${first.commitId}`.cwd(root);
			} else {
				const tree = (await $`git rev-parse ${first.commitId}^{tree}`.cwd(root).text()).trim();
				const temporary = (
					await $`printf temporary | git commit-tree ${tree} -p ${first.commitId}`.cwd(root).text()
				).trim();
				await $`git update-ref -m temporary HEAD ${temporary} ${first.commitId}`.cwd(root);
				await $`git update-ref -m "backlog:auto-commit/v2 lookalike" HEAD ${first.commitId} ${temporary}`.cwd(root);
			}
			const result = await commitSelected(root, git, "backlog: Update task BACK-2", "two\n", {
				amendOwned: true,
			});
			expect(result.amended).toBe(false);
		}

		const sourceRoot = join(testDir, "clone-source");
		const sourceGit = await initializeRepository(sourceRoot);
		await commitSelected(sourceRoot, sourceGit, "backlog: Update task BACK-1", "one\n");
		const cloneRoot = join(testDir, "clone");
		await $`git clone -q ${sourceRoot} ${cloneRoot}`;
		await $`git config user.name clone && git config user.email clone@example.com`.cwd(cloneRoot);
		const cloneGit = new GitOperations(cloneRoot, {} as BacklogConfig);
		const cloneResult = await commitSelected(cloneRoot, cloneGit, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(cloneResult.amended).toBe(false);
	}, 30_000);

	it("rejects remote, branch, tag, descendant, annotated-tag, and merge sharing", async () => {
		const scenarios: Array<{ name: string; setup: (root: string, owned: string) => Promise<void> }> = [
			{
				name: "remote-direct",
				setup: async (root, owned) => void (await $`git update-ref refs/remotes/origin/main ${owned}`.cwd(root)),
			},
			{
				name: "remote-descendant",
				setup: async (root, owned) => {
					const tree = (await $`git rev-parse ${owned}^{tree}`.cwd(root).text()).trim();
					const child = (await $`printf child | git commit-tree ${tree} -p ${owned}`.cwd(root).text()).trim();
					await $`git update-ref refs/remotes/origin/main ${child}`.cwd(root);
				},
			},
			{
				name: "branch-direct",
				setup: async (root, owned) => void (await $`git branch other ${owned}`.cwd(root)),
			},
			{
				name: "tag-direct",
				setup: async (root, owned) => void (await $`git tag shared ${owned}`.cwd(root)),
			},
			{
				name: "annotated-direct",
				setup: async (root, owned) => void (await $`git tag -a shared -m shared ${owned}`.cwd(root)),
			},
			{
				name: "branch-descendant",
				setup: async (root, owned) => {
					const tree = (await $`git rev-parse ${owned}^{tree}`.cwd(root).text()).trim();
					const child = (await $`printf child | git commit-tree ${tree} -p ${owned}`.cwd(root).text()).trim();
					await $`git update-ref refs/heads/other ${child}`.cwd(root);
				},
			},
			{
				name: "tag-descendant",
				setup: async (root, owned) => {
					const tree = (await $`git rev-parse ${owned}^{tree}`.cwd(root).text()).trim();
					const child = (await $`printf child | git commit-tree ${tree} -p ${owned}`.cwd(root).text()).trim();
					await $`git tag shared ${child}`.cwd(root);
				},
			},
			{
				name: "annotated-descendant",
				setup: async (root, owned) => {
					const tree = (await $`git rev-parse ${owned}^{tree}`.cwd(root).text()).trim();
					const child = (await $`printf child | git commit-tree ${tree} -p ${owned}`.cwd(root).text()).trim();
					await $`git tag -a shared -m shared ${child}`.cwd(root);
				},
			},
		];
		for (const scenario of scenarios) {
			const root = join(testDir, scenario.name);
			const git = await initializeRepository(root);
			const first = await commitSelected(root, git, "backlog: Update task BACK-1", "one\n");
			await scenario.setup(root, first.commitId);
			const result = await commitSelected(root, git, "backlog: Update task BACK-2", "two\n", {
				amendOwned: true,
			});
			expect(result.amended).toBe(false);
		}

		const mergeRoot = join(testDir, "owned-merge");
		const mergeGit = await initializeRepository(mergeRoot);
		const first = await commitSelected(mergeRoot, mergeGit, "backlog: Update task BACK-1", "one\n");
		const base = (await $`git rev-parse ${first.commitId}^`.cwd(mergeRoot).text()).trim();
		const tree = (await $`git rev-parse ${first.commitId}^{tree}`.cwd(mergeRoot).text()).trim();
		const side = (await $`printf side | git commit-tree ${tree} -p ${base}`.cwd(mergeRoot).text()).trim();
		const merge = (
			await $`printf merge | git commit-tree ${tree} -p ${first.commitId} -p ${side}`.cwd(mergeRoot).text()
		).trim();
		await $`git update-ref -m "backlog:auto-commit/v1 owned merge" HEAD ${merge} ${first.commitId}`.cwd(mergeRoot);
		const result = await commitSelected(mergeRoot, mergeGit, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(result.amended).toBe(false);
	}, 30_000);

	it("fails closed for merge, rebase, cherry-pick, and revert operation markers", async () => {
		const markers = ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD"];
		for (const marker of markers) {
			const root = join(testDir, marker.toLowerCase());
			const git = await initializeRepository(root);
			await Bun.write(join(root, "selected.txt"), "selected\n");
			await git.stageFiles([join(root, "selected.txt")]);
			const configuredPath = (await $`git rev-parse --git-path ${marker}`.cwd(root).text()).trim();
			const markerPath = isAbsolute(configuredPath) ? configuredPath : join(root, configuredPath);
			if (marker.startsWith("rebase-")) {
				await mkdir(markerPath, { recursive: true });
			} else {
				await Bun.write(markerPath, `${await head(root)}\n`);
			}
			const before = await head(root);
			await expect(
				git.commitFiles("backlog: Update task BACK-1", [join(root, "selected.txt")], undefined, {
					amendOwned: true,
				}),
			).rejects.toThrow("in progress");
			expect(await head(root)).toBe(before);
			expect((await $`git diff --cached --name-only`.cwd(root).text()).trim()).toBe("selected.txt");
			await rm(markerPath, { recursive: true, force: true });
		}
	}, 30_000);

	it("keeps ownership evidence reflog-only and out of the reachable object graph", async () => {
		const git = await initializeRepository(testDir);
		const result = await commitSelected(testDir, git, "backlog: Update task BACK-1", "one\n");
		expect(result.ownershipRecorded).toBe(true);
		const refs = (await $`git show-ref`.cwd(testDir).text())
			.trim()
			.split("\n")
			.map((line) => line.split(" ")[1]);
		expect(refs).toEqual(["refs/heads/main"]);
		expect((await $`git rev-list --all --objects`.cwd(testDir).text()).trim()).toBe(
			(await $`git rev-list HEAD --objects`.cwd(testDir).text()).trim(),
		);
		expect((await $`git reflog show -1 --format=%gs main`.cwd(testDir).text()).trim()).toStartWith(
			"backlog:auto-commit/v1 ",
		);
	});

	it("matches amend hook lifecycle and treats post hooks as best-effort notifications", async () => {
		const git = await initializeRepository(testDir);
		const first = await commitSelected(testDir, git, "backlog: Update task BACK-1", "one\n");
		await installHook(
			testDir,
			"pre-commit",
			"printf 'pre\\n' >> hook-order.txt; printf pre > pre-index.txt; git add pre-index.txt",
		);
		await installHook(
			testDir,
			"prepare-commit-msg",
			"printf 'prepare:%s\\n' \"$2\" >> hook-order.txt; printf prepare > prepare-index.txt; git add prepare-index.txt",
		);
		await installHook(
			testDir,
			"commit-msg",
			"printf 'message\\n' >> hook-order.txt; printf message > message-index.txt; git add message-index.txt",
		);
		await installHook(
			testDir,
			"post-commit",
			"printf 'post\\n' >> hook-order.txt; printf post > post-index.txt; git add post-index.txt; exit 1",
		);
		await installHook(
			testDir,
			"post-rewrite",
			"printf 'rewrite:%s:' \"$1\" >> hook-order.txt; cat >> post-rewrite-map.txt; exit 1",
		);
		const replacement = await commitSelected(testDir, git, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(replacement.amended).toBe(true);
		expect(await Bun.file(join(testDir, "hook-order.txt")).text()).toBe(
			"pre\nprepare:message\nmessage\npost\nrewrite:amend:",
		);
		expect(await Bun.file(join(testDir, "post-rewrite-map.txt")).text()).toBe(
			`${first.commitId} ${replacement.commitId}\n`,
		);
		for (const path of ["pre-index.txt", "prepare-index.txt", "message-index.txt"]) {
			expect((await $`git show :${path}`.cwd(testDir).nothrow().quiet()).exitCode).not.toBe(0);
			expect((await $`git cat-file -e HEAD:${path}`.cwd(testDir).nothrow().quiet()).exitCode).not.toBe(0);
		}
		expect(await $`git show :post-index.txt`.cwd(testDir).text()).toBe("post");
		expect((await $`git cat-file -e HEAD:post-index.txt`.cwd(testDir).nothrow().quiet()).exitCode).not.toBe(0);
		expect(await head(testDir)).toBe(replacement.commitId);
	});

	it("preserves bypass semantics and supports replacement through the legacy hook runner", async () => {
		const bypassRoot = join(testDir, "bypass");
		const bypassGit = await initializeRepository(bypassRoot);
		await commitSelected(bypassRoot, bypassGit, "backlog: Update task BACK-1", "one\n");
		bypassGit.setConfig({ bypassGitHooks: true } as BacklogConfig);
		await installHook(bypassRoot, "pre-commit", "exit 9");
		await installHook(bypassRoot, "commit-msg", "exit 8");
		await installHook(bypassRoot, "prepare-commit-msg", "printf prepare >> bypass-hooks.txt");
		await installHook(bypassRoot, "post-commit", "printf post >> bypass-hooks.txt");
		await installHook(bypassRoot, "post-rewrite", "printf rewrite >> bypass-hooks.txt");
		const bypass = await commitSelected(bypassRoot, bypassGit, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(bypass.amended).toBe(true);
		expect(await Bun.file(join(bypassRoot, "bypass-hooks.txt")).text()).toBe("preparepostrewrite");

		const legacyRoot = join(testDir, "legacy");
		const firstGit = await initializeRepository(legacyRoot);
		await commitSelected(legacyRoot, firstGit, "backlog: Update task BACK-1", "one\n");
		await installHook(legacyRoot, "pre-commit", "printf pre >> legacy-hooks.txt");
		await installHook(legacyRoot, "post-rewrite", "printf rewrite >> legacy-hooks.txt");
		const legacyGit = new GitOperations(legacyRoot, {} as BacklogConfig);
		const privateGit = legacyGit as unknown as PrivateGit;
		const originalExec = privateGit.execGit.bind(legacyGit);
		privateGit.execGit = async (args, options) =>
			args[0] === "version" ? { stdout: "git version 2.35.8\n", stderr: "" } : originalExec(args, options);
		const legacy = await commitSelected(legacyRoot, legacyGit, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(legacy.amended).toBe(true);
		expect(await Bun.file(join(legacyRoot, "legacy-hooks.txt")).text()).toBe("prerewrite");
	}, 30_000);

	it("uses current signing configuration and leaves HEAD unchanged on signing failure", async () => {
		const git = await initializeRepository(testDir);
		const keyPath = join(testDir, "signing-key");
		await $`ssh-keygen -q -t ed25519 -N "" -f ${keyPath}`.cwd(testDir);
		await $`git config gpg.format ssh`.cwd(testDir);
		await $`git config user.signingkey ${keyPath}`.cwd(testDir);
		await $`git config commit.gpgSign true`.cwd(testDir);
		const signed = await commitSelected(testDir, git, "backlog: Update task BACK-1", "one\n");
		expect(await $`git cat-file commit ${signed.commitId}`.cwd(testDir).text()).toContain("gpgsig ");

		await $`git config commit.gpgSign false`.cwd(testDir);
		const unsigned = await commitSelected(testDir, git, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(await $`git cat-file commit ${unsigned.commitId}`.cwd(testDir).text()).not.toContain("gpgsig ");

		await $`git config commit.gpgSign true`.cwd(testDir);
		const resigned = await commitSelected(testDir, git, "backlog: Update task BACK-3", "three\n", {
			amendOwned: true,
		});
		expect(await $`git cat-file commit ${resigned.commitId}`.cwd(testDir).text()).toContain("gpgsig ");

		await $`git config user.signingkey ${join(testDir, "missing-key")}`.cwd(testDir);
		const before = await head(testDir);
		await expect(
			commitSelected(testDir, git, "backlog: Update task BACK-4", "four\n", { amendOwned: true }),
		).rejects.toThrow("Git command failed");
		expect(await head(testDir)).toBe(before);
	}, 30_000);

	it("ends the sequence when a replacement cannot record evidence for its new SHA", async () => {
		const git = await initializeRepository(testDir);
		await commitSelected(testDir, git, "backlog: Update task BACK-1", "one\n");
		await $`git config core.logAllRefUpdates false`.cwd(testDir);
		const configuredLogPath = (await $`git rev-parse --git-path logs/refs/heads/main`.cwd(testDir).text()).trim();
		const logPath = isAbsolute(configuredLogPath) ? configuredLogPath : join(testDir, configuredLogPath);
		const privateGit = git as unknown as PrivateGit;
		const originalExec = privateGit.execGit.bind(git);
		let removedEvidence = false;
		privateGit.execGit = async (args, options) => {
			if (args[0] === "update-ref" && !removedEvidence) {
				removedEvidence = true;
				await rm(logPath, { force: true });
			}
			return originalExec(args, options);
		};
		const replacement = await commitSelected(testDir, git, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(replacement.amended).toBe(true);
		expect(replacement.ownershipRecorded).toBe(false);
		privateGit.execGit = originalExec;
		const next = await commitSelected(testDir, git, "backlog: Update task BACK-3", "three\n", {
			amendOwned: true,
		});
		expect(next.amended).toBe(false);
	}, 30_000);

	it("re-evaluates ownership after concurrent branch movement and never overwrites the new tip", async () => {
		const git = await initializeRepository(testDir);
		await commitSelected(testDir, git, "backlog: Update task BACK-1", "one\n");
		const beforeCount = await commitCount(testDir);
		const privateGit = git as unknown as PrivateGit;
		const originalExec = privateGit.execGit.bind(git);
		let advanced = false;
		privateGit.execGit = async (args, options) => {
			if (args[0] === "update-ref" && !advanced) {
				advanced = true;
				await Bun.write(join(testDir, "concurrent.txt"), "concurrent\n");
				await $`git add concurrent.txt && git commit -q --only -m concurrent -- concurrent.txt`.cwd(testDir);
			}
			return originalExec(args, options);
		};
		const result = await commitSelected(testDir, git, "backlog: Update task BACK-2", "two\n", {
			amendOwned: true,
		});
		expect(advanced).toBe(true);
		expect(result.amended).toBe(false);
		expect(await $`git show HEAD:concurrent.txt`.cwd(testDir).text()).toBe("concurrent\n");
		expect(await $`git show HEAD:selected.txt`.cwd(testDir).text()).toBe("two\n");
		expect(await commitCount(testDir)).toBe(beforeCount + 2);
	}, 30_000);

	it("records and consumes branch-local evidence from a linked worktree", async () => {
		const git = await initializeRepository(testDir);
		await commitSelected(testDir, git, "backlog: Update task BACK-1", "main\n");
		const linkedRoot = join(testDir, "linked");
		await $`git worktree add -q -b linked ${linkedRoot}`.cwd(testDir);
		const linkedGit = new GitOperations(linkedRoot, {} as BacklogConfig);
		const first = await commitSelected(linkedRoot, linkedGit, "backlog: Update task BACK-2", "linked-one\n");
		const second = await commitSelected(linkedRoot, linkedGit, "backlog: Update task BACK-3", "linked-two\n", {
			amendOwned: true,
		});
		expect(first.ownershipRecorded).toBe(true);
		expect(second.amended).toBe(true);
		expect((await $`git branch --show-current`.cwd(linkedRoot).text()).trim()).toBe("linked");
		expect(await $`git show HEAD:selected.txt`.cwd(linkedRoot).text()).toBe("linked-two\n");
	}, 30_000);
});
