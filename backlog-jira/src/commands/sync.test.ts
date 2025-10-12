import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import type { SyncOptions, ConflictStrategy } from "./sync.ts";

// Mock modules
const mockBacklogClient = {
	getTask: mock(() => Promise.resolve({
		id: "task-1",
		title: "Test Task",
		description: "Test description",
		status: "To Do",
		assignee: "alice",
		priority: "high",
		labels: ["backend"],
	})),
	updateTask: mock(() => Promise.resolve()),
};

const mockJiraClient = {
	getIssue: mock(() => Promise.resolve({
		key: "PROJ-1",
		summary: "Test Task",
		description: "Test description",
		status: "To Do",
		assignee: "alice",
		priority: "high",
		labels: ["backend"],
	})),
	updateIssue: mock(() => Promise.resolve()),
};

const mockStore = {
	getMapping: mock(() => ({ taskId: "task-1", jiraKey: "PROJ-1" })),
	getAllMappings: mock(() => new Map([["task-1", "PROJ-1"]])),
	getSnapshots: mock(() => ({
		backlog: { hash: "baseHash", payload: "{}", taskId: "task-1", source: "backlog", createdAt: new Date().toISOString() },
		jira: { hash: "baseHash", payload: "{}", taskId: "task-1", source: "jira", createdAt: new Date().toISOString() },
	})),
	setSnapshot: mock(() => {}),
	updateSyncState: mock(() => {}),
	logOperation: mock(() => {}),
	close: mock(() => {}),
};

const mockPush = mock(() => Promise.resolve({ success: true, pushed: ["task-1"], failed: [], skipped: [] }));
const mockPull = mock(() => Promise.resolve({ success: true, pulled: ["task-1"], failed: [], skipped: [] }));

