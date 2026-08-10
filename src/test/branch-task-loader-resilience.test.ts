import { describe, expect, it } from "bun:test";
import { BranchTaskLoader } from "../core/task-loader.ts";
import type { GitOperations } from "../git/operations.ts";
import type { BacklogConfig } from "../types/index.ts";

const config: BacklogConfig = {
	projectName: "Branch loader resilience",
	statuses: ["To Do", "Done"],
	labels: [],
	milestones: [],
	dateFormat: "YYYY-MM-DD",
	checkActiveBranches: true,
	activeBranchDays: 30,
	remoteOperations: true,
	prefixes: { task: "task" },
};

describe("BranchTaskLoader resilience", () => {
	it("skips one unreadable branch while loading healthy branches", async () => {
		const currentCommit = "0".repeat(40);
		const badCommit = "1".repeat(40);
		const goodCommit = "2".repeat(40);
		const taskPath = "backlog/tasks/task-17 - Healthy task.md";
		const treeCalls = new Set<string>();
		const git = {
			listFilesInTree: async (commit: string) => {
				treeCalls.add(commit);
				if (commit === badCommit) throw new Error("branch tree is unavailable");
				if (commit === goodCommit) return [taskPath];
				throw new Error(`unexpected commit ${commit}`);
			},
			getBranchLastModifiedMap: async (commit: string) => {
				expect(commit).toBe(goodCommit);
				return new Map([[taskPath, new Date("2026-08-10T00:00:00Z")]]);
			},
			showFile: async (commit: string, path: string) => {
				expect(commit).toBe(goodCommit);
				expect(path).toBe(taskPath);
				return `---
id: TASK-17
title: Healthy task
status: To Do
assignee: []
created_date: 2026-08-10
labels: []
dependencies: []
---

## Description

Loaded despite the neighboring branch failure.`;
			},
		} as unknown as GitOperations;

		const result = await new BranchTaskLoader(git).load(
			[
				{ name: "main", commit: currentCommit, current: true },
				{ name: "feature/bad", commit: badCommit, current: false },
				{ name: "origin/feature/good", commit: goodCommit, current: false },
			],
			config,
			[],
			false,
		);

		expect(result.complete).toBe(false);
		const entries = result.entries;
		expect(treeCalls).toEqual(new Set([badCommit, goodCommit]));
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			id: "TASK-17",
			branch: "origin/feature/good",
			type: "task",
		});
		expect(entries[0]?.task).toMatchObject({
			id: "TASK-17",
			title: "Healthy task",
			source: "remote",
			branch: "feature/good",
		});
	});

	it("retries a commit index after a transient history failure", async () => {
		const currentCommit = "0".repeat(40);
		const featureCommit = "1".repeat(40);
		const taskPath = "backlog/tasks/task-18 - Retried task.md";
		let treeCalls = 0;
		let historyCalls = 0;
		let blobCalls = 0;
		const git = {
			listFilesInTree: async (commit: string) => {
				expect(commit).toBe(featureCommit);
				treeCalls += 1;
				return [taskPath];
			},
			getBranchLastModifiedMap: async (commit: string) => {
				expect(commit).toBe(featureCommit);
				historyCalls += 1;
				if (historyCalls === 1) throw new Error("history temporarily unavailable");
				return new Map([[taskPath, new Date("2026-08-10T00:00:00Z")]]);
			},
			showFile: async (commit: string, path: string) => {
				expect(commit).toBe(featureCommit);
				expect(path).toBe(taskPath);
				blobCalls += 1;
				return `---
id: TASK-18
title: Retried task
status: To Do
assignee: []
created_date: 2026-08-10
labels: []
dependencies: []
---

## Description

Loaded after retrying the failed history query.`;
			},
		} as unknown as GitOperations;
		const loader = new BranchTaskLoader(git);
		const tips = [
			{ name: "main", commit: currentCommit, current: true },
			{ name: "origin/feature/retry", commit: featureCommit, current: false },
		];

		expect(await loader.load(tips, config, [], false)).toEqual({ entries: [], complete: false });
		const result = await loader.load(tips, config, [], false);
		const entries = result.entries;

		expect(result.complete).toBe(true);
		expect(treeCalls).toBe(2);
		expect(historyCalls).toBe(2);
		expect(blobCalls).toBe(1);
		expect(entries[0]?.task).toMatchObject({
			id: "TASK-18",
			title: "Retried task",
			source: "remote",
			branch: "feature/retry",
		});
	});

	it("retries a transient hydration failure without rebuilding the commit index", async () => {
		const currentCommit = "0".repeat(40);
		const featureCommit = "3".repeat(40);
		const taskPath = "backlog/tasks/task-19 - Retried hydration.md";
		let treeCalls = 0;
		let historyCalls = 0;
		let blobCalls = 0;
		const git = {
			listFilesInTree: async () => {
				treeCalls += 1;
				return [taskPath];
			},
			getBranchLastModifiedMap: async () => {
				historyCalls += 1;
				return new Map([[taskPath, new Date("2026-08-10T00:00:00Z")]]);
			},
			showFile: async () => {
				blobCalls += 1;
				if (blobCalls === 1) throw new Error("blob temporarily unavailable");
				return `---
id: TASK-19
title: Retried hydration
status: To Do
assignee: []
created_date: 2026-08-10
labels: []
dependencies: []
---

## Description

Loaded after retrying the failed blob read.`;
			},
		} as unknown as GitOperations;
		const loader = new BranchTaskLoader(git);
		const tips = [
			{ name: "main", commit: currentCommit, current: true },
			{ name: "feature/retry", commit: featureCommit, current: false },
		];

		const first = await loader.load(tips, config, [], false);
		expect(first.complete).toBe(false);
		expect(first.entries[0]?.task).toBeUndefined();

		const second = await loader.load(tips, config, [], false);
		expect(second.complete).toBe(true);
		expect(second.entries[0]?.task?.title).toBe("Retried hydration");
		expect({ treeCalls, historyCalls, blobCalls }).toEqual({
			treeCalls: 1,
			historyCalls: 1,
			blobCalls: 2,
		});
	});

	it("caches an immutable malformed task without leaving the generation unhealthy", async () => {
		const currentCommit = "0".repeat(40);
		const featureCommit = "4".repeat(40);
		const taskPath = "backlog/tasks/task-20 - Malformed.md";
		let treeCalls = 0;
		let historyCalls = 0;
		let blobCalls = 0;
		const git = {
			listFilesInTree: async () => {
				treeCalls += 1;
				return [taskPath];
			},
			getBranchLastModifiedMap: async () => {
				historyCalls += 1;
				return new Map([[taskPath, new Date("2026-08-10T00:00:00Z")]]);
			},
			showFile: async () => {
				blobCalls += 1;
				return "---\nid: [unterminated\n---";
			},
		} as unknown as GitOperations;
		const loader = new BranchTaskLoader(git);
		const tips = [
			{ name: "main", commit: currentCommit, current: true },
			{ name: "feature/malformed", commit: featureCommit, current: false },
		];

		const first = await loader.load(tips, config, [], false);
		expect(first.complete).toBe(true);
		expect(first.entries[0]?.task).toBeUndefined();
		const second = await loader.load(tips, config, [], false);
		expect(second.complete).toBe(true);
		expect(second.entries[0]?.task).toBeUndefined();
		expect({ treeCalls, historyCalls, blobCalls }).toEqual({
			treeCalls: 1,
			historyCalls: 1,
			blobCalls: 1,
		});
	});
});
