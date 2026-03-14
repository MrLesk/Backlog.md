import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBacklogDirectory } from "../utils/backlog-directory.ts";

describe("resolveBacklogDirectory", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `backlog-directory-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("prefers root backlog.config.yml with backlog_directory for custom folders", async () => {
		await mkdir(join(testDir, "planning", "backlog-data", "tasks"), { recursive: true });
		await writeFile(
			join(testDir, "backlog.config.yml"),
			'project_name: "Test"\nbacklog_directory: "planning/backlog-data"\n',
		);

		const resolution = resolveBacklogDirectory(testDir);
		expect(resolution.source).toBe("custom");
		expect(resolution.configSource).toBe("root");
		expect(resolution.backlogDir).toBe("planning/backlog-data");
		expect(resolution.configPath).toBe(join(testDir, "backlog.config.yml"));
	});

	it("keeps root backlog.config.yml canonical even when the configured backlog directory does not exist yet", async () => {
		await writeFile(
			join(testDir, "backlog.config.yml"),
			'project_name: "Test"\nbacklog_directory: "planning/backlog-data"\n',
		);

		const resolution = resolveBacklogDirectory(testDir);
		expect(resolution.source).toBe("custom");
		expect(resolution.configSource).toBe("root");
		expect(resolution.backlogDir).toBe("planning/backlog-data");
		expect(resolution.backlogPath).toBe(join(testDir, "planning", "backlog-data"));
		expect(resolution.configPath).toBe(join(testDir, "backlog.config.yml"));
	});

	it("uses root backlog.config.yml with built-in backlog folder when backlog_directory is omitted", async () => {
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });
		await writeFile(join(testDir, "backlog.config.yml"), 'project_name: "Test"\n');

		const resolution = resolveBacklogDirectory(testDir);
		expect(resolution.source).toBe("backlog");
		expect(resolution.configSource).toBe("root");
		expect(resolution.backlogDir).toBe("backlog");
		expect(resolution.configPath).toBe(join(testDir, "backlog.config.yml"));
	});

	it("falls back to folder-local config when root backlog.config.yml is absent", async () => {
		await mkdir(join(testDir, ".backlog", "tasks"), { recursive: true });
		await writeFile(join(testDir, ".backlog", "config.yml"), 'project_name: "Test"\n');

		const resolution = resolveBacklogDirectory(testDir);
		expect(resolution.source).toBe(".backlog");
		expect(resolution.configSource).toBe("folder");
		expect(resolution.backlogDir).toBe(".backlog");
		expect(resolution.configPath).toBe(join(testDir, ".backlog", "config.yml"));
	});

	it("falls back to folder-local config when root backlog.config.yml is invalid", async () => {
		await mkdir(join(testDir, ".backlog", "tasks"), { recursive: true });
		await writeFile(join(testDir, ".backlog", "config.yml"), 'project_name: "Test"\n');
		await writeFile(join(testDir, "backlog.config.yml"), 'name: "placeholder"\n');

		const resolution = resolveBacklogDirectory(testDir);
		expect(resolution.source).toBe(".backlog");
		expect(resolution.configSource).toBe("folder");
		expect(resolution.backlogDir).toBe(".backlog");
		expect(resolution.configPath).toBe(join(testDir, ".backlog", "config.yml"));
	});
});
