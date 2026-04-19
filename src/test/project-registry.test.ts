import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProjectRegistry, resolveProjectContext, writeProjectRegistry } from "../utils/project-registry.ts";

describe("project registry", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `backlog-project-registry-${Date.now()}`);
		await mkdir(join(testDir, "backlog"), { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("writes and rereads the project registry", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [
				{ key: "xx01", path: "apps/web" },
				{ key: "ops" },
			],
		});

		const registry = await readProjectRegistry(testDir);
		expect(registry).toEqual({
			version: 1,
			defaultProject: "xx01",
			projects: [
				{ key: "xx01", path: "apps/web" },
				{ key: "ops" },
			],
		});
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
			projects: [
				{ key: "xx01", path: "apps/web" },
				{ key: "ops" },
			],
		});

		const context = await resolveProjectContext(testDir, {
			cwd: join(testDir, "docs"),
		});

		expect(context.project).toEqual({ key: "ops" });
		expect(context.backlogRoot).toBe(join(testDir, "backlog", "ops"));
	});
});
