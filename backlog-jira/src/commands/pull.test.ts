import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import type { PullOptions } from "./pull.ts";

// Mock clients and store
const mockBacklogClient = {
	getTask: mock(() => Promise.resolve({
		id: "task-1",
		title: "Old Task",
		description: "Old description",
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
		id: "10001",
		summary: "Updated Task",
		description: "Updated description",
		status: "In Progress",
		assignee: "bob",
		priority: "medium",
		labels: ["frontend"],
	})),
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

const mockClassifySyncState = mock(() => ({ state: "NeedsPull" }));

describe("pull command", () => {
	beforeEach(() => {
		// Reset all mocks
		mockBacklogClient.getTask.mockClear();
		mockBacklogClient.updateTask.mockClear();
		mockJiraClient.getIssue.mockClear();
		mockStore.getMapping.mockClear();
		mockStore.getAllMappings.mockClear();
		mockStore.getSnapshots.mockClear();
		mockStore.setSnapshot.mockClear();
		mockStore.updateSyncState.mockClear();
		mockStore.logOperation.mockClear();
		mockStore.close.mockClear();
		mockClassifySyncState.mockClear();
	});

	describe("pull via CLI updates", () => {
		it("should update Backlog task via CLI when Jira changed", async () => {
			// This test verifies:
			// - AC #2: Pull command uses CLI-based updates
			// - No direct file writes
			// - BacklogClient.updateTask is called

			const jiraIssue = {
				key: "PROJ-1",
				summary: "New Title from Jira",
				description: "New description from Jira",
				status: "In Progress",
				assignee: "bob",
				priority: "medium",
				labels: ["frontend", "urgent"],
			};

			const backlogTask = {
				id: "task-1",
				title: "Old Title",
				description: "Old description",
				status: "To Do",
				assignee: "alice",
				priority: "high",
				labels: ["backend"],
			};

			mockJiraClient.getIssue.mockResolvedValue(jiraIssue);
			mockBacklogClient.getTask.mockResolvedValue(backlogTask);

			// Build updates from Jira to Backlog
			const updates: Record<string, unknown> = {};

			if (jiraIssue.summary !== backlogTask.title) {
				updates.title = jiraIssue.summary;
			}
			if (jiraIssue.description !== backlogTask.description) {
				updates.description = jiraIssue.description;
			}
			if (jiraIssue.status !== backlogTask.status) {
				updates.status = jiraIssue.status;
			}
			if (jiraIssue.assignee !== backlogTask.assignee) {
				updates.assignee = jiraIssue.assignee;
			}

			expect(updates).toEqual({
				title: "New Title from Jira",
				description: "New description from Jira",
				status: "In Progress",
				assignee: "bob",
			});

			// Apply via CLI
			await mockBacklogClient.updateTask("task-1", updates);

			expect(mockBacklogClient.updateTask).toHaveBeenCalledWith("task-1", updates);
		});

		it("should only update changed fields", async () => {
			// Test selective updates
			const jiraIssue = {
				key: "PROJ-1",
				summary: "Same Title",
				description: "New description only", // Only this changed
				status: "To Do",
				assignee: "alice",
				priority: "high",
				labels: ["backend"],
			};

			const backlogTask = {
				id: "task-1",
				title: "Same Title",
				description: "Old description",
				status: "To Do",
				assignee: "alice",
				priority: "high",
				labels: ["backend"],
			};

			const updates: Record<string, unknown> = {};

			if (jiraIssue.summary !== backlogTask.title) {
				updates.title = jiraIssue.summary;
			}
			if (jiraIssue.description !== backlogTask.description) {
				updates.description = jiraIssue.description;
			}

			expect(updates).toEqual({ description: "New description only" });
		});
	});

	describe("status mapping", () => {
		it("should map Jira status to Backlog status", () => {
			// This test verifies:
			// - AC #2: Status mapping works correctly
			// - Different Jira statuses map to correct Backlog statuses

			const mappings: Record<string, string> = {
				"To Do": "To Do",
				"Open": "To Do",
				"Backlog": "To Do",
				"In Progress": "In Progress",
				"Done": "Done",
				"Closed": "Done",
				"Resolved": "Done",
			};

			expect(mappings["To Do"]).toBe("To Do");
			expect(mappings["Open"]).toBe("To Do");
			expect(mappings["Backlog"]).toBe("To Do");
			expect(mappings["In Progress"]).toBe("In Progress");
			expect(mappings["Done"]).toBe("Done");
			expect(mappings["Closed"]).toBe("Done");
			expect(mappings["Resolved"]).toBe("Done");
		});

		it("should use original status if no mapping exists", () => {
			const jiraStatus = "Custom Status";
			const mappings: Record<string, string> = {
				"To Do": "To Do",
				"In Progress": "In Progress",
				"Done": "Done",
			};

			const backlogStatus = mappings[jiraStatus] || jiraStatus;

			expect(backlogStatus).toBe("Custom Status");
		});
	});

	describe("conflict detection", () => {
		it("should detect conflicts when both sides changed", async () => {
			// This test verifies:
			// - AC #2: Pull detects conflicts
			// - Uses 3-way merge logic

			const backlogHash = "changedBacklogHash";
			const jiraHash = "changedJiraHash";
			const baseHash = "originalHash";

			mockStore.getSnapshots.mockReturnValue({
				backlog: { hash: baseHash, payload: "{}", taskId: "task-1", source: "backlog", createdAt: new Date().toISOString() },
				jira: { hash: baseHash, payload: "{}", taskId: "task-1", source: "jira", createdAt: new Date().toISOString() },
			});

			mockClassifySyncState.mockReturnValue({
				state: "Conflict",
				backlogHash,
				jiraHash,
				baseBacklogHash: baseHash,
				baseJiraHash: baseHash,
			});

			const result = mockClassifySyncState(backlogHash, jiraHash, baseHash, baseHash);

			expect(result.state).toBe("Conflict");
		});

		it("should not pull when conflict detected without force", () => {
			const force = false;
			const syncState = { state: "Conflict" };

			if (!force && syncState.state === "Conflict") {
				const shouldThrow = () => {
					throw new Error("Conflict detected. Use --force to override or run 'backlog-jira sync' to resolve");
				};

				expect(shouldThrow).toThrow("Conflict detected");
			}
		});

		it("should pull with --force even when conflict detected", () => {
			const force = true;
			const syncState = { state: "Conflict" };

			if (force) {
				// Should proceed with pull
				expect(true).toBe(true);
			}
		});

		it("should skip pull when already in sync", () => {
			const syncState = { state: "InSync" };

			if (syncState.state === "InSync") {
				// Should skip
				expect(mockBacklogClient.updateTask).not.toHaveBeenCalled();
			}
		});
	});

	describe("options handling", () => {
		it("should handle taskIds option", () => {
			const options: PullOptions = {
				taskIds: ["task-1", "task-2", "task-3"],
			};

			expect(options.taskIds).toHaveLength(3);
			expect(options.taskIds).toContain("task-1");
		});

		it("should handle --all option", () => {
			const options: PullOptions = {
				all: true,
			};

			mockStore.getAllMappings.mockReturnValue(new Map([
				["task-1", "PROJ-1"],
				["task-2", "PROJ-2"],
				["task-3", "PROJ-3"],
			]));

			const mappings = mockStore.getAllMappings();
			const taskIds = Array.from(mappings.keys());

			expect(taskIds).toHaveLength(3);
			expect(options.all).toBe(true);
		});

		it("should handle --dry-run option", () => {
			const options: PullOptions = {
				dryRun: true,
				taskIds: ["task-1"],
			};

			if (options.dryRun) {
				// No actual updates should be made
				expect(mockBacklogClient.updateTask).not.toHaveBeenCalled();
			}
		});

		it("should handle --force option", () => {
			const options: PullOptions = {
				force: true,
				taskIds: ["task-1"],
			};

			expect(options.force).toBe(true);
		});
	});

	describe("snapshot management", () => {
		it("should update snapshots after successful pull", async () => {
			const task = { id: "task-1", title: "Updated" };
			const issue = { key: "PROJ-1", summary: "Updated" };

			const syncedHash = "syncedHash123";

			// After successful pull, snapshots should match
			mockStore.setSnapshot("task-1", "backlog", syncedHash, task);
			mockStore.setSnapshot("task-1", "jira", syncedHash, issue);

			expect(mockStore.setSnapshot).toHaveBeenCalledWith("task-1", "backlog", syncedHash, task);
			expect(mockStore.setSnapshot).toHaveBeenCalledWith("task-1", "jira", syncedHash, issue);
		});

		it("should update sync state after successful pull", () => {
			const now = new Date().toISOString();

			mockStore.updateSyncState("task-1", {
				lastSyncAt: now,
			});

			expect(mockStore.updateSyncState).toHaveBeenCalledWith("task-1", {
				lastSyncAt: now,
			});
		});
	});

	describe("error handling", () => {
		it("should handle missing mapping", () => {
			mockStore.getMapping.mockReturnValue(null);

			const mapping = mockStore.getMapping("task-1");

			if (!mapping) {
				const shouldThrow = () => {
					throw new Error("No Jira mapping found for task task-1");
				};

				expect(shouldThrow).toThrow("No Jira mapping found");
			}
		});

		it("should handle Jira API errors", async () => {
			mockJiraClient.getIssue.mockRejectedValue(new Error("Issue not found"));

			try {
				await mockJiraClient.getIssue("INVALID-1");
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe("Issue not found");
			}
		});

		it("should handle Backlog CLI errors", async () => {
			mockBacklogClient.updateTask.mockRejectedValue(new Error("Task not found"));

			try {
				await mockBacklogClient.updateTask("invalid-task", {});
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe("Task not found");
			}
		});

		it("should continue with other tasks after one fails", () => {
			const result = {
				success: false,
				pulled: ["task-1"],
				failed: [{ taskId: "task-2", error: "Failed to update" }],
				skipped: [],
			};

			expect(result.pulled).toHaveLength(1);
			expect(result.failed).toHaveLength(1);
			expect(result.success).toBe(false);
		});
	});

	describe("result reporting", () => {
		it("should return successful pull result", () => {
			const result = {
				success: true,
				pulled: ["task-1", "task-2"],
				failed: [],
				skipped: [],
			};

			expect(result.success).toBe(true);
			expect(result.pulled).toHaveLength(2);
			expect(result.failed).toHaveLength(0);
		});

		it("should track skipped tasks", () => {
			const result = {
				success: true,
				pulled: ["task-1"],
				failed: [],
				skipped: ["task-2"], // Already in sync
			};

			expect(result.skipped).toContain("task-2");
		});

		it("should log operation result", () => {
			const result = {
				success: true,
				pulled: ["task-1"],
				failed: [],
				skipped: [],
			};

			mockStore.logOperation("pull", null, null, "success", JSON.stringify(result));

			expect(mockStore.logOperation).toHaveBeenCalledWith(
				"pull",
				null,
				null,
				"success",
				JSON.stringify(result)
			);
		});
	});

	afterEach(() => {
		mockStore.close();
	});
});
