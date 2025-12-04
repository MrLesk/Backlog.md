import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { clearProjectRootCache, findBacklogRoot } from "../utils/find-backlog-root.ts";

describe("findBacklogRoot", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `backlog-root-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
		clearProjectRootCache();
	});

	afterEach(async () => {
		clearProjectRootCache();
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should find root when backlog/ directory exists at start dir", async () => {
		// Create backlog structure at root
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});

	it("should find root when backlog.json exists at start dir", async () => {
		// Create backlog.json at root
		await writeFile(join(testDir, "backlog.json"), JSON.stringify({ name: "Test" }));

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});

	it("should find root from a subfolder", async () => {
		// Create backlog structure at root
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });

		// Create nested subfolder
		const subfolder = join(testDir, "src", "components", "ui");
		await mkdir(subfolder, { recursive: true });

		const result = await findBacklogRoot(subfolder);
		expect(result).toBe(testDir);
	});

	it("should find root from deeply nested subfolder", async () => {
		// Create backlog.json at root
		await writeFile(join(testDir, "backlog.json"), JSON.stringify({ name: "Test" }));

		// Create deeply nested subfolder
		const deepFolder = join(testDir, "a", "b", "c", "d", "e", "f");
		await mkdir(deepFolder, { recursive: true });

		const result = await findBacklogRoot(deepFolder);
		expect(result).toBe(testDir);
	});

	it("should return null when no backlog project found", async () => {
		// Create a folder with no backlog setup
		const emptyFolder = join(testDir, "empty");
		await mkdir(emptyFolder, { recursive: true });

		const result = await findBacklogRoot(emptyFolder);
		expect(result).toBeNull();
	});

	it("should prefer backlog/ directory over git root", async () => {
		// Initialize git repo
		await $`git init`.cwd(testDir).quiet();

		// Create backlog in a subfolder (simulating monorepo)
		const projectFolder = join(testDir, "packages", "my-project");
		await mkdir(join(projectFolder, "backlog", "tasks"), { recursive: true });

		// Search from within the project
		const searchDir = join(projectFolder, "src");
		await mkdir(searchDir, { recursive: true });

		const result = await findBacklogRoot(searchDir);
		expect(result).toBe(projectFolder);
	});

	it("should find git root with backlog as fallback", async () => {
		// Initialize git repo with backlog at root
		await $`git init`.cwd(testDir).quiet();
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });

		// Create subfolder without its own backlog
		const subfolder = join(testDir, "packages", "lib");
		await mkdir(subfolder, { recursive: true });

		const result = await findBacklogRoot(subfolder);
		expect(result).toBe(testDir);
	});

	it("should not use git root if it has no backlog setup", async () => {
		// Initialize git repo WITHOUT backlog
		await $`git init`.cwd(testDir).quiet();

		// Create subfolder
		const subfolder = join(testDir, "src");
		await mkdir(subfolder, { recursive: true });

		const result = await findBacklogRoot(subfolder);
		expect(result).toBeNull();
	});

	it("should handle nested git repos - find nearest backlog root", async () => {
		// Initialize outer git repo with backlog
		await $`git init`.cwd(testDir).quiet();
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });

		// Create inner project with its own backlog (nested repo scenario)
		const innerProject = join(testDir, "packages", "inner");
		await mkdir(innerProject, { recursive: true });
		await $`git init`.cwd(innerProject).quiet();
		await mkdir(join(innerProject, "backlog", "tasks"), { recursive: true });

		// Search from within inner project
		const innerSrc = join(innerProject, "src");
		await mkdir(innerSrc, { recursive: true });

		const result = await findBacklogRoot(innerSrc);
		// Should find the inner project's backlog, not the outer one
		expect(result).toBe(innerProject);
	});

	it("should handle backlog/ with config.yaml", async () => {
		// Create backlog structure with config.yaml instead of tasks/
		await mkdir(join(testDir, "backlog"), { recursive: true });
		await writeFile(join(testDir, "backlog", "config.yaml"), "name: Test");

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});
});
