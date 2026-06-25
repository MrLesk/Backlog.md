import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("test-cli-help-schemas");
	await mkdir(TEST_DIR, { recursive: true });

	// Configure git for tests - required for CI
	await $`git init`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

	const core = new Core(TEST_DIR);
	await initializeTestProject(core, "CLI Help Schemas Test");
});

afterEach(async () => {
	try {
		await safeCleanup(TEST_DIR);
	} catch {
		// Ignore cleanup errors
	}
});

describe("command help input schemas", () => {
	it("shows input schema details for init and instructions", async () => {
		// CLI-CONTRACT: verifies '--help' output for init and instructions includes structured input schema fields and examples
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
		// CLI-CONTRACT: verifies '--help' output for task subcommands includes typed field descriptions with accepted status values from config
		const createHelp = await $`bun ${CLI_PATH} task create --help`.cwd(TEST_DIR).text();
		const listHelp = await $`bun ${CLI_PATH} task list --help`.cwd(TEST_DIR).text();
		const editHelp = await $`bun ${CLI_PATH} task edit --help`.cwd(TEST_DIR).text();
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

		// CLI-CONTRACT: verifies '--help' output reflects project-configured statuses (not hardcoded defaults) in task create/list/edit/search
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
		// CLI-CONTRACT: verifies '--help' output for doc/config/search/cleanup commands includes typed field descriptions
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
		// CLI-CONTRACT: verifies typo-corrected error message for unknown command ('tesk' → 'task')
		const unknownCommand = await $`bun ${CLI_PATH} tesk list`.cwd(TEST_DIR).nothrow().quiet();
		// CLI-CONTRACT: verifies typo-corrected error message for unknown option ('--statuz' → '--status')
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
		// CLI-CONTRACT: verifies missing required argument error message format ("missing required argument 'taskId'") and help pointer
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
		// CLI-CONTRACT: verifies 'init' CLI output and resulting project state in git repo
		await $`bun ${CLI_PATH} init ErrorProj --defaults --integration-mode none`.cwd(TEST_DIR).quiet();

		// CLI-CONTRACT: verifies 'task list --priority urgent' exits non-zero with concise error (no "Error:" prefix)
		const priority = await $`bun ${CLI_PATH} task list --priority urgent`.cwd(TEST_DIR).nothrow().quiet();
		// CLI-CONTRACT: verifies 'doc create -p ../outside' exits non-zero with concise error (no "Error:" prefix)
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
