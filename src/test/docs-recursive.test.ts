import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

describe("Docs recursive listing and ID generation", () => {
	beforeEach(async () => {
		TEST_DIR = join(process.cwd(), ".tmp-test-docs-" + Math.random().toString(36).slice(2));
		await rm(TEST_DIR, { recursive: true, force: true });
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Init backlog project
		const core = new Core(TEST_DIR);
		await core.initializeProject("Docs Test");

		// Disable remote operations to simulate offline mode
		const cfg = await core.filesystem.loadConfig();
		if (cfg) {
			cfg.remoteOperations = false;
			await core.filesystem.saveConfig(cfg);
		}
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	it("lists and views documents from subdirectories and generates unique IDs", async () => {
		const core = new Core(TEST_DIR);
		// Create docs in nested paths
		await core.createDocument(
			{ id: "doc-1", title: "Top", type: "other", createdDate: "2020-01-01", body: "" },
			false,
			"",
		);
		await core.createDocument(
			{ id: "doc-2", title: "Nested A", type: "other", createdDate: "2020-01-02", body: "" },
			false,
			"guides",
		);
		await core.createDocument(
			{ id: "doc-3", title: "Nested B", type: "other", createdDate: "2020-01-03", body: "" },
			false,
			"guides/sub",
		);

		// list should include all 3
		const listOut = await $`bun ${CLI_PATH} doc list --plain`.cwd(TEST_DIR).quiet();
		const listText = listOut.stdout.toString();
		expect(listText).toContain("doc-1 - Top");
		expect(listText).toContain("doc-2 - Nested A");
		expect(listText).toContain("doc-3 - Nested B");

		// view by id in subdir should work
		const viewOut = await $`bun ${CLI_PATH} doc view doc-2`.cwd(TEST_DIR).quiet();
		expect(viewOut.exitCode).toBe(0);

		// offline ID generation should see all local docs
		const nextId = await $`bun ${CLI_PATH} doc create "Another" -p guides`.cwd(TEST_DIR).quiet();
		expect(nextId.exitCode).toBe(0);
		// Next should be doc-4 given 1..3 exist
		const docs = await core.filesystem.listDocuments();
		const hasDoc4 = docs.some((d) => d.id === "doc-4");
		expect(hasDoc4).toBe(true);
	});
});
