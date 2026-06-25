import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI doc search command", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-doc-search");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doc Search Project");

		await core.createDocument(
			{
				id: "doc-1",
				title: "Architecture Overview",
				type: "guide",
				createdDate: "2026-06-13",
				rawContent: "Service topology and indexing architecture details.",
				tags: ["architecture", "search"],
			},
			false,
			"guides",
		);

		await core.createDocument(
			{
				id: "doc-2",
				title: "Architecture Runbook",
				type: "specification",
				createdDate: "2026-06-13",
				rawContent: "Operational architecture procedures.",
			},
			false,
			"runbooks",
		);

		await core.createDocument(
			{
				id: "doc-3",
				title: "Support Playbook",
				type: "other",
				createdDate: "2026-06-13",
				rawContent: "Customer support response steps.",
			},
			false,
		);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("searches documents with plain agent-readable identity and follow-up context", async () => {
		const result = await $`bun ${cliPath} doc search architecture`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Documents:");
		expect(stdout).toContain(
			"doc-1 - Architecture Overview (path: guides/doc-1 - Architecture-Overview.md, type: guide, tags: architecture, search)",
		);
		expect(stdout).toContain("View: backlog doc view doc-1");
		expect(stdout).toMatch(/\[score [0-1]\.\d{3}]/);
		expect(stdout).not.toContain("Support Playbook");
	});

	it("prints a query-specific no-result message", async () => {
		const result = await $`bun ${cliPath} doc search zzzzzzzz`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString().trim()).toBe('No documents found for "zzzzzzzz".');
	});

	it("limits document search results", async () => {
		const result = await $`bun ${cliPath} doc search architecture --limit 1`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		const documentLines = stdout.match(/^ {2}doc-/gm) ?? [];
		expect(documentLines).toHaveLength(1);
		expect(stdout).toContain("View: backlog doc view");
	});

	it("rejects missing or invalid query and limit inputs", async () => {
		const missingQuery = await $`bun ${cliPath} doc search`.cwd(TEST_DIR).nothrow().quiet();
		const emptyQuery = await $`bun ${cliPath} doc search ${""}`.cwd(TEST_DIR).nothrow().quiet();
		const longQuery = await $`bun ${cliPath} doc search ${"a".repeat(201)}`.cwd(TEST_DIR).nothrow().quiet();
		const zeroLimit = await $`bun ${cliPath} doc search architecture --limit 0`.cwd(TEST_DIR).nothrow().quiet();
		const highLimit = await $`bun ${cliPath} doc search architecture --limit 101`.cwd(TEST_DIR).nothrow().quiet();
		const textLimit = await $`bun ${cliPath} doc search architecture --limit many`.cwd(TEST_DIR).nothrow().quiet();

		const missingQueryOutput = missingQuery.stdout.toString() + missingQuery.stderr.toString();
		const emptyQueryOutput = emptyQuery.stdout.toString() + emptyQuery.stderr.toString();
		const longQueryOutput = longQuery.stdout.toString() + longQuery.stderr.toString();
		const zeroLimitOutput = zeroLimit.stdout.toString() + zeroLimit.stderr.toString();
		const highLimitOutput = highLimit.stdout.toString() + highLimit.stderr.toString();
		const textLimitOutput = textLimit.stdout.toString() + textLimit.stderr.toString();

		expect(missingQuery.exitCode).not.toBe(0);
		expect(missingQueryOutput).toContain("missing required argument 'query'");
		expect(missingQueryOutput).toContain("Run with --help");
		expect(emptyQuery.exitCode).not.toBe(0);
		// Bun's shell strips empty string args so CLI sees missing required argument
		expect(emptyQueryOutput).toMatch(/Query is required|missing required argument 'query'/);
		expect(longQuery.exitCode).not.toBe(0);
		expect(longQueryOutput).toContain("Query must be 200 characters or fewer.");
		expect(zeroLimit.exitCode).not.toBe(0);
		expect(zeroLimitOutput).toContain("Limit must be an integer between 1 and 100.");
		expect(highLimit.exitCode).not.toBe(0);
		expect(highLimitOutput).toContain("Limit must be an integer between 1 and 100.");
		expect(textLimit.exitCode).not.toBe(0);
		expect(textLimitOutput).toContain("Invalid limit: many.");
	});

	it("documents the input schema and output shape in help", async () => {
		const help = await $`bun ${cliPath} doc search --help`.cwd(TEST_DIR).text();

		expect(help).toContain("Input schema:");
		expect(help).toContain("Required fields:");
		expect(help).toContain("query: String");
		expect(help).toContain("Optional fields:");
		expect(help).toContain("limit: Integer");
		expect(help).toContain("Reads:");
		expect(help).toContain("Writes:");
		expect(help).toContain("None; this is a read-only command");
		expect(help).toContain("Output:");
		expect(help).toContain("Plain text Documents list");
		expect(help).toContain('backlog doc search "architecture"');
		expect(help).toContain('backlog doc search "runbook" --limit 5');
	});
});
