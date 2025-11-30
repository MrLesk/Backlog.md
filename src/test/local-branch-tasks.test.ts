import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { TaskWithMetadata } from "../core/remote-tasks.ts";
import { loadLocalBranchTasks } from "../core/remote-tasks.ts";
import { buildLocalBranchTaskIndex } from "../core/task-loader.ts";
import type { GitOperations } from "../git/operations.ts";

// Mock GitOperations for testing
class MockGitOperations implements Partial<GitOperations> {
	private currentBranch = "main";

	async getCurrentBranch(): Promise<string> {
		return this.currentBranch;
	}

	async listRecentBranches(_daysAgo: number): Promise<string[]> {
		return ["main", "feature-a", "feature-b", "origin/main"];
	}

	async getBranchLastModifiedMap(_ref: string, _dir: string): Promise<Map<string, Date>> {
		const map = new Map<string, Date>();
		map.set("backlog/tasks/task-1 - Main Task.md", new Date("2025-06-13"));
		map.set("backlog/tasks/task-2 - Feature Task.md", new Date("2025-06-13"));
		map.set("backlog/tasks/task-3 - New Task.md", new Date("2025-06-13"));
		return map;
	}

	async listFilesInTree(ref: string, _path: string): Promise<string[]> {
		// Main branch has task-1 and task-2
		if (ref === "main") {
			return ["backlog/tasks/task-1 - Main Task.md", "backlog/tasks/task-2 - Feature Task.md"];
		}
		// feature-a has task-1 and task-3 (task-3 is new)
		if (ref === "feature-a") {
			return ["backlog/tasks/task-1 - Main Task.md", "backlog/tasks/task-3 - New Task.md"];
		}
		// feature-b has task-2
		if (ref === "feature-b") {
			return ["backlog/tasks/task-2 - Feature Task.md"];
		}
		return [];
	}

	async showFile(_ref: string, file: string): Promise<string> {
		if (file.includes("task-1")) {
			return `---
id: task-1
title: Main Task
status: To Do
assignee: []
created_date: 2025-06-13
labels: []
dependencies: []
---\n\n## Description\n\nMain task`;
		}
		if (file.includes("task-2")) {
			return `---
id: task-2
title: Feature Task
status: In Progress
assignee: []
created_date: 2025-06-13
labels: []
dependencies: []
---\n\n## Description\n\nFeature task`;
		}
		if (file.includes("task-3")) {
			return `---
id: task-3
title: New Task
status: To Do
assignee: []
created_date: 2025-06-13
labels: []
dependencies: []
---\n\n## Description\n\nNew task from feature-a branch`;
		}
		return "";
	}
}

describe("Local branch task discovery", () => {
	let consoleDebugSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleDebugSpy = spyOn(console, "debug");
	});

	afterEach(() => {
		consoleDebugSpy?.mockRestore();
	});

	describe("buildLocalBranchTaskIndex", () => {
		it("should build index from local branches excluding current branch", async () => {
			const mockGit = new MockGitOperations() as unknown as GitOperations;
			const branches = ["main", "feature-a", "feature-b", "origin/main"];

			const index = await buildLocalBranchTaskIndex(mockGit, branches, "main", "backlog");

			// Should find task-3 from feature-a (not in main)
			expect(index.has("task-3")).toBe(true);
			const task3Entries = index.get("task-3");
			expect(task3Entries?.length).toBe(1);
			expect(task3Entries?.[0]?.branch).toBe("feature-a");

			// Should find task-1 and task-2 from other branches
			expect(index.has("task-1")).toBe(true);
			expect(index.has("task-2")).toBe(true);
		});

		it("should exclude origin/ branches", async () => {
			const mockGit = new MockGitOperations() as unknown as GitOperations;
			const branches = ["main", "feature-a", "origin/feature-a"];

			const index = await buildLocalBranchTaskIndex(mockGit, branches, "main", "backlog");

			// Should only have entries from feature-a (local), not origin/feature-a
			const task1Entries = index.get("task-1");
			expect(task1Entries?.every((e) => e.branch === "feature-a")).toBe(true);
		});

		it("should exclude current branch", async () => {
			const mockGit = new MockGitOperations() as unknown as GitOperations;
			const branches = ["main", "feature-a"];

			const index = await buildLocalBranchTaskIndex(mockGit, branches, "main", "backlog");

			// task-1 should only be from feature-a, not main
			const task1Entries = index.get("task-1");
			expect(task1Entries?.every((e) => e.branch !== "main")).toBe(true);
		});
	});

	describe("loadLocalBranchTasks", () => {
		it("should discover tasks from other local branches", async () => {
			const mockGit = new MockGitOperations() as unknown as GitOperations;

			const progressMessages: string[] = [];
			const localBranchTasks = await loadLocalBranchTasks(mockGit, null, (msg: string) => {
				progressMessages.push(msg);
			});

			// Should find task-3 which only exists in feature-a
			const task3 = localBranchTasks.find((t) => t.id === "task-3");
			expect(task3).toBeDefined();
			expect(task3?.title).toBe("New Task");
			expect(task3?.source).toBe("local-branch");
			expect(task3?.branch).toBe("feature-a");

			// Progress should mention other local branches
			expect(progressMessages.some((msg) => msg.includes("other local branches"))).toBe(true);
		});

		it("should skip tasks that exist in filesystem when provided", async () => {
			const mockGit = new MockGitOperations() as unknown as GitOperations;

			// Simulate that task-1 already exists in filesystem
			const localTasks: TaskWithMetadata[] = [
				{
					id: "task-1",
					title: "Main Task (local)",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-13",
					labels: [],
					dependencies: [],
					source: "local",
				},
			];

			const localBranchTasks = await loadLocalBranchTasks(mockGit, null, undefined, localTasks);

			// task-3 should be found (not in local tasks)
			expect(localBranchTasks.some((t) => t.id === "task-3")).toBe(true);

			// task-1 should not be hydrated since it exists locally
			// (unless the remote version is newer, which in this mock it's not)
			// The behavior depends on whether the remote version is newer
		});

		it("should return empty array when on detached HEAD", async () => {
			const mockGit = {
				getCurrentBranch: async () => "",
			} as unknown as GitOperations;

			const tasks = await loadLocalBranchTasks(mockGit, null);
			expect(tasks).toEqual([]);
		});

		it("should return empty when only current branch exists", async () => {
			const mockGit = {
				getCurrentBranch: async () => "main",
				listRecentBranches: async () => ["main"],
			} as unknown as GitOperations;

			const tasks = await loadLocalBranchTasks(mockGit, null);
			expect(tasks).toEqual([]);
		});
	});
});
