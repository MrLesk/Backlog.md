import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BACKLOG_CWD_ENV, resolveRuntimeCwd } from "../utils/runtime-cwd.ts";

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

	it("uses process.cwd() when no override is provided", async () => {
		const result = await resolveRuntimeCwd();

		expect(result.cwd).toBe(testDir);
		expect(result.source).toBe("process");
	});

	it("uses BACKLOG_CWD when environment override is provided", async () => {
		const nestedDir = join(testDir, "workspace", "project");
		await mkdir(nestedDir, { recursive: true });
		process.env[BACKLOG_CWD_ENV] = nestedDir;

		const result = await resolveRuntimeCwd();

		expect(result.cwd).toBe(nestedDir);
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

		expect(result.cwd).toBe(optionDir);
		expect(result.source).toBe("option");
		expect(result.sourceLabel).toBe("--cwd");
	});

	it("supports relative override paths", async () => {
		await mkdir(join(testDir, "relative", "path"), { recursive: true });

		const result = await resolveRuntimeCwd({ cwd: "./relative/path" });

		expect(result.cwd).toBe(join(testDir, "relative", "path"));
		expect(result.source).toBe("option");
	});

	it("throws when override path is invalid", async () => {
		process.env[BACKLOG_CWD_ENV] = join(testDir, "missing");

		await expect(resolveRuntimeCwd()).rejects.toThrow(`Invalid directory from ${BACKLOG_CWD_ENV}`);
	});
});
