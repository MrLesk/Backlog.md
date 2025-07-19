import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Decision, Document, Task } from "../types";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("CLI ID Incrementing Behavior", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-test-"));
		core = new Core(testDir);
		// Initialize git repository first to avoid interactive prompts and ensure consistency
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		await core.initializeProject("ID Incrementing Test");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("should increment task IDs correctly", async () => {
		const task1: Task = {
			id: "task-1",
			title: "First Task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			body: "A test task.",
		};
		await core.createTask(task1);

		const result = await $`bun ${CLI_PATH} task create "Second Task"`.cwd(testDir).quiet();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Created task task-2");

		const task2 = await core.filesystem.loadTask("task-2");
		expect(task2).toBeDefined();
		expect(task2?.title).toBe("Second Task");
	});

	test("should increment document IDs correctly", async () => {
		const doc1: Document = {
			id: "doc-1",
			title: "First Doc",
			type: "other",
			createdDate: "",
			body: "",
		};
		await core.createDocument(doc1);

		const result = await $`bun ${CLI_PATH} doc create "Second Doc"`.cwd(testDir).quiet();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Created document doc-2");

		const docs = await core.filesystem.listDocuments();
		const doc2 = docs.find((d) => d.id === "doc-2");
		expect(doc2).toBeDefined();
		expect(doc2?.title).toBe("Second Doc");
	});

	test("should increment decision IDs correctly", async () => {
		const decision1: Decision = {
			id: "decision-1",
			title: "First Decision",
			date: "",
			status: "proposed",
			context: "",
			decision: "",
			consequences: "",
		};
		await core.createDecision(decision1);

		const result = await $`bun ${CLI_PATH} decision create "Second Decision"`.cwd(testDir).quiet();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Created decision decision-2");

		const decision2 = await core.filesystem.loadDecision("decision-2");
		expect(decision2).not.toBeNull();
		expect(decision2?.title).toBe("Second Decision");
	});
});
