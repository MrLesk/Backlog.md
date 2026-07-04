import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI doc view command", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-doc-view");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doc View Project");

		await core.createDocument({
			id: "doc-1",
			title: "Architecture Overview",
			type: "guide",
			createdDate: "2026-07-04",
			rawContent: "Service topology and indexing architecture details.",
		});
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("prints document content with --plain", async () => {
		const result = await $`bun ${cliPath} doc view doc-1 --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Architecture Overview");
		expect(stdout).toContain("Service topology and indexing architecture details.");
	});

	it("falls back to plain output without --plain when not attached to a TTY", async () => {
		const result = await $`bun ${cliPath} doc view doc-1`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Service topology and indexing architecture details.");
		expect(stdout).not.toContain("[");
	});
});
