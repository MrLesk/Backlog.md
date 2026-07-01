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

	// Note: Skipping integration tests that require git repository setup
	// These tests can be enabled for local development but may timeout in CI
});
