import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { addAgentInstructions } from "../agent-instructions.ts";
import { Core } from "../core/backlog.ts";
import { initializeProject } from "../core/init.ts";
import type { GitCommitResult } from "../git/operations.ts";
import { McpServer } from "../mcp/server.ts";
import { MilestoneHandlers } from "../mcp/tools/milestones/handlers.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { BacklogServer } from "../server/index.ts";
import { createTaskFromBoard } from "../ui/unified-view.ts";
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
		await addAgentInstructions(testDir, core.git, ["GEMINI.md"], true, {
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
		for (const fileName of ["AGENTS.md", "GEMINI.md", "CLAUDE.md"]) {
			expect(message).toContain(`"identifiers":["${fileName}"]`);
		}
		expect(message.match(/"entity":"instruction"/g)).toHaveLength(3);
	}, 20_000);

	test("mixed agent-instruction batches retain each file and actual action", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await Bun.write(join(testDir, "AGENTS.md"), "Existing project instructions\n");
		await $`git add . && git commit -m "Enable mixed instruction batch"`.cwd(testDir).quiet();

		const results = await addAgentInstructions(testDir, core.git, ["AGENTS.md", "CLAUDE.md"], true, {
			automaticCommitIntent: "amend-own",
		});

		expect(results.map(({ action, fileName }) => ({ action, fileName }))).toEqual([
			{ action: "updated", fileName: "AGENTS.md" },
			{ action: "created", fileName: "CLAUDE.md" },
		]);
		const message = await $`git show -s --format=%B HEAD`.cwd(testDir).text();
		expect(message).toContain('"verb":"Update","entity":"instruction","identifiers":["AGENTS.md"]');
		expect(message).toContain('"verb":"Add","entity":"instruction","identifiers":["CLAUDE.md"]');
		expect(message.match(/"entity":"instruction"/g)).toHaveLength(2);
		expect((await $`git show -s --format=%s HEAD`.cwd(testDir).text()).trim()).toBe("backlog: 2 changes");
	}, 20_000);

	test("Core agent-instruction writes feed the CLI/TUI result sink", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await $`git add backlog/config.yml && git commit -m "Enable agent feedback"`.cwd(testDir).quiet();
		const results: GitCommitResult[] = [];
		let callbackCount = 0;
		const invocationCore = new Core(testDir, {
			autoCommit: { results, onResult: () => callbackCount++ },
		});

		await invocationCore.updateAgentInstructions(["AGENTS.md"]);
		expect(invocationCore.consumeAutoCommitNotices()).toEqual([]);
		await Bun.write(join(testDir, "CLAUDE.md"), "Existing instructions\n");
		await invocationCore.updateAgentInstructions(["CLAUDE.md"]);

		expect(invocationCore.consumeAutoCommitNotices()).toEqual([
			expect.stringMatching(/^Amended Backlog commit [0-9a-f]{12} as [0-9a-f]{12}\.$/),
		]);
		expect(callbackCount).toBe(2);
		expect(results).toEqual([]);
	}, 20_000);

	test("CLI-shaped re-initialization records agent-instruction replacement feedback", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		const configured = { ...config, autoCommit: true, autoCommitMode: "amend-own" as const };
		await core.filesystem.saveConfig(configured);
		await $`git add backlog/config.yml && git commit -m "Enable re-init feedback"`.cwd(testDir).quiet();
		await core.createTaskFromInput({ title: "Owned before re-init" });
		const results: GitCommitResult[] = [];
		const invocationCore = new Core(testDir, { autoCommit: { results } });

		await initializeProject(invocationCore, {
			projectName: configured.projectName,
			integrationMode: "cli",
			agentInstructions: ["AGENTS.md"],
			existingConfig: configured,
		});

		expect(invocationCore.consumeAutoCommitNotices()).toEqual([
			expect.stringMatching(/^Amended Backlog commit [0-9a-f]{12} as [0-9a-f]{12}\.$/),
		]);
		expect(results).toEqual([]);
	}, 20_000);

	test("re-initialization writes and results honor post-save current automatic-commit bytes", async () => {
		for (const scenario of [
			{ name: "true-to-false", requested: true, current: false, requestedMode: "amend-own", currentMode: "amend-own" },
			{ name: "false-to-true", requested: false, current: true, requestedMode: "amend-own", currentMode: "amend-own" },
			{ name: "amend-to-new", requested: true, current: true, requestedMode: "amend-own", currentMode: "new" },
		] as const) {
			const root = join(testDir, scenario.name);
			await mkdir(root, { recursive: true });
			await $`git init -q -b main`.cwd(root);
			await $`git config user.email test@example.com`.cwd(root);
			await $`git config user.name "Test User"`.cwd(root);
			const scenarioCore = new Core(root);
			await initializeTestProject(scenarioCore, "Re-init current bytes");
			await $`git add . && git commit -q -m baseline`.cwd(root);
			const existingConfig = await scenarioCore.filesystem.loadConfig();
			if (!existingConfig) throw new Error("Missing test config");
			const originalSaveConfig = scenarioCore.filesystem.saveConfig.bind(scenarioCore.filesystem);
			scenarioCore.filesystem.saveConfig = async (config) => {
				await originalSaveConfig(config);
				const configPath = scenarioCore.filesystem.configFilePath;
				const savedBytes = await Bun.file(configPath).text();
				await Bun.write(
					configPath,
					savedBytes
						.replace(`auto_commit: ${scenario.requested}`, `auto_commit: ${scenario.current}`)
						.replace(`auto_commit_mode: ${scenario.requestedMode}`, `auto_commit_mode: ${scenario.currentMode}`),
				);
			};
			const beforeCount = await commitCount(root);

			const result = await initializeProject(scenarioCore, {
				projectName: existingConfig.projectName,
				integrationMode: "cli",
				agentInstructions: ["AGENTS.md"],
				existingConfig,
				advancedConfig: { autoCommit: scenario.requested, autoCommitMode: scenario.requestedMode },
			});

			expect(result.config.autoCommit).toBe(scenario.current);
			expect(result.config.autoCommitMode).toBe(scenario.currentMode);
			expect(await Bun.file(join(root, "AGENTS.md")).exists()).toBe(true);
			expect(await commitCount(root)).toBe(beforeCount + (scenario.current ? 1 : 0));
			if (scenario.current) {
				expect(await $`git show HEAD:AGENTS.md`.cwd(root).text()).toContain("Backlog.md");
			} else {
				expect((await $`git cat-file -e HEAD:AGENTS.md`.cwd(root).nothrow().quiet()).exitCode).not.toBe(0);
			}
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

	test("browser milestone creation shares new, amend-own, force-new, and disabled behavior", async () => {
		const setConfig = async (autoCommit: boolean, autoCommitMode: "new" | "amend-own", message: string) => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Missing test config");
			await core.filesystem.saveConfig({ ...config, autoCommit, autoCommitMode });
			await $`git add backlog/config.yml && git commit -m ${message}`.cwd(testDir).quiet();
		};
		const createThroughServer = async (title: string, autoCommit?: { forceNew: boolean }) => {
			const server = new BacklogServer(testDir, { autoCommit });
			try {
				await server.start(0, false);
				const response = await fetch(`http://localhost:${server.getPort()}/api/milestones`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title }),
				});
				expect(response.status).toBe(201);
				return response.headers.get("X-Backlog-Auto-Commit");
			} finally {
				await server.stop();
			}
		};

		await setConfig(true, "new", "Enable new milestone commits");
		const beforeNew = await commitCount(testDir);
		expect(await createThroughServer("New mode milestone")).toBeNull();
		expect(await commitCount(testDir)).toBe(beforeNew + 1);

		await setConfig(true, "amend-own", "Enable owned milestone commits");
		await createThroughServer("Owned milestone start");
		const afterOwnedStart = await commitCount(testDir);
		expect(await createThroughServer("Owned milestone replacement")).toMatch(/^Amended Backlog commit /);
		expect(await commitCount(testDir)).toBe(afterOwnedStart);

		expect(await createThroughServer("Forced milestone boundary", { forceNew: true })).toBeNull();
		expect(await commitCount(testDir)).toBe(afterOwnedStart + 1);

		await setConfig(false, "amend-own", "Disable milestone commits");
		const beforeDisabled = await commitCount(testDir);
		expect(await createThroughServer("Disabled milestone commit")).toBeNull();
		expect(await commitCount(testDir)).toBe(beforeDisabled);
	}, 30_000);

	test("current autoCommit false overrides stale enabled display config for TUI and agent-shaped mutations", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await $`git add . && git commit -m "Enable automatic commits"`.cwd(testDir).quiet();
		const cached = await core.filesystem.loadConfig();
		expect(cached?.autoCommit).toBe(true);
		const configPath = join(testDir, "backlog", "config.yml");
		const currentBytes = await Bun.file(configPath).text();
		await Bun.write(configPath, currentBytes.replace("auto_commit: true", "auto_commit: false"));
		const beforeCount = await commitCount(testDir);

		await createTaskFromBoard(core, { title: "Current bytes win" });
		await core.updateAgentInstructions(["AGENTS.md"]);

		expect(await commitCount(testDir)).toBe(beforeCount);
		expect(await core.filesystem.loadTask("task-1")).not.toBeNull();
		expect(await Bun.file(join(testDir, "AGENTS.md")).exists()).toBe(true);
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

	test("a mutation keeps its pre-write automatic-commit plan when config changes during the write", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await $`git add backlog/config.yml && git commit -m "Enable immutable plan test"`.cwd(testDir).quiet();
		const { task } = await core.createTaskFromInput({ title: "Owned plan" });
		const beforeUpdate = await commitCount(testDir);
		const saveTask = core.filesystem.saveTask.bind(core.filesystem);
		core.filesystem.saveTask = async (nextTask) => {
			const filePath = await saveTask(nextTask);
			const current = await core.filesystem.loadConfig();
			if (!current) throw new Error("Missing config during test write");
			await core.filesystem.saveConfig({ ...current, autoCommitMode: "new" });
			return filePath;
		};

		await core.updateTaskFromInput(task.id, { title: "Owned plan updated" });

		expect(await commitCount(testDir)).toBe(beforeUpdate);
		expect(await $`git show -s --format=%B HEAD`.cwd(testDir).text()).toContain('"verb":"Update"');
	}, 20_000);

	test("concurrent plan resolution cannot replace an in-flight Git configuration snapshot", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		const automaticConfig = { ...config, autoCommit: true, autoCommitMode: "amend-own" as const };
		await core.filesystem.saveConfig(automaticConfig);
		await $`git add backlog/config.yml && git commit -m "Enable concurrent plan test"`.cwd(testDir).quiet();
		const { task } = await core.createTaskFromInput({ title: "Concurrent plan" });
		const beforeUpdateHead = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();
		const beforeUpdateCount = await commitCount(testDir);

		let loadedConfig = automaticConfig;
		core.filesystem.loadConfigForMutation = async () => loadedConfig;
		const saveTask = core.filesystem.saveTask.bind(core.filesystem);
		let releaseWrite!: () => void;
		let reportWriteReached!: () => void;
		const writeReached = new Promise<void>((resolve) => {
			reportWriteReached = resolve;
		});
		const continueWrite = new Promise<void>((resolve) => {
			releaseWrite = resolve;
		});
		core.filesystem.saveTask = async (nextTask) => {
			const filePath = await saveTask(nextTask);
			reportWriteReached();
			await continueWrite;
			return filePath;
		};

		const update = core.updateTaskFromInput(task.id, { title: "Concurrent plan updated" });
		await writeReached;
		loadedConfig = { ...automaticConfig, filesystemOnly: true };
		let competingPlanSawRepository: boolean | undefined;
		await core.withAutoCommitPlan(undefined, async () => {
			competingPlanSawRepository = await core.git.isRepository();
		});
		expect(competingPlanSawRepository).toBe(false);
		releaseWrite();
		await update;

		const afterUpdateHead = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();
		expect(afterUpdateHead).not.toBe(beforeUpdateHead);
		expect(await commitCount(testDir)).toBe(beforeUpdateCount);
		expect(await $`git status --short`.cwd(testDir).text()).toBe("");
	}, 20_000);

	test("invalid auto-commit mode is rejected before entity or lifecycle writes", async () => {
		const { task } = await core.createTaskFromInput({ title: "Original task" }, false);
		const { task: draft } = await core.createTaskFromInput({ title: "Original draft", status: "Draft" }, false);
		const document = {
			id: "doc-atomic",
			title: "Original document",
			type: "other" as const,
			createdDate: "2026-07-29",
			rawContent: "Original document",
		};
		await core.createDocument(document, false);
		const decision = {
			id: "decision-atomic",
			title: "Original decision",
			date: "2026-07-29",
			status: "proposed" as const,
			context: "Original",
			decision: "Original",
			consequences: "Original",
			rawContent: "",
		};
		await core.createDecision(decision, false);
		const milestone = await core.createMilestone("Original milestone", undefined, false);
		await core.updateAgentInstructions(["AGENTS.md"], false);
		await $`git add . && git commit -m "Create invalid-mode fixtures"`.cwd(testDir).quiet();
		const configText = await Bun.file(join(testDir, "backlog", "config.yml")).text();
		const invalidConfig = /auto_commit_mode: .*/.test(configText)
			? configText.replace(/auto_commit_mode: .*/, 'auto_commit_mode: "amend-own')
			: `${configText.trimEnd()}\nauto_commit_mode: "amend-own\n`;
		await Bun.write(join(testDir, "backlog", "config.yml"), invalidConfig);
		await $`git add backlog/config.yml && git commit -m "Install invalid mode"`.cwd(testDir).quiet();
		core = new Core(testDir);

		const expectAtomicRejection = async (action: () => Promise<unknown>) => {
			await expect(action()).rejects.toThrow("auto_commit_mode must be new or amend-own");
			expect(await $`git status --short`.cwd(testDir).text()).toBe("");
		};
		await expectAtomicRejection(() => core.updateTaskFromInput(task.id, { title: "Changed task" }));
		await expectAtomicRejection(() => core.editTaskOrDraft(draft.id, { status: "To Do", title: "Promoted draft" }));
		await expectAtomicRejection(() => core.createDocument({ ...document, title: "Changed document" }));
		await expectAtomicRejection(() => core.createDecision({ ...decision, title: "Changed decision" }));
		await expectAtomicRejection(() =>
			new MilestoneHandlers(core).renameMilestone({ from: milestone.id, to: "Changed milestone" }),
		);
		await expectAtomicRejection(() => core.updateAgentInstructions(["AGENTS.md"]));

		await Bun.write(join(testDir, "backlog", "config.yml"), configText);
		core = new Core(testDir);
		expect((await core.filesystem.loadTask(task.id))?.title).toBe("Original task");
		expect((await core.filesystem.loadDraft(draft.id))?.title).toBe("Original draft");
		expect((await core.filesystem.loadDocument(document.id))?.title).toBe("Original document");
		expect((await core.filesystem.loadDecision(decision.id))?.title).toBe("Original decision");
		expect((await core.filesystem.loadMilestone(milestone.id))?.title).toBe("Original milestone");
		await Bun.write(join(testDir, "backlog", "config.yml"), invalidConfig);
		expect(await $`git status --short`.cwd(testDir).text()).toBe("");
	}, 20_000);

	test("long-lived Core, browser, and MCP mutations reject malformed current config bytes", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		const configured = { ...config, autoCommit: true, autoCommitMode: "amend-own" as const };
		await core.filesystem.saveConfig(configured);
		await $`git add backlog/config.yml && git commit -m "Cache valid long-lived config"`.cwd(testDir).quiet();
		const server = new BacklogServer(testDir);
		const mcp = new McpServer(testDir, "Test instructions");
		registerTaskTools(mcp, configured);
		try {
			await server.start(0, false);
			await core.filesystem.loadConfig();
			await (server as unknown as { core: Core }).core.filesystem.loadConfig();
			await mcp.filesystem.loadConfig();
			const configText = await Bun.file(join(testDir, "backlog", "config.yml")).text();
			await Bun.write(
				join(testDir, "backlog", "config.yml"),
				configText.replace(/auto_commit_mode: .*/, "auto_commit_mode unsafe"),
			);
			const headBeforeMutations = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();

			await expect(core.createTaskFromInput({ title: "Core must not write" })).rejects.toThrow(
				"auto_commit_mode must be new or amend-own",
			);
			const browserResponse = await fetch(`http://localhost:${server.getPort()}/api/tasks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Browser must not write" }),
			});
			expect(browserResponse.status).toBe(400);
			expect(await browserResponse.text()).toContain("auto_commit_mode must be new or amend-own");
			const mcpResult = await mcp.testInterface.callTool({
				params: { name: "task_create", arguments: { title: "MCP must not write" } },
			});
			expect(mcpResult.isError).toBe(true);
			expect(mcpResult.content.map((item) => ("text" in item ? item.text : "")).join("\n")).toContain(
				"auto_commit_mode must be new or amend-own",
			);

			expect(await core.filesystem.listTasks()).toEqual([]);
			expect((await $`git rev-parse HEAD`.cwd(testDir).text()).trim()).toBe(headBeforeMutations);
		} finally {
			await Promise.all([server.stop(), mcp.stop()]);
		}
	}, 20_000);

	test("long-lived Core, browser, and MCP mutations reject unavailable current config", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		const configured = { ...config, autoCommit: true, autoCommitMode: "amend-own" as const };
		await core.filesystem.saveConfig(configured);
		await $`git add backlog/config.yml && git commit -m "Cache available long-lived config"`.cwd(testDir).quiet();
		const server = new BacklogServer(testDir);
		const mcp = new McpServer(testDir, "Test instructions");
		registerTaskTools(mcp, configured);
		const configPath = join(testDir, "backlog", "config.yml");
		const backupPath = `${configPath}.unavailable`;
		try {
			await server.start(0, false);
			await core.filesystem.loadConfig();
			await (server as unknown as { core: Core }).core.filesystem.loadConfig();
			await mcp.filesystem.loadConfig();
			await rename(configPath, backupPath);
			const headBeforeMutations = (await $`git rev-parse HEAD`.cwd(testDir).text()).trim();

			await expect(core.createTaskFromInput({ title: "Core must not write" })).rejects.toThrow(
				"Unable to read current backlog configuration",
			);
			await mkdir(configPath);
			const browserResponse = await fetch(`http://localhost:${server.getPort()}/api/tasks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Browser must not write" }),
			});
			expect(browserResponse.status).toBe(400);
			expect(await browserResponse.text()).toContain("Unable to read current backlog configuration");
			await rm(configPath, { recursive: true, force: true });
			const mcpResult = await mcp.testInterface.callTool({
				params: { name: "task_create", arguments: { title: "MCP must not write" } },
			});
			expect(mcpResult.isError).toBe(true);
			expect(mcpResult.content.map((item) => ("text" in item ? item.text : "")).join("\n")).toContain(
				"Unable to read current backlog configuration",
			);
			expect(await core.filesystem.listTasks()).toEqual([]);
			expect((await $`git rev-parse HEAD`.cwd(testDir).text()).trim()).toBe(headBeforeMutations);
		} finally {
			await rm(configPath, { recursive: true, force: true });
			if (await Bun.file(backupPath).exists()) await rename(backupPath, configPath);
			await Promise.all([server.stop(), mcp.stop()]);
		}
	}, 20_000);

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
			["draft"],
			["draft", "list"],
			["draft", "view"],
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
