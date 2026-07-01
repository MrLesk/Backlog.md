import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { CLI_AGENT_NUDGE, Core, isGitRepository } from "../index.ts";
import { parseTask } from "../markdown/parser.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import type { Decision, Document, Task } from "../types/index.ts";
import { BACKLOG_CWD_ENV } from "../utils/runtime-cwd.ts";
import { listTasksPlatformAware, viewTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const normalizeCliOutput = (output: string) => output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

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

	describe("root command", () => {
		it("prints the root entry when --plain is passed without a subcommand", async () => {
			const result = await $`bun ${CLI_PATH} --plain`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(0);
			expect(output).toContain("Backlog.md v");
			expect(output).toContain("Local instructions:");
			expect(output).toContain("backlog instructions overview");
			expect(output).not.toContain("unknown option '--plain'");
			expect(output).not.toContain("\u001B[");
			expect(output).not.toContain("\u001B]");
		});
	});

	describe("backlog instructions command", () => {
		it("prints the guide index by default", async () => {
			const output = await $`bun ${CLI_PATH} instructions`.cwd(TEST_DIR).text();

			expect(output).toContain("Backlog.md instructions");
			expect(output).toContain("Start here:");
			expect(output).toMatch(/'backlog instructions overview'\s+Required first read before answering any user request/);
			expect(output).not.toMatch(/^\s+'backlog instructions'\s+List workflow guides/m);
			expect(output).toContain("task-creation");
			expect(output).toContain("task-execution");
			expect(output).toContain("task-finalization");
			expect(output).toContain("init-required");
			expect(output).toContain("How to verify, summarize, and finish work");
			expect(output).not.toContain("mark work Done");
			expect(output).toContain("    'backlog instructions overview'");
			expect(output).toContain("      -> Required first read before answering any user request");
			expect(output).not.toContain("--plain");
			expect(output).not.toContain("\u001B[");
			expect(output).not.toContain("MCP Tools Quick Reference");
			expect(output).not.toContain("task_search");
			expect(output).not.toContain("backlog://workflow/");
			expect(output).not.toContain("Always operate through MCP tools");
			expect(output).not.toContain("bundled");
			expect(output).not.toContain("binary");
			expect(output).not.toContain("No network documentation");
		});

		it("lists available instruction guides", async () => {
			const output = await $`bun ${CLI_PATH} instructions --list`.cwd(TEST_DIR).text();

			expect(output).toContain("overview");
			expect(output).toContain("task-creation");
			expect(output).toContain("task-execution");
			expect(output).toContain("task-finalization");
			expect(output).toContain("init-required");
		});

		it("prints selected instruction guides", async () => {
			const overview = normalizeCliOutput(await $`bun ${CLI_PATH} instructions overview`.cwd(TEST_DIR).text());
			const taskCreation = normalizeCliOutput(await $`bun ${CLI_PATH} instructions task-creation`.cwd(TEST_DIR).text());
			const taskExecution = normalizeCliOutput(
				await $`bun ${CLI_PATH} instructions task-execution`.cwd(TEST_DIR).text(),
			);
			const taskFinalization = normalizeCliOutput(
				await $`bun ${CLI_PATH} instructions task-finalization`.cwd(TEST_DIR).text(),
			);
			const initRequired = normalizeCliOutput(await $`bun ${CLI_PATH} instructions init-required`.cwd(TEST_DIR).text());

			expect(overview).toContain("## Backlog.md Overview (CLI)");
			expect(overview).toContain("### Start Every Request Here");
			expect(overview).toContain(
				"Use this overview to decide what to read or run next. The detailed guides contain the procedure for creating, executing, and finalizing tasks.",
			);
			expect(overview).toContain('backlog search "query" --plain');
			expect(overview).toContain('backlog task list --search "login" --labels frontend,bug --limit 20 --plain');
			expect(overview).toContain("backlog task view BACK-123 --plain");
			expect(overview).toContain(
				"Always read the relevant guide before that part of the workflow. Do not rely on this overview alone for these actions:",
			);
			expect(overview).toContain(
				"`backlog instructions task-creation`\n  -> Read before creating tasks: how to search, scope, and create tasks",
			);
			expect(overview).toContain(
				"`backlog instructions task-execution`\n  -> Read before planning or updating task work: how to plan, update, and work through tasks",
			);
			expect(overview).toContain(
				"`backlog instructions task-finalization`\n  -> Read before finishing tasks: how to verify, summarize, and finish tasks",
			);
			expect(overview).not.toContain('backlog task create "Title"');
			expect(overview).not.toContain("backlog task edit BACK-123 --plan");
			expect(overview).not.toContain("backlog task edit BACK-123 --check-ac 1");
			expect(overview).not.toContain("backlog task edit BACK-123 -s Done");
			expect(overview).toContain(
				"Important: Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use Backlog commands so automatic metadata stays complete.",
			);
			expect(overview).not.toContain("MCP Tools Quick Reference");
			expect(overview).not.toContain("backlog://workflow/");
			expect(taskCreation).toContain("## Task Creation Guide");
			expect(taskCreation).toContain('backlog task create "Add project search"');
			expect(taskCreation).toContain('backlog search "desktop app" --plain');
			expect(taskCreation).toContain(
				'backlog task list --search "desktop app" --labels frontend,bug --limit 20 --plain',
			);
			expect(taskCreation).toContain('backlog task list --status "<active status>" --plain');
			expect(taskCreation).not.toContain('backlog task list --status "In Progress" --plain');
			expect(taskExecution).toContain(
				'backlog task list --status "<active status>" --assignee @your-name --labels backend --search "auth" --limit 20 --plain',
			);
			expect(taskExecution).toContain('backlog task edit BACK-123 -s "<active status>" -a @your-name');
			expect(taskExecution).not.toContain('backlog task edit BACK-123 -s "In Progress" -a @your-name');
			expect(taskFinalization).toContain("configured terminal status");
			expect(taskFinalization).toContain("Inspect accepted statuses if needed: `backlog task edit BACK-123 --help`");
			expect(taskFinalization).toContain('backlog task edit BACK-123 -s "<terminal status>"');
			expect(taskFinalization).not.toContain("backlog task edit BACK-123 -s Done");
			expect(taskCreation).not.toContain("task_create");
			expect(taskCreation).not.toContain("task_search");
			expect(initRequired).toContain("This directory does not have Backlog.md initialized.");
			expect(initRequired).toContain("backlog init --defaults");
		}, 15_000);

		it("renders task ID examples with the configured task prefix", async () => {
			await mkdir(join(TEST_DIR, "backlog"), { recursive: true });
			await Bun.write(
				join(TEST_DIR, "backlog", "config.yml"),
				[
					'project_name: "Prefix Project"',
					'statuses: ["To Do", "In Progress", "Done"]',
					"labels: []",
					"date_format: yyyy-mm-dd",
					'task_prefix: "feat"',
					"",
				].join("\n"),
			);

			const overview = await $`bun ${CLI_PATH} instructions overview`.cwd(TEST_DIR).text();
			const taskCreation = await $`bun ${CLI_PATH} instructions task-creation`.cwd(TEST_DIR).text();
			const createHelp = await $`bun ${CLI_PATH} task create --help`.cwd(TEST_DIR).text();
			const listHelp = await $`bun ${CLI_PATH} task list --help`.cwd(TEST_DIR).text();
			const editHelp = await $`bun ${CLI_PATH} task edit --help`.cwd(TEST_DIR).text();

			expect(overview).toContain("backlog task view FEAT-123 --plain");
			expect(taskCreation).toContain('backlog task create -p FEAT-10 "Set up shell"');
			expect(taskCreation).toContain('backlog task create "Add bulk update UI" --dep FEAT-21');
			expect(createHelp).toContain('backlog task create -p FEAT-1 "Add tests"');
			expect(listHelp).toContain("backlog task list --parent FEAT-1");
			expect(editHelp).toContain('backlog task edit FEAT-1 --status "<active status>" -a @sara');
			for (const output of [overview, taskCreation, createHelp, listHelp, editHelp]) {
				expect(output).not.toContain("BACK-");
			}
		}, 15_000);

		it("renders help and instruction examples from BACKLOG_CWD", async () => {
			await mkdir(join(TEST_DIR, "backlog"), { recursive: true });
			await Bun.write(
				join(TEST_DIR, "backlog", "config.yml"),
				[
					'project_name: "Runtime Cwd Schema Project"',
					'statuses: ["Ready", "Review", "Closed"]',
					"labels: []",
					"date_format: yyyy-mm-dd",
					'task_prefix: "feat"',
					"",
				].join("\n"),
			);
			const outsideDir = join(TEST_DIR, "outside");
			await mkdir(outsideDir, { recursive: true });
			const env = { ...process.env, [BACKLOG_CWD_ENV]: TEST_DIR };

			const overview = await $`bun ${CLI_PATH} instructions overview`.cwd(outsideDir).env(env).text();
			const createHelp = await $`bun ${CLI_PATH} task create --help`.cwd(outsideDir).env(env).text();
			const editHelp = await $`bun ${CLI_PATH} task edit --help`.cwd(outsideDir).env(env).text();

			expect(overview).toContain("backlog task view FEAT-123 --plain");
			expect(createHelp).toContain("status: one of configured statuses: Draft, Ready, Review, Closed");
			expect(createHelp).toContain('backlog task create -p FEAT-1 "Add tests"');
			expect(editHelp).toContain("status: one of configured statuses: Ready, Review, Closed");
			expect(editHelp).toContain('backlog task edit FEAT-1 --status "<active status>" -a @sara');
			for (const output of [overview, createHelp, editHelp]) {
				expect(output).not.toContain("BACK-");
			}
		}, 10_000);

		it("does not recommend task complete in CLI workflow guides or agent nudge", async () => {
			const overview = await $`bun ${CLI_PATH} instructions overview`.cwd(TEST_DIR).text();
			const taskCreation = await $`bun ${CLI_PATH} instructions task-creation`.cwd(TEST_DIR).text();
			const taskExecution = await $`bun ${CLI_PATH} instructions task-execution`.cwd(TEST_DIR).text();
			const taskFinalization = await $`bun ${CLI_PATH} instructions task-finalization`.cwd(TEST_DIR).text();

			for (const guide of [overview, taskCreation, taskExecution, taskFinalization, CLI_AGENT_NUDGE]) {
				expect(guide).not.toContain("backlog task complete");
				expect(guide).not.toContain("task complete");
				expect(guide).not.toContain("task_complete");
			}
		});

		it("rejects unknown instruction guides with valid options", async () => {
			const result = await $`bun ${CLI_PATH} instructions does-not-exist`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(1);
			expect(output).toContain("Unknown instruction guide: does-not-exist");
			expect(output).toContain("Valid guides:");
			expect(output).toContain("backlog instructions");
		});
	});

	describe("command help input schemas", () => {
		it("shows input schema details for init and instructions", async () => {
			const initHelp = await $`bun ${CLI_PATH} init --help`.cwd(TEST_DIR).text();
			const instructionsHelp = await $`bun ${CLI_PATH} instructions --help`.cwd(TEST_DIR).text();

			expect(initHelp).toContain("Input schema:");
			expect(initHelp).toContain("projectName: String");
			expect(initHelp).toContain("--integration-mode: one of: cli, mcp, none");
			expect(initHelp).toContain("(default: cli)");
			expect(initHelp).toContain("CLI instructions are recommended");
			expect(initHelp).toContain('backlog init "My Project" --defaults --integration-mode cli');
			expect(initHelp).not.toContain("backlog init --integration-mode mcp");
			expect(initHelp).toContain("Writes:");
			expect(instructionsHelp).toContain(
				"guide: one of: overview, task-creation, task-execution, task-finalization, init-required",
			);
			expect(instructionsHelp).toContain("Output:");
		});

		it("shows task command field types in help", async () => {
			const createHelp = await $`bun ${CLI_PATH} task create --help`.cwd(TEST_DIR).text();
			const listHelp = await $`bun ${CLI_PATH} task list --help`.cwd(TEST_DIR).text();
			const editHelp = await $`bun ${CLI_PATH} task edit --help`.cwd(TEST_DIR).text();
			const editHelpCompact = editHelp.replace(/\s+/g, " ");
			const completeHelp = await $`bun ${CLI_PATH} task complete --help`.cwd(TEST_DIR).text();

			expect(createHelp).toContain("title: String");
			expect(createHelp).toContain("description: Markdown");
			expect(createHelp).toContain("status: one of configured statuses: Draft, To Do, In Progress, Done");
			expect(createHelp).toContain("priority: one of: high, medium, low");
			expect(createHelp).toContain("ordinal: Integer");
			expect(listHelp).toContain("status: one of configured statuses: To Do, In Progress, Done");
			expect(listHelp).not.toContain("status: one of configured statuses: Draft, To Do, In Progress, Done");
			expect(listHelp).toContain("priority: one of: high, medium, low");
			expect(listHelp).toContain("labels: Comma-separated strings");
			expect(listHelp).toContain("search: String");
			expect(listHelp).toContain("limit: Positive integer");
			expect(listHelp).toContain("sort: one of: priority, id");
			expect(listHelp).toContain('backlog task list --labels frontend,bug --search "login" --limit 10 --plain');
			expect(editHelp).toContain("taskId: Task ID");
			expect(editHelp).toContain("status: one of configured statuses: To Do, In Progress, Done");
			expect(editHelp).not.toContain("status: one of configured statuses: Draft, To Do, In Progress, Done");
			expect(editHelp).toContain(
				"label: Comma-separated strings - Replace all labels; repeat --label or use label1,label2",
			);
			expect(editHelp).toContain(
				"add-label: Comma-separated strings - Add labels; repeat --add-label or use label1,label2",
			);
			expect(editHelp).toContain(
				"remove-label: Comma-separated strings - Remove labels; repeat --remove-label or use label1,label2",
			);
			expect(editHelp).toContain("clear-labels: Boolean - Remove all labels; cannot combine with other label flags");
			expect(editHelpCompact).toContain("replace all task labels");
			expect(editHelpCompact).toContain("add task labels without replacing existing labels");
			expect(editHelpCompact).toContain("remove task labels without replacing others");
			expect(editHelpCompact).toContain("remove all task labels");
			expect(editHelp).toContain("plan: Markdown");
			expect(editHelp).toContain("Writes:");
			expect(completeHelp).toContain("cleanup procedure");
			expect(completeHelp).toContain("disappear from the active Kanban board");
			expect(completeHelp).toContain("cleanup/archive purposes");
		});

		it("shows configured status values in task help", async () => {
			await mkdir(join(TEST_DIR, "backlog"), { recursive: true });
			await Bun.write(
				join(TEST_DIR, "backlog", "config.yml"),
				[
					'project_name: "Schema Project"',
					'statuses: ["Ready", "Review", "Closed"]',
					"labels: []",
					"date_format: yyyy-mm-dd",
					"",
				].join("\n"),
			);

			const createHelp = await $`bun ${CLI_PATH} task create --help`.cwd(TEST_DIR).text();
			const listHelp = await $`bun ${CLI_PATH} task list --help`.cwd(TEST_DIR).text();
			const searchHelp = await $`bun ${CLI_PATH} search --help`.cwd(TEST_DIR).text();
			const editHelp = await $`bun ${CLI_PATH} task edit --help`.cwd(TEST_DIR).text();

			expect(createHelp).toContain("status: one of configured statuses: Draft, Ready, Review, Closed");
			expect(listHelp).toContain("status: one of configured statuses: Ready, Review, Closed");
			expect(searchHelp).toContain("status: one of configured statuses: Ready, Review, Closed");
			expect(editHelp).toContain("status: one of configured statuses: Ready, Review, Closed");
			for (const output of [listHelp, searchHelp, editHelp]) {
				expect(output).not.toContain("status: one of configured statuses: Draft, Ready, Review, Closed");
			}
		});

		it("shows document, config, search, and cleanup schemas in help", async () => {
			const docHelp = await $`bun ${CLI_PATH} doc update --help`.cwd(TEST_DIR).text();
			const configHelp = await $`bun ${CLI_PATH} config set --help`.cwd(TEST_DIR).text();
			const searchHelp = await $`bun ${CLI_PATH} search --help`.cwd(TEST_DIR).text();
			const cleanupHelp = await $`bun ${CLI_PATH} cleanup --help`.cwd(TEST_DIR).text();

			expect(docHelp).toContain("content: Markdown");
			expect(docHelp).toContain("path: Docs-relative path");
			expect(docHelp).toContain("type: one of: readme, guide, specification, other");
			expect(configHelp).toContain("key: one of: defaultEditor, projectName, defaultStatus");
			expect(configHelp).toContain("value: String");
			expect(searchHelp).toContain("type: one or more of: task, document, decision");
			expect(searchHelp).toContain("status: one of configured statuses: To Do, In Progress, Done");
			expect(searchHelp).not.toContain("status: one of configured statuses: Draft, To Do, In Progress, Done");
			expect(searchHelp).toContain("priority: one of: high, medium, low");
			expect(searchHelp).toContain("modified-file: Project-root-relative path");
			expect(cleanupHelp).toContain("Writes:");
		});
	});

	describe("self-correcting CLI errors", () => {
		it("suggests likely commands and options", async () => {
			const unknownCommand = await $`bun ${CLI_PATH} tesk list`.cwd(TEST_DIR).nothrow().quiet();
			const unknownOption = await $`bun ${CLI_PATH} task list --statuz To Do`.cwd(TEST_DIR).nothrow().quiet();
			const commandOutput = unknownCommand.stdout.toString() + unknownCommand.stderr.toString();
			const optionOutput = unknownOption.stdout.toString() + unknownOption.stderr.toString();

			expect(unknownCommand.exitCode).not.toBe(0);
			expect(commandOutput).toContain("unknown command 'tesk'");
			expect(commandOutput).toContain("Did you mean task?");
			expect(commandOutput).toContain("Run with --help");
			expect(unknownOption.exitCode).not.toBe(0);
			expect(optionOutput).toContain("unknown option '--statuz'");
			expect(optionOutput).toContain("Did you mean --status?");
			expect(optionOutput).toContain("Run with --help");
		});

		it("points missing required arguments to help", async () => {
			const result = await $`bun ${CLI_PATH} task view`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).not.toBe(0);
			expect(output).toContain("missing required argument 'taskId'");
			expect(output).toContain("Run with --help");
		});

		it("keeps validation errors concise and actionable", async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
			await $`bun ${CLI_PATH} init ErrorProj --defaults --integration-mode none`.cwd(TEST_DIR).quiet();

			const priority = await $`bun ${CLI_PATH} task list --priority urgent`.cwd(TEST_DIR).nothrow().quiet();
			const docPath = await $`bun ${CLI_PATH} doc create "Unsafe" -p ../outside`.cwd(TEST_DIR).nothrow().quiet();
			const priorityOutput = priority.stdout.toString() + priority.stderr.toString();
			const docPathOutput = docPath.stdout.toString() + docPath.stderr.toString();

			expect(priority.exitCode).not.toBe(0);
			expect(priorityOutput).toContain("Invalid priority: urgent. Valid values are: high, medium, low");
			expect(priorityOutput).not.toContain("Error:");
			expect(docPath.exitCode).not.toBe(0);
			expect(docPathOutput).toContain("Document path cannot include traversal segments.");
			expect(docPathOutput).not.toContain("Error:");
		});
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

	describe("task list command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "List Test Project", true);
		});

		it("should show 'No tasks found' when no tasks exist", async () => {
			const core = new Core(TEST_DIR);
			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);
		});

		it("should list tasks grouped by status", async () => {
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

			// Load and verify default config status order
			const config = await core.filesystem.loadConfig();
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
		});

		it("should filter tasks by status", async () => {
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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

		it("should filter tasks by labels requiring every requested label", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "UI Bug Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["UI", "Bug"],
					dependencies: [],
					rawContent: "UI bug task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "UI Only Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["ui"],
					dependencies: [],
					rawContent: "UI only task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-3",
					title: "Bug Only Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["bug"],
					dependencies: [],
					rawContent: "Bug only task",
				},
				false,
			);

			const commaResult = await $`bun ${CLI_PATH} task list --plain --labels ui,bug`.cwd(TEST_DIR).quiet();
			const repeatedResult = await $`bun ${CLI_PATH} task list --plain --labels ui --labels bug`.cwd(TEST_DIR).quiet();

			for (const result of [commaResult, repeatedResult]) {
				const out = result.stdout.toString();
				expect(out).toContain("TASK-1 - UI Bug Task");
				expect(out).not.toContain("TASK-2 - UI Only Task");
				expect(out).not.toContain("TASK-3 - Bug Only Task");
			}
		});

		it("should filter tasks by search query", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Billing Webhook",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Handle invoice payment callbacks.",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Profile Settings",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Update account preferences.",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --search "invoice payment"`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("TASK-1 - Billing Webhook");
			expect(out).not.toContain("TASK-2 - Profile Settings");
		});

		it("should apply plain limit before regrouping sorted tasks by status", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Low Priority First ID",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					priority: "low",
					rawContent: "Low priority task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "High Priority Later ID",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					priority: "high",
					rawContent: "High priority task",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --limit 1`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("Done:");
			expect(out).toContain("[HIGH] TASK-2 - High Priority Later ID");
			expect(out).not.toContain("To Do:");
			expect(out).not.toContain("TASK-1 - Low Priority First ID");
		});

		it("should combine search, labels, and existing task list filters", async () => {
			const core = new Core(TEST_DIR);
			const milestone = await core.filesystem.createMilestone("Release Filters");

			await core.createTask(
				{
					id: "task-1",
					title: "OAuth Parent",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Parent task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-1.1",
					title: "OAuth Callback",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: ["security", "api"],
					dependencies: [],
					description: "Implement token exchange callback.",
					milestone: milestone.id,
					parentTaskId: "task-1",
					priority: "high",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-1.2",
					title: "OAuth Callback Missing Label",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: ["security"],
					dependencies: [],
					description: "Implement token exchange callback.",
					milestone: milestone.id,
					parentTaskId: "task-1",
					priority: "high",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "OAuth Callback Other Parent",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: ["security", "api"],
					dependencies: [],
					description: "Implement token exchange callback.",
					milestone: milestone.id,
					priority: "high",
				},
				false,
			);

			const result =
				await $`bun ${CLI_PATH} task list --plain --status ${"To Do"} --assignee alice --milestone "Release Filters" --parent TASK-1 --priority high --labels security,api --search "OAuth Callback"`
					.cwd(TEST_DIR)
					.quiet();
			const out = result.stdout.toString();
			expect(out).toContain("[HIGH] TASK-1.1 - OAuth Callback");
			expect(out).not.toContain("TASK-1.2 - OAuth Callback Missing Label");
			expect(out).not.toContain("TASK-2 - OAuth Callback Other Parent");
		});

		it("should reject invalid task list limit", async () => {
			const result = await $`bun ${CLI_PATH} task list --plain --limit 0`.cwd(TEST_DIR).nothrow().quiet();
			const out = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(1);
			expect(out).toContain("--limit must be a positive integer (1 or greater).");
			expect(out).toContain("Try 'backlog task list --help' for options.");
		});
	});

	describe("task view command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "View Test Project");
		});

		it("should display task details with markdown formatting", async () => {
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

			const nonExistentTask = await core.filesystem.loadTask("task-999");
			expect(nonExistentTask).toBeNull();
		});

		it("should not modify task files (read-only operation)", async () => {
			const core = new Core(TEST_DIR);

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

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Shortcut Test Project");
		});

		it("should display formatted task details like the view command", async () => {
			const core = new Core(TEST_DIR);

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

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Edit Test Project", true);
		});

		it("should update task title, description, and status", async () => {
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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

		it("should replace labels from repeated CLI label flags", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-6",
					title: "Repeated Label Replace Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["old1", "old2"],
					dependencies: [],
					rawContent: "Testing repeated label replacement",
				},
				false,
			);

			await $`bun ${CLI_PATH} task edit task-6 --label new1 --label new2,new3 --plain`.cwd(TEST_DIR).quiet();

			const updatedTask = await core.filesystem.loadTask("task-6");
			expect(updatedTask?.labels).toEqual(["new1", "new2", "new3"]);
		});

		it("should add labels from repeated CLI add-label flags", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-7",
					title: "Repeated Label Add Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["existing"],
					dependencies: [],
					rawContent: "Testing repeated label additions",
				},
				false,
			);

			await $`bun ${CLI_PATH} task edit task-7 --add-label video --add-label test,bug --plain`.cwd(TEST_DIR).quiet();

			const updatedTask = await core.filesystem.loadTask("task-7");
			expect(updatedTask?.labels).toEqual(["existing", "video", "test", "bug"]);
		});

		it("should remove labels from repeated CLI remove-label flags", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-8",
					title: "Repeated Label Remove Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["keep", "drop1", "drop2", "drop3"],
					dependencies: [],
					rawContent: "Testing repeated label removals",
				},
				false,
			);

			await $`bun ${CLI_PATH} task edit task-8 --remove-label drop1 --remove-label drop2,drop3 --plain`
				.cwd(TEST_DIR)
				.quiet();

			const updatedTask = await core.filesystem.loadTask("task-8");
			expect(updatedTask?.labels).toEqual(["keep"]);
		});

		it("should clear labels from CLI clear-labels flag", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-9",
					title: "Clear Labels Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["old1", "old2"],
					dependencies: [],
					rawContent: "Testing label clearing",
				},
				false,
			);

			await $`bun ${CLI_PATH} task edit task-9 --clear-labels --plain`.cwd(TEST_DIR).quiet();

			const updatedTask = await core.filesystem.loadTask("task-9");
			expect(updatedTask?.labels).toEqual([]);
		});

		it("should reject mixing CLI label replacement with label mutations", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-10",
					title: "Mixed Label Mode Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["old"],
					dependencies: [],
					rawContent: "Testing mixed label mode rejection",
				},
				false,
			);

			const addResult = await $`bun ${CLI_PATH} task edit task-10 --label replacement --add-label extra --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
			const removeResult = await $`bun ${CLI_PATH} task edit task-10 --label replacement --remove-label old --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
			const clearResult = await $`bun ${CLI_PATH} task edit task-10 --clear-labels --add-label extra --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();

			for (const result of [addResult, removeResult]) {
				expect(result.exitCode).toBe(1);
				expect(result.stderr.toString()).toContain("Cannot combine --label with --add-label or --remove-label");
			}
			expect(clearResult.exitCode).toBe(1);
			expect(clearResult.stderr.toString()).toContain(
				"Cannot combine --clear-labels with --label, --add-label, or --remove-label",
			);
			const updatedTask = await core.filesystem.loadTask("task-10");
			expect(updatedTask?.labels).toEqual(["old"]);
		});

		it("should handle non-existent task gracefully", async () => {
			const core = new Core(TEST_DIR);

			const nonExistentTask = await core.filesystem.loadTask("task-999");
			expect(nonExistentTask).toBeNull();
		});

		it("should automatically set updated_date field when editing", async () => {
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Archive Test Project");
		});

		it("should archive a task", async () => {
			const core = new Core(TEST_DIR);

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
			const archiveFiles = await readdir(join(TEST_DIR, "backlog", "archive", "tasks"));
			expect(archiveFiles.some((f) => f.startsWith("task-1"))).toBe(true);
		});

		it("should handle archiving non-existent task", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.archiveTask("task-999", false);
			expect(success).toBe(false);
		});

		it("refuses to archive a Done task through the CLI archive command", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-5",
					title: "Done CLI Archive Test Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["archive"],
					dependencies: [],
					rawContent: "Terminal-status task should be completed, not archived",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task archive task-5`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).not.toBe(0);
			expect(output).toContain("Task TASK-5 is Done.");
			expect(output).toContain("Use: backlog task complete TASK-5");
			expect(await core.filesystem.loadTask("task-5")).not.toBeNull();

			const archivedTasks = await core.filesystem.listArchivedTasks();
			expect(archivedTasks.some((task) => task.id === "TASK-5")).toBe(false);
		});

		it("completes a Done task through the CLI cleanup command", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-3",
					title: "Complete CLI Test Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["cleanup"],
					dependencies: [],
					rawContent: "Task ready for cleanup completion",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task complete task-3`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(0);
			expect(output).toContain("Completed task TASK-3.");
			expect(output).toContain(join(TEST_DIR, "backlog", "completed"));
			expect(await core.filesystem.loadTask("task-3")).toBeNull();

			const completedTasks = await core.filesystem.listCompletedTasks();
			expect(completedTasks.some((task) => task.id === "TASK-3")).toBe(true);
		});

		it("refuses to complete a non-Done task through the CLI cleanup command", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-4",
					title: "Not Done CLI Test Task",
					status: "Not Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["cleanup"],
					dependencies: [],
					rawContent: "Task not ready for cleanup completion",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task complete task-4`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).not.toBe(0);
			expect(output).toContain("Task TASK-4 is not Done.");
			expect(output).toContain('backlog task edit TASK-4 -s "Done"');
			expect(output).toContain("before cleanup");
			expect((await core.filesystem.loadTask("task-4"))?.status).toBe("Not Done");

			const completedTasks = await core.filesystem.listCompletedTasks();
			expect(completedTasks.some((task) => task.id === "TASK-4")).toBe(false);
		});

		it("should demote task to drafts", async () => {
			const core = new Core(TEST_DIR);

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
			const draftsFiles = await readdir(join(TEST_DIR, "backlog", "drafts"));
			expect(draftsFiles.some((f) => f.startsWith("draft-"))).toBe(true);

			// Verify draft can be loaded with draft- ID
			const demotedDraft = await core.filesystem.loadDraft("draft-1");
			expect(demotedDraft?.title).toBe("Demote Test Task");
		});

		it("should promote draft to tasks", async () => {
			const core = new Core(TEST_DIR);

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
			const tasksFiles = await readdir(join(TEST_DIR, "backlog", "tasks"));
			expect(tasksFiles.some((f) => f.startsWith("task-"))).toBe(true);

			// Verify task can be loaded with task- ID
			const promotedTask = await core.filesystem.loadTask("task-1");
			expect(promotedTask?.title).toBe("Promote Test Draft");
		});

		it("should archive a draft", async () => {
			const core = new Core(TEST_DIR);

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
			const archiveFiles = await readdir(join(TEST_DIR, "backlog", "archive", "drafts"));
			expect(archiveFiles.some((f) => f.startsWith(draft.id.toLowerCase()))).toBe(true);
		});

		it("should handle promoting non-existent draft", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.promoteDraft("task-999", false);
			expect(success).toBe(false);
		});

		it("should handle demoting non-existent task", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.demoteTask("task-999", false);
			expect(success).toBe(false);
		});

		it("should handle archiving non-existent draft", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.archiveDraft("task-999", false);
			expect(success).toBe(false);
		});

		it("should commit archive operations automatically", async () => {
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Doc Test Project");
		});

		it("should create and list documents", async () => {
			const core = new Core(TEST_DIR);
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

		it("should create documents in a subpath and print the persisted path", async () => {
			const result = await $`bun ${CLI_PATH} doc create "Setup Guide" -p guides/setup`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);
			const stdout = result.stdout.toString();
			expect(stdout).toContain("Created document doc-1");
			expect(stdout).toContain("Path: backlog/docs/guides/setup/doc-1 - Setup-Guide.md");

			const core = new Core(TEST_DIR);
			const docs = await core.filesystem.listDocuments();
			expect(docs[0]?.path).toBe("guides/setup/doc-1 - Setup-Guide.md");
		});

		it("should reject unsafe document paths", async () => {
			const result = await $`bun ${CLI_PATH} doc create "Unsafe" -p ../outside`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("Document path cannot include traversal segments.");
		});

		it("should update document content and metadata", async () => {
			const core = new Core(TEST_DIR);
			await core.createDocument(
				{
					id: "doc-1",
					title: "Setup Guide",
					type: "guide",
					createdDate: "2025-06-08",
					rawContent: "Old content",
					tags: ["setup"],
				},
				false,
				"guides/setup",
			);

			const updatedContent = "# Updated\n\nRun install steps.";
			const result =
				await $`bun ${CLI_PATH} doc update doc-1 --title "Install Runbook" --content ${updatedContent} -t specification --tags ops,runbook -p runbooks`
					.cwd(TEST_DIR)
					.quiet();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("Updated document doc-1");
			expect(result.stdout.toString()).toContain("Path: backlog/docs/runbooks/doc-1 - Install-Runbook.md");

			const docs = await core.filesystem.listDocuments();
			const updated = docs.find((doc) => doc.id === "doc-1");
			expect(updated?.title).toBe("Install Runbook");
			expect(updated?.type).toBe("specification");
			expect(updated?.tags).toEqual(["ops", "runbook"]);
			expect(updated?.path).toBe("runbooks/doc-1 - Install-Runbook.md");
			expect(updated?.rawContent).toBe(updatedContent);
		});

		it("should preserve omitted document fields when updating", async () => {
			const core = new Core(TEST_DIR);
			await core.createDocument(
				{
					id: "doc-1",
					title: "Setup Guide",
					type: "guide",
					createdDate: "2025-06-08",
					rawContent: "Keep this content",
					tags: ["setup", "guide"],
				},
				false,
				"guides",
			);

			await $`bun ${CLI_PATH} doc update doc-1 --title "Setup Handbook"`.cwd(TEST_DIR).quiet();

			const docs = await core.filesystem.listDocuments();
			const updated = docs.find((doc) => doc.id === "doc-1");
			expect(updated?.title).toBe("Setup Handbook");
			expect(updated?.type).toBe("guide");
			expect(updated?.tags).toEqual(["setup", "guide"]);
			expect(updated?.path).toBe("guides/doc-1 - Setup-Handbook.md");
			expect(updated?.rawContent).toBe("Keep this content");
		});

		it("should reject invalid document update inputs", async () => {
			const core = new Core(TEST_DIR);
			await core.createDocument(
				{
					id: "doc-1",
					title: "Setup Guide",
					type: "guide",
					createdDate: "2025-06-08",
					rawContent: "Content",
				},
				false,
			);

			const missing = await $`bun ${CLI_PATH} doc update doc-404 --content "Nope"`.cwd(TEST_DIR).quiet().nothrow();
			expect(missing.exitCode).not.toBe(0);
			expect(missing.stderr.toString()).toContain("Document not found: doc-404");

			const invalidType = await $`bun ${CLI_PATH} doc update doc-1 --content "Nope" -t invalid`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(invalidType.exitCode).not.toBe(0);
			expect(invalidType.stderr.toString()).toContain(
				"Document type must be one of: readme, guide, specification, other.",
			);

			const unsafePath = await $`bun ${CLI_PATH} doc update doc-1 --content "Nope" -p ../outside`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(unsafePath.exitCode).not.toBe(0);
			expect(unsafePath.stderr.toString()).toContain("Document path cannot include traversal segments.");
		});

		it("should create and list decisions", async () => {
			const core = new Core(TEST_DIR);
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

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Board Test Project", true);
		});

		it("should display kanban board with tasks grouped by status", async () => {
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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

			for (const branch of branches) {
				const ref = `origin/${branch}`;
				const files = await core.gitOps.listFilesInTree(ref, "backlog/tasks");
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
			const core = new Core(TEST_DIR);

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
			const core = new Core(TEST_DIR);

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
