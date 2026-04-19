import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { clearProjectRootCache, findBacklogRoot } from "../utils/find-backlog-root.ts";
import { safeCleanup } from "./test-utils.ts";

describe("findBacklogRoot", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `backlog-root-test-${randomUUID()}`);
		await mkdir(testDir, { recursive: true });
		clearProjectRootCache();
	});

	afterEach(async () => {
		clearProjectRootCache();
		await safeCleanup(testDir);
	});

	it("should find root when backlog/ directory with config exists at start dir", async () => {
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });
		await writeFile(join(testDir, "backlog", "config.yml"), "project_name: Test\n");

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});

	it("should find root when .backlog/ directory with config exists at start dir", async () => {
		await mkdir(join(testDir, ".backlog", "tasks"), { recursive: true });
		await writeFile(join(testDir, ".backlog", "config.yml"), "project_name: Test\n");

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});

	it("should NOT find root for bare backlog/ directory without config", async () => {
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });

		const result = await findBacklogRoot(testDir);
		expect(result).toBeNull();
	});

	it("should find root when backlog.json exists at start dir", async () => {
		// Create backlog.json at root
		await writeFile(join(testDir, "backlog.json"), JSON.stringify({ name: "Test" }));

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});

	it("should find root from a subfolder", async () => {
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });
		await writeFile(join(testDir, "backlog", "config.yml"), "project_name: Test\n");

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
		await $`git init`.cwd(testDir).quiet();

		// Create backlog with config in a subfolder (simulating monorepo)
		const projectFolder = join(testDir, "packages", "my-project");
		await mkdir(join(projectFolder, "backlog", "tasks"), { recursive: true });
		await writeFile(join(projectFolder, "backlog", "config.yml"), "project_name: Test\n");

		const searchDir = join(projectFolder, "src");
		await mkdir(searchDir, { recursive: true });

		const result = await findBacklogRoot(searchDir);
		expect(result).toBe(projectFolder);
	});

	it("should find git root with backlog as fallback", async () => {
		await $`git init`.cwd(testDir).quiet();
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });
		await writeFile(join(testDir, "backlog", "config.yml"), "project_name: Test\n");

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
		await $`git init`.cwd(testDir).quiet();
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });
		await writeFile(join(testDir, "backlog", "config.yml"), "project_name: Outer\n");

		const innerProject = join(testDir, "packages", "inner");
		await mkdir(innerProject, { recursive: true });
		await $`git init`.cwd(innerProject).quiet();
		await mkdir(join(innerProject, "backlog", "tasks"), { recursive: true });
		await writeFile(join(innerProject, "backlog", "config.yml"), "project_name: Inner\n");

		const innerSrc = join(innerProject, "src");
		await mkdir(innerSrc, { recursive: true });

		const result = await findBacklogRoot(innerSrc);
		expect(result).toBe(innerProject);
	});

	it("should handle backlog/ with config.yaml", async () => {
		// Create backlog structure with config.yaml instead of tasks/
		await mkdir(join(testDir, "backlog"), { recursive: true });
		await writeFile(join(testDir, "backlog", "config.yaml"), "name: Test");

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});

	it("should handle backlog/projects.yml as a repository-level backlog marker", async () => {
		await mkdir(join(testDir, "backlog"), { recursive: true });
		await writeFile(join(testDir, "backlog", "projects.yml"), "version: 1\nprojects: []\n");

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});

	it("should find root from a nested subfolder when backlog/projects.yml is the only marker", async () => {
		await mkdir(join(testDir, "backlog"), { recursive: true });
		await writeFile(join(testDir, "backlog", "projects.yml"), "version: 1\nprojects: []\n");

		const nested = join(testDir, "packages", "web", "src");
		await mkdir(nested, { recursive: true });

		const result = await findBacklogRoot(nested);
		expect(result).toBe(testDir);
	});

	it("should find root from a nested subfolder when .backlog/projects.yml is the only marker", async () => {
		await mkdir(join(testDir, ".backlog"), { recursive: true });
		await writeFile(join(testDir, ".backlog", "projects.yml"), "version: 1\nprojects: []\n");

		const nested = join(testDir, "packages", "web", "src");
		await mkdir(nested, { recursive: true });

		const result = await findBacklogRoot(nested);
		expect(result).toBe(testDir);
	});

	it("should ignore malformed nested backlog/projects.yml markers", async () => {
		await mkdir(join(testDir, "backlog"), { recursive: true });
		await writeFile(join(testDir, "backlog", "config.yml"), "project_name: Test\n");

		const nestedProject = join(testDir, "packages", "web");
		await mkdir(join(nestedProject, "backlog"), { recursive: true });
		await writeFile(join(nestedProject, "backlog", "projects.yml"), "version: 1oops\nprojects: []\n");

		const nestedStart = join(nestedProject, "src");
		await mkdir(nestedStart, { recursive: true });

		const result = await findBacklogRoot(nestedStart);
		expect(result).toBe(testDir);
	});

	it("should find root when project root backlog.config.yml points to a custom backlog directory", async () => {
		await mkdir(join(testDir, "planning", "backlog", "tasks"), { recursive: true });
		await writeFile(
			join(testDir, "backlog.config.yml"),
			'project_name: "Test"\nbacklog_directory: "planning/backlog"\n',
		);

		const result = await findBacklogRoot(testDir);
		expect(result).toBe(testDir);
	});

	it("should ignore placeholder backlog.config.yml files that do not look like Backlog config", async () => {
		await writeFile(join(testDir, "backlog.config.yml"), 'name: "placeholder"\n');

		const result = await findBacklogRoot(testDir);
		expect(result).toBeNull();
	});

	it("should not stop at nested custom backlog directories without a config marker", async () => {
		await mkdir(join(testDir, "planning", "backlog", "tasks"), { recursive: true });
		await writeFile(
			join(testDir, "backlog.config.yml"),
			'project_name: "Test"\nbacklog_directory: "planning/backlog"\n',
		);

		const nestedStart = join(testDir, "planning", "backlog", "tasks");
		const result = await findBacklogRoot(nestedStart);
		expect(result).toBe(testDir);
	});
});
