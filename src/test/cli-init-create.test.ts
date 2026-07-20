import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { CLI_AGENT_NUDGE, Core, isGitRepository } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("CLI Integration", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("backlog init command", () => {
		it("should initialize backlog project in existing git repo", async () => {
			// Set up a git repository
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			// Initialize backlog project using Core (simulating CLI)
			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "CLI Test Project", true);

			// Verify directory structure was created
			const configExists = await Bun.file(join(TEST_DIR, "backlog", "config.yml")).exists();
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

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Directory Test");

			// Check all expected directories exist
			const expectedDirs = [
				"backlog",
				"backlog/tasks",
				"backlog/drafts",
				"backlog/archive",
				"backlog/archive/tasks",
				"backlog/archive/drafts",
				"backlog/archive/milestones",
				"backlog/milestones",
				"backlog/docs",
				"backlog/decisions",
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

			const core = new Core(TEST_DIR);
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

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Existing Repo Test");

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Existing Repo Test");
		});

		it("should accept optional project name parameter", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			// Test the CLI implementation by directly using the Core functionality
			const core = new Core(TEST_DIR);
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
			const core = new Core(TEST_DIR);
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
			expect(output).toContain("AI Integration: CLI instructions");
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
			expect(output).toContain("AI Integration: CLI instructions");
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

		it("should default to CLI instructions when no mode is specified", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output = await $`bun ${CLI_PATH} init DefaultCliProj --defaults`.cwd(TEST_DIR).text();

			expect(output).toContain("AI Integration: CLI instructions");
			expect(output).toContain("Agent instructions: AGENTS.md");
			const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
			expect(agents).toContain(CLI_AGENT_NUDGE);
			expect(agents).toContain(
				"For every user request in this project, run `backlog instructions overview` before answering or taking action.",
			);
			expect(agents).not.toContain("`backlog instructions` to list available guides");
			expect(agents).not.toContain("# Instructions for the usage of Backlog.md CLI Tool");
		});

		it("maps Cursor to AGENTS.md while preserving existing instructions and user Cursor rules", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
			await Bun.write(join(TEST_DIR, "AGENTS.md"), "Existing team instructions\n");
			await mkdir(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
			const userRulePath = join(TEST_DIR, ".cursor", "rules", "team-owned.mdc");
			await Bun.write(userRulePath, "User-managed Cursor rule\n");

			const firstOutput = await $`bun ${CLI_PATH} init CursorProj --defaults --agent-instructions cursor`
				.cwd(TEST_DIR)
				.text();
			const secondOutput = await $`bun ${CLI_PATH} init CursorProj --defaults --agent-instructions cursor`
				.cwd(TEST_DIR)
				.text();

			const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
			expect(firstOutput).toContain("Agent instructions: AGENTS.md");
			expect(secondOutput).toContain("Unchanged: AGENTS.md");
			expect(agents).toContain("Existing team instructions");
			expect(agents).toContain(CLI_AGENT_NUDGE);
			expect((agents.match(/<!-- BACKLOG\.MD GUIDELINES START -->/g) || []).length).toBe(1);
			expect(await Bun.file(userRulePath).text()).toBe("User-managed Cursor rule\n");
			expect(await Bun.file(join(TEST_DIR, ".cursorrules")).exists()).toBe(false);
			expect(await Bun.file(join(TEST_DIR, ".cursor", "rules", "backlog.mdc")).exists()).toBe(false);
		});

		it("deduplicates Cursor and agents in combined instruction selections", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output = await $`bun ${CLI_PATH} init CombinedCursor --defaults --agent-instructions cursor,claude,agents`
				.cwd(TEST_DIR)
				.text();

			expect(output).toContain("Agent instructions: AGENTS.md, CLAUDE.md");
			expect(await Bun.file(join(TEST_DIR, "AGENTS.md")).exists()).toBe(true);
			expect(await Bun.file(join(TEST_DIR, "CLAUDE.md")).exists()).toBe(true);
			expect(await Bun.file(join(TEST_DIR, ".cursor", "rules", "backlog.mdc")).exists()).toBe(false);
		});

		it("documents the Cursor AGENTS.md target in init help", async () => {
			const help = await $`bun ${CLI_PATH} init --help`.cwd(TEST_DIR).text();

			expect(help).toContain("cursor (writes AGENTS.md)");
			expect(help).toContain("cursor writes AGENTS.md");
		});

		it("should label created and updated agent instruction files separately", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
			await Bun.write(join(TEST_DIR, "AGENTS.md"), "Existing instructions\n");

			const output = await $`bun ${CLI_PATH} init MixedAgentFiles --defaults --agent-instructions agents,claude`
				.cwd(TEST_DIR)
				.text();

			expect(output).toContain("Created: CLAUDE.md");
			expect(output).toContain("Updated: AGENTS.md");
			expect(output).not.toContain("Created: AGENTS.md");
			const agents = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
			const claude = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();
			expect(agents).toContain("Existing instructions");
			expect(agents).toContain(CLI_AGENT_NUDGE);
			expect(claude).toContain(CLI_AGENT_NUDGE);
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

			expect(output).toContain("Backlog directory: .backlog");
			expect(await Bun.file(join(TEST_DIR, ".backlog", "config.yml")).exists()).toBe(true);
			expect(await Bun.file(join(TEST_DIR, "backlog", "config.yml")).exists()).toBe(false);
		});

		it("should store custom non-interactive backlog dir in root backlog.config.yml", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const output =
				await $`bun ${CLI_PATH} init CustomProj --defaults --integration-mode none --backlog-dir planning/backlog-data`
					.cwd(TEST_DIR)
					.text();

			expect(output).toContain("Backlog directory: planning/backlog-data");
			expect(output).toContain("Config location: backlog.config.yml");
			expect(await Bun.file(join(TEST_DIR, "backlog.config.yml")).exists()).toBe(true);
			const rootConfig = await Bun.file(join(TEST_DIR, "backlog.config.yml")).text();
			expect(rootConfig).toContain('backlog_directory: "planning/backlog-data"');
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
			const core = new Core(TEST_DIR);
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

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Create Command Test", true);

			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected backlog config to exist");
			}

			config.autoCommit = true;
			await core.filesystem.saveConfig(config);
			const git = await core.getGitOps();
			await git.addFile(join(TEST_DIR, "backlog", "config.yml"));
			await git.commitChanges("backlog: Enable autoCommit for CLI create tests");
		});

		it("should honor autoCommit config for task create", async () => {
			const beforeCount = Number((await $`git rev-list --count HEAD`.cwd(TEST_DIR).text()).trim());
			const output = await $`bun ${CLI_PATH} task create "CLI Auto Commit Task"`.cwd(TEST_DIR).text();
			const afterCount = Number((await $`git rev-list --count HEAD`.cwd(TEST_DIR).text()).trim());

			const core = new Core(TEST_DIR);
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

			const core = new Core(TEST_DIR);
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
			const core = new Core(TEST_DIR);

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
});
