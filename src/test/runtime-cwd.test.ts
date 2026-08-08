import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAssignees, getLabels, getStatuses, getTaskIds } from "../completions/data-providers.ts";
import { Core, createRuntimeCore } from "../core/backlog.ts";
import { BACKLOG_CWD_ENV, resolveRuntimeCwd } from "../utils/runtime-cwd.ts";
import { initializeTestProject } from "./test-utils.ts";

describe("resolveRuntimeCwd", () => {
	let testDir: string;
	let originalCwd: string;
	let originalBacklogCwd: string | undefined;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-runtime-cwd-"));
		originalCwd = process.cwd();
		originalBacklogCwd = process.env[BACKLOG_CWD_ENV];
		delete process.env[BACKLOG_CWD_ENV];
		process.chdir(testDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		if (originalBacklogCwd === undefined) {
			delete process.env[BACKLOG_CWD_ENV];
		} else {
			process.env[BACKLOG_CWD_ENV] = originalBacklogCwd;
		}
		await rm(testDir, { recursive: true, force: true });
	});

	async function expectCanonicalPath(actualPath: string, expectedPath: string): Promise<void> {
		const [actualCanonical, expectedCanonical] = await Promise.all([realpath(actualPath), realpath(expectedPath)]);
		expect(actualCanonical).toBe(expectedCanonical);
	}

	it("uses process.cwd() when no override is provided", async () => {
		const result = await resolveRuntimeCwd();

		await expectCanonicalPath(result.cwd, testDir);
		expect(result.source).toBe("process");
	});

	it("uses BACKLOG_CWD when environment override is provided", async () => {
		const nestedDir = join(testDir, "workspace", "project");
		await mkdir(nestedDir, { recursive: true });
		process.env[BACKLOG_CWD_ENV] = nestedDir;

		const result = await resolveRuntimeCwd();

		await expectCanonicalPath(result.cwd, nestedDir);
		expect(result.source).toBe("env");
		expect(result.sourceLabel).toBe(BACKLOG_CWD_ENV);
	});

	it("gives --cwd option precedence over BACKLOG_CWD", async () => {
		const envDir = join(testDir, "env-dir");
		const optionDir = join(testDir, "option-dir");
		await mkdir(envDir, { recursive: true });
		await mkdir(optionDir, { recursive: true });
		process.env[BACKLOG_CWD_ENV] = envDir;

		const result = await resolveRuntimeCwd({ cwd: optionDir });

		await expectCanonicalPath(result.cwd, optionDir);
		expect(result.source).toBe("option");
		expect(result.sourceLabel).toBe("--cwd");
	});

	it("supports relative override paths", async () => {
		await mkdir(join(testDir, "relative", "path"), { recursive: true });

		const result = await resolveRuntimeCwd({ cwd: "./relative/path" });

		await expectCanonicalPath(result.cwd, join(testDir, "relative", "path"));
		expect(result.source).toBe("option");
	});

	it("throws when override path is invalid", async () => {
		process.env[BACKLOG_CWD_ENV] = join(testDir, "missing");

		await expect(resolveRuntimeCwd()).rejects.toThrow(`Invalid directory from ${BACKLOG_CWD_ENV}`);
	});

	describe("createRuntimeCore", () => {
		it("binds the Core to process.cwd() when no override is provided", async () => {
			const core = await createRuntimeCore();

			await expectCanonicalPath(core.filesystem.rootDir, testDir);
		});

		it("binds the Core to BACKLOG_CWD when the override is provided", async () => {
			const projectDir = join(testDir, "workspace", "project");
			await mkdir(projectDir, { recursive: true });
			process.env[BACKLOG_CWD_ENV] = projectDir;

			const core = await createRuntimeCore();

			await expectCanonicalPath(core.filesystem.rootDir, projectDir);
		});

		it("ascends to the project root when BACKLOG_CWD points at a subdirectory", async () => {
			const projectDir = join(testDir, "project");
			const nestedDir = join(projectDir, "packages", "web", "src");
			await initializeTestProject(new Core(projectDir), "Nested Override Project");
			await mkdir(nestedDir, { recursive: true });
			process.env[BACKLOG_CWD_ENV] = nestedDir;

			const core = await createRuntimeCore();

			await expectCanonicalPath(core.filesystem.rootDir, projectDir);
		});

		it("ascends to the project root from a subdirectory of process.cwd()", async () => {
			const projectDir = join(testDir, "project");
			const nestedDir = join(projectDir, "docs", "guides");
			await initializeTestProject(new Core(projectDir), "Nested Cwd Project");
			await mkdir(nestedDir, { recursive: true });
			process.chdir(nestedDir);

			const core = await createRuntimeCore();

			await expectCanonicalPath(core.filesystem.rootDir, projectDir);
		});

		it("stays on the resolved directory when no project is found", async () => {
			const nestedDir = join(testDir, "no-project", "nested");
			await mkdir(nestedDir, { recursive: true });
			process.env[BACKLOG_CWD_ENV] = nestedDir;

			const core = await createRuntimeCore();

			await expectCanonicalPath(core.filesystem.rootDir, nestedDir);
		});

		it("fails closed when BACKLOG_CWD points at a missing directory", async () => {
			process.env[BACKLOG_CWD_ENV] = join(testDir, "missing");

			await expect(createRuntimeCore()).rejects.toThrow(`Invalid directory from ${BACKLOG_CWD_ENV}`);
		});
	});

	describe("shell completion data providers", () => {
		it("reads the parent project when BACKLOG_CWD points at a subdirectory", async () => {
			const projectDir = join(testDir, "project");
			const nestedDir = join(projectDir, "packages", "cli");
			const core = new Core(projectDir);
			await initializeTestProject(core, "Completion Project");
			await mkdir(nestedDir, { recursive: true });
			await core.createTaskFromInput({ title: "Completion task", labels: ["ui"], assignee: ["@alex"] });
			process.env[BACKLOG_CWD_ENV] = nestedDir;

			expect(await getTaskIds()).toEqual(["TASK-1"]);
			expect(await getLabels()).toEqual(["ui"]);
			expect(await getAssignees()).toEqual(["@alex"]);
		});

		it("degrades to static fallbacks when no project is found", async () => {
			const nestedDir = join(testDir, "no-project", "nested");
			await mkdir(nestedDir, { recursive: true });
			process.env[BACKLOG_CWD_ENV] = nestedDir;

			expect(await getTaskIds()).toEqual([]);
			expect(await getStatuses()).toEqual(["To Do", "In Progress", "Done"]);
		});

		it("degrades to static fallbacks when BACKLOG_CWD is invalid", async () => {
			process.env[BACKLOG_CWD_ENV] = join(testDir, "missing");

			expect(await getTaskIds()).toEqual([]);
			expect(await getStatuses()).toEqual(["To Do", "In Progress", "Done"]);
		});
	});
});
