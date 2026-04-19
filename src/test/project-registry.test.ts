import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readProjectRegistry, resolveProjectContext, writeProjectRegistry } from "../utils/project-registry.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("project registry", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("backlog-project-registry");
		await mkdir(join(testDir, "backlog"), { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("writes and rereads the project registry", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [{ key: "xx01", path: "apps/web" }, { key: "ops" }],
		});

		const registry = await readProjectRegistry(testDir);
		expect(registry).toEqual({
			version: 1,
			defaultProject: "xx01",
			projects: [{ key: "xx01", path: "apps/web" }, { key: "ops" }],
		});
	});

	it("writes and rereads the project registry in a hidden backlog container", async () => {
		await mkdir(join(testDir, ".backlog"), { recursive: true });
		await writeFile(join(testDir, ".backlog", "config.yml"), "project_name: Test\n");

		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [{ key: "xx01", path: "apps/web" }],
		});

		const registry = await readProjectRegistry(testDir);
		expect(registry).toEqual({
			version: 1,
			defaultProject: "xx01",
			projects: [{ key: "xx01", path: "apps/web" }],
		});
	});

	it("preserves the hidden container when backlog also exists", async () => {
		await mkdir(join(testDir, "backlog"), { recursive: true });
		await mkdir(join(testDir, ".backlog"), { recursive: true });
		await writeFile(join(testDir, "backlog", "projects.yml"), "name: placeholder\n");
		await writeFile(join(testDir, ".backlog", "projects.yml"), "version: 1\nprojects:\n  - key: xx01\n");

		const context = await resolveProjectContext(testDir, {
			project: "xx01",
		});

		expect(context.containerRoot).toBe(join(testDir, ".backlog"));
		expect(context.registryPath).toBe(join(testDir, ".backlog", "projects.yml"));

		await writeProjectRegistry(testDir, {
			version: 1,
			projects: [{ key: "xx01" }],
		});

		const registry = await readProjectRegistry(testDir);
		expect(registry).toEqual({
			version: 1,
			projects: [{ key: "xx01" }],
		});

		const hiddenRegistry = await readFile(join(testDir, ".backlog", "projects.yml"), "utf8");
		expect(hiddenRegistry).toContain('"xx01"');
		const backlogRegistry = await readFile(join(testDir, "backlog", "projects.yml"), "utf8");
		expect(backlogRegistry).toBe("name: placeholder\n");
	});

	it("round-trips escaped quoted project paths", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [{ key: "xx01", path: 'apps/quoted "dir"' }],
		});

		const registry = await readProjectRegistry(testDir);
		expect(registry).toEqual({
			version: 1,
			defaultProject: "xx01",
			projects: [{ key: "xx01", path: 'apps/quoted "dir"' }],
		});
	});

	it("rejects unknown top-level registry keys", async () => {
		await writeFile(
			join(testDir, "backlog", "projects.yml"),
			"version: 1\nunexpected: value\nprojects:\n  - key: xx01\n",
		);

		const registry = await readProjectRegistry(testDir);
		expect(registry).toBeNull();
	});

	it("rejects duplicate registry fields", async () => {
		await writeFile(join(testDir, "backlog", "projects.yml"), "version: 1\nprojects:\n  - key: xx01\n    key: xx02\n");

		const registry = await readProjectRegistry(testDir);
		expect(registry).toBeNull();
	});

	it("rejects case-insensitive key collisions", async () => {
		await writeFile(join(testDir, "backlog", "projects.yml"), "version: 1\nprojects:\n  - key: xx01\n  - key: XX01\n");

		const registry = await readProjectRegistry(testDir);
		expect(registry).toBeNull();
	});

	it("rejects duplicate normalized project paths", async () => {
		await writeFile(
			join(testDir, "backlog", "projects.yml"),
			"version: 1\nprojects:\n  - key: xx01\n    path: apps/web\n  - key: xx02\n    path: apps//web\n",
		);

		const registry = await readProjectRegistry(testDir);
		expect(registry).toBeNull();
	});

	it("rejects version values with trailing characters", async () => {
		await writeFile(join(testDir, "backlog", "projects.yml"), "version: 1oops\nprojects: []\n");

		const registry = await readProjectRegistry(testDir);
		expect(registry).toBeNull();
	});

	it("rejects malformed unquoted scalar values", async () => {
		await writeFile(
			join(testDir, "backlog", "projects.yml"),
			"version: 1\nprojects:\n  - key: xx01\n    path: apps/quoted dir\n",
		);

		const registry = await readProjectRegistry(testDir);
		expect(registry).toBeNull();
	});

	it("rejects unsafe project keys", async () => {
		await writeFile(join(testDir, "backlog", "projects.yml"), "version: 1\nprojects:\n  - key: CON\n");

		const registry = await readProjectRegistry(testDir);
		expect(registry).toBeNull();
	});

	it("reports invalid registry files distinctly during project resolution", async () => {
		await writeFile(join(testDir, "backlog", "projects.yml"), "version: 1oops\nprojects: []\n");

		await expect(resolveProjectContext(testDir, { cwd: join(testDir, "src") })).rejects.toThrow(
			"exists but is invalid",
		);
	});

	it("prefers an explicit project over cwd matches", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [
				{ key: "xx01", path: "apps/web" },
				{ key: "xx02", path: "packages/sdk" },
			],
		});

		const context = await resolveProjectContext(testDir, {
			cwd: join(testDir, "apps", "web", "src"),
			project: "xx02",
		});

		expect(context.project).toEqual({ key: "xx02", path: "packages/sdk" });
		expect(context.backlogRoot).toBe(join(testDir, "backlog", "xx02"));
		expect(context.containerRoot).toBe(join(testDir, "backlog"));
		expect(context.registryPath).toBe(join(testDir, "backlog", "projects.yml"));
	});

	it("uses the longest cwd path prefix when resolving the project", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [
				{ key: "xx01", path: "apps" },
				{ key: "xx02", path: "apps/web" },
			],
		});

		const context = await resolveProjectContext(testDir, {
			cwd: join(testDir, "apps", "web", "src"),
		});

		expect(context.project.key).toBe("xx02");
		expect(context.backlogRoot).toBe(join(testDir, "backlog", "xx02"));
	});

	it("falls back to the default project when cwd does not match", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "ops",
			projects: [{ key: "xx01", path: "apps/web" }, { key: "ops" }],
		});

		const context = await resolveProjectContext(testDir, {
			cwd: join(testDir, "docs"),
		});

		expect(context.project).toEqual({ key: "ops" });
		expect(context.backlogRoot).toBe(join(testDir, "backlog", "ops"));
	});
});
