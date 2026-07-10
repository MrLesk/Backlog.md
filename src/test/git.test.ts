import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { GitOperations, isGitRepository } from "../git/operations.ts";

describe("Git Operations", () => {
	describe("isGitRepository", () => {
		it("should return true for current directory (which is a git repo)", async () => {
			const result = await isGitRepository(process.cwd());
			expect(result).toBe(true);
		});

		it("should return false for /tmp directory", async () => {
			const result = await isGitRepository("/tmp");
			expect(result).toBe(false);
		});

		it("should return false when the working directory cannot be spawned", async () => {
			const result = await isGitRepository(join(process.cwd(), "tmp", "missing-git-cwd"));
			expect(result).toBe(false);
		});
	});

	describe("GitOperations instantiation", () => {
		it("should create GitOperations instance", () => {
			const git = new GitOperations(process.cwd());
			expect(git).toBeDefined();
		});
	});

	describe("resolveCommit", () => {
		it("should terminate rev-parse options before the ref", async () => {
			const git = new GitOperations(process.cwd());
			let capturedArgs: string[] = [];
			const internals = git as unknown as {
				isRepository: () => Promise<boolean>;
				execGit: (args: string[], options?: unknown) => Promise<{ stdout: string; stderr: string }>;
			};
			internals.isRepository = async () => true;
			internals.execGit = async (args: string[]) => {
				capturedArgs = args;
				return {
					stdout: "abc123\n",
					stderr: "",
				};
			};

			const sha = await git.resolveCommit("-raw-ref");

			expect(sha).toBe("abc123");
			expect(capturedArgs).toEqual(["rev-parse", "--verify", "--quiet", "--end-of-options", "-raw-ref^{commit}"]);
		});
	});

	describe("listRecentBranchTips", () => {
		it("captures current-branch identity and ref tips in one Git query", async () => {
			const git = new GitOperations(process.cwd(), {
				projectName: "Git tips",
				statuses: [],
				labels: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: true,
			});
			const now = Math.floor(Date.now() / 1000);
			let capturedArgs: string[] = [];
			let callCount = 0;
			const internals = git as unknown as {
				execGit: (args: string[], options?: unknown) => Promise<{ stdout: string; stderr: string }>;
			};
			internals.execGit = async (args: string[]) => {
				callCount += 1;
				capturedArgs = args;
				return {
					stdout: `*\0main\0aaa111\0${now}\n \0origin/feature\0bbb222\0${now}\n`,
					stderr: "",
				};
			};

			const tips = await git.listRecentBranchTips(30);

			expect(callCount).toBe(1);
			expect(capturedArgs).toEqual([
				"for-each-ref",
				"--format=%(HEAD)%00%(refname:short)%00%(objectname)%00%(committerdate:unix)",
				"refs/heads",
				"refs/remotes/origin",
			]);
			expect(tips).toEqual([
				{ name: "main", commit: "aaa111", current: true },
				{ name: "origin/feature", commit: "bbb222", current: false },
			]);
		});
	});

	describe("hashFile", () => {
		it("hashes with the repository-relative path so Git clean filters match tree blobs", async () => {
			const git = new GitOperations(process.cwd());
			let capturedArgs: string[] = [];
			let capturedOptions: { cwd?: string; readOnly?: boolean } | undefined;
			const internals = git as unknown as {
				getPathContext: () => Promise<{ repoRoot: string; relativePath: string }>;
				execGit: (
					args: string[],
					options?: { cwd?: string; readOnly?: boolean },
				) => Promise<{ stdout: string; stderr: string }>;
			};
			internals.getPathContext = async () => ({ repoRoot: "/repo", relativePath: "project/backlog/tasks/back-1.md" });
			internals.execGit = async (args, options) => {
				capturedArgs = args;
				capturedOptions = options;
				return { stdout: "blob123\n", stderr: "" };
			};

			expect(await git.hashFile("/repo/project/backlog/tasks/back-1.md")).toBe("blob123");
			expect(capturedArgs).toEqual([
				"hash-object",
				"--path=project/backlog/tasks/back-1.md",
				"--",
				"project/backlog/tasks/back-1.md",
			]);
			expect(capturedOptions).toEqual({ cwd: "/repo", readOnly: true });
		});
	});

	// Note: Skipping integration tests that require git repository setup
	// These tests can be enabled for local development but may timeout in CI
});
