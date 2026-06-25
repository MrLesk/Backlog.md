import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { CLI_AGENT_NUDGE } from "../index.ts";
import { BACKLOG_CWD_ENV } from "../utils/runtime-cwd.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const normalizeCliOutput = (output: string) => output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

let TEST_DIR: string;

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("test-cli-instructions");
	await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
	try {
		await safeCleanup(TEST_DIR);
	} catch {
		// Ignore cleanup errors
	}
});

describe("root command", () => {
	it("prints the root entry when --plain is passed without a subcommand", async () => {
		// CLI-CONTRACT
		const result = await $`bun ${CLI_PATH} --plain`.cwd(TEST_DIR).nothrow().quiet();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).toBe(0);
		expect(output).toContain("Backlog.md v");
		expect(output).toContain("Local instructions:");
		expect(output).toContain("backlog instructions overview");
		expect(output).not.toContain("unknown option '--plain'");
		expect(output).not.toContain("[");
		expect(output).not.toContain("]");
	});
});

describe("backlog instructions command", () => {
	it("prints the guide index by default", async () => {
		// CLI-CONTRACT: verifies 'backlog instructions' default output format, guide list, and absence of MCP-specific content
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
		expect(output).not.toContain("[");
		expect(output).not.toContain("MCP Tools Quick Reference");
		expect(output).not.toContain("task_search");
		expect(output).not.toContain("backlog://workflow/");
		expect(output).not.toContain("Always operate through MCP tools");
		expect(output).not.toContain("bundled");
		expect(output).not.toContain("binary");
		expect(output).not.toContain("No network documentation");
	});

	it("lists available instruction guides", async () => {
		// CLI-CONTRACT: verifies 'backlog instructions --list' enumerates available guide names
		const output = await $`bun ${CLI_PATH} instructions --list`.cwd(TEST_DIR).text();

		expect(output).toContain("overview");
		expect(output).toContain("task-creation");
		expect(output).toContain("task-execution");
		expect(output).toContain("task-finalization");
		expect(output).toContain("init-required");
	});

	it("prints selected instruction guides", async () => {
		// CLI-CONTRACT: verifies content and structure of all instruction guide pages including example commands with configured prefix
		const overview = normalizeCliOutput(await $`bun ${CLI_PATH} instructions overview`.cwd(TEST_DIR).text());
		const taskCreation = normalizeCliOutput(await $`bun ${CLI_PATH} instructions task-creation`.cwd(TEST_DIR).text());
		const taskExecution = normalizeCliOutput(await $`bun ${CLI_PATH} instructions task-execution`.cwd(TEST_DIR).text());
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
		expect(taskCreation).toContain('backlog task list --search "desktop app" --labels frontend,bug --limit 20 --plain');
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

		// CLI-CONTRACT: verifies instruction/help output renders task ID examples using the project-configured task_prefix (e.g. FEAT-123)
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

		// CLI-CONTRACT: verifies BACKLOG_CWD env var overrides cwd for project discovery; help and instructions reflect project config from that path
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
		// CLI-CONTRACT: verifies no guide mentions 'backlog task complete' or 'task complete' to avoid agent confusion
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
		// CLI-CONTRACT: verifies unknown guide name exits non-zero with error message listing valid guide names
		const result = await $`bun ${CLI_PATH} instructions does-not-exist`.cwd(TEST_DIR).nothrow().quiet();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).toBe(1);
		expect(output).toContain("Unknown instruction guide: does-not-exist");
		expect(output).toContain("Valid guides:");
		expect(output).toContain("backlog instructions");
	});
});
