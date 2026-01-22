import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let TEST_DIR: string;
let mcpServer: McpServer;

async function loadConfig(server: McpServer) {
	const config = await server.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load backlog configuration for tests");
	}
	return config;
}

describe("MCP draft support via task tools", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-drafts");
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await mcpServer.initializeProject("Test Project");

		const config = await loadConfig(mcpServer);
		registerTaskTools(mcpServer, config);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
		} catch {
			// ignore
		}
		await safeCleanup(TEST_DIR);
	});

	it("creates, lists, and views drafts while excluding them by default", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Draft task",
					status: "Draft",
				},
			},
		});

		expect(getText(createResult.content)).toContain("Task DRAFT-1 - Draft task");

		const draft = await mcpServer.filesystem.loadDraft("draft-1");
		expect(draft).not.toBeNull();

		const listDefault = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: {} },
		});

		const defaultText = getText(listDefault.content);
		expect(defaultText).not.toContain("DRAFT-1");

		const listDrafts = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { status: "Draft" } },
		});

		const listDraftText = getText(listDrafts.content);
		expect(listDraftText).toContain("Draft:");
		expect(listDraftText).toContain("DRAFT-1 - Draft task");

		const viewDraft = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "draft-1" } },
		});

		const viewText = getText(viewDraft.content);
		expect(viewText).toContain("Task DRAFT-1 - Draft task");
	});

	it("promotes and demotes via task_edit status changes", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Promotion candidate",
					status: "Draft",
				},
			},
		});

		const promoteResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "draft-1",
					status: "To Do",
					title: "Promoted task",
				},
			},
		});

		expect(getText(promoteResult.content)).toContain("Task TASK-1 - Promoted task");

		const promoted = await mcpServer.getTask("task-1");
		expect(promoted?.status).toBe("To Do");

		const removedDraft = await mcpServer.filesystem.loadDraft("draft-1");
		expect(removedDraft).toBeNull();

		const demoteResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					status: "Draft",
					title: "Demoted draft",
				},
			},
		});

		const demoteText = getText(demoteResult.content);
		const match = demoteText.match(/Task (DRAFT-\d+)/);
		expect(match).not.toBeNull();
		const draftId = match?.[1] ?? "";

		const demotedDraft = await mcpServer.filesystem.loadDraft(draftId);
		expect(demotedDraft?.status).toBe("Draft");
		expect(demotedDraft?.title).toBe("Demoted draft");

		const taskFile = await mcpServer.filesystem.loadTask("task-1");
		expect(taskFile).toBeNull();
	});

	it("searches and archives drafts when requested", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Archive this draft",
					status: "Draft",
				},
			},
		});

		const searchResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_search",
				arguments: {
					query: "Archive",
					status: "Draft",
				},
			},
		});

		const searchText = getText(searchResult.content);
		expect(searchText).toContain("DRAFT-1 - Archive this draft");

		await mcpServer.testInterface.callTool({
			params: { name: "task_archive", arguments: { id: "draft-1" } },
		});

		const archivedDraft = await mcpServer.filesystem.loadDraft("draft-1");
		expect(archivedDraft).toBeNull();

		const archiveDir = join(TEST_DIR, "backlog", "archive", "drafts");
		const archiveFiles = await readdir(archiveDir);
		expect(archiveFiles.some((file) => file.startsWith("draft-1"))).toBe(true);
	});
});
