import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

async function runCli(args: string[], cwd = TEST_DIR) {
	return await $`bun ${[CLI_PATH, ...args]}`.cwd(cwd).nothrow().quiet();
}

describe("CLI JSON output", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-json-output");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "JSON Output Test");
		await core.createTask(
			{
				id: "task-1",
				title: "JSON task",
				status: "In Progress",
				type: "enhancement",
				priority: "high",
				assignee: ["@alex"],
				reporter: "@sam",
				createdDate: "2026-07-14 09:30",
				updatedDate: "2026-07-14 10:45",
				labels: ["cli", "json"],
				milestone: "m-1",
				dependencies: ["TASK-2"],
				references: ["https://example.com/issue"],
				documentation: ["doc-1"],
				modifiedFiles: ["src/cli.ts"],
				description: "Machine-readable output",
				implementationPlan: "1. Add formatter",
				implementationNotes: "Formatter added",
				finalSummary: "Ready for review",
				acceptanceCriteriaItems: [{ index: 1, text: "Produces JSON", checked: true }],
				definitionOfDoneItems: [{ index: 1, text: "Tests pass", checked: false }],
				comments: [{ index: 1, body: "Keep this stable", createdDate: "2026-07-14 11:00", author: "@alex" }],
				ordinal: 1000,
				branch: "secret-branch",
				rawContent: "internal markdown",
				source: "local",
				onStatusChange: "echo secret",
			},
			false,
		);

		await core.filesystem.saveDocument({
			id: "doc-1",
			title: "JSON guide",
			type: "guide",
			createdDate: "2026-07-13",
			updatedDate: "2026-07-14 08:00",
			rawContent: "JSON task documentation",
			tags: ["cli"],
			path: "guides/json.md",
		});

		await core.filesystem.saveDecision({
			id: "decision-1",
			title: "Use stable JSON",
			date: "2026-07-12",
			status: "accepted",
			context: "JSON task consumers need stability",
			decision: "Publish curated fields",
			consequences: "Version the contract",
			rawContent: "JSON task decision",
		});
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("returns a compact versioned task-list envelope", async () => {
		const result = await runCli(["task", "list", "--json"]);
		expect(result.exitCode).toBe(0);
		expect(result.stderr.toString()).toBe("");
		expect(result.stdout.toString().endsWith("\n")).toBe(true);

		const output = JSON.parse(result.stdout.toString());
		expect(output).toEqual({
			schemaVersion: 1,
			kind: "task-list",
			tasks: [
				{
					id: "TASK-1",
					title: "JSON task",
					status: "In Progress",
					type: "enhancement",
					priority: "high",
					assignees: ["@alex"],
					reporter: "@sam",
					labels: ["cli", "json"],
					milestone: "m-1",
					parentTaskId: null,
					ordinal: 1000,
					createdAt: "2026-07-14T09:30:00Z",
					updatedAt: "2026-07-14T10:45:00Z",
				},
			],
		});
		expect(result.stdout.toString()).not.toContain("rawContent");
		expect(result.stdout.toString()).not.toContain("secret-branch");
		expect(result.stdout.toString()).not.toContain("onStatusChange");
	});

	it("returns curated task details for view and shorthand", async () => {
		for (const args of [
			["task", "view", "1", "--json"],
			["task", "1", "--json"],
		]) {
			const result = await runCli(args);
			expect(result.exitCode).toBe(0);
			const output = JSON.parse(result.stdout.toString());
			expect(output.schemaVersion).toBe(1);
			expect(output.kind).toBe("task-view");
			expect(output.task.path).toMatch(/^backlog\/tasks\/task-1 - JSON-task\.md$/);
			expect(output.task.description).toBe("Machine-readable output");
			expect(output.task.dependencies).toEqual(["TASK-2"]);
			expect(output.task.acceptanceCriteria).toEqual([{ index: 1, text: "Produces JSON", checked: true }]);
			expect(output.task.definitionOfDone).toEqual([{ index: 1, text: "Tests pass", checked: false }]);
			expect(output.task.comments).toEqual([
				{
					index: 1,
					body: "Keep this stable",
					createdAt: "2026-07-14T11:00:00Z",
					author: "@alex",
				},
			]);
			expect(output.task.subtasks).toEqual([]);
			expect(output.task.finalSummary).toBe("Ready for review");
			expect(output.task.rawContent).toBeUndefined();
			expect(output.task.filePath).toBeUndefined();
			expect(output.task.branch).toBeUndefined();
		}
	});

	it("serializes an absent description as null and preserves Markdown verbatim", async () => {
		const withoutDescription = await runCli(["task", "create", "No description", "--plain"]);
		expect(withoutDescription.exitCode).toBe(0);
		const withMarkdown = await runCli([
			"task",
			"create",
			"Markdown description",
			"--description",
			"First line\n\n- item with `code`",
			"--plain",
		]);
		expect(withMarkdown.exitCode).toBe(0);

		const absent = await runCli(["task", "view", "2", "--json"]);
		expect(absent.exitCode).toBe(0);
		expect(JSON.parse(absent.stdout.toString()).task.description).toBeNull();

		const markdown = await runCli(["task", "view", "3", "--json"]);
		expect(markdown.exitCode).toBe(0);
		expect(JSON.parse(markdown.stdout.toString()).task.description).toBe("First line\n\n- item with `code`");
	});

	it("preserves heterogeneous search rank and omits scores", async () => {
		const result = await runCli(["search", "JSON task", "--json"]);
		expect(result.exitCode).toBe(0);
		const output = JSON.parse(result.stdout.toString());
		expect(output.schemaVersion).toBe(1);
		expect(output.kind).toBe("search");
		expect(output.results.map((entry: { type: string }) => entry.type)).toEqual(["task", "document", "decision"]);
		expect(output.results[0].data.id).toBe("TASK-1");
		expect(output.results[1].data).toEqual({
			id: "doc-1",
			title: "JSON guide",
			type: "guide",
			path: "backlog/docs/doc-1 - JSON-guide.md",
			tags: ["cli"],
			createdAt: "2026-07-13",
			updatedAt: "2026-07-14T08:00:00Z",
		});
		expect(output.results[2].data).toEqual({
			id: "decision-1",
			title: "Use stable JSON",
			status: "accepted",
			date: "2026-07-12",
		});
		for (const entry of output.results) {
			expect(entry.score).toBeUndefined();
		}
	});

	it("uses the configured project-relative docs directory in search paths", async () => {
		const customTestDir = createUniqueTestDir("test-cli-json-output-custom-dir");
		try {
			await mkdir(customTestDir, { recursive: true });
			await $`git init -b main`.cwd(customTestDir).quiet();
			await $`git config user.name "Test User"`.cwd(customTestDir).quiet();
			await $`git config user.email test@example.com`.cwd(customTestDir).quiet();

			const core = new Core(customTestDir);
			await initializeTestProject(core, "Custom JSON Output Test", false, "planning/backlog-data");
			await core.filesystem.saveDocument({
				id: "doc-1",
				title: "Custom guide",
				type: "guide",
				createdDate: "2026-07-15",
				rawContent: "Custom directory JSON documentation",
			});

			const result = await runCli(["search", "Custom directory JSON", "--json"], customTestDir);
			expect(result.exitCode).toBe(0);
			expect(result.stderr.toString()).toBe("");
			const output = JSON.parse(result.stdout.toString());
			expect(output.results).toHaveLength(1);
			expect(output.results[0].data.path).toBe("planning/backlog-data/docs/doc-1 - Custom-guide.md");
		} finally {
			await safeCleanup(customTestDir);
		}
	});

	it("returns successful empty envelopes", async () => {
		const list = await runCli(["task", "list", "--status", "Done", "--json"]);
		expect(JSON.parse(list.stdout.toString())).toEqual({ schemaVersion: 1, kind: "task-list", tasks: [] });

		const search = await runCli(["search", "no-such-content", "--json"]);
		expect(JSON.parse(search.stdout.toString())).toEqual({ schemaVersion: 1, kind: "search", results: [] });
	});

	it("rejects conflicting output modes without stdout", async () => {
		for (const args of [
			["task", "list", "--json", "--plain"],
			["task", "view", "1", "--json", "--plain"],
			["task", "1", "--json", "--plain"],
			["search", "JSON", "--json", "--plain"],
		]) {
			const result = await runCli(args);
			expect(result.exitCode).toBe(1);
			expect(result.stdout.toString()).toBe("");
			expect(result.stderr.toString()).toContain("--json cannot be combined with --plain");
		}
	});

	it("treats output-looking search terms after -- as literal queries", async () => {
		const json = await runCli(["search", "--json", "--", "--plain"]);
		expect(json.exitCode).toBe(0);
		expect(json.stderr.toString()).toBe("");
		expect(JSON.parse(json.stdout.toString())).toEqual({ schemaVersion: 1, kind: "search", results: [] });

		const plain = await runCli(["search", "--plain", "--", "--json"]);
		expect(plain.exitCode).toBe(0);
		expect(plain.stderr.toString()).toBe("");
		expect(plain.stdout.toString()).toContain("TASK-1 - JSON task");
	});

	it("rejects --json on unsupported task subcommands", async () => {
		for (const args of [
			["task", "archive", "999", "--json"],
			["task", "--json", "archive", "999"],
		]) {
			const result = await runCli(args);
			expect(result.exitCode).toBe(1);
			expect(result.stdout.toString()).toBe("");
			expect(result.stderr.toString()).toContain("--json");
			expect(result.stderr.toString()).not.toContain("Task 999 not found");
		}
	});

	it("uses stderr and a nonzero exit for JSON errors", async () => {
		for (const args of [
			["task", "view", "999", "--json"],
			["task", "999", "--json"],
			["task", "list", "--limit", "0", "--json"],
		]) {
			const result = await runCli(args);
			expect(result.exitCode).toBe(1);
			expect(result.stdout.toString()).toBe("");
			expect(result.stderr.toString().length).toBeGreaterThan(0);
		}
	});

	it("is parseable through a shell pipe", async () => {
		const result =
			await $`bun ${CLI_PATH} task list --json | bun -e ${"const value = await Bun.stdin.json(); console.log(value.kind);"}`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toBe("task-list\n");
	});

	it("documents JSON mode in command help", async () => {
		for (const args of [
			["task", "list", "--help"],
			["task", "view", "--help"],
			["task", "--help"],
			["search", "--help"],
		]) {
			const result = await runCli(args);
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("--json");
		}
	});
});
