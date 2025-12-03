import { describe, expect, it } from "bun:test";
import { findTaskInLocalBranches, findTaskInRemoteBranches } from "../core/task-loader.ts";
import type { GitOperations } from "../git/operations.ts";

type PartialGitOps = Partial<GitOperations>;

describe("findTaskInRemoteBranches", () => {
	it("should return null when git has no remotes", async () => {
		const mockGit: PartialGitOps = {
			hasAnyRemote: async () => false,
		};
		const result = await findTaskInRemoteBranches(mockGit as GitOperations, "task-999");
		expect(result).toBeNull();
	});

	it("should return null when no branches exist", async () => {
		const mockGit: PartialGitOps = {
			hasAnyRemote: async () => true,
			listRecentRemoteBranches: async () => [],
		};
		const result = await findTaskInRemoteBranches(mockGit as GitOperations, "task-999");
		expect(result).toBeNull();
	});

	it("should return null when task is not in any branch", async () => {
		const mockGit: PartialGitOps = {
			hasAnyRemote: async () => true,
			listRecentRemoteBranches: async () => ["main"],
			listFilesInTree: async () => ["backlog/tasks/task-1 - some task.md"],
			getBranchLastModifiedMap: async () => new Map([["backlog/tasks/task-1 - some task.md", new Date()]]),
		};
		const result = await findTaskInRemoteBranches(mockGit as GitOperations, "task-999");
		expect(result).toBeNull();
	});

	it("should find and load task from remote branch", async () => {
		const mockTaskContent = `---
id: task-123
title: Test Task
status: To Do
assignee: []
created_date: '2025-01-01 12:00'
labels: []
dependencies: []
---

## Description

Test description
`;
		const mockGit: PartialGitOps = {
			hasAnyRemote: async () => true,
			listRecentRemoteBranches: async () => ["feature"],
			listFilesInTree: async () => ["backlog/tasks/task-123 - Test Task.md"],
			getBranchLastModifiedMap: async () =>
				new Map([["backlog/tasks/task-123 - Test Task.md", new Date("2025-01-01")]]),
			showFile: async () => mockTaskContent,
		};

		const result = await findTaskInRemoteBranches(mockGit as GitOperations, "task-123");
		expect(result).not.toBeNull();
		expect(result?.id).toBe("task-123");
		expect(result?.source).toBe("remote");
		expect(result?.branch).toBe("feature");
	});
});

describe("findTaskInLocalBranches", () => {
	it("should return null when on detached HEAD", async () => {
		const mockGit: PartialGitOps = {
			getCurrentBranch: async () => "",
		};
		const result = await findTaskInLocalBranches(mockGit as GitOperations, "task-999");
		expect(result).toBeNull();
	});

	it("should return null when only current branch exists", async () => {
		const mockGit: PartialGitOps = {
			getCurrentBranch: async () => "main",
			listRecentBranches: async () => ["main"],
		};
		const result = await findTaskInLocalBranches(mockGit as GitOperations, "task-999");
		expect(result).toBeNull();
	});

	it("should find and load task from another local branch", async () => {
		const mockTaskContent = `---
id: task-456
title: Local Branch Task
status: In Progress
assignee: []
created_date: '2025-01-01 12:00'
labels: []
dependencies: []
---

## Description

From local branch
`;
		const mockGit: PartialGitOps = {
			getCurrentBranch: async () => "main",
			listRecentBranches: async () => ["main", "feature-branch"],
			listFilesInTree: async () => ["backlog/tasks/task-456 - Local Branch Task.md"],
			getBranchLastModifiedMap: async () =>
				new Map([["backlog/tasks/task-456 - Local Branch Task.md", new Date("2025-01-01")]]),
			showFile: async () => mockTaskContent,
		};

		const result = await findTaskInLocalBranches(mockGit as GitOperations, "task-456");
		expect(result).not.toBeNull();
		expect(result?.id).toBe("task-456");
		expect(result?.source).toBe("local-branch");
		expect(result?.branch).toBe("feature-branch");
	});
});
