import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { parseTask } from "../markdown/parser.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("task project field", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-task-project");
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await initializeTestProject(core, "Project Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("fail-closed when unconfigured", () => {
		it("should reject a project value when no projects are configured", async () => {
			await expect(core.createTaskFromInput({ title: "Web task", project: "web" }, false)).rejects.toThrow(
				"No projects are configured. Add a 'projects:' list to",
			);
		});

		it("should reject a project value on edit when no projects are configured", async () => {
			const { task } = await core.createTaskFromInput({ title: "Task" }, false);
			await expect(core.updateTaskFromInput(task.id, { project: "web" }, false)).rejects.toThrow(
				"No projects are configured. Add a 'projects:' list to",
			);
		});

		it("should allow creating tasks without a project when unconfigured", async () => {
			const { task } = await core.createTaskFromInput({ title: "Untagged task" }, false);
			const loaded = await core.filesystem.loadTask(task.id);
			expect(loaded?.project).toBeUndefined();
		});
	});

	describe("persistence round-trip", () => {
		beforeEach(async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Config not found");
			config.projects = ["web", "api", "mobile"];
			await core.filesystem.saveConfig(config);
		});

		it("should persist project on create and read it back", async () => {
			const { task } = await core.createTaskFromInput({ title: "Web task", project: "web" }, false);
			expect(task.project).toBe("web");

			const loaded = await core.filesystem.loadTask(task.id);
			expect(loaded?.project).toBe("web");
		});

		it("should update and clear project through edit input", async () => {
			const { task } = await core.createTaskFromInput({ title: "Web task", project: "web" }, false);

			await core.updateTaskFromInput(task.id, { project: "api" }, false);
			let loaded = await core.filesystem.loadTask(task.id);
			expect(loaded?.project).toBe("api");
			expect(loaded?.updatedDate).toBeDefined();

			await core.updateTaskFromInput(task.id, { project: "" }, false);
			loaded = await core.filesystem.loadTask(task.id);
			expect(loaded?.project).toBeUndefined();
		});

		it("should normalize project casing against the allowed set", async () => {
			const { task } = await core.createTaskFromInput({ title: "Web task", project: "WEB" }, false);
			expect(task.project).toBe("web");
		});

		it("should serialize project to frontmatter and parse it back", () => {
			const task: Task = {
				id: "task-1",
				title: "Round trip",
				status: "To Do",
				assignee: [],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				project: "api",
			};

			const serialized = serializeTask(task);
			expect(serialized).toContain("project: api");
			expect(parseTask(serialized).project).toBe("api");
		});
	});

	describe("validation", () => {
		beforeEach(async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Config not found");
			config.projects = ["web", "api"];
			await core.filesystem.saveConfig(config);
		});

		it("should reject unknown project on create with allowed values in the error", async () => {
			await expect(core.createTaskFromInput({ title: "Bad project", project: "mobile" }, false)).rejects.toThrow(
				"Invalid project: mobile. Valid projects are: web, api",
			);
		});

		it("should reject unknown project on edit", async () => {
			const { task } = await core.createTaskFromInput({ title: "Task" }, false);
			await expect(core.updateTaskFromInput(task.id, { project: "mobile" }, false)).rejects.toThrow(
				"Invalid project: mobile",
			);
		});
	});

	describe("config override", () => {
		it("should validate against configured projects and preserve configured casing", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Config not found");
			config.projects = ["Web", "API"];
			await core.filesystem.saveConfig(config);

			const { task } = await core.createTaskFromInput({ title: "Custom project", project: "api" }, false);
			expect(task.project).toBe("API");

			await expect(core.createTaskFromInput({ title: "Bad project", project: "mobile" }, false)).rejects.toThrow(
				"Invalid project: mobile. Valid projects are: Web, API",
			);
		});

		it("should round-trip the projects config key", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Config not found");
			config.projects = ["web", "api"];
			await core.filesystem.saveConfig(config);

			const reloaded = await new Core(TEST_DIR).filesystem.loadConfig();
			expect(reloaded?.projects).toEqual(["web", "api"]);
		});

		it("should leave projects undefined when the config key is absent", async () => {
			const config = await core.filesystem.loadConfig();
			expect(config?.projects).toBeUndefined();
		});
	});

	describe("back-compat for unassigned-project tasks", () => {
		it("should parse legacy frontmatter without a project key", () => {
			const legacy = [
				"---",
				"id: task-1",
				"title: Legacy",
				"status: To Do",
				"created_date: 2026-01-01",
				"---",
				"",
			].join("\n");
			expect(parseTask(legacy).project).toBeUndefined();
		});

		it("should not write a project key for tasks without a project", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Config not found");
			config.projects = ["web"];
			await core.filesystem.saveConfig(config);

			const { task } = await core.createTaskFromInput({ title: "Untagged task" }, false);
			await core.updateTaskFromInput(task.id, { title: "Still untagged" }, false);

			const loaded = await core.filesystem.loadTask(task.id);
			if (!loaded) throw new Error("Task not found");
			expect(loaded.project).toBeUndefined();
			expect(serializeTask(loaded)).not.toContain("project:");
		});
	});
});
