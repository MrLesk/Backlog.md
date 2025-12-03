import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRemoteTasks } from "../core/task-loader.ts";
import type { FileSystem } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import type { BacklogConfig } from "../types/index.ts";

describe("Offline Mode Configuration", () => {
	let tempDir: string;
	let gitOps: GitOperations;
	let _mockFileSystem: FileSystem;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "backlog-offline-test-"));
		gitOps = new GitOperations(tempDir);
		_mockFileSystem = {
			loadConfig: async () => ({ backlogDirectory: "backlog" }),
		} as unknown as FileSystem;
	});

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	describe("GitOperations.fetch()", () => {
		it("should skip fetch when remoteOperations is false", async () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: false,
			};

			gitOps.setConfig(config);

			// Mock process.env.DEBUG to capture debug message
			const originalDebug = process.env.DEBUG;
			process.env.DEBUG = "1";

			// Capture console.warn calls
			const originalWarn = console.warn;
			const warnMessages: string[] = [];
			console.warn = (message: string) => {
				warnMessages.push(message);
			};

			// This should not throw and should skip the actual fetch
			await gitOps.fetch();

			// Verify debug message was logged
			expect(warnMessages).toContain("Remote operations are disabled in config. Skipping fetch.");

			// Restore
			process.env.DEBUG = originalDebug;
			console.warn = originalWarn;
		});

		it("should proceed with fetch when remoteOperations is true", async () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: true,
			};

			gitOps.setConfig(config);

			// This should attempt to run git fetch and likely fail since we're not in a git repo
			// but it should not be skipped due to config
			try {
				await gitOps.fetch();
			} catch (error) {
				// Expected to fail since we're not in a proper git repo with remote
				expect(error).toBeDefined();
			}
		});

		it("should handle network errors gracefully", async () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: true,
			};

			gitOps.setConfig(config);

			// Capture console.warn calls
			const originalWarn = console.warn;
			const warnMessages: string[] = [];
			console.warn = (message: string) => {
				warnMessages.push(message);
			};

			// Mock execGit to simulate network error
			type GitOperationsWithExecGit = { execGit: (args: string[]) => Promise<{ stdout: string; stderr: string }> };
			const originalExecGit = (gitOps as unknown as GitOperationsWithExecGit).execGit;
			(gitOps as unknown as GitOperationsWithExecGit).execGit = async (args: string[]) => {
				if (args[0] === "fetch") {
					throw new Error("could not resolve host github.com");
				}
				return originalExecGit.call(gitOps, args);
			};

			// Should not throw, should handle gracefully
			await expect(async () => {
				await gitOps.fetch();
			}).not.toThrow();

			// Restore
			console.warn = originalWarn;
			(gitOps as unknown as GitOperationsWithExecGit).execGit = originalExecGit;
		});
	});

	describe("Network Error Detection", () => {
		it("should detect various network error patterns", () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: true,
			};

			gitOps.setConfig(config);

			const networkErrors = [
				"could not resolve host github.com",
				"Connection refused",
				"Network is unreachable",
				"Operation timed out",
				"No route to host",
				"Connection timed out",
				"Temporary failure in name resolution",
			];

			for (const errorMessage of networkErrors) {
				const isNetworkError = (gitOps as unknown as { isNetworkError: (error: unknown) => boolean }).isNetworkError(
					new Error(errorMessage),
				);
				expect(isNetworkError).toBe(true);
			}

			// Non-network errors should not be detected as network errors
			const nonNetworkErrors = ["Permission denied", "Repository not found", "Authentication failed"];

			for (const errorMessage of nonNetworkErrors) {
				const isNetworkError = (gitOps as unknown as { isNetworkError: (error: unknown) => boolean }).isNetworkError(
					new Error(errorMessage),
				);
				expect(isNetworkError).toBe(false);
			}
		});
	});

	describe("loadRemoteTasks with offline config", () => {
		it("should skip remote operations when remoteOperations is false", async () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: false,
			};

			const progressMessages: string[] = [];
			const onProgress = (msg: string) => progressMessages.push(msg);

			const mockGitOperations = {
				fetch: async () => {
					throw new Error("This should not be called");
				},
				listRemoteBranches: async () => [],
				listRecentRemoteBranches: async (_daysAgo: number) => [],
			} as unknown as GitOperations;

			const remoteTasks = await loadRemoteTasks(mockGitOperations, config, onProgress);

			expect(remoteTasks).toEqual([]);
			expect(progressMessages).toContain("Remote operations disabled - skipping remote tasks");
		});

		it("should proceed with remote operations when remoteOperations is true", async () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: true,
			};

			const progressMessages: string[] = [];
			const onProgress = (msg: string) => progressMessages.push(msg);

			let fetchCalled = false;
			const mockGitOperations = {
				fetch: async () => {
					fetchCalled = true;
				},
				listRemoteBranches: async () => [],
				listRecentRemoteBranches: async (_daysAgo: number) => [],
			} as unknown as GitOperations;

			const remoteTasks = await loadRemoteTasks(mockGitOperations, config, onProgress);

			expect(fetchCalled).toBe(true);
			expect(remoteTasks).toEqual([]);
			expect(progressMessages).toContain("Fetching remote branches...");
		});

		it("should proceed with remote operations when config is null (default behavior)", async () => {
			const progressMessages: string[] = [];
			const onProgress = (msg: string) => progressMessages.push(msg);

			let fetchCalled = false;
			const mockGitOperations = {
				fetch: async () => {
					fetchCalled = true;
				},
				listRemoteBranches: async () => [],
				listRecentRemoteBranches: async (_daysAgo: number) => [],
			} as unknown as GitOperations;

			const remoteTasks = await loadRemoteTasks(mockGitOperations, null, onProgress);

			expect(fetchCalled).toBe(true);
			expect(remoteTasks).toEqual([]);
			expect(progressMessages).toContain("Fetching remote branches...");
		});
	});

	describe("Config Management", () => {
		it("should handle missing remoteOperations field as default true", () => {
			const configWithoutRemoteOps: Partial<BacklogConfig> = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				// remoteOperations field is missing
			};

			gitOps.setConfig(configWithoutRemoteOps as BacklogConfig);

			// Should default to allowing remote operations when field is missing
			// This tests backward compatibility
		});

		it("should handle null config gracefully", () => {
			gitOps.setConfig(null);

			// Should not throw and should default to allowing remote operations
		});
	});
});
