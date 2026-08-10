import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitOperations, isGitRepository } from "../git/operations.ts";
import type { BacklogConfig } from "../types/index.ts";

const TEST_CONFIG = {
	projectName: "Git operations",
	statuses: [],
	labels: [],
	dateFormat: "YYYY-MM-DD",
} satisfies BacklogConfig;

function createGate(): { promise: Promise<void>; release: () => void } {
	let release: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release: () => release() };
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
		throw error;
	}
}

async function waitForProcessExit(pid: number): Promise<void> {
	const deadline = Date.now() + 5_000;
	while (isProcessAlive(pid)) {
		if (Date.now() >= deadline) throw new Error(`Process ${pid} survived the Git timeout`);
		await Bun.sleep(10);
	}
}

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

	describe("isRepository", () => {
		it("coalesces concurrent checks and reuses positive results per directory", async () => {
			const git = new GitOperations(process.cwd());
			let checks = 0;
			const checkStarted = createGate();
			const checkGate = createGate();
			const internals = git as unknown as {
				detectRepository: (cwd: string) => Promise<boolean>;
			};
			internals.detectRepository = async () => {
				checks += 1;
				checkStarted.release();
				await checkGate.promise;
				return true;
			};

			const first = git.isRepository(process.cwd());
			const second = git.isRepository(join(process.cwd(), "."));
			await checkStarted.promise;
			expect(checks).toBe(1);

			checkGate.release();
			expect(await Promise.all([first, second])).toEqual([true, true]);
			expect(await git.isRepository(process.cwd())).toBe(true);
			expect(checks).toBe(1);

			expect(await git.isRepository(join(process.cwd(), "other-repository"))).toBe(true);
			expect(checks).toBe(2);
		});

		it("does not cache a negative result", async () => {
			const git = new GitOperations(process.cwd());
			let checks = 0;
			const internals = git as unknown as {
				detectRepository: (cwd: string) => Promise<boolean>;
			};
			internals.detectRepository = async () => {
				checks += 1;
				return false;
			};

			expect(await git.isRepository()).toBe(false);
			expect(await git.isRepository()).toBe(false);
			expect(checks).toBe(2);
		});

		it("keeps filesystem-only mode authoritative over cached repository state", async () => {
			const git = new GitOperations(process.cwd(), {
				...TEST_CONFIG,
				filesystemOnly: false,
			});
			let checks = 0;
			const internals = git as unknown as {
				detectRepository: (cwd: string) => Promise<boolean>;
			};
			internals.detectRepository = async () => {
				checks += 1;
				return true;
			};

			expect(await git.isRepository()).toBe(true);
			git.setConfig({
				...TEST_CONFIG,
				filesystemOnly: true,
			});
			expect(await git.isRepository()).toBe(false);
			expect(checks).toBe(1);
		});
	});

	describe("fetch", () => {
		it("allows bounded Git commands to complete normally", async () => {
			const git = new GitOperations(process.cwd());
			const internals = git as unknown as {
				execGit: (args: string[], options?: { timeoutMs?: number }) => Promise<{ stdout: string; stderr: string }>;
			};

			const result = await internals.execGit(["--version"], { timeoutMs: 10_000 });

			expect(result.stdout).toStartWith("git version");
		});

		it("clears a bounded Git timer when process output fails before the deadline", async () => {
			const git = new GitOperations(process.cwd());
			const internals = git as unknown as {
				execGit: (args: string[], options: { timeoutMs: number }) => Promise<{ stdout: string; stderr: string }>;
			};
			const runtime = Bun as unknown as { spawn: (...args: unknown[]) => unknown };
			const originalSpawn = runtime.spawn;
			const clearTimeoutSpy = spyOn(globalThis, "clearTimeout");
			runtime.spawn = () => ({
				pid: 424_242,
				stdin: null,
				stdout: new ReadableStream<Uint8Array>({
					start(controller) {
						controller.error(new Error("output read failed"));
					},
				}),
				stderr: new ReadableStream<Uint8Array>({
					start(controller) {
						controller.close();
					},
				}),
				exited: Promise.resolve(0),
				kill() {},
			});

			try {
				await expect(internals.execGit(["--version"], { timeoutMs: 60_000 })).rejects.toThrow("output read failed");
				expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
			} finally {
				runtime.spawn = originalSpawn;
				clearTimeoutSpy.mockRestore();
			}
		});

		it("hard-kills a timed-out Git process group even when a child holds its pipes", async () => {
			if (process.platform === "win32") return;
			const git = new GitOperations(process.cwd());
			const internals = git as unknown as {
				execGit: (
					args: string[],
					options: { timeoutMs: number; env?: Record<string, string> },
				) => Promise<{ stdout: string; stderr: string }>;
			};
			const directory = await mkdtemp(join(tmpdir(), "backlog-git-timeout-"));
			const scriptPath = join(directory, "hang.sh");
			const pidPath = join(directory, "child.pid");
			let childPid: number | undefined;

			try {
				await writeFile(
					scriptPath,
					`#!/bin/sh
trap '' TERM
(trap '' TERM; sleep 30) &
child_pid=$!
printf '%s\\n' "$child_pid" > "$BACKLOG_TIMEOUT_PID_FILE"
wait "$child_pid"
`,
					{ mode: 0o755 },
				);

				await expect(
					internals.execGit(["-c", `alias.hang=!${scriptPath}`, "hang"], {
						timeoutMs: 500,
						env: { BACKLOG_TIMEOUT_PID_FILE: pidPath },
					}),
				).rejects.toThrow("Git command timeout after 500ms");

				childPid = Number((await readFile(pidPath, "utf8")).trim());
				expect(Number.isSafeInteger(childPid)).toBe(true);
				await waitForProcessExit(childPid);
			} finally {
				if (childPid && isProcessAlive(childPid)) process.kill(childPid, "SIGKILL");
				await rm(directory, { recursive: true, force: true });
			}
		});

		it("coalesces concurrent fetches and bounds non-interactive Git work", async () => {
			const git = new GitOperations(process.cwd(), {
				...TEST_CONFIG,
				remoteOperations: true,
			});
			let remoteChecks = 0;
			let fetchCalls = 0;
			const fetchStarted = createGate();
			const fetchGate = createGate();
			let captured:
				| {
						args: string[];
						options?: { env?: Record<string, string>; timeoutMs?: number };
				  }
				| undefined;
			const internals = git as unknown as {
				hasAnyRemote: () => Promise<boolean>;
				execGit: (
					args: string[],
					options?: { env?: Record<string, string>; timeoutMs?: number },
				) => Promise<{ stdout: string; stderr: string }>;
			};
			internals.hasAnyRemote = async () => {
				remoteChecks += 1;
				return true;
			};
			internals.execGit = async (args, options) => {
				fetchCalls += 1;
				captured = { args, options };
				fetchStarted.release();
				await fetchGate.promise;
				return { stdout: "", stderr: "" };
			};

			const first = git.fetch();
			const second = git.fetch();
			await fetchStarted.promise;
			expect(remoteChecks).toBe(1);
			expect(fetchCalls).toBe(1);

			fetchGate.release();
			await Promise.all([first, second]);
			expect(captured).toEqual({
				args: ["fetch", "origin", "--prune", "--quiet"],
				options: {
					env: {
						GIT_TERMINAL_PROMPT: "0",
						GCM_INTERACTIVE: "Never",
					},
					timeoutMs: 10_000,
				},
			});

			await git.fetch();
			expect(remoteChecks).toBe(2);
			expect(fetchCalls).toBe(2);
		});

		it("loads configuration before deciding whether remote work is disabled", async () => {
			let configLoads = 0;
			let remoteChecks = 0;
			const git = new GitOperations(process.cwd(), null, async () => {
				configLoads += 1;
				return {
					...TEST_CONFIG,
					remoteOperations: false,
				};
			});
			const internals = git as unknown as {
				hasAnyRemote: () => Promise<boolean>;
			};
			internals.hasAnyRemote = async () => {
				remoteChecks += 1;
				return true;
			};

			await git.fetch();

			expect(configLoads).toBe(1);
			expect(remoteChecks).toBe(0);
		});

		it("coalesces lazy configuration and fetch work on concurrent first use", async () => {
			let configLoads = 0;
			let fetchCalls = 0;
			const configStarted = createGate();
			const configGate = createGate();
			const git = new GitOperations(process.cwd(), null, async () => {
				configLoads += 1;
				configStarted.release();
				await configGate.promise;
				return { ...TEST_CONFIG, remoteOperations: true };
			});
			const internals = git as unknown as {
				hasAnyRemote: () => Promise<boolean>;
				execGit: () => Promise<{ stdout: string; stderr: string }>;
			};
			internals.hasAnyRemote = async () => true;
			internals.execGit = async () => {
				fetchCalls += 1;
				return { stdout: "", stderr: "" };
			};

			const first = git.fetch();
			const second = git.fetch();
			await configStarted.promise;
			configGate.release();
			await Promise.all([first, second]);

			expect(configLoads).toBe(1);
			expect(fetchCalls).toBe(1);
		});

		it("treats a bounded fetch timeout as a transient network failure", async () => {
			const git = new GitOperations(process.cwd(), {
				...TEST_CONFIG,
				remoteOperations: true,
			});
			const internals = git as unknown as {
				hasAnyRemote: () => Promise<boolean>;
				execGit: () => Promise<{ stdout: string; stderr: string }>;
			};
			internals.hasAnyRemote = async () => true;
			internals.execGit = async () => {
				throw new Error("Git command timeout after 10000ms");
			};

			await expect(git.fetch()).resolves.toBeUndefined();
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
				...TEST_CONFIG,
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

		it("retains the current branch when its tip is older than the active window", async () => {
			const git = new GitOperations(process.cwd(), {
				...TEST_CONFIG,
				remoteOperations: false,
			});
			const oldTimestamp = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60;
			const internals = git as unknown as {
				execGit: (args: string[]) => Promise<{ stdout: string; stderr: string }>;
			};
			internals.execGit = async () => ({
				stdout: `*\0main\0aaa111\0${oldTimestamp}\n \0old-feature\0bbb222\0${oldTimestamp}\n`,
				stderr: "",
			});

			const tips = await git.listRecentBranchTips(30);

			expect(tips).toEqual([{ name: "main", commit: "aaa111", current: true }]);
		});
	});

	describe("getBranchLastModifiedMap", () => {
		it("passes an absolute cache cutoff to Git", async () => {
			const git = new GitOperations(process.cwd());
			let capturedArgs: string[] = [];
			const internals = git as unknown as {
				isRepository: () => Promise<boolean>;
				execGit: (args: string[]) => Promise<{ stdout: string; stderr: string }>;
			};
			internals.isRepository = async () => true;
			internals.execGit = async (args) => {
				capturedArgs = args;
				return { stdout: "", stderr: "" };
			};
			const cutoff = new Date("2026-07-11T00:00:00Z");

			expect(await git.getBranchLastModifiedMap("abc123", "backlog", cutoff)).toEqual(new Map());
			expect(capturedArgs).toContain(`--since=@${Math.floor(cutoff.getTime() / 1000)}`);
		});

		it("propagates Git history failures", async () => {
			const git = new GitOperations(process.cwd());
			const internals = git as unknown as {
				isRepository: () => Promise<boolean>;
				execGit: () => Promise<{ stdout: string; stderr: string }>;
			};
			internals.isRepository = async () => true;
			internals.execGit = async () => {
				throw new Error("history unavailable");
			};

			await expect(git.getBranchLastModifiedMap("abc123", "backlog")).rejects.toThrow("history unavailable");
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
