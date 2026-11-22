import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

describe("CLI root entry (bare run)", () => {
	beforeEach(async () => {
		TEST_DIR = await mkdtemp(join(tmpdir(), "backlog-root-entry-"));
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	it("prints a plain local entry point in non-initialized repo", async () => {
		const result = await $`bun ${CLI_PATH}`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		expect(out).toContain("██████╗");
		expect(out).toContain("Backlog.md v");
		expect(out).toContain("This directory is not initialized for Backlog.md.");
		expect(out).toContain("Project setup:");
		expect(out).toContain("backlog init");
		expect(out).toContain("Local instructions:");
		expect(out).toContain("backlog instructions");
		expect(out).toContain("backlog instructions overview");
		expect(out).toContain("backlog <command> --help");
		expect(out).toContain("Docs: https://backlog.md");
		expect(out).not.toContain("\u001B[");
		expect(out).not.toContain("\u001B]");
	});

	it("prints a plain local entry point in initialized repo", async () => {
		// Initialize Git + project via Core
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Splash Test");

		const result = await $`bun ${CLI_PATH}`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		expect(out).toContain("██████╗");
		expect(out).toContain("Common workflow:");
		expect(out).toContain("backlog task view TASK-123 --plain");
		expect(out).toContain("backlog task create");
		expect(out).toContain("backlog board");
		expect(out).toContain("Open the TUI Kanban board");
		expect(out).toContain("backlog browser");
		expect(out).toContain("Open the Web UI Kanban board");
		expect(out).toContain("Local instructions:");
		expect(out).toContain("backlog instructions task-execution");
		expect(out).not.toContain("backlog init");
		expect(out).toContain("Docs: https://backlog.md");
		expect(out).not.toContain("\u001B[");
		expect(out).not.toContain("\u001B]");
	});

	it("--help shows commander help, not the root entry", async () => {
		const result = await $`bun ${CLI_PATH} --help`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		expect(out).toMatch(/Usage: .*backlog/);
		expect(out).not.toContain("Local instructions:");
	});
});

import { initializeFilesystemTestProject } from "./test-utils.ts";
