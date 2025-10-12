import { describe, expect, it } from "bun:test";
import type { Snapshot } from "../state/store.ts";
import { classifySyncState } from "./sync-state.ts";

describe("sync-state", () => {
	describe("classifySyncState", () => {
		it("should return Unknown when no snapshots exist", () => {
			const result = classifySyncState("hash1", "hash2", null, null);

			expect(result.state).toBe("Unknown");
			expect(result.backlogHash).toBe("hash1");
			expect(result.jiraHash).toBe("hash2");
		});

		it("should return Unknown when only backlog snapshot exists", () => {
			const backlogSnapshot: Snapshot = {
				taskId: "task-1",
				source: "backlog",
				hash: "baseHash",
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const result = classifySyncState("hash1", "hash2", backlogSnapshot, null);

			expect(result.state).toBe("Unknown");
		});

		it("should return Unknown when only jira snapshot exists", () => {
			const jiraSnapshot: Snapshot = {
				taskId: "task-1",
				source: "jira",
				hash: "baseHash",
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const result = classifySyncState("hash1", "hash2", null, jiraSnapshot);

			expect(result.state).toBe("Unknown");
		});

		it("should return InSync when both sides match snapshots", () => {
			const baseHash = "sameHash";

			const backlogSnapshot: Snapshot = {
				taskId: "task-1",
				source: "backlog",
				hash: baseHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const jiraSnapshot: Snapshot = {
				taskId: "task-1",
				source: "jira",
				hash: baseHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const result = classifySyncState(baseHash, baseHash, backlogSnapshot, jiraSnapshot);

			expect(result.state).toBe("InSync");
			expect(result.backlogHash).toBe(baseHash);
			expect(result.jiraHash).toBe(baseHash);
			expect(result.baseBacklogHash).toBe(baseHash);
			expect(result.baseJiraHash).toBe(baseHash);
		});

		it("should return NeedsPush when only Backlog changed", () => {
			const baseHash = "originalHash";
			const newBacklogHash = "changedBacklogHash";

			const backlogSnapshot: Snapshot = {
				taskId: "task-1",
				source: "backlog",
				hash: baseHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const jiraSnapshot: Snapshot = {
				taskId: "task-1",
				source: "jira",
				hash: baseHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const result = classifySyncState(newBacklogHash, baseHash, backlogSnapshot, jiraSnapshot);

			expect(result.state).toBe("NeedsPush");
			expect(result.backlogHash).toBe(newBacklogHash);
			expect(result.jiraHash).toBe(baseHash);
			expect(result.baseBacklogHash).toBe(baseHash);
			expect(result.baseJiraHash).toBe(baseHash);
		});

		it("should return NeedsPull when only Jira changed", () => {
			const baseHash = "originalHash";
			const newJiraHash = "changedJiraHash";

			const backlogSnapshot: Snapshot = {
				taskId: "task-1",
				source: "backlog",
				hash: baseHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const jiraSnapshot: Snapshot = {
				taskId: "task-1",
				source: "jira",
				hash: baseHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const result = classifySyncState(baseHash, newJiraHash, backlogSnapshot, jiraSnapshot);

			expect(result.state).toBe("NeedsPull");
			expect(result.backlogHash).toBe(baseHash);
			expect(result.jiraHash).toBe(newJiraHash);
			expect(result.baseBacklogHash).toBe(baseHash);
			expect(result.baseJiraHash).toBe(baseHash);
		});

		it("should return Conflict when both sides changed", () => {
			const baseHash = "originalHash";
			const newBacklogHash = "changedBacklogHash";
			const newJiraHash = "changedJiraHash";

			const backlogSnapshot: Snapshot = {
				taskId: "task-1",
				source: "backlog",
				hash: baseHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const jiraSnapshot: Snapshot = {
				taskId: "task-1",
				source: "jira",
				hash: baseHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const result = classifySyncState(newBacklogHash, newJiraHash, backlogSnapshot, jiraSnapshot);

			expect(result.state).toBe("Conflict");
			expect(result.backlogHash).toBe(newBacklogHash);
			expect(result.jiraHash).toBe(newJiraHash);
			expect(result.baseBacklogHash).toBe(baseHash);
			expect(result.baseJiraHash).toBe(baseHash);
		});

		it("should handle different base hashes for backlog and jira", () => {
			const baseBacklogHash = "baseBacklog";
			const baseJiraHash = "baseJira";
			const currentHash = "current";

			const backlogSnapshot: Snapshot = {
				taskId: "task-1",
				source: "backlog",
				hash: baseBacklogHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			const jiraSnapshot: Snapshot = {
				taskId: "task-1",
				source: "jira",
				hash: baseJiraHash,
				payload: "{}",
				createdAt: new Date().toISOString(),
			};

			// Both changed from different bases
			const result = classifySyncState(currentHash, currentHash, backlogSnapshot, jiraSnapshot);

			expect(result.state).toBe("Conflict");
			expect(result.baseBacklogHash).toBe(baseBacklogHash);
			expect(result.baseJiraHash).toBe(baseJiraHash);
		});
	});
});
