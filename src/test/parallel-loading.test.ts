import { describe, expect, it } from "bun:test";
import type { GitOps } from "../core/git-ops.ts";
import type { TaskWithMetadata } from "../core/remote-tasks.ts";
import { loadRemoteTasks, resolveTaskConflict } from "../core/remote-tasks.ts";

// Mock GitOps for testing
class MockGitOps implements Partial<GitOps> {
	private tasks: Record<string, { content: string; timestamp: Date }>[] = [];

	constructor(tasks: Record<string, { content: string; timestamp: Date }>[]) {
		this.tasks = tasks;
	}

	async fetch(): Promise<void> {
		// Mock fetch
	}

	async listRemoteBranches(): Promise<string[]> {
		return ["main", "feature", "feature2"];
	}

	async listFilesInTree(ref: string, _path: string): Promise<string[]> {
		if (ref === "origin/main") {
			return ["backlog/tasks/task-1 - Main Task.md"];
		}
		if (ref === "origin/feature") {
			return ["backlog/tasks/task-2 - Feature Task.md"];
		}
		if (ref === "origin/feature2") {
			return ["backlog/tasks/task-3 - Feature2 Task.md"];
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
title: Feature2 Task
status: Done
assignee: []
created_date: 2025-06-13
labels: []
dependencies: []
---\n\n## Description\n\nFeature2 task`;
		}
		return "";
	}

	async getFileLastModifiedTime(_ref: string, _file: string): Promise<Date | null> {
		return new Date("2025-06-13");
	}
}

describe("Parallel remote task loading", () => {
	it("should load tasks from multiple branches in parallel", async () => {
		const mockGitOps = new MockGitOps([]) as unknown as GitOps;

		// Track progress messages
		const progressMessages: string[] = [];
		const remoteTasks = await loadRemoteTasks(mockGitOps, (msg) => {
			progressMessages.push(msg);
		});

		// Verify results - we should have tasks from all remote branches
		expect(remoteTasks.length).toBe(3);
		const taskIds = remoteTasks.map((t) => t.id);
		expect(taskIds).toContain("task-1");
		expect(taskIds).toContain("task-2");
		expect(taskIds).toContain("task-3");

		// Verify each task has correct metadata
		const task1 = remoteTasks.find((t) => t.id === "task-1");
		expect(task1?.source).toBe("remote");
		expect(task1?.branch).toBe("main");
		expect(task1?.status).toBe("To Do");

		// Verify progress reporting
		expect(progressMessages.some((msg) => msg.includes("Fetching remote branches"))).toBe(true);
		expect(progressMessages.some((msg) => msg.includes("Found 3 remote branches"))).toBe(true);
		expect(progressMessages.some((msg) => msg.includes("Loaded 3 total remote tasks"))).toBe(true);
	});

	it("should handle errors gracefully", async () => {
		// Mock console.error to suppress expected error output
		const originalConsoleError = console.error;
		console.error = () => {};

		// Create a mock that throws an error
		const errorGitOps = {
			fetch: async () => {
				throw new Error("Network error");
			},
		} as unknown as GitOps;

		// Should return empty array on error
		const remoteTasks = await loadRemoteTasks(errorGitOps);
		expect(remoteTasks).toEqual([]);

		// Restore console.error
		console.error = originalConsoleError;
	});

	it("should resolve task conflicts correctly", async () => {
		const statuses = ["To Do", "In Progress", "Done"];

		const localTask: TaskWithMetadata = {
			id: "task-1",
			title: "Local Task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-06-13",
			labels: [],
			dependencies: [],
			description: "Local version",
			source: "local",
			lastModified: new Date("2025-06-13T10:00:00Z"),
		};

		const remoteTask: TaskWithMetadata = {
			id: "task-1",
			title: "Remote Task",
			status: "Done",
			assignee: [],
			createdDate: "2025-06-13",
			labels: [],
			dependencies: [],
			description: "Remote version",
			source: "remote",
			branch: "feature",
			lastModified: new Date("2025-06-13T12:00:00Z"),
		};

		// Test most_progressed strategy - should pick Done over To Do
		const resolved1 = resolveTaskConflict(localTask, remoteTask, statuses, "most_progressed");
		expect(resolved1.status).toBe("Done");
		expect(resolved1.title).toBe("Remote Task");

		// Test most_recent strategy - should pick the more recent one
		const resolved2 = resolveTaskConflict(localTask, remoteTask, statuses, "most_recent");
		expect(resolved2.lastModified).toEqual(new Date("2025-06-13T12:00:00Z"));
		expect(resolved2.title).toBe("Remote Task");
	});
});
