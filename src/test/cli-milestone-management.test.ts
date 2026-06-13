import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { MilestoneHandlers } from "../mcp/tools/milestones/handlers.ts";
import type { CallToolResult } from "../mcp/types.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const cliPath = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;
let cleanupDirs: string[];

function toolText(result: CallToolResult): string {
	return result.content
		.map((item) => (item.type === "text" ? item.text : ""))
		.filter(Boolean)
		.join("\n");
}

function normalizeRenamePaths(text: string): string {
	return text
		.trim()
		.replace(/Renamed milestone file: [^\n]+ -> [^\n]+/g, "Renamed milestone file: <source> -> <target>");
}

async function setupProject(dir: string, projectName: string): Promise<Core> {
	await rm(dir, { recursive: true, force: true });
	await mkdir(dir, { recursive: true });
	await $`git init -b main`.cwd(dir).quiet();
	await $`git config user.name "Test User"`.cwd(dir).quiet();
	await $`git config user.email test@example.com`.cwd(dir).quiet();

	const core = new Core(dir);
	await initializeTestProject(core, projectName);
	return core;
}

describe("CLI milestone management", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-milestone-management");
		cleanupDirs = [TEST_DIR];
		await setupProject(TEST_DIR, "CLI Milestone Management Project");
	});

	afterEach(async () => {
		for (const dir of cleanupDirs) {
			await safeCleanup(dir);
		}
	});

	it("adds milestone files with descriptions and rejects duplicate aliases", async () => {
		const core = new Core(TEST_DIR);

		const add = await $`bun ${cliPath} milestone add "Release CLI" --description "Custom release scope"`
			.cwd(TEST_DIR)
			.quiet();

		expect(add.exitCode).toBe(0);
		expect(add.stdout.toString()).toContain('Created milestone "Release CLI" (m-0).');

		const milestones = await core.filesystem.listMilestones();
		expect(milestones).toHaveLength(1);
		expect(milestones[0]?.title).toBe("Release CLI");
		expect(milestones[0]?.description).toBe("Custom release scope");

		const duplicate = await $`bun ${cliPath} milestone add " release cli "`.cwd(TEST_DIR).quiet().nothrow();
		const duplicateOutput = duplicate.stdout.toString() + duplicate.stderr.toString();

		expect(duplicate.exitCode).toBe(1);
		expect(duplicateOutput).toContain(
			'Milestone alias conflict: "release cli" matches existing milestone "Release CLI" (m-0).',
		);
	});

	it("auto-commits added milestone files when autoCommit is enabled", async () => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected test project config to exist");
		}
		config.autoCommit = true;
		await core.filesystem.saveConfig(config);
		await core.ensureConfigLoaded();

		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m "baseline"`.cwd(TEST_DIR).quiet();

		const add = await $`bun ${cliPath} milestone add "Committed Release"`.cwd(TEST_DIR).quiet();

		expect(add.exitCode).toBe(0);
		expect(add.stdout.toString()).toContain('Created milestone "Committed Release" (m-0).');
		expect((await core.git.getStatus()).trim()).toBe("");
		expect(await core.git.getLastCommitMessage()).toContain("backlog: Add milestone m-0");
	});

	it("renames milestones and updates local task references by default", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task A" --milestone "Release A" --plain`.cwd(TEST_DIR).quiet();
		await core.editTask("task-1", { milestone: "Release A" }, false);

		const rename = await $`bun ${cliPath} milestone rename "Release A" "Release Prime"`.cwd(TEST_DIR).quiet();

		expect(rename.exitCode).toBe(0);
		expect(rename.stdout.toString()).toContain('Renamed milestone "Release A" (m-0) → "Release Prime" (m-0).');
		expect(rename.stdout.toString()).toContain("Updated 1 local task: TASK-1");

		const task = await core.filesystem.loadTask("task-1");
		expect(task?.milestone).toBe("m-0");

		const milestones = await core.filesystem.listMilestones();
		expect(milestones[0]?.title).toBe("Release Prime");
	});

	it("supports disabling task updates during milestone rename", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Legacy Release"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Legacy task" --milestone "Legacy Release" --plain`.cwd(TEST_DIR).quiet();
		await core.editTask("task-1", { milestone: "Legacy Release" }, false);

		const rename = await $`bun ${cliPath} milestone rename "Legacy Release" "Renamed Release" --no-update-tasks`
			.cwd(TEST_DIR)
			.quiet();

		expect(rename.exitCode).toBe(0);
		expect(rename.stdout.toString()).toContain("Skipped updating tasks (updateTasks=false).");

		const task = await core.filesystem.loadTask("task-1");
		expect(task?.milestone).toBe("Legacy Release");
	});

	it("removes milestones with clear, keep, and reassign task-handling modes", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} milestone add "Release B"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task A" --milestone "Release A" --plain`.cwd(TEST_DIR).quiet();

		const reassign =
			await $`bun ${cliPath} milestone remove "Release A" --task-handling reassign --reassign-to "Release B"`
				.cwd(TEST_DIR)
				.quiet();

		expect(reassign.exitCode).toBe(0);
		expect(reassign.stdout.toString()).toContain('Removed milestone "Release A" (m-0).');
		expect(reassign.stdout.toString()).toContain('Reassigned 1 local task to "Release B" (m-1): TASK-1');
		expect((await core.filesystem.loadTask("task-1"))?.milestone).toBe("m-1");

		const clear = await $`bun ${cliPath} milestone remove "Release B"`.cwd(TEST_DIR).quiet();
		expect(clear.exitCode).toBe(0);
		expect(clear.stdout.toString()).toContain("Cleared milestone for 1 local task: TASK-1");
		expect((await core.filesystem.loadTask("task-1"))?.milestone).toBeUndefined();

		await $`bun ${cliPath} milestone add "Keep Value"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit task-1 --milestone "Keep Value" --plain`.cwd(TEST_DIR).quiet();

		const keep = await $`bun ${cliPath} milestone remove "Keep Value" --task-handling keep`.cwd(TEST_DIR).quiet();
		expect(keep.exitCode).toBe(0);
		expect(keep.stdout.toString()).toContain("Kept task milestone values unchanged (taskHandling=keep).");
		expect((await core.filesystem.loadTask("task-1"))?.milestone).toBe("m-2");
	});

	it("validates remove task-handling flags and required reassign targets", async () => {
		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();

		const invalid = await $`bun ${cliPath} milestone remove "Release A" --task-handling punt`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		const missingTarget = await $`bun ${cliPath} milestone remove "Release A" --task-handling reassign`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();

		expect(invalid.exitCode).toBe(1);
		expect(invalid.stderr.toString()).toContain("Invalid task handling: punt. Valid values are: clear, keep, reassign");
		expect(missingTarget.exitCode).toBe(1);
		expect(missingTarget.stderr.toString()).toContain("reassignTo is required when taskHandling is reassign.");
	});

	it("documents milestone command schemas in help output", async () => {
		const helpByCommand = new Map([
			["list", await $`bun ${cliPath} milestone list --help`.cwd(TEST_DIR).text()],
			["add", await $`bun ${cliPath} milestone add --help`.cwd(TEST_DIR).text()],
			["rename", await $`bun ${cliPath} milestone rename --help`.cwd(TEST_DIR).text()],
			["remove", await $`bun ${cliPath} milestone remove --help`.cwd(TEST_DIR).text()],
			["archive", await $`bun ${cliPath} milestone archive --help`.cwd(TEST_DIR).text()],
		]);

		for (const [command, help] of helpByCommand) {
			expect(help).toContain("Input schema:");
			expect(help).toContain("Reads:");
			expect(help).toContain("Output:");
			expect(help).toContain("Examples:");
			if (command !== "list") {
				expect(help).toContain("Writes:");
			}
		}

		expect(helpByCommand.get("rename")).toContain("disable with --no-update-tasks");
		expect(helpByCommand.get("remove")).toContain("task-handling: one of: clear, keep, reassign");
		expect(helpByCommand.get("remove")).toContain("reassign-to: Milestone ID or title");
	});

	it("matches MCP milestone handler output for shared mutation operations", async () => {
		const mcpDir = createUniqueTestDir("test-cli-milestone-mcp-parity");
		cleanupDirs.push(mcpDir);
		const mcpCore = await setupProject(mcpDir, "MCP Milestone Parity Project");
		const mcpHandlers = new MilestoneHandlers(mcpCore);

		const cliAdd = await $`bun ${cliPath} milestone add "Parity A"`.cwd(TEST_DIR).quiet();
		const mcpAdd = await mcpHandlers.addMilestone({ name: "Parity A" });
		expect(cliAdd.stdout.toString().trim()).toBe(toolText(mcpAdd).trim());

		const cliRename = await $`bun ${cliPath} milestone rename "Parity A" "Parity B"`.cwd(TEST_DIR).quiet();
		const mcpRename = await mcpHandlers.renameMilestone({ from: "Parity A", to: "Parity B" });
		expect(normalizeRenamePaths(cliRename.stdout.toString())).toBe(normalizeRenamePaths(toolText(mcpRename)));

		const cliRemove = await $`bun ${cliPath} milestone remove "Parity B" --task-handling keep`.cwd(TEST_DIR).quiet();
		const mcpRemove = await mcpHandlers.removeMilestone({ name: "Parity B", taskHandling: "keep" });
		expect(cliRemove.stdout.toString().trim()).toBe(toolText(mcpRemove).trim());
	});
});
