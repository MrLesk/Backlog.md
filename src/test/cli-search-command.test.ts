import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI search command", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-cli-search");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await core.initializeProject("Search Command Project");

		await core.createTask(
			{
				id: "task-1",
				title: "Central search integration",
				status: "To Do",
				assignee: ["@codex"],
				createdDate: "2025-09-18",
				labels: ["search"],
				dependencies: [],
				rawContent: "Implements central search module",
				description: "Implements central search module",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-2",
				title: "High priority follow-up",
				status: "In Progress",
				assignee: ["@codex"],
				createdDate: "2025-09-18",
				labels: ["search"],
				dependencies: [],
				rawContent: "Follow-up work",
				description: "Follow-up work",
				priority: "high",
			},
			false,
		);

		await core.filesystem.saveDocument({
			id: "doc-1",
			title: "Search Architecture Notes",
			type: "guide",
			createdDate: "2025-09-18",
			rawContent: "# Search Architecture Notes\nCentral search design",
		});

		await core.filesystem.saveDecision({
			id: "decision-1",
			title: "Adopt centralized search",
			date: "2025-09-18",
			status: "accepted",
			context: "Discussed search consolidation",
			decision: "Adopt shared Fuse index",
			consequences: "Unified search paths",
			rawContent: "## Context\nDiscussed search consolidation\n\n## Decision\nAdopt shared Fuse index",
		});
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("returns matching tasks, documents, and decisions in plain output", async () => {
		const result = await $`bun ${cliPath} search central --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Tasks:");
		expect(stdout).toContain("task-1 - Central search integration");
		expect(stdout).toContain("Documents:");
		expect(stdout).toContain("doc-1 - Search Architecture Notes");
		expect(stdout).toContain("Decisions:");
		expect(stdout).toContain("decision-1 - Adopt centralized search");
	});

	it("honors status and priority filters for task results", async () => {
		const statusResult = await $`bun ${cliPath} search follow-up --type task --status "In Progress" --plain`
			.cwd(TEST_DIR)
			.quiet();
		expect(statusResult.exitCode).toBe(0);
		const statusStdout = statusResult.stdout.toString();
		expect(statusStdout).toContain("task-2 - High priority follow-up");
		expect(statusStdout).not.toContain("task-1 - Central search integration");

		const priorityResult = await $`bun ${cliPath} search follow-up --type task --priority high --plain`
			.cwd(TEST_DIR)
			.quiet();
		expect(priorityResult.exitCode).toBe(0);
		const priorityStdout = priorityResult.stdout.toString();
		expect(priorityStdout).toContain("task-2 - High priority follow-up");
	});

	it("applies result limit", async () => {
		const result = await $`bun ${cliPath} search search --plain --limit 1`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		const taskMatches = stdout.match(/task-\d+ -/g) || [];
		expect(taskMatches.length).toBeLessThanOrEqual(1);
	});
});
