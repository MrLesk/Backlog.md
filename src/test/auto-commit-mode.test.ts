import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { addAgentInstructions } from "../agent-instructions.ts";
import { Core } from "../core/backlog.ts";
import { McpServer } from "../mcp/server.ts";
import { MilestoneHandlers } from "../mcp/tools/milestones/handlers.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const CROSS_ENTITY_GIT_TIMEOUT_MS = 20_000;

async function commitCount(directory: string): Promise<number> {
	return Number.parseInt((await $`git rev-list --count HEAD`.cwd(directory).text()).trim(), 10);
}

describe("autoCommitMode", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("auto-commit-mode");
		await mkdir(testDir, { recursive: true });
		await $`git init`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		core = new Core(testDir);
		await initializeTestProject(core, "Auto commit mode");
		await $`git add .`.cwd(testDir).quiet();
		await $`git commit -m "Initialize project"`.cwd(testDir).quiet();
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	test("missing mode keeps creating new commits", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: undefined });
		await $`git add backlog/config.yml && git commit -m "Enable automatic commits"`.cwd(testDir).quiet();

		await $`bun ${CLI_PATH} task create "First" --plain`.cwd(testDir).quiet();
		const afterFirst = await commitCount(testDir);
		await $`bun ${CLI_PATH} task create "Second" --plain`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Third" --plain --no-amend`.cwd(testDir).quiet();

		expect(await commitCount(testDir)).toBe(afterFirst + 2);
	});

	test("enabling amend-own starts after the last new-mode commit instead of rewriting it", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "new" });
		await $`git add backlog/config.yml && git commit -m "Enable new automatic commits"`.cwd(testDir).quiet();

		await core.createTaskFromInput({ title: "Before opt in" });
		const beforeOptIn = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();
		expect(await $`git show -s --format=%B HEAD`.cwd(testDir).text()).not.toContain("Backlog-Operations-");
		expect(await $`git reflog show -1 --format=%gs HEAD`.cwd(testDir).text()).toStartWith("commit: Create task");
		const beforeCount = await commitCount(testDir);

		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await core.createTaskFromInput({ title: "First owned operation" });
		expect(await commitCount(testDir)).toBe(beforeCount + 1);
		expect((await $`git merge-base --is-ancestor ${beforeOptIn} HEAD`.cwd(testDir).nothrow()).exitCode).toBe(0);
		expect(await $`git show -s --format=%B HEAD`.cwd(testDir).text()).toContain("Backlog-Operations-v2:");

		const afterSequenceStart = await commitCount(testDir);
		await core.createTaskFromInput({ title: "Second owned operation" });
		expect(await commitCount(testDir)).toBe(afterSequenceStart);
	}, 15_000);

	test("amend-own replaces an owned tip and --no-amend creates a new commit", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await $`git add backlog/config.yml && git commit -m "Enable owned commit replacement"`.cwd(testDir).quiet();

		await $`bun ${CLI_PATH} task create "First" --plain`.cwd(testDir).quiet();
		const afterFirst = await commitCount(testDir);
		const amended = await $`bun ${CLI_PATH} task create "Second" --plain`.cwd(testDir).text();

		expect(await commitCount(testDir)).toBe(afterFirst);
		expect(amended).toMatch(/Amended Backlog commit [0-9a-f]{12} as [0-9a-f]{12}\./);

		const forcedNew = await $`bun ${CLI_PATH} task create "Third" --plain --no-amend`.cwd(testDir).text();
		expect(await commitCount(testDir)).toBe(afterFirst + 1);
		expect(forcedNew).not.toContain("Amended Backlog commit");
	}, 20_000);

	for (const mode of ["new", "amend-own"] as const) {
		test(
			`${mode} is shared by task, draft, document, decision, milestone, and agent mutations`,
			async () => {
				const config = await core.filesystem.loadConfig();
				if (!config) throw new Error("Missing test config");
				await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: mode });
				await $`git add backlog/config.yml && git commit -m ${`Configure ${mode}`}`.cwd(testDir).quiet();
				const baseline = await commitCount(testDir);

				await core.createTaskFromInput({ title: "Task mutation" });
				await core.createTaskFromInput({ title: "Draft mutation", status: "Draft" });
				await core.createDocumentFromInput({ title: "Document mutation", content: "Document body" });
				await core.createDecision({
					id: "decision-1",
					title: "Decision mutation",
					date: "2026-07-28",
					status: "proposed",
					context: "",
					decision: "",
					consequences: "",
					rawContent: "",
				});
				await new MilestoneHandlers(core).addMilestone({ name: "Milestone mutation" });
				await addAgentInstructions(testDir, core.git, ["AGENTS.md"], true, {
					automaticCommitIntent: mode === "amend-own" ? "amend-own" : "new",
				});

				expect(await commitCount(testDir)).toBe(baseline + (mode === "new" ? 6 : 1));
				expect(await Bun.file(join(testDir, "AGENTS.md")).exists()).toBe(true);
				expect((await core.filesystem.listDrafts()).map((draft) => draft.title)).toContain("Draft mutation");
				expect((await core.filesystem.listDocuments()).map((document) => document.title)).toContain(
					"Document mutation",
				);
				expect((await core.filesystem.listDecisions()).map((decision) => decision.title)).toContain(
					"Decision mutation",
				);
				expect((await core.filesystem.listMilestones()).map((milestone) => milestone.title)).toContain(
					"Milestone mutation",
				);
			},
			CROSS_ENTITY_GIT_TIMEOUT_MS,
		);
	}

	test("structured production draft operations produce a factored rolling subject", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await $`git add backlog/config.yml && git commit -m "Enable owned draft replacement"`.cwd(testDir).quiet();

		await core.createTaskFromInput({ title: "First draft", status: "Draft" });
		await core.createTaskFromInput({ title: "Second draft", status: "Draft" });

		expect((await $`git show -s --format=%s HEAD`.cwd(testDir).text()).trim()).toBe(
			"backlog: Create drafts DRAFT-1, DRAFT-2",
		);
	});

	test("structured production upserts distinguish add and update operations", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await $`git add backlog/config.yml && git commit -m "Enable structured upsert replacement"`.cwd(testDir).quiet();

		await core.createDocument({
			id: "doc-1",
			title: "First document",
			type: "other",
			createdDate: "2026-07-28",
			rawContent: "First",
		});
		await core.createDocument({
			id: "doc-1",
			title: "Updated document",
			type: "other",
			createdDate: "2026-07-28",
			rawContent: "Updated",
		});
		const decision = {
			id: "decision-1",
			title: "Decision",
			date: "2026-07-28",
			status: "proposed" as const,
			context: "",
			decision: "First",
			consequences: "",
			rawContent: "",
		};
		await core.createDecision(decision);
		await core.createDecision({ ...decision, decision: "Updated" });
		await addAgentInstructions(testDir, core.git, ["AGENTS.md"], true, {
			automaticCommitIntent: "amend-own",
		});
		await Bun.write(join(testDir, "CLAUDE.md"), "Existing project instructions\n");
		const agentResults = await addAgentInstructions(testDir, core.git, ["CLAUDE.md"], true, {
			automaticCommitIntent: "amend-own",
		});
		expect(agentResults[0]?.action).toBe("updated");

		const message = await $`git show -s --format=%B HEAD`.cwd(testDir).text();
		for (const [verb, entity] of [
			["Add", "document"],
			["Update", "document"],
			["Add", "decision"],
			["Update", "decision"],
			["Add", "instruction"],
			["Update", "instruction"],
		]) {
			expect(message).toContain(`"verb":"${verb}","entity":"${entity}"`);
		}
	}, 20_000);

	test("MCP mutation output reports an owned replacement", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		const configured = { ...config, autoCommit: true, autoCommitMode: "amend-own" as const };
		await core.filesystem.saveConfig(configured);
		await $`git add backlog/config.yml && git commit -m "Enable MCP automatic replacement"`.cwd(testDir).quiet();

		const server = new McpServer(testDir, "Test instructions");
		registerTaskTools(server, configured);
		try {
			await server.testInterface.callTool({
				params: { name: "task_create", arguments: { title: "First MCP mutation" } },
			});
			const second = await server.testInterface.callTool({
				params: { name: "task_create", arguments: { title: "Second MCP mutation" } },
			});
			const text = second.content.map((item) => ("text" in item ? item.text : "")).join("\n");
			expect(text).toMatch(/Amended Backlog commit [0-9a-f]{12} as [0-9a-f]{12}\./);
		} finally {
			await server.stop();
		}
	});

	test("MCP invocation force-new starts a fresh owned sequence", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		const configured = { ...config, autoCommit: true, autoCommitMode: "amend-own" as const };
		await core.filesystem.saveConfig(configured);
		await $`git add backlog/config.yml && git commit -m "Enable MCP force-new test"`.cwd(testDir).quiet();

		const firstServer = new McpServer(testDir, "Test instructions");
		registerTaskTools(firstServer, configured);
		try {
			await firstServer.testInterface.callTool({
				params: { name: "task_create", arguments: { title: "Owned MCP sequence" } },
			});
		} finally {
			await firstServer.stop();
		}
		const beforeForced = await commitCount(testDir);

		const forcedServer = new McpServer(testDir, "Test instructions", "0.0.0", {
			autoCommit: { forceNew: true },
		});
		registerTaskTools(forcedServer, configured);
		try {
			const result = await forcedServer.testInterface.callTool({
				params: { name: "task_create", arguments: { title: "Forced MCP boundary" } },
			});
			const text = result.content.map((item) => ("text" in item ? item.text : "")).join("\n");
			expect(text).not.toContain("Amended Backlog commit");
		} finally {
			await forcedServer.stop();
		}
		expect(await commitCount(testDir)).toBe(beforeForced + 1);
	});

	test("autoCommit false remains the gate for every mutation type in amend-own mode", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: false, autoCommitMode: "amend-own" });
		await $`git add backlog/config.yml && git commit -m "Disable automatic commits"`.cwd(testDir).quiet();
		const baseline = await commitCount(testDir);

		await core.createTaskFromInput({ title: "Task mutation" });
		await core.createTaskFromInput({ title: "Draft mutation", status: "Draft" });
		await core.createDocumentFromInput({ title: "Document mutation", content: "Document body" });
		await core.createDecision({
			id: "decision-1",
			title: "Decision mutation",
			date: "2026-07-28",
			status: "proposed",
			context: "",
			decision: "",
			consequences: "",
			rawContent: "",
		});
		await new MilestoneHandlers(core).addMilestone({ name: "Milestone mutation" });
		await addAgentInstructions(testDir, core.git, ["AGENTS.md"], false, { automaticCommitIntent: "amend-own" });

		expect(await commitCount(testDir)).toBe(baseline);
	});

	test("every automatic-commit CLI command advertises --no-amend", async () => {
		const commandPaths = [
			["init"],
			["search"],
			["board"],
			["board", "view"],
			["browser"],
			["task"],
			["task", "list"],
			["task", "view"],
			["draft", "list"],
			["mcp", "start"],
			["task", "create"],
			["task", "edit"],
			["task", "archive"],
			["task", "complete"],
			["task", "demote"],
			["draft", "create"],
			["draft", "archive"],
			["draft", "promote"],
			["milestone", "add"],
			["milestone", "rename"],
			["milestone", "remove"],
			["milestone", "archive"],
			["doc", "create"],
			["doc", "update"],
			["decision", "create"],
			["agents"],
			["cleanup"],
		];
		for (const commandPath of commandPaths) {
			const help = await $`bun ${CLI_PATH} ${commandPath} --help`.cwd(testDir).text();
			expect(help, commandPath.join(" ")).toContain("--no-amend");
		}
	}, 30_000);

	test("a boolean enable override does not discard an invocation force-new boundary", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await $`git add backlog/config.yml && git commit -m "Enable owned replacement"`.cwd(testDir).quiet();

		await core.createTaskFromInput({ title: "Owned sequence" });
		const beforeForced = await commitCount(testDir);
		const invocationCore = new Core(testDir, { autoCommit: { forceNew: true } });
		await invocationCore.withAutoCommitFeedback(async () => {
			await invocationCore.createTaskFromInput({ title: "Forced boundary" }, true);
		});

		expect(await commitCount(testDir)).toBe(beforeForced + 1);
	});

	test("an explicit commit enable override still uses the configured mode", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: false, autoCommitMode: "amend-own" });
		await $`git add backlog/config.yml && git commit -m "Configure disabled automatic replacement"`
			.cwd(testDir)
			.quiet();

		await core.createTaskFromInput({ title: "First" }, true);
		const afterFirst = await commitCount(testDir);
		await core.createTaskFromInput({ title: "Second" }, true);

		expect(await commitCount(testDir)).toBe(afterFirst);
	});
});
