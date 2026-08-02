import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { CLI_AGENT_NUDGE } from "../index.ts";
import { BACKLOG_CWD_ENV } from "../utils/runtime-cwd.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const normalizeCliOutput = (output: string) => output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

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
			expect(overview).toContain("Use this overview to decide what to read or run next.");
			expect(overview).not.toContain("The detailed guides contain the procedure");
			expect(overview).toContain('backlog search "query" --plain');
			expect(overview).toContain('backlog task list --search "login" --labels frontend,bug --limit 20 --plain');
			expect(overview).toContain("backlog task view BACK-123 --plain");
			expect(overview).toContain(
				"**Required: read the matching guide below before creating, executing, or finalizing tasks. Do not rely on this overview alone for these actions.** The overview only tells you when to act; the guides define the required procedure, and skipping them produces inconsistent tasks and metadata.",
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
			expect(taskCreation).toContain('backlog task list --exclude-status "<terminal status>" --plain');
			expect(taskCreation).toContain(
				"Repeat `--exclude-status` or pass comma-separated configured statuses to exclude multiple states.",
			);
			expect(taskCreation).not.toContain('backlog task list --status "In Progress" --plain');
			expect(taskCreation).toContain(
				"Do not pass milestone IDs such as `m-0` to `--parent`; assign a task to a milestone with `--milestone`/`-m`.",
			);
			expect(taskCreation).toContain(
				"If you will continue from task creation into implementation in the same session, stop and read `backlog instructions task-execution` before viewing, assigning, planning, editing, or implementing a task.",
			);
			expect(taskCreation).toContain(
				"For future work, do **not** add an implementation plan or speculative code approach",
			);
			expect(taskCreation).toContain(
				"The narrow exception is already-started work being created directly in a configured active status",
			);
			expect(taskExecution).toContain(
				'backlog task list --status "<active status>" --assignee @your-name --labels backend --search "auth" --limit 20 --plain',
			);
			expect(taskExecution).toContain('backlog task edit BACK-123 -s "<active status>" -a @your-name');
			expect(taskExecution).not.toContain('backlog task edit BACK-123 -s "In Progress" -a @your-name');
			expect(taskExecution).toContain(
				"Research the current system, including relevant code, tests, conventions, and recent changes",
			);
			expect(taskExecution).toContain("Record the current plan in the task before implementation");
			expect(taskExecution).toContain("or more repeatable `--append-plan` values");
			expect(taskExecution).toContain(
				'backlog task edit BACK-123 --plan "1. Revised approach" --append-plan "2. Verify it"',
			);
			expect(taskExecution).toContain(
				"If the plan contains a material product, architecture, or workflow decision, or the project or user requires plan",
			);
			const viewIndex = taskExecution.indexOf("backlog task view BACK-123 --plain");
			const eligibilityIndex = taskExecution.indexOf("Review its current status");
			const activateIndex = taskExecution.indexOf('backlog task edit BACK-123 -s "<active status>" -a @your-name');
			const researchIndex = taskExecution.indexOf("Research the current system");
			const planIndex = taskExecution.indexOf("Record the current plan in the task");
			const conditionalReviewIndex = taskExecution.indexOf(
				"If the plan contains a material product, architecture, or workflow decision",
			);
			const implementIndex = taskExecution.indexOf("### Execution Workflow");
			expect(viewIndex).toBeGreaterThan(-1);
			expect(eligibilityIndex).toBeGreaterThan(viewIndex);
			expect(activateIndex).toBeGreaterThan(eligibilityIndex);
			expect(researchIndex).toBeGreaterThan(activateIndex);
			expect(planIndex).toBeGreaterThan(researchIndex);
			expect(conditionalReviewIndex).toBeGreaterThan(planIndex);
			expect(implementIndex).toBeGreaterThan(conditionalReviewIndex);
			expect(taskExecution).toContain(
				"Do not check acceptance criteria, write the final summary, or move the task to the terminal status from this guide alone.",
			);
			expect(taskExecution).toContain("verify each acceptance criterion with objective evidence before checking it");
			expect(taskFinalization).toContain("configured terminal status");
			expect(taskFinalization).toContain("Inspect accepted statuses if needed: `backlog task edit BACK-123 --help`");
			expect(taskFinalization).toContain('backlog task edit BACK-123 -s "<terminal status>"');
			expect(taskFinalization).not.toContain("backlog task edit BACK-123 -s Done");
			expect(taskFinalization).toContain("Run objective verification before checking acceptance criteria.");
			expect(taskFinalization).toContain(
				"For UI or interactive work, exercise the behavior through a browser, DOM script, test runner, or documented manual interaction result.",
			);
			expect(taskFinalization).toContain(
				"Do not check acceptance criteria from code presence, grep output, or implementation intent alone.",
			);
			expect(taskCreation).not.toContain("task_create");
			expect(taskCreation).not.toContain("task_search");
			expect(taskCreation).toContain("### Shell Quoting for Literal Backticks");
			expect(taskCreation).toContain("backlog task create 'Document `backlog init` setup'");
			expect(taskCreation).toContain(
				"Backlog.md cannot recover the original text after the shell has already executed it",
			);
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
			expect(createHelp).toContain("specify existing parent task ID, not a");
			expect(createHelp).toContain("milestone ID");
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
			const createHelpCompact = createHelp.replace(/\s+/g, " ");
			const editHelpCompact = editHelp.replace(/\s+/g, " ");
			const completeHelp = await $`bun ${CLI_PATH} task complete --help`.cwd(TEST_DIR).text();

			expect(createHelp).toContain("title: String");
			expect(createHelp).toContain("description: Markdown");
			expect(createHelp).toContain("status: one of configured statuses: Draft, To Do, In Progress, Done");
			expect(createHelp).toContain("priority: one of configured priorities: High, Medium, Low");
			expect(createHelp).toContain("ordinal: Integer");
			expect(createHelpCompact).toContain(
				"--plan <text> add a plan only for already-started work created directly in an active status (for example, In Progress)",
			);
			expect(createHelp).toContain(
				"plan: Markdown - Only for already-started work created directly in a configured active status (for example, In Progress)",
			);
			expect(listHelp).toContain("status: one of configured statuses: To Do, In Progress, Done");
			expect(listHelp).not.toContain("status: one of configured statuses: Draft, To Do, In Progress, Done");
			expect(listHelp).toContain("priority: one of configured priorities: High, Medium, Low");
			expect(listHelp).toContain("labels: Comma-separated strings");
			expect(listHelp).toContain("search: String");
			expect(listHelp).toContain("limit: Positive integer");
			expect(listHelp).toContain("sort: one of: priority, id, ordinal");
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
			expect(searchHelp).toContain("priority: one of configured priorities: High, Medium, Low");
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
			expect(priorityOutput).toContain("Invalid priority: urgent. Valid values are: High, Medium, Low");
			expect(priorityOutput).not.toContain("Error:");
			expect(docPath.exitCode).not.toBe(0);
			expect(docPathOutput).toContain("Document path cannot include traversal segments.");
			expect(docPathOutput).not.toContain("Error:");
		});
	});
});
