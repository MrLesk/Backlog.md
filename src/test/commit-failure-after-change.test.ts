import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { ChangeNotCommittedError, Core } from "../core/backlog.ts";
import { McpServer } from "../mcp/server.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { BacklogServer } from "../server/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createTestDirOutsideRepository, initializeTestProject, safeCleanup } from "./test-utils.ts";

/**
 * A change that is on disk while its commit failed is reported in one sentence, by every interface
 * and for tasks, documents and decisions alike: "<record> was <archived|restored|deleted>, but committing the
 * change failed: <reason>". Nobody is told that nothing happened, and nobody is told only that Git
 * failed.
 */
let TEST_DIR: string;
const CLI_PATH = getTestCliPath();
const COMMIT_FAILED = "but committing the change failed:";

async function backlog(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const result = await $`bun ${[CLI_PATH, ...args]}`.cwd(TEST_DIR).nothrow().quiet();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

/** Another Git process holds the index from here on, so nothing can be staged or committed. */
const lockIndex = () => writeFile(join(TEST_DIR, ".git", "index.lock"), "");
const unlockIndex = () => rm(join(TEST_DIR, ".git", "index.lock"), { force: true });

beforeEach(async () => {
	TEST_DIR = await createTestDirOutsideRepository("test-commit-failure");
	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	const core = new Core(TEST_DIR);
	await initializeTestProject(core, "Commit Failure Project", true);
	const config = await core.filesystem.loadConfig();
	if (!config) throw new Error("Expected the project config");
	await core.filesystem.saveConfig({ ...config, autoCommit: true, remoteOperations: false });
	// A task on the board and one in the archive, a document and a decision in their folders and one
	// of each in the archive, all committed.
	await core.createTaskFromInput({ title: "On the board" });
	await core.createTaskFromInput({ title: "In the archive" });
	expect(await core.archiveTask("TASK-2")).toBe(true);
	await core.createDocumentFromInput({ title: "A document", content: "" });
	await core.createDocumentFromInput({ title: "An archived document", content: "" });
	expect(await core.archiveContentRecord("document", "doc-2")).not.toBeNull();
	await core.createDecisionWithTitle("A decision");
	await core.createDecisionWithTitle("An archived decision");
	expect(await core.archiveContentRecord("decision", "decision-2")).not.toBeNull();
	await $`git add -A`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Set up the project"`.cwd(TEST_DIR).quiet().nothrow();
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
});

describe("a change whose commit failed, on the CLI", () => {
	it.each([
		[["task", "archive", "1"], "Task TASK-1 was archived"],
		[["task", "restore", "2"], "Task TASK-2 was restored"],
		[["task", "delete", "2"], "Task TASK-2 was deleted"],
		[["doc", "archive", "doc-1"], "Document doc-1 was archived"],
		[["doc", "restore", "doc-2"], "Document doc-2 was restored"],
		[["doc", "delete", "doc-2"], "Document doc-2 was deleted"],
		[["decision", "archive", "decision-1"], "Decision decision-1 was archived"],
		[["decision", "restore", "decision-2"], "Decision decision-2 was restored"],
		[["decision", "delete", "decision-2"], "Decision decision-2 was deleted"],
	])("backlog %j says %s and that committing failed", async (command, change) => {
		await lockIndex();

		const result = await backlog(...command);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toStartWith(`${change}, ${COMMIT_FAILED}`);
		expect(result.stderr).toContain("index.lock");
		// No success line, because the command did not finish what it does.
		expect(result.stdout).toBe("");
	});
});

describe("a change whose commit failed, through MCP", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await mcpServer.ensureConfigLoaded();
		registerTaskTools(mcpServer, config);
		registerDocumentTools(mcpServer, config);
	});

	afterEach(async () => {
		await mcpServer.stop().catch(() => {});
	});

	it.each([
		["task_archive", "task-1", "Task TASK-1 was archived"],
		["task_restore", "task-2", "Task TASK-2 was restored"],
		["task_delete", "task-2", "Task TASK-2 was deleted"],
		["document_archive", "doc-1", "Document doc-1 was archived"],
		["document_restore", "doc-2", "Document doc-2 was restored"],
		["document_delete", "doc-2", "Document doc-2 was deleted"],
	])("%s returns core's sentence instead of an unexpected error", async (tool, id, change) => {
		await lockIndex();

		const result = await mcpServer.testInterface.callTool({ params: { name: tool, arguments: { id } } });

		const text = (result.content?.[0] as { text?: string } | undefined)?.text ?? "";
		expect(result.isError).toBe(true);
		expect((result.structuredContent as { code?: string } | undefined)?.code).toBe("OPERATION_FAILED");
		expect(text).toContain(`${change}, ${COMMIT_FAILED}`);
		expect(text).not.toContain("An unexpected error occurred");
	});
});

describe("a change whose commit failed, in core and over HTTP", () => {
	it("throws one error type whose message names the change, and tags a task archive for the browser", async () => {
		const core = new Core(TEST_DIR);
		await lockIndex();

		const archived = await core.archiveTask("TASK-1").catch((error: unknown) => error);

		expect(archived).toBeInstanceOf(ChangeNotCommittedError);
		expect((archived as Error).message).toStartWith(`Task TASK-1 was archived, ${COMMIT_FAILED}`);
		expect((archived as { archiveState?: string }).archiveState).toBe("moved");

		await unlockIndex();
		await lockIndex();
		const document = await core.archiveContentRecord("document", "doc-1").catch((error: unknown) => error);
		expect(document).toBeInstanceOf(ChangeNotCommittedError);
		expect((document as Error).message).toStartWith(`Document doc-1 was archived, ${COMMIT_FAILED}`);
	});

	it("answers the task archive route with the same sentence and the moved state", async () => {
		const server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		try {
			await lockIndex();

			const response = await fetch(`http://127.0.0.1:${server.getPort()}/api/tasks/TASK-1/archive`, {
				method: "POST",
			});

			expect(response.status).toBe(500);
			const body = (await response.json()) as { error: string; archiveState: string };
			expect(body.error).toStartWith(`Task TASK-1 was archived, ${COMMIT_FAILED}`);
			expect(body.archiveState).toBe("moved");
		} finally {
			await server.stop();
		}
	});
});
