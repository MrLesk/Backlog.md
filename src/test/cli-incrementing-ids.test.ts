import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Decision, Document, Task } from "../types";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

describe("CLI ID Incrementing Behavior", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-incrementing-ids");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		// Initialize git repository first to avoid interactive prompts and ensure consistency
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await core.initializeProject("ID Incrementing Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
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

		const result = await $`bun ${CLI_PATH} task create "Second Task"`.cwd(TEST_DIR).quiet();

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

		const result = await $`bun ${CLI_PATH} doc create "Second Doc"`.cwd(TEST_DIR).quiet();

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

		const result = await $`bun ${CLI_PATH} decision create "Second Decision"`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Created decision decision-2");

		const decision2 = await core.filesystem.loadDecision("decision-2");
		expect(decision2).not.toBeNull();
		expect(decision2?.title).toBe("Second Decision");
	});
});