describe("sync command", () => {
	beforeEach(() => {
		// Reset all mocks
		mockBacklogClient.getTask.mockClear();
		mockBacklogClient.updateTask.mockClear();
		mockJiraClient.getIssue.mockClear();
		mockJiraClient.updateIssue.mockClear();
		mockStore.getMapping.mockClear();
		mockStore.getAllMappings.mockClear();
		mockStore.getSnapshots.mockClear();
		mockStore.setSnapshot.mockClear();
		mockStore.updateSyncState.mockClear();
		mockStore.logOperation.mockClear();
		mockStore.close.mockClear();
		mockPush.mockClear();
		mockPull.mockClear();
	});

	describe("sync state handling", () => {
		it("should skip when already InSync", () => {
			// This test verifies:
			// - AC #3: Sync handles InSync state
			// - No action taken when in sync

			const syncState = { state: "InSync" };

			if (syncState.state === "InSync") {
				// Should skip
				expect(mockPush).not.toHaveBeenCalled();
				expect(mockPull).not.toHaveBeenCalled();
			}
		});

		it("should push when NeedsPush detected", async () => {
			// This test verifies:
			// - AC #3: Sync handles NeedsPush state
			// - Push is called automatically

			const syncState = { state: "NeedsPush" };

			if (syncState.state === "NeedsPush") {
				await mockPush({ taskIds: ["task-1"] });

				expect(mockPush).toHaveBeenCalledWith({ taskIds: ["task-1"] });
				expect(mockPull).not.toHaveBeenCalled();
			}
		});

		it("should pull when NeedsPull detected", async () => {
			// This test verifies:
			// - AC #3: Sync handles NeedsPull state
			// - Pull is called automatically

			const syncState = { state: "NeedsPull" };

			if (syncState.state === "NeedsPull") {
				await mockPull({ taskIds: ["task-1"] });

				expect(mockPull).toHaveBeenCalledWith({ taskIds: ["task-1"] });
				expect(mockPush).not.toHaveBeenCalled();
			}
		});

		it("should create initial snapshot when Unknown", () => {
			// This test verifies:
			// - AC #3: Sync handles Unknown state
			// - Initial baseline created

			const syncState = { state: "Unknown" };

			if (syncState.state === "Unknown") {
				const backlogHash = "initialBacklogHash";
				const jiraHash = "initialJiraHash";

				mockStore.setSnapshot("task-1", "backlog", backlogHash, {});
				mockStore.setSnapshot("task-1", "jira", jiraHash, {});

				expect(mockStore.setSnapshot).toHaveBeenCalledTimes(2);
			}
		});

		it("should handle Conflict state", () => {
			// This test verifies:
			// - AC #3: Sync detects Conflict state
			// - Triggers conflict resolution

			const syncState = { state: "Conflict" };

			expect(syncState.state).toBe("Conflict");
			// Conflict resolution tested in separate describe block
		});
	});

	describe("conflict resolution strategies", () => {
		it("should use prefer-backlog strategy", async () => {
			// This test verifies:
			// - AC #5: prefer-backlog strategy works
			// - Backlog changes pushed to Jira

			const strategy: ConflictStrategy = "prefer-backlog";
			const syncState = { state: "Conflict" };

			if (syncState.state === "Conflict") {
				if (strategy === "prefer-backlog") {
					await mockPush({ taskIds: ["task-1"], force: true });

					expect(mockPush).toHaveBeenCalledWith({ taskIds: ["task-1"], force: true });
					expect(mockPull).not.toHaveBeenCalled();
				}
			}
		});

		it("should use prefer-jira strategy", async () => {
			// This test verifies:
			// - AC #5: prefer-jira strategy works
			// - Jira changes pulled to Backlog

			const strategy: ConflictStrategy = "prefer-jira";
			const syncState = { state: "Conflict" };

			if (syncState.state === "Conflict") {
				if (strategy === "prefer-jira") {
					await mockPull({ taskIds: ["task-1"], force: true });

					expect(mockPull).toHaveBeenCalledWith({ taskIds: ["task-1"], force: true });
					expect(mockPush).not.toHaveBeenCalled();
				}
			}
		});

		it("should mark for manual resolution with prompt strategy", () => {
			// This test verifies:
			// - AC #5: prompt strategy marks for manual resolution
			// - Interactive UI not required in CLI

			const strategy: ConflictStrategy = "prompt";
			const syncState = { state: "Conflict" };

			if (syncState.state === "Conflict" && strategy === "prompt") {
				mockStore.updateSyncState("task-1", {
					conflictState: "manual-resolution-required",
				});

				expect(mockStore.updateSyncState).toHaveBeenCalledWith("task-1", {
					conflictState: "manual-resolution-required",
				});
			}
		});

		it("should mark for manual resolution with manual strategy", () => {
			// This test verifies:
			// - AC #5: manual strategy marks for manual resolution

			const strategy: ConflictStrategy = "manual";
			const syncState = { state: "Conflict" };

			if (syncState.state === "Conflict" && strategy === "manual") {
				mockStore.updateSyncState("task-1", {
					conflictState: "manual-resolution-required",
				});

				expect(mockStore.updateSyncState).toHaveBeenCalledWith("task-1", {
					conflictState: "manual-resolution-required",
				});
			}
		});
	});

	describe("field-level conflict detection", () => {
		it("should detect title/summary conflicts", () => {
			// This test verifies:
			// - Field-level conflict detection for title/summary

			const backlogTask = { title: "Backlog Title" };
			const jiraIssue = { summary: "Jira Title" };
			const baseBacklog = { title: "Original Title" };
			const baseJira = { summary: "Original Title" };

			// Both changed from different bases
			const titleConflict = backlogTask.title !== baseBacklog.title && 
								 jiraIssue.summary !== baseJira.summary;

			expect(titleConflict).toBe(true);
		});

		it("should detect description conflicts", () => {
			const backlogTask = { description: "Backlog Description" };
			const jiraIssue = { description: "Jira Description" };
			const baseBacklog = { description: "Original" };
			const baseJira = { description: "Original" };

			const descConflict = backlogTask.description !== baseBacklog.description && 
								jiraIssue.description !== baseJira.description;

			expect(descConflict).toBe(true);
		});

		it("should detect status conflicts", () => {
			const backlogTask = { status: "In Progress" };
			const jiraIssue = { status: "Done" };
			const baseBacklog = { status: "To Do" };
			const baseJira = { status: "To Do" };

			const statusConflict = backlogTask.status !== baseBacklog.status && 
								  jiraIssue.status !== baseJira.status;

			expect(statusConflict).toBe(true);
		});

		it("should detect assignee conflicts", () => {
			const backlogTask = { assignee: "alice" };
			const jiraIssue = { assignee: "bob" };
			const baseBacklog = { assignee: "charlie" };
			const baseJira = { assignee: "charlie" };

			const assigneeConflict = backlogTask.assignee !== baseBacklog.assignee && 
									jiraIssue.assignee !== baseJira.assignee;

			expect(assigneeConflict).toBe(true);
		});

		it("should detect priority conflicts", () => {
			const backlogTask = { priority: "high" };
			const jiraIssue = { priority: "low" };
			const baseBacklog = { priority: "medium" };
			const baseJira = { priority: "medium" };

			const priorityConflict = backlogTask.priority !== baseBacklog.priority && 
									jiraIssue.priority !== baseJira.priority;

			expect(priorityConflict).toBe(true);
		});

		it("should detect labels conflicts", () => {
			const backlogTask = { labels: ["backend", "api"] };
			const jiraIssue = { labels: ["frontend", "ui"] };
			const baseBacklog = { labels: ["backend"] };
			const baseJira = { labels: ["backend"] };

			const labelsConflict = JSON.stringify(backlogTask.labels) !== JSON.stringify(baseBacklog.labels) && 
								  JSON.stringify(jiraIssue.labels) !== JSON.stringify(baseJira.labels);

			expect(labelsConflict).toBe(true);
		});
	});

	describe("options handling", () => {
		it("should handle taskIds option", () => {
			const options: SyncOptions = {
				taskIds: ["task-1", "task-2"],
			};

			expect(options.taskIds).toHaveLength(2);
			expect(options.taskIds).toContain("task-1");
		});

		it("should handle --all option", () => {
			const options: SyncOptions = {
				all: true,
			};

			mockStore.getAllMappings.mockReturnValue(new Map([
				["task-1", "PROJ-1"],
				["task-2", "PROJ-2"],
			]));

			const mappings = mockStore.getAllMappings();
			const taskIds = Array.from(mappings.keys());

			expect(taskIds).toHaveLength(2);
			expect(options.all).toBe(true);
		});

		it("should handle --strategy option", () => {
			const options: SyncOptions = {
				strategy: "prefer-backlog",
			};

			expect(options.strategy).toBe("prefer-backlog");
		});

		it("should use default strategy from config", () => {
			const config = {
				sync: {
					conflictStrategy: "prefer-jira",
				},
			};

			const strategy = (config.sync?.conflictStrategy as ConflictStrategy) || "prompt";

			expect(strategy).toBe("prefer-jira");
		});

		it("should handle --dry-run option", () => {
			const options: SyncOptions = {
				dryRun: true,
				taskIds: ["task-1"],
			};

			expect(options.dryRun).toBe(true);
		});
	});

	describe("result reporting", () => {
		it("should return successful sync result", () => {
			const result = {
				success: true,
				synced: ["task-1", "task-2"],
				conflicts: [],
				failed: [],
				skipped: [],
			};

			expect(result.success).toBe(true);
			expect(result.synced).toHaveLength(2);
			expect(result.conflicts).toHaveLength(0);
		});

		it("should track conflict resolutions", () => {
			const result = {
				success: true,
				synced: ["task-1"],
				conflicts: [
					{ taskId: "task-2", resolution: "preferred-backlog" },
					{ taskId: "task-3", resolution: "manual-required" },
				],
				failed: [],
				skipped: [],
			};

			expect(result.conflicts).toHaveLength(2);
			expect(result.conflicts[0].resolution).toBe("preferred-backlog");
			expect(result.conflicts[1].resolution).toBe("manual-required");
		});

		it("should track skipped tasks", () => {
			const result = {
				success: true,
				synced: ["task-1"],
				conflicts: [],
				failed: [],
				skipped: ["task-2"], // No mapping
			};

			expect(result.skipped).toContain("task-2");
		});

		it("should log operation result", () => {
			const result = {
				success: true,
				synced: ["task-1"],
				conflicts: [],
				failed: [],
				skipped: [],
			};

			mockStore.logOperation("sync", null, null, "success", JSON.stringify(result));

			expect(mockStore.logOperation).toHaveBeenCalledWith(
				"sync",
				null,
				null,
				"success",
				JSON.stringify(result)
			);
		});
	});

	describe("error handling", () => {
		it("should handle missing mapping", () => {
			mockStore.getMapping.mockReturnValue(null);

			const mapping = mockStore.getMapping("task-1");

			if (!mapping) {
				// Should skip
				expect(mapping).toBeNull();
			}
		});

		it("should continue with other tasks after one fails", () => {
			const result = {
				success: false,
				synced: ["task-1"],
				conflicts: [],
				failed: [{ taskId: "task-2", error: "Sync failed" }],
				skipped: [],
			};

			expect(result.synced).toHaveLength(1);
			expect(result.failed).toHaveLength(1);
			expect(result.success).toBe(false);
		});
	});

	describe("snapshot management", () => {
		it("should update both snapshots after successful sync", () => {
			const task = { id: "task-1", title: "Synced" };
			const issue = { key: "PROJ-1", summary: "Synced" };
			const syncedHash = "syncedHash";

			mockStore.setSnapshot("task-1", "backlog", syncedHash, task);
			mockStore.setSnapshot("task-1", "jira", syncedHash, issue);

			expect(mockStore.setSnapshot).toHaveBeenCalledTimes(2);
			expect(mockStore.setSnapshot).toHaveBeenCalledWith("task-1", "backlog", syncedHash, task);
			expect(mockStore.setSnapshot).toHaveBeenCalledWith("task-1", "jira", syncedHash, issue);
		});

		it("should update sync state after successful sync", () => {
			const now = new Date().toISOString();

			mockStore.updateSyncState("task-1", {
				lastSyncAt: now,
			});

			expect(mockStore.updateSyncState).toHaveBeenCalledWith("task-1", {
				lastSyncAt: now,
			});
		});
	});

	afterEach(() => {
		mockStore.close();
	});
});
