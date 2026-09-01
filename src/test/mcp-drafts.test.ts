import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

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

		await initializeFilesystemTestProject(mcpServer, "Test Project");

		const config = await loadConfig(mcpServer);
		registerTaskTools(mcpServer, config);
	});

	afterEach(async () => {
		const stopResult = await Promise.allSettled([mcpServer.stop()]);
		const cleanupResult = await Promise.allSettled([safeCleanup(TEST_DIR)]);
		const errors = [...stopResult, ...cleanupResult]
			.filter((result): result is PromiseRejectedResult => result.status === "rejected")
			.map((result) => result.reason);
		if (errors.length === 1) throw errors[0];
		if (errors.length > 1) throw new AggregateError(errors, "MCP server and fixture cleanup both failed");
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

	it("reports dependent cleanup when task_edit demotes a task", async () => {
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Demotion target" } },
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: { title: "Dependent", dependencies: ["TASK-1"] },
			},
		});

		const result = await mcpServer.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "TASK-1", status: "Draft" } },
		});

		expect(getText(result.content)).toContain("Removed references to TASK-1 from TASK-2.");
	});

	it("task_edit status promotion fails fast under a held draft lock", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Contended MCP promotion",
					status: "Draft",
				},
			},
		});

		const reference = await mcpServer.filesystem.resolveDraftReference("DRAFT-1");
		if (!reference) throw new Error("expected draft reference");

		let release: () => void = () => {};
		try {
			const held = new Promise<void>((resolveHeld) => {
				void mcpServer.filesystem.withDraftLock(reference, async () => {
					resolveHeld();
					await new Promise<void>((resolveRelease) => {
						release = resolveRelease;
					});
				});
			});
			await held;

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "task_edit",
					arguments: {
						id: "DRAFT-1",
						status: "To Do",
					},
				},
			});

			expect(result.isError).toBe(true);
			expect(getText(result.content)).toContain("being modified by another process");

			const stillDraft = await mcpServer.filesystem.loadDraft("DRAFT-1");
			expect(stillDraft?.status).toBe("Draft");
		} finally {
			release();
		}
	});

	it("task_edit fails closed when duplicate numeric draft identities exist", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Alpha one",
					status: "Draft",
				},
			},
		});

		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const twinPath = join(draftsDir, "draft-001 - Alpha two.md");
		await Bun.write(
			twinPath,
			"---\nid: DRAFT-001\ntitle: Alpha two\nstatus: Draft\nassignee: []\ncreated_date: 2026-08-24 10:00\nlabels: []\ndependencies: []\n---\n\n## Description\n\nbody\n",
		);

		const view = await mcpServer.testInterface.callTool({
			params: {
				name: "task_view",
				arguments: { id: "DRAFT-1" },
			},
		});
		expect(view.isError).toBe(true);
		expect(getText(view.content)).toContain("is ambiguous");
		expect(getText(view.content)).toContain("draft-1 - Alpha-one.md");
		expect(getText(view.content)).toContain("draft-001 - Alpha two.md");

		const result = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "DRAFT-1",
					title: "Hijacked",
				},
			},
		});

		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("is ambiguous");
		expect(getText(result.content)).toContain("draft-001 - Alpha two.md");

		const healthyText = await Bun.file(join(draftsDir, "draft-1 - Alpha-one.md")).text();
		expect(healthyText).toContain("Alpha one");
		expect(await Bun.file(twinPath).text()).toContain("Alpha two");
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

	it("filters tasks and drafts by milestone ID as well as title", async () => {
		const milestone = await mcpServer.filesystem.createMilestone("Alpha Release");
		const numericId = milestone.id.replace(/^m-/i, "");

		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Milestone task", milestone: milestone.id } },
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: { title: "Milestone draft", status: "Draft", milestone: milestone.id },
			},
		});

		for (const query of [numericId, milestone.id, milestone.id.toUpperCase(), "Alpha Release"]) {
			const taskList = await mcpServer.testInterface.callTool({
				params: { name: "task_list", arguments: { milestone: query } },
			});
			expect(getText(taskList.content)).toContain("Milestone task");

			const draftList = await mcpServer.testInterface.callTool({
				params: { name: "task_list", arguments: { status: "Draft", milestone: query } },
			});
			expect(getText(draftList.content)).toContain("Milestone draft");
		}

		const unmatched = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { milestone: "zzz-unrelated-milestone" } },
		});
		expect(getText(unmatched.content)).not.toContain("Milestone task");
	});

	it("keeps active and archived milestone IDs distinct when their titles are reused", async () => {
		const archivedMilestone = await mcpServer.filesystem.createMilestone("Shared Release");
		await mcpServer.filesystem.createMilestone("Keep allocator advanced");
		expect((await mcpServer.archiveMilestone(archivedMilestone.id, false)).success).toBe(true);
		const activeMilestone = await mcpServer.filesystem.createMilestone("Shared Release");

		for (const [title, status, milestone] of [
			["Archived task", undefined, archivedMilestone.id],
			["Active task", undefined, activeMilestone.id],
			["Archived draft", "Draft", archivedMilestone.id],
			["Active draft", "Draft", activeMilestone.id],
		] as const) {
			await mcpServer.testInterface.callTool({
				params: { name: "task_create", arguments: { title, status, milestone } },
			});
		}

		for (const [query, included, excluded] of [
			[archivedMilestone.id, "Archived", "Active"],
			[activeMilestone.id, "Active", "Archived"],
		] as const) {
			const tasks = await mcpServer.testInterface.callTool({
				params: { name: "task_list", arguments: { milestone: query } },
			});
			const drafts = await mcpServer.testInterface.callTool({
				params: { name: "task_list", arguments: { status: "Draft", milestone: query } },
			});
			expect(getText(tasks.content)).toContain(`${included} task`);
			expect(getText(tasks.content)).not.toContain(`${excluded} task`);
			expect(getText(drafts.content)).toContain(`${included} draft`);
			expect(getText(drafts.content)).not.toContain(`${excluded} draft`);
		}
	});
});
