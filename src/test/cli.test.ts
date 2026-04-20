import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { $ } from "bun";
import { Core, isGitRepository } from "../index.ts";
import { parseTask } from "../markdown/parser.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import type { Decision, Document, Task } from "../types/index.ts";
import { readProjectRegistry, resolveProjectRegistryLocation } from "../utils/project-registry.ts";
import { listTasksPlatformAware, viewTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

async function createDefaultProjectCore(): Promise<Core> {
	const registryLocation = await resolveProjectRegistryLocation(TEST_DIR);
	const registry = await readProjectRegistry(TEST_DIR);
	const defaultProjectKey = registry?.defaultProject ?? registry?.projects[0]?.key;

	if (registryLocation && defaultProjectKey) {
		return new Core(TEST_DIR, {
			backlogRoot: join(registryLocation.containerRoot, defaultProjectKey),
		});
	}

	return new Core(TEST_DIR);
}

describe("CLI Integration", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("backlog init command", () => {
		it("should initialize backlog project in existing git repo", async () => {
			// Set up a git repository
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			// Initialize backlog project using Core (simulating CLI)
			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "CLI Test Project", true);

			// Verify directory structure was created
			const configExists = await Bun.file(core.filesystem.configFilePath).exists();
			expect(configExists).toBe(true);

			// Verify config content
			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("CLI Test Project");
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("To Do");

			// Verify git commit was created
			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("Initialize backlog project: CLI Test Project");
		});

		it("should create all required directories", async () => {
			// Set up a git repository
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Directory Test");

			// Check all expected directories exist
			const projectDir = core.filesystem.backlogDirName;
			const expectedDirs = [
				"backlog",
				projectDir,
				`${projectDir}/tasks`,
				`${projectDir}/drafts`,
				`${projectDir}/archive`,
				`${projectDir}/archive/tasks`,
				`${projectDir}/archive/drafts`,
				`${projectDir}/archive/milestones`,
				`${projectDir}/milestones`,
				`${projectDir}/docs`,
				`${projectDir}/decisions`,
			];

			for (const dir of expectedDirs) {
				try {
					const stats = await stat(join(TEST_DIR, dir));
					expect(stats.isDirectory()).toBe(true);
				} catch {
					// If stat fails, directory doesn't exist
					expect(false).toBe(true);
				}
			}
		});

		it("should handle project names with special characters", async () => {
			// Set up a git repository
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			const specialProjectName = "My-Project_2024 (v1.0)";
			await initializeTestProject(core, specialProjectName);

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe(specialProjectName);
		});

		it("should work when git repo exists", async () => {
			// Set up existing git repo
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const isRepo = await isGitRepository(TEST_DIR);
			expect(isRepo).toBe(true);

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Existing Repo Test");

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Existing Repo Test");
		});

		it("should accept optional project name parameter", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			// Test the CLI implementation by directly using the Core functionality
			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Test Project");

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Test Project");
		});

		it("should create agent instruction files when requested", async () => {
			// Set up a git repository
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			// Simulate the agent instructions being added
			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Agent Test Project");

			// Import and call addAgentInstructions directly (simulating user saying "y")
			const { addAgentInstructions } = await import("../index.ts");
			await addAgentInstructions(TEST_DIR, core.gitOps);

			// Verify agent files were created
			const agentsFile = await Bun.file(join(TEST_DIR, "AGENTS.md")).exists();
			const claudeFile = await Bun.file(join(TEST_DIR, "CLAUDE.md")).exists();
			// .cursorrules removed; Cursor now uses AGENTS.md
			const geminiFile = await Bun.file(join(TEST_DIR, "GEMINI.md")).exists();
			const copilotFile = await Bun.file(join(TEST_DIR, ".github/copilot-instructions.md")).exists();

			expect(agentsFile).toBe(true);
			expect(claudeFile).toBe(true);
			expect(geminiFile).toBe(true);
			expect(copilotFile).toBe(true);

			// Verify content
			const agentsContent = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
			const claudeContent = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();
			const geminiContent = await Bun.file(join(TEST_DIR, "GEMINI.md")).text();
			const copilotContent = await Bun.file(join(TEST_DIR, ".github/copilot-instructions.md")).text();
			expect(agentsContent.length).toBeGreaterThan(0);
			expect(claudeContent.length).toBeGreaterThan(0);
			expect(geminiContent.length).toBeGreaterThan(0);
			expect(copilotContent.length).toBeGreaterThan(0);
		});

		it("should allow skipping agent instructions with 'none' selection", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output = await $`bun ${CLI_PATH} init TestProj --defaults --agent-instructions none`.cwd(TEST_DIR).text();

			const agentsFile = await Bun.file(join(TEST_DIR, "AGENTS.md")).exists();
			const claudeFile = await Bun.file(join(TEST_DIR, "CLAUDE.md")).exists();
			expect(agentsFile).toBe(false);
			expect(claudeFile).toBe(false);
			expect(output).toContain("AI Integration: CLI commands (legacy)");
			expect(output).toContain("Skipping agent instruction files per selection.");
		});

		it("should print minimal summary when advanced settings are skipped", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output = await $`bun ${CLI_PATH} init SummaryProj --defaults --agent-instructions none`
				.cwd(TEST_DIR)
				.text();

			expect(output).toContain("Initialization Summary");
			expect(output).toContain("Project Name: SummaryProj");
			expect(output).toContain("AI Integration: CLI commands (legacy)");
			expect(output).toContain("Advanced settings: unchanged");
			expect(output).not.toContain("Remote operations:");
			expect(output).not.toContain("Zero-padded IDs:");
		});

		it("should support MCP integration mode via flag", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output = await $`bun ${CLI_PATH} init McpProj --defaults --integration-mode mcp`.cwd(TEST_DIR).text();

			expect(output).toContain("AI Integration: MCP connector");
			expect(output).toContain("Agent instruction files: guidance is provided through the MCP connector.");
			expect(output).toContain("MCP server name: backlog");
			expect(output).toContain("MCP client setup: skipped (non-interactive)");
			const agentsFile = await Bun.file(join(TEST_DIR, "AGENTS.md")).exists();
			const claudeFile = await Bun.file(join(TEST_DIR, "CLAUDE.md")).exists();
			expect(agentsFile).toBe(false);
			expect(claudeFile).toBe(false);
		});

		it("should default to MCP integration when no mode is specified", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output = await $`bun ${CLI_PATH} init DefaultMcpProj --defaults`.cwd(TEST_DIR).text();

			expect(output).toContain("AI Integration: MCP connector");
			expect(output).toContain("MCP server name: backlog");
			expect(output).toContain("MCP client setup: skipped (non-interactive)");
		});

		it("should allow skipping AI integration via flag", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output = await $`bun ${CLI_PATH} init SkipProj --defaults --integration-mode none`.cwd(TEST_DIR).text();

			expect(output).not.toContain("AI Integration:");
			expect(output).toContain("AI integration: skipped");
			const agentsFile = await Bun.file(join(TEST_DIR, "AGENTS.md")).exists();
			const claudeFile = await Bun.file(join(TEST_DIR, "CLAUDE.md")).exists();
			expect(agentsFile).toBe(false);
			expect(claudeFile).toBe(false);
		});

		it("should support non-interactive .backlog selection via --backlog-dir", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output = await $`bun ${CLI_PATH} init HiddenProj --defaults --integration-mode none --backlog-dir .backlog`
				.cwd(TEST_DIR)
				.text();

			expect(output).toContain("Backlog directory: backlog/hiddenproj");
			expect(await Bun.file(join(TEST_DIR, "backlog", "hiddenproj", "config.yml")).exists()).toBe(true);
			expect(await Bun.file(join(TEST_DIR, ".backlog", "config.yml")).exists()).toBe(false);
		});

		it("should keep custom non-interactive backlog dir input on the native project path", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output =
				await $`bun ${CLI_PATH} init CustomProj --defaults --integration-mode none --backlog-dir planning/backlog-data`
					.cwd(TEST_DIR)
					.text();

			expect(output).toContain("Backlog directory: backlog/customproj");
			expect(output).toContain("Config location: folder config.yml");
			expect(await Bun.file(join(TEST_DIR, "backlog", "customproj", "config.yml")).exists()).toBe(true);
			expect(await Bun.file(join(TEST_DIR, "backlog.config.yml")).exists()).toBe(false);
			expect(await Bun.file(join(TEST_DIR, "planning", "backlog-data", "config.yml")).exists()).toBe(false);
		});

		it("should reject invalid --backlog-dir values", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const result =
				await $`bun ${CLI_PATH} init InvalidDirProj --defaults --integration-mode none --backlog-dir ../outside`
					.cwd(TEST_DIR)
					.nothrow();
			const output = result.stdout.toString() + result.stderr.toString();
			expect(result.exitCode).toBe(1);
			expect(output).toContain("Invalid --backlog-dir value");
		});

		it("should reject --backlog-dir during re-initialization", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			await $`bun ${CLI_PATH} init ReinitProj --defaults --integration-mode none`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${CLI_PATH} init ReinitProj --defaults --integration-mode none --backlog-dir .backlog`
				.cwd(TEST_DIR)
				.nothrow();
			const output = result.stdout.toString() + result.stderr.toString();
			expect(result.exitCode).toBe(1);
			expect(output).toContain("fixed after initialization");
		});

		it("should reject MCP integration when agent instruction flags are provided", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			let failed = false;
			let combinedOutput = "";
			try {
				await $`bun ${CLI_PATH} init ConflictProj --defaults --integration-mode mcp --agent-instructions claude`
					.cwd(TEST_DIR)
					.text();
			} catch (err) {
				failed = true;
				const e = err as { stdout?: unknown; stderr?: unknown };
				combinedOutput = String(e.stdout ?? "") + String(e.stderr ?? "");
			}

			expect(failed).toBe(true);
			expect(combinedOutput).toContain("cannot be combined");
		});

		it("should ignore 'none' when other agent instructions are provided", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			await $`bun ${CLI_PATH} init TestProj --defaults --agent-instructions agents,none`.cwd(TEST_DIR).quiet();

			const agentsFile = await Bun.file(join(TEST_DIR, "AGENTS.md")).exists();
			expect(agentsFile).toBe(true);
		});

		it("should error on invalid agent instruction value", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			let failed = false;
			try {
				await $`bun ${CLI_PATH} init InvalidProj --defaults --agent-instructions notreal`.cwd(TEST_DIR).quiet();
			} catch (e) {
				failed = true;
				const err = e as { stdout?: unknown; stderr?: unknown };
				const out = String(err.stdout ?? "") + String(err.stderr ?? "");
				expect(out).toContain("Invalid agent instruction: notreal");
				expect(out).toContain("Valid options are: cursor, claude, agents, gemini, copilot, none");
			}

			expect(failed).toBe(true);
		});
	});

	describe("git integration", () => {
		beforeEach(async () => {
			// Set up a git repository
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		});

		it("should create initial commit with backlog structure", async () => {
			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Git Integration Test", true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toBe("backlog: Initialize backlog project: Git Integration Test");

			// Verify git status is clean after initialization
			const isClean = await core.gitOps.isClean();
			expect(isClean).toBe(true);
		});
	});

	describe("create commands", () => {
		beforeEach(async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Create Command Test", true);

			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected backlog config to exist");
			}

			config.autoCommit = true;
			await core.filesystem.saveConfig(config);
			const git = await core.getGitOps();
			await git.addFile(core.filesystem.configFilePath);
			await git.commitChanges("backlog: Enable autoCommit for CLI create tests");
		});

		it("should honor autoCommit config for task create", async () => {
			const beforeCount = Number((await $`git rev-list --count HEAD`.cwd(TEST_DIR).text()).trim());
			const output = await $`bun ${CLI_PATH} task create "CLI Auto Commit Task"`.cwd(TEST_DIR).text();
			const afterCount = Number((await $`git rev-list --count HEAD`.cwd(TEST_DIR).text()).trim());

			const core = await createDefaultProjectCore();
			const git = await core.getGitOps();
			const task = await core.filesystem.loadTask("task-1");

			expect(task).not.toBeNull();
			expect(output).toContain(`Created task ${task?.id}`);
			expect(afterCount).toBe(beforeCount + 1);
			expect(await git.isClean()).toBe(true);
			expect(await git.getLastCommitMessage()).toContain(`Create task ${task?.id}`);
			expect(task?.title).toBe("CLI Auto Commit Task");
		});

		it("should honor autoCommit config for draft create", async () => {
			const beforeCount = Number((await $`git rev-list --count HEAD`.cwd(TEST_DIR).text()).trim());
			const output = await $`bun ${CLI_PATH} draft create "CLI Auto Commit Draft"`.cwd(TEST_DIR).text();
			const afterCount = Number((await $`git rev-list --count HEAD`.cwd(TEST_DIR).text()).trim());

			const core = await createDefaultProjectCore();
			const git = await core.getGitOps();
			const draft = await core.filesystem.loadDraft("draft-1");

			expect(draft).not.toBeNull();
			expect(output).toContain(`Created draft ${draft?.id}`);
			expect(afterCount).toBe(beforeCount + 1);
			expect(await git.isClean()).toBe(true);
			expect(await git.getLastCommitMessage()).toContain(`Create draft ${draft?.id}`);
			expect(draft?.title).toBe("CLI Auto Commit Draft");
		});

		it("should accept dependencies from other active branches", async () => {
			const core = await createDefaultProjectCore();

			const remoteDir = join(TEST_DIR, "remote.git");
			await $`git init --bare -b main ${remoteDir}`.quiet();
			await $`git remote add origin ${remoteDir}`.cwd(TEST_DIR).quiet();
			await $`git push -u origin main`.cwd(TEST_DIR).quiet();

			await $`git checkout -b feature`.cwd(TEST_DIR).quiet();
			await core.createTask(
				{
					id: "task-1",
					title: "Cross-branch dependency target",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-09",
					labels: [],
					dependencies: [],
					rawContent: "Created on feature branch",
				},
				true,
			);
			await $`git push -u origin feature`.cwd(TEST_DIR).quiet();
			await $`git remote update origin --prune`.cwd(TEST_DIR).quiet();
			await $`git checkout main`.cwd(TEST_DIR).quiet();
			await core.gitOps.fetch();

			const visibleTasks = await core.queryTasks();
			expect(visibleTasks.some((task) => task.id === "TASK-1")).toBe(true);

			const output = await $`bun ${CLI_PATH} task create "Depends on feature task" --depends-on task-1`
				.cwd(TEST_DIR)
				.text();
			const createdTask = await core.filesystem.loadTask("task-2");

			expect(output).toContain("Created task TASK-2");
			expect(createdTask?.dependencies).toEqual(["TASK-1"]);
		});
	});

	describe("task list command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "List Test Project", true);
		});

		it("should show 'No tasks found' when no tasks exist", async () => {
			const core = await createDefaultProjectCore();
			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);
		});

		it("should list tasks grouped by status", async () => {
			const core = await createDefaultProjectCore();

			// Create test tasks with different statuses
			await core.createTask(
				{
					id: "task-1",
					title: "First Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "First test task",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-2",
					title: "Second Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Second test task",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-3",
					title: "Third Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Third test task",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(3);

			// Verify tasks are grouped correctly by status
			const todoTasks = tasks.filter((t) => t.status === "To Do");
			const doneTasks = tasks.filter((t) => t.status === "Done");

			expect(todoTasks).toHaveLength(2);
			expect(doneTasks).toHaveLength(1);
			expect(todoTasks.map((t) => t.id)).toEqual(["TASK-1", "TASK-3"]); // IDs normalized to uppercase
			expect(doneTasks.map((t) => t.id)).toEqual(["TASK-2"]); // IDs normalized to uppercase
		});

		it("should respect config status order", async () => {
			const core = await createDefaultProjectCore();

			// Load and verify default config status order
			const config = await core.filesystem.loadConfig();
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
		});

		it("should filter tasks by status", async () => {
			const core = await createDefaultProjectCore();

			await core.createTask(
				{
					id: "task-1",
					title: "First Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "First test task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Second Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Second test task",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --status Done`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("Done:");
			expect(out).toContain("TASK-2 - Second Task"); // IDs normalized to uppercase
			expect(out).not.toContain("TASK-1");
		});

		it("should filter tasks by status case-insensitively", async () => {
			const core = await createDefaultProjectCore();

			await core.createTask(
				{
					id: "task-1",
					title: "First Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "First test task",
				},
				true,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Second Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Second test task",
				},
				true,
			);

			const testCases = ["done", "DONE", "DoNe"];

			for (const status of testCases) {
				const result = await $`bun ${CLI_PATH} task list --plain --status ${status}`.cwd(TEST_DIR).quiet();
				const out = result.stdout.toString();
				expect(out).toContain("Done:");
				expect(out).toContain("TASK-2 - Second Task"); // IDs normalized to uppercase
				expect(out).not.toContain("TASK-1");
			}

			// Test with -s flag
			const resultShort = await listTasksPlatformAware({ plain: true, status: "done" }, TEST_DIR);
			const outShort = resultShort.stdout;
			expect(outShort).toContain("Done:");
			expect(outShort).toContain("TASK-2 - Second Task"); // IDs normalized to uppercase
			expect(outShort).not.toContain("TASK-1");
		});

		it("should filter tasks by assignee", async () => {
			const core = await createDefaultProjectCore();

			await core.createTask(
				{
					id: "task-1",
					title: "Assigned Task",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Assigned task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Unassigned Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Other task",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --assignee alice`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("TASK-1 - Assigned Task"); // IDs normalized to uppercase
			expect(out).not.toContain("TASK-2 - Unassigned Task");
		});
	});

	describe("task view command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "View Test Project");
		});

		it("should display task details with markdown formatting", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			const testTask = {
				id: "task-1",
				title: "Test View Task",
				status: "To Do",
				assignee: ["testuser"],
				createdDate: "2025-06-08",
				labels: ["test", "cli"],
				dependencies: [],
				rawContent: "This is a test task for view command",
			};

			await core.createTask(testTask, false);

			// Load the task back
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask).not.toBeNull();
			expect(loadedTask?.id).toBe("TASK-1"); // IDs normalized to uppercase
			expect(loadedTask?.title).toBe("Test View Task");
			expect(loadedTask?.status).toBe("To Do");
			expect(loadedTask?.assignee).toEqual(["testuser"]);
			expect(loadedTask?.labels).toEqual(["test", "cli"]);
			expect(loadedTask?.rawContent).toBe("This is a test task for view command");
		});

		it("should handle task IDs with and without 'task-' prefix", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			await core.createTask(
				{
					id: "task-5",
					title: "Prefix Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Testing task ID normalization",
				},
				false,
			);

			// Test loading with full task-5 ID
			const taskWithPrefix = await core.filesystem.loadTask("task-5");
			expect(taskWithPrefix?.id).toBe("TASK-5"); // IDs normalized to uppercase

			// Test loading with just numeric ID (5)
			const taskWithoutPrefix = await core.filesystem.loadTask("5");
			// The filesystem loadTask should handle normalization
			expect(taskWithoutPrefix?.id).toBe("TASK-5"); // IDs normalized to uppercase
		});

		it("should return null for non-existent tasks", async () => {
			const core = await createDefaultProjectCore();

			const nonExistentTask = await core.filesystem.loadTask("task-999");
			expect(nonExistentTask).toBeNull();
		});

		it("should not modify task files (read-only operation)", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			const originalTask = {
				id: "task-1",
				title: "Read Only Test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-08",
				labels: ["readonly"],
				dependencies: [],
				rawContent: "Original description",
			};

			await core.createTask(originalTask, false);

			// Load the task (simulating view operation)
			const viewedTask = await core.filesystem.loadTask("task-1");

			// Load again to verify nothing changed
			const secondView = await core.filesystem.loadTask("task-1");

			expect(viewedTask).toEqual(secondView);
			expect(viewedTask?.title).toBe("Read Only Test");
			expect(viewedTask?.rawContent).toBe("Original description");
		});
	});

	describe("task shortcut command", () => {
		beforeEach(async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Shortcut Test Project");
		});

		it("should display formatted task details like the view command", async () => {
			const core = await createDefaultProjectCore();

			await core.createTask(
				{
					id: "task-1",
					title: "Shortcut Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Shortcut description",
				},
				false,
			);

			const resultShortcut = await viewTaskPlatformAware({ taskId: "1", plain: true }, TEST_DIR);
			const resultView = await viewTaskPlatformAware({ taskId: "1", plain: true, useViewCommand: true }, TEST_DIR);

			const outShortcut = resultShortcut.stdout;
			const outView = resultView.stdout;

			expect(outShortcut).toBe(outView);
			expect(outShortcut).toContain("Task task-1 - Shortcut Task");
		});
	});

	describe("task edit command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Edit Test Project", true);
		});

		it("should update task title, description, and status", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			await core.createTask(
				{
					id: "task-1",
					title: "Original Title",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Original description",
				},
				false,
			);

			// Load and edit the task
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();

			await core.updateTaskFromInput(
				"task-1",
				{
					title: "Updated Title",
					description: "Updated description",
					status: "In Progress",
				},
				false,
			);

			// Verify changes were persisted
			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask?.title).toBe("Updated Title");
			expect(extractStructuredSection(updatedTask?.rawContent || "", "description")).toBe("Updated description");
			expect(updatedTask?.status).toBe("In Progress");
			const today = new Date().toISOString().slice(0, 16).replace("T", " ");
			expect(updatedTask?.updatedDate).toBe(today);
		});

		it("should update assignee", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			await core.createTask(
				{
					id: "task-2",
					title: "Assignee Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Testing assignee updates",
				},
				false,
			);

			// Update assignee
			await core.updateTaskFromInput("task-2", { assignee: ["newuser@example.com"] }, false);

			// Verify assignee was updated
			const updatedTask = await core.filesystem.loadTask("task-2");
			expect(updatedTask?.assignee).toEqual(["newuser@example.com"]);
		});

		it("should replace all labels with new labels", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task with existing labels
			await core.createTask(
				{
					id: "task-3",
					title: "Label Replace Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["old1", "old2"],
					dependencies: [],
					rawContent: "Testing label replacement",
				},
				false,
			);

			// Replace all labels
			await core.updateTaskFromInput("task-3", { labels: ["new1", "new2", "new3"] }, false);

			// Verify labels were replaced
			const updatedTask = await core.filesystem.loadTask("task-3");
			expect(updatedTask?.labels).toEqual(["new1", "new2", "new3"]);
		});

		it("should add labels without replacing existing ones", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task with existing labels
			await core.createTask(
				{
					id: "task-4",
					title: "Label Add Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["existing"],
					dependencies: [],
					rawContent: "Testing label addition",
				},
				false,
			);

			// Add new labels
			await core.updateTaskFromInput("task-4", { addLabels: ["added1", "added2"] }, false);

			// Verify labels were added
			const updatedTask = await core.filesystem.loadTask("task-4");
			expect(updatedTask?.labels).toEqual(["existing", "added1", "added2"]);
		});

		it("should remove specific labels", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task with multiple labels
			await core.createTask(
				{
					id: "task-5",
					title: "Label Remove Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["keep1", "remove", "keep2"],
					dependencies: [],
					rawContent: "Testing label removal",
				},
				false,
			);

			// Remove specific label
			await core.updateTaskFromInput("task-5", { removeLabels: ["remove"] }, false);

			// Verify label was removed
			const updatedTask = await core.filesystem.loadTask("task-5");
			expect(updatedTask?.labels).toEqual(["keep1", "keep2"]);
		});

		it("should handle non-existent task gracefully", async () => {
			const core = await createDefaultProjectCore();

			const nonExistentTask = await core.filesystem.loadTask("task-999");
			expect(nonExistentTask).toBeNull();
		});

		it("should automatically set updated_date field when editing", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			await core.createTask(
				{
					id: "task-6",
					title: "Updated Date Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-07",
					labels: [],
					dependencies: [],
					rawContent: "Testing updated date",
				},
				false,
			);

			// Edit the task (without manually setting updatedDate)
			await core.updateTaskFromInput("task-6", { title: "Updated Title" }, false);

			// Verify updated_date was automatically set to today's date
			const updatedTask = await core.filesystem.loadTask("task-6");
			const today = new Date().toISOString().slice(0, 16).replace("T", " ");
			expect(updatedTask?.updatedDate).toBe(today);
			expect(updatedTask?.createdDate).toBe("2025-06-07"); // Should remain unchanged
		});

		it("should commit changes automatically", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			await core.createTask(
				{
					id: "task-7",
					title: "Commit Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Testing auto-commit",
				},
				false,
			);

			// Edit the task with auto-commit enabled
			await core.updateTaskFromInput("task-7", { title: "Updated for Commit" }, true);

			// Verify the task was updated (this confirms the update functionality works)
			const updatedTask = await core.filesystem.loadTask("task-7");
			expect(updatedTask?.title).toBe("Updated for Commit");

			// For now, just verify that updateTask with autoCommit=true doesn't throw
			// The actual git commit functionality is tested at the Core level
		});

		it("should preserve YAML frontmatter formatting", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			await core.createTask(
				{
					id: "task-8",
					title: "YAML Test",
					status: "To Do",
					assignee: ["testuser"],
					createdDate: "2025-06-08",
					labels: ["yaml", "test"],
					dependencies: ["task-1"],
					rawContent: "Testing YAML preservation",
				},
				false,
			);

			// Edit the task
			await core.updateTaskFromInput(
				"task-8",
				{
					title: "Updated YAML Test",
					status: "In Progress",
				},
				false,
			);

			// Verify all frontmatter fields are preserved
			const updatedTask = await core.filesystem.loadTask("task-8");
			expect(updatedTask?.id).toBe("TASK-8"); // IDs normalized to uppercase
			expect(updatedTask?.title).toBe("Updated YAML Test");
			expect(updatedTask?.status).toBe("In Progress");
			expect(updatedTask?.assignee).toEqual(["testuser"]);
			expect(updatedTask?.createdDate).toBe("2025-06-08");
			const today = new Date().toISOString().slice(0, 16).replace("T", " ");
			expect(updatedTask?.updatedDate).toBe(today);
			expect(updatedTask?.labels).toEqual(["yaml", "test"]);
			expect(updatedTask?.dependencies).toEqual(["task-1"]);
			expect(updatedTask?.rawContent).toBe("Testing YAML preservation");
		});
	});

	describe("task archive and state transition commands", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Archive Test Project");
		});

		it("should archive a task", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			await core.createTask(
				{
					id: "task-1",
					title: "Archive Test Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["completed"],
					dependencies: [],
					rawContent: "Task ready for archiving",
				},
				false,
			);

			// Archive the task
			const success = await core.archiveTask("task-1", false);
			expect(success).toBe(true);

			// Verify task is no longer in tasks directory
			const task = await core.filesystem.loadTask("task-1");
			expect(task).toBeNull();

			// Verify task exists in archive
			const { readdir } = await import("node:fs/promises");
			const archiveFiles = await readdir(core.filesystem.archiveTasksDir);
			expect(archiveFiles.some((f) => f.startsWith("task-1"))).toBe(true);
		});

		it("should handle archiving non-existent task", async () => {
			const core = await createDefaultProjectCore();

			const success = await core.archiveTask("task-999", false);
			expect(success).toBe(false);
		});

		it("should demote task to drafts", async () => {
			const core = await createDefaultProjectCore();

			// Create a test task
			await core.createTask(
				{
					id: "task-2",
					title: "Demote Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["needs-revision"],
					dependencies: [],
					rawContent: "Task that needs to go back to drafts",
				},
				false,
			);

			// Demote the task
			const success = await core.demoteTask("task-2", false);
			expect(success).toBe(true);

			// Verify task is no longer in tasks directory
			const task = await core.filesystem.loadTask("task-2");
			expect(task).toBeNull();

			// Verify demoted draft has new draft- ID
			const { readdir } = await import("node:fs/promises");
			const draftsFiles = await readdir(join(core.filesystem.backlogDir, "drafts"));
			expect(draftsFiles.some((f) => f.startsWith("draft-"))).toBe(true);

			// Verify draft can be loaded with draft- ID
			const demotedDraft = await core.filesystem.loadDraft("draft-1");
			expect(demotedDraft?.title).toBe("Demote Test Task");
		});

		it("should promote draft to tasks", async () => {
			const core = await createDefaultProjectCore();

			// Create a test draft through the canonical create path
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Promote Test Draft",
					status: "Draft",
					labels: ["ready"],
					rawContent: "Draft ready for promotion",
				},
				false,
			);

			// Promote the draft
			const success = await core.promoteDraft(draft.id, false);
			expect(success).toBe(true);

			// Verify draft is no longer in drafts directory
			const loadedDraft = await core.filesystem.loadDraft(draft.id);
			expect(loadedDraft).toBeNull();

			// Verify promoted task has new task- ID
			const { readdir } = await import("node:fs/promises");
			const tasksFiles = await readdir(core.filesystem.tasksDir);
			expect(tasksFiles.some((f) => f.startsWith("task-"))).toBe(true);

			// Verify task can be loaded with task- ID
			const promotedTask = await core.filesystem.loadTask("task-1");
			expect(promotedTask?.title).toBe("Promote Test Draft");
		});

		it("should archive a draft", async () => {
			const core = await createDefaultProjectCore();

			// Create a test draft through the canonical create path
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Archive Test Draft",
					status: "Draft",
					labels: ["cancelled"],
					rawContent: "Draft that should be archived",
				},
				false,
			);

			// Archive the draft
			const success = await core.archiveDraft(draft.id, false);
			expect(success).toBe(true);

			// Verify draft is no longer in drafts directory
			const loadedDraft = await core.filesystem.loadDraft(draft.id);
			expect(loadedDraft).toBeNull();

			// Verify draft exists in archive
			const { readdir } = await import("node:fs/promises");
			const archiveFiles = await readdir(join(core.filesystem.backlogDir, "archive", "drafts"));
			expect(archiveFiles.some((f) => f.startsWith(draft.id.toLowerCase()))).toBe(true);
		});

		it("should handle promoting non-existent draft", async () => {
			const core = await createDefaultProjectCore();

			const success = await core.promoteDraft("task-999", false);
			expect(success).toBe(false);
		});

		it("should handle demoting non-existent task", async () => {
			const core = await createDefaultProjectCore();

			const success = await core.demoteTask("task-999", false);
			expect(success).toBe(false);
		});

		it("should handle archiving non-existent draft", async () => {
			const core = await createDefaultProjectCore();

			const success = await core.archiveDraft("task-999", false);
			expect(success).toBe(false);
		});

		it("should commit archive operations automatically", async () => {
			const core = await createDefaultProjectCore();

			// Create and archive a task with auto-commit
			await core.createTask(
				{
					id: "task-5",
					title: "Commit Archive Test",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Testing auto-commit on archive",
				},
				false,
			);

			const success = await core.archiveTask("task-5", true); // autoCommit = true
			expect(success).toBe(true);

			// Verify operation completed successfully
			const task = await core.filesystem.loadTask("task-5");
			expect(task).toBeNull();
		});

		it("should preserve task content through state transitions", async () => {
			const core = await createDefaultProjectCore();

			// Create a task with rich content
			const originalTask = {
				id: "task-6",
				title: "Content Preservation Test",
				status: "In Progress",
				assignee: ["testuser"],
				createdDate: "2025-06-08",
				labels: ["important", "preservation-test"],
				dependencies: ["task-1", "task-2"],
				rawContent: "This task has rich metadata that should be preserved through transitions",
			};

			await core.createTask(originalTask, false);

			// Demote to draft - note: this generates a new draft ID
			await core.demoteTask("task-6", false);

			// Find the demoted draft (it will have a new draft- ID)
			const drafts = await core.filesystem.listDrafts();
			const asDraft = drafts.find((d) => d.title === originalTask.title);

			expect(asDraft?.title).toBe(originalTask.title);
			expect(asDraft?.assignee).toEqual(originalTask.assignee);
			expect(asDraft?.labels).toEqual(originalTask.labels);
			expect(asDraft?.dependencies).toEqual(originalTask.dependencies);
			expect(asDraft?.rawContent).toContain(originalTask.rawContent);

			// Promote back to task - use the draft's new ID
			expect(asDraft).toBeDefined();
			if (!asDraft) {
				throw new Error("Expected demoted draft to exist");
			}
			await core.promoteDraft(asDraft.id, false);

			// Find the promoted task (it will have a new task- ID)
			const tasks = await core.filesystem.listTasks();
			const backToTask = tasks.find((t) => t.title === originalTask.title);

			expect(backToTask?.title).toBe(originalTask.title);
			expect(backToTask?.assignee).toEqual(originalTask.assignee);
			expect(backToTask?.labels).toEqual(originalTask.labels);
			expect(backToTask?.dependencies).toEqual(originalTask.dependencies);
			expect(backToTask?.rawContent).toContain(originalTask.rawContent);
		});
	});

	describe("doc and decision commands", () => {
		beforeEach(async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Doc Test Project");
		});

		it("should create and list documents", async () => {
			const core = await createDefaultProjectCore();
			const doc: Document = {
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-06-08",
				rawContent: "Content",
			};
			await core.createDocument(doc, false);

			const docs = await core.filesystem.listDocuments();
			expect(docs).toHaveLength(1);
			expect(docs[0]?.title).toBe("Guide");
		});

		it("should create and list decisions", async () => {
			const core = await createDefaultProjectCore();
			const decision: Decision = {
				id: "decision-1",
				title: "Choose Stack",
				date: "2025-06-08",
				status: "accepted",
				context: "context",
				decision: "decide",
				consequences: "conseq",
				rawContent: "",
			};
			await core.createDecision(decision, false);
			const decisions = await core.filesystem.listDecisions();
			expect(decisions).toHaveLength(1);
			expect(decisions[0]?.title).toBe("Choose Stack");
		});
	});

	describe("board view command", () => {
		beforeEach(async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = await createDefaultProjectCore();
			await initializeTestProject(core, "Board Test Project", true);
		});

		it("should display kanban board with tasks grouped by status", async () => {
			const core = await createDefaultProjectCore();

			// Create test tasks with different statuses
			await core.createTask(
				{
					id: "task-1",
					title: "Todo Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "A task in todo",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-2",
					title: "Progress Task",
					status: "In Progress",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "A task in progress",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-3",
					title: "Done Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "A completed task",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(3);

			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];
			expect(statuses).toEqual(["To Do", "In Progress", "Done"]);

			// Test the kanban board generation
			const { generateKanbanBoardWithMetadata } = await import("../board.ts");
			const board = generateKanbanBoardWithMetadata(tasks, statuses, "Test Project");

			// Verify board contains all statuses and tasks (now on separate lines)
			expect(board).toContain("To Do");
			expect(board).toContain("In Progress");
			expect(board).toContain("Done");
			expect(board).toContain("TASK-1");
			expect(board).toContain("Todo Task");
			expect(board).toContain("TASK-2");
			expect(board).toContain("Progress Task");
			expect(board).toContain("TASK-3");
			expect(board).toContain("Done Task");

			// Verify board structure (now includes metadata header)
			const lines = board.split("\n");
			expect(board).toContain("# Kanban Board Export");
			expect(board).toContain("To Do");
			expect(board).toContain("In Progress");
			expect(board).toContain("Done");
			expect(board).toContain("|"); // Table structure
			expect(lines.length).toBeGreaterThan(5); // Should have content rows
		});

		it("should handle empty project with default statuses", async () => {
			const core = await createDefaultProjectCore();

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);

			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const { generateKanbanBoardWithMetadata } = await import("../board.ts");
			const board = generateKanbanBoardWithMetadata(tasks, statuses, "Test Project");

			// Should return board with metadata, configured status columns, and empty-state message
			expect(board).toContain("# Kanban Board Export");
			expect(board).toContain("| To Do | In Progress | Done |");
			expect(board).toContain("No tasks found");
		});

		it("should support vertical layout option", async () => {
			const core = await createDefaultProjectCore();

			await core.createTask(
				{
					id: "task-1",
					title: "Todo Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "A task in todo",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const { generateKanbanBoardWithMetadata } = await import("../board.ts");
			const board = generateKanbanBoardWithMetadata(tasks, statuses, "Test Project");

			// Should contain proper board structure
			expect(board).toContain("# Kanban Board Export");
			expect(board).toContain("To Do");
			expect(board).toContain("TASK-1");
			expect(board).toContain("Todo Task");
		});

		it("should support --vertical shortcut flag", async () => {
			const core = await createDefaultProjectCore();

			await core.createTask(
				{
					id: "task-1",
					title: "Shortcut Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-09",
					labels: [],
					dependencies: [],
					rawContent: "Testing vertical shortcut",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			// Test that --vertical flag produces vertical layout
			const { generateKanbanBoardWithMetadata } = await import("../board.ts");
			const board = generateKanbanBoardWithMetadata(tasks, statuses, "Test Project");

			// Should contain proper board structure
			expect(board).toContain("# Kanban Board Export");
			expect(board).toContain("To Do");
			expect(board).toContain("TASK-1");
			expect(board).toContain("Shortcut Task");
		});

		it("should merge task status from remote branches", async () => {
			const core = await createDefaultProjectCore();

			const task = {
				id: "task-1",
				title: "Remote Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-09",
				labels: [],
				dependencies: [],
				rawContent: "from remote",
			} as Task;

			await core.createTask(task, true);

			// set up remote repository
			const remoteDir = join(TEST_DIR, "remote.git");
			await $`git init --bare -b main ${remoteDir}`.quiet();
			await $`git remote add origin ${remoteDir}`.cwd(TEST_DIR).quiet();
			await $`git push -u origin main`.cwd(TEST_DIR).quiet();

			// create branch with updated status
			await $`git checkout -b feature`.cwd(TEST_DIR).quiet();
			await core.updateTaskFromInput("task-1", { status: "Done" }, true);
			await $`git push -u origin feature`.cwd(TEST_DIR).quiet();

			// Update remote-tracking branches to ensure they are recognized
			await $`git remote update origin --prune`.cwd(TEST_DIR).quiet();

			// switch back to main where status is still To Do
			await $`git checkout main`.cwd(TEST_DIR).quiet();

			await core.gitOps.fetch();
			const branches = await core.gitOps.listRemoteBranches();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const localTasks = await core.filesystem.listTasks();
			const tasksById = new Map(localTasks.map((t) => [t.id, t]));
			const tasksDir = relative(TEST_DIR, core.filesystem.tasksDir).replace(/\\/g, "/");

			for (const branch of branches) {
				const ref = `origin/${branch}`;
				const files = await core.gitOps.listFilesInTree(ref, tasksDir);
				for (const file of files) {
					const content = await core.gitOps.showFile(ref, file);
					const remoteTask = parseTask(content);
					const existing = tasksById.get(remoteTask.id);
					const currentIdx = existing ? statuses.indexOf(existing.status) : -1;
					const newIdx = statuses.indexOf(remoteTask.status);
					if (!existing || newIdx > currentIdx || currentIdx === -1 || newIdx === currentIdx) {
						tasksById.set(remoteTask.id, remoteTask);
					}
				}
			}

			const final = tasksById.get("TASK-1"); // IDs normalized to uppercase
			expect(final?.status).toBe("Done");
		});

		it("should default to view when no subcommand is provided", async () => {
			const core = await createDefaultProjectCore();

			await core.createTask(
				{
					id: "task-99",
					title: "Default Cmd Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-10",
					labels: [],
					dependencies: [],
					rawContent: "test",
				},
				false,
			);

			const resultDefault = await $`bun ${["src/cli.ts", "board"]}`.cwd(TEST_DIR).quiet().nothrow();
			const resultView = await $`bun ${["src/cli.ts", "board", "view"]}`.cwd(TEST_DIR).quiet().nothrow();

			expect(resultDefault.stdout.toString()).toBe(resultView.stdout.toString());
		});

		it("should export kanban board to file", async () => {
			const core = await createDefaultProjectCore();

			// Create test tasks
			await core.createTask(
				{
					id: "task-1",
					title: "Export Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-09",
					labels: [],
					dependencies: [],
					rawContent: "Testing board export",
				},
				false,
			);

			const { exportKanbanBoardToFile } = await import("../index.ts");
			const outputPath = join(TEST_DIR, "test-export.md");
			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			await exportKanbanBoardToFile(tasks, statuses, outputPath, "TestProject");

			// Verify file was created and contains expected content
			const content = await Bun.file(outputPath).text();
			expect(content).toContain("To Do");
			expect(content).toContain("TASK-1");
			expect(content).toContain("Export Test Task");
			expect(content).toContain("# Kanban Board Export (powered by Backlog.md)");
			expect(content).toContain("Project: TestProject");

			// Test overwrite behavior
			await exportKanbanBoardToFile(tasks, statuses, outputPath, "TestProject");
			const overwrittenContent = await Bun.file(outputPath).text();
			const occurrences = overwrittenContent.split("TASK-1").length - 1;
			expect(occurrences).toBe(1); // Should appear once after overwrite
		});
	});
});
