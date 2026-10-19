import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { basename, join } from "node:path";
import { $ } from "bun";
import { DEFAULT_STATUSES, DEFAULT_TASK_TYPES } from "../constants/index.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { JsonSchema } from "../mcp/validation/validators.ts";
import type { Task } from "../types/index.ts";
import {
	archiveTaskFile,
	commitSamePathBranchTaskVariant,
	createUniqueTestDir,
	initializeFilesystemTestProject,
	safeCleanup,
} from "./test-utils.ts";

// Helper to extract text from MCP content (handles union types)
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

async function enableGitTestProject(): Promise<void> {
	await $`git init -b main`.cwd(TEST_DIR).quiet();

	const config = await loadConfig(mcpServer);
	config.filesystemOnly = false;
	await mcpServer.filesystem.saveConfig(config);
	await mcpServer.ensureConfigLoaded();
}

function installCrossBranchTripwires(server: McpServer) {
	const error = new Error("MCP task search crossed the branch-loading boundary");
	const loadTasks = spyOn(server, "loadTasks").mockRejectedValue(error);
	const fetch = spyOn(server.gitOps, "fetch").mockRejectedValue(error);
	const listRecentBranchTips = spyOn(server.gitOps, "listRecentBranchTips").mockRejectedValue(error);
	const listRecentBranches = spyOn(server.gitOps, "listRecentBranches").mockRejectedValue(error);
	const listRecentRemoteBranches = spyOn(server.gitOps, "listRecentRemoteBranches").mockRejectedValue(error);
	const listFilesInTree = spyOn(server.gitOps, "listFilesInTree").mockRejectedValue(error);
	const showFile = spyOn(server.gitOps, "showFile").mockRejectedValue(error);
	const getRepositoryRoot = spyOn(server.gitOps, "getRepositoryRoot").mockRejectedValue(error);
	const resolveCommit = spyOn(server.gitOps, "resolveCommit").mockRejectedValue(error);

	return {
		expectUntouched() {
			expect(loadTasks).toHaveBeenCalledTimes(0);
			expect(fetch).toHaveBeenCalledTimes(0);
			expect(listRecentBranchTips).toHaveBeenCalledTimes(0);
			expect(listRecentBranches).toHaveBeenCalledTimes(0);
			expect(listRecentRemoteBranches).toHaveBeenCalledTimes(0);
			expect(listFilesInTree).toHaveBeenCalledTimes(0);
			expect(showFile).toHaveBeenCalledTimes(0);
			expect(getRepositoryRoot).toHaveBeenCalledTimes(0);
			expect(resolveCommit).toHaveBeenCalledTimes(0);
		},
		restore() {
			loadTasks.mockRestore();
			fetch.mockRestore();
			listRecentBranchTips.mockRestore();
			listRecentBranches.mockRestore();
			listRecentRemoteBranches.mockRestore();
			listFilesInTree.mockRestore();
			showFile.mockRestore();
			getRepositoryRoot.mockRestore();
			resolveCommit.mockRestore();
		},
	};
}

describe("MCP task tools (MVP)", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-tasks");
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

	it("creates and lists tasks", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Agent onboarding checklist",
					description: "Steps to onboard a new AI agent",
					labels: ["agents", "workflow"],
					priority: "high",
					acceptanceCriteria: ["Credentials provisioned", "Documentation shared"],
				},
			},
		});

		expect(getText(createResult.content)).toContain("Task TASK-1 - Agent onboarding checklist");

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { search: "onboarding" } },
		});

		const listText = (listResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
		expect(listText).toContain("To Do:");
		expect(listText).toContain("[HIGH] TASK-1 - Agent onboarding checklist");
		expect(listText).not.toContain("Implementation Plan:");
		expect(listText).not.toContain("Acceptance Criteria:");

		const searchResult = await mcpServer.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "agent" } },
		});

		const searchText = getText(searchResult.content);
		expect(searchText).toContain("Tasks:");
		expect(searchText).toContain("TASK-1 - Agent onboarding checklist");
		expect(searchText).toContain("(To Do)");
		expect(searchText).not.toContain("Implementation Plan:");
	});

	it("renders every task result through the one plain serializer", async () => {
		const create = async (title: string, dependencies?: string[]) =>
			await mcpServer.testInterface.callTool({
				params: { name: "task_create", arguments: { title, ...(dependencies ? { dependencies } : {}) } },
			});
		await create("Foundation");
		await create("Selected", ["TASK-1"]);
		await create("Follow up", ["TASK-2"]);

		const viewText = getText(
			(await mcpServer.testInterface.callTool({ params: { name: "task_view", arguments: { id: "TASK-2" } } })).content,
		);
		// Exactly the section the canonical CLI renders, from the same shared model.
		expect(viewText).toContain("Dependency Graph:");
		expect(viewText).toContain("Depends on (1 direct, 1 total):");
		expect(viewText).toContain("└─ TASK-1 - Foundation [To Do]");
		expect(viewText).toContain("Dependents (1 direct, 1 total):");
		expect(viewText).toContain("└─ TASK-3 - Follow up [To Do]");

		// A write confirmation is the same serializer, so it reads exactly like task detail.
		const editText = getText(
			(
				await mcpServer.testInterface.callTool({
					params: { name: "task_edit", arguments: { id: "TASK-2", priority: "high" } },
				})
			).content,
		);
		expect(editText).toContain("TASK-2");
		expect(editText).toContain("Dependency Graph:");
		expect(editText).toContain("Depends on (1 direct, 1 total):");
		expect(editText).not.toContain("Dependencies: ");
	});

	it("shows acceptance criteria progress in task_list only for tasks with criteria", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Task with criteria",
					acceptanceCriteria: ["First criterion", "Second criterion", "Third criterion"],
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: { id: "TASK-1", acceptanceCriteriaCheck: [1] },
			},
		});
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Task without criteria" } },
		});

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: {} },
		});

		const listText = getText(listResult.content);
		expect(listText).toContain("TASK-1 - Task with criteria (ac: 1/3)");
		expect(listText).toContain("TASK-2 - Task without criteria");
		expect(listText).not.toContain("Task without criteria (ac:");
	});

	it("creates, reports, edits, and clears dueDate", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createDueDateSchema = (toolByName.get("task_create")?.inputSchema as JsonSchema | undefined)?.properties
			?.dueDate;
		const editDueDateSchema = (toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined)?.properties?.dueDate;
		expect(createDueDateSchema?.type).toBe("string");
		expect(editDueDateSchema?.type).toEqual(["string", "null"]);
		expect(editDueDateSchema?.description).toContain("null to clear");

		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: { title: "Due task", dueDate: "2026-08-10" },
			},
		});
		expect(getText(createResult.content)).toContain("Due: 2026-08-10");
		expect((await mcpServer.getTask("task-1"))?.dueDate).toBe("2026-08-10");

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: {} },
		});
		expect(getText(listResult.content)).toContain("due 2026-08-10)");

		const editResult = await mcpServer.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "task-1", dueDate: null } },
		});
		expect(editResult.isError).not.toBe(true);
		expect((await mcpServer.getTask("task-1"))?.dueDate).toBeUndefined();

		const invalidResult = await mcpServer.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "task-1", dueDate: "10/08/2026" } },
		});
		expect(invalidResult.isError).toBe(true);
		expect(getText(invalidResult.content)).toContain("YYYY-MM-DD");
	});

	it("adapts duplicate diagnosis to the canonical CLI without agent repair prompts", async () => {
		const makeTask = (id: string, title: string): Task => ({
			id,
			title,
			status: "To Do",
			assignee: [],
			createdDate: "2026-01-01",
			labels: [],
			dependencies: [],
			rawContent: `## Description\n\n${title}`,
		});
		await Bun.write(
			join(mcpServer.filesystem.tasksDir, "task-1 - Alpha.md"),
			serializeTask(makeTask("TASK-1", "Alpha")),
		);
		await Bun.write(
			join(mcpServer.filesystem.tasksDir, "task-01 - Beta.md"),
			serializeTask(makeTask("TASK-01", "Beta")),
		);

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: {} },
		});
		const text = (listResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
		expect(text).toContain("duplicate task ID");
		expect(text).toContain("backlog doctor");
		expect(text).toContain("task-1 - Alpha.md");
		expect(text.toLowerCase()).not.toContain("prompt");
		expect(text.toLowerCase()).not.toContain("agent");

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "TASK-1" } },
		});
		expect(viewResult.isError).toBe(true);
		expect(getText(viewResult.content)).toContain("is ambiguous");
	});

	it("archives a task in any status, keeps its ID, and then treats it as read-only", async () => {
		const call = async (name: string, args: Record<string, unknown>) =>
			await mcpServer.testInterface.callTool({ params: { name, arguments: args } });
		await call("task_create", { title: "Finished work", status: "Done" });
		await call("task_create", { title: "Set aside work" });

		for (const id of ["task-1", "task-2"]) {
			const archived = await call("task_archive", { id });
			expect(archived.isError).not.toBe(true);
			expect(getText(archived.content)).toContain(`Archived task ${id.toUpperCase()}.`);
		}

		const view = getText((await call("task_view", { id: "task-1" })).content);
		expect(view).toContain("Task TASK-1 - Finished work");
		expect(view).toContain("Status: ✔ Done (archived)");
		expect((await mcpServer.filesystem.listArchivedTasks()).map((task) => [task.id, task.status])).toEqual([
			["TASK-1", "Done"],
			["TASK-2", "To Do"],
		]);

		// Both archived IDs stay taken, including the highest one.
		expect(getText((await call("task_create", { title: "Next work" })).content)).toContain("Task TASK-3 - Next work");

		for (const [name, args] of [
			["task_edit", { id: "task-2", notesAppend: ["late note"] }],
			["task_archive", { id: "task-2" }],
		] as const) {
			const refused = await call(name, args);
			expect(refused.isError).toBe(true);
			expect(getText(refused.content)).toContain(
				"Task TASK-2 is archived. Archived tasks are read-only. Restore it to the board first: backlog task restore TASK-2",
			);
		}

		const toolNames = (await mcpServer.testInterface.listTools()).tools.map((tool) => tool.name);
		expect(toolNames).toContain("task_archive");
		expect(toolNames.filter((name) => name.includes("complete"))).toEqual([]);
	});

	it("answers a lifecycle call on a task that exists only on another branch with core's read-only refusal", async () => {
		await enableGitTestProject();
		const config = await loadConfig(mcpServer);
		await mcpServer.filesystem.saveConfig({ ...config, checkActiveBranches: true, remoteOperations: false });
		const base = { status: "To Do", assignee: [], createdDate: "2026-08-01", labels: [], dependencies: [] };
		await mcpServer.filesystem.saveTask({ ...base, id: "TASK-1", title: "On the board" });
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add the board task"`.cwd(TEST_DIR).quiet();
		await $`git switch -c feature`.cwd(TEST_DIR).quiet();
		await mcpServer.filesystem.saveTask({ ...base, id: "TASK-2", title: "Only on the feature branch" });
		await Bun.write(
			join(mcpServer.filesystem.archiveTasksDir, "task-3 - Archived-on-the-feature-branch.md"),
			serializeTask({ ...base, id: "TASK-3", title: "Archived on the feature branch" }),
		);
		// Two files on that branch claim TASK-4.
		for (const name of ["task-4 - First-claimant.md", "task-04 - Second-claimant.md"]) {
			await Bun.write(
				join(mcpServer.filesystem.tasksDir, name),
				serializeTask({ ...base, id: name.startsWith("task-04") ? "TASK-04" : "TASK-4", title: name }),
			);
		}
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add the feature tasks"`.cwd(TEST_DIR).quiet();
		await $`git switch main`.cwd(TEST_DIR).quiet();
		const call = async (name: string, args: Record<string, unknown>) =>
			await mcpServer.testInterface.callTool({ params: { name, arguments: args } });

		// Both tasks are visible from here, on the other branch's board and in its archive, so
		// "not found" would contradict what task_view just showed.
		for (const [id, title] of [
			["2", "Only on the feature branch"],
			["3", "Archived on the feature branch"],
		]) {
			const view = await call("task_view", { id: `task-${id}` });
			expect(view.isError).not.toBe(true);
			expect(getText(view.content)).toContain(`Task TASK-${id} - ${title}`);

			for (const operation of ["task_archive", "task_delete", "task_restore"]) {
				const refused = await call(operation, { id: `task-${id}` });
				expect(refused.isError).toBe(true);
				expect(getText(refused.content)).toBe(
					`Task TASK-${id} exists only on branch "feature" and is read-only here. Switch to that branch to change it.`,
				);
			}
		}

		const unknown = await call("task_archive", { id: "task-9" });
		expect(unknown.isError).toBe(true);
		expect(getText(unknown.content)).toBe("Task task-9 not found.");

		// An ID that two records claim on the other branch fails closed instead of reading as missing.
		const contested = await call("task_archive", { id: "task-4" });
		expect(contested.isError).toBe(true);
		expect(getText(contested.content)).toContain("is ambiguous");
		await expect(mcpServer.archiveTask("task-4")).rejects.toThrow("is ambiguous");
		await expect(mcpServer.deleteTask("task-4")).rejects.toThrow("is ambiguous");
		await expect(mcpServer.restoreTask("task-4")).rejects.toThrow("is ambiguous");

		expect((await mcpServer.filesystem.listTasks()).map((task) => task.id)).toEqual(["TASK-1"]);
		expect(await mcpServer.filesystem.listArchivedTasks()).toEqual([]);
	});

	it("restores an archived task to the board under the same rules as the CLI", async () => {
		const call = async (name: string, args: Record<string, unknown>) =>
			await mcpServer.testInterface.callTool({ params: { name, arguments: args } });
		await call("task_create", { title: "Comes back", status: "In Progress" });
		await call("task_create", { title: "Stays on the board" });
		await call("task_archive", { id: "task-1" });

		const restored = await call("task_restore", { id: "task-1" });
		expect(restored.isError).not.toBe(true);
		const text = getText(restored.content);
		expect(text).toContain("Restored task TASK-1.");
		expect(text).toContain("Task TASK-1 - Comes back");
		expect(text).toContain("In Progress");
		expect(text).not.toContain("(archived)");
		expect((await mcpServer.filesystem.listTasks()).map((task) => task.id)).toEqual(["TASK-1", "TASK-2"]);
		expect(await mcpServer.filesystem.listArchivedTasks()).toEqual([]);

		// Back on the board it is an ordinary task again.
		const edited = await call("task_edit", { id: "task-1", notesAppend: ["Back on the board"] });
		expect(edited.isError).not.toBe(true);
		// task_list returns one text item per status; the restored task is in its own status group.
		const listed = ((await call("task_list", {})).content ?? []).map((_item, index, items) => getText(items, index));
		expect(listed.join("\n")).toContain("In Progress:\n  TASK-1 - Comes back");

		const onBoard = await call("task_restore", { id: "task-2" });
		expect(onBoard.isError).toBe(true);
		expect(getText(onBoard.content)).toContain("Task TASK-2 is not archived. It is already on the board.");
		const unknown = await call("task_restore", { id: "task-99" });
		expect(unknown.isError).toBe(true);
		expect(getText(unknown.content)).toContain("Task task-99 not found.");
		expect((await mcpServer.filesystem.listTasks()).map((task) => task.id)).toEqual(["TASK-1", "TASK-2"]);

		const restoreTool = (await mcpServer.testInterface.listTools()).tools.find((tool) => tool.name === "task_restore");
		expect(restoreTool?.inputSchema).toMatchObject({
			properties: { id: { type: "string" } },
			required: ["id"],
			additionalProperties: false,
		});
	});

	it("deletes an archived task under the same rules as the CLI", async () => {
		const call = async (name: string, args: Record<string, unknown>) =>
			await mcpServer.testInterface.callTool({ params: { name, arguments: args } });
		await call("task_create", { title: "Target" });
		await call("task_create", { title: "Dependent", dependencies: ["task-1"] });
		await call("task_create", { title: "Parent" });
		await call("task_create", { title: "Child", parentTaskId: "task-3" });
		await call("task_create", { title: "Draft dependent", status: "Draft", dependencies: ["task-1"] });

		const notArchived = await call("task_delete", { id: "task-1" });
		expect(notArchived.isError).toBe(true);
		expect(getText(notArchived.content)).toContain(
			"Task TASK-1 is not archived. A task must be archived before it can be deleted.",
		);
		expect((await mcpServer.filesystem.loadTask("task-1"))?.title).toBe("Target");

		await call("task_archive", { id: "task-3" });
		const withSubtasks = await call("task_delete", { id: "task-3" });
		expect(withSubtasks.isError).toBe(true);
		expect(getText(withSubtasks.content)).toContain(
			"Task TASK-3 cannot be deleted while its subtasks exist: TASK-3.1.",
		);
		expect((await mcpServer.filesystem.listArchivedTasks()).map((task) => task.id)).toEqual(["TASK-3"]);

		await call("task_archive", { id: "task-1" });
		const deleted = await call("task_delete", { id: "task-1" });
		expect(deleted.isError).not.toBe(true);
		// The cleaned draft is named with the cleaned task, in the same line.
		expect(getText(deleted.content)).toBe("Deleted task TASK-1.\nRemoved references to TASK-1 from TASK-2, DRAFT-1.");
		expect((await mcpServer.filesystem.loadTask("task-2"))?.dependencies).toEqual([]);
		expect((await mcpServer.filesystem.loadDraft("draft-1"))?.dependencies).toEqual([]);
		for (const name of ["task_view", "task_delete"]) {
			const gone = await call(name, { id: "task-1" });
			expect(gone.isError).toBe(true);
			expect(getText(gone.content)).toContain("Task task-1 not found.");
		}

		// The deleted ID is released: the highest ID is handed out again once its task is deleted.
		expect(getText((await call("task_create", { title: "Last" })).content)).toContain("Task TASK-4 - Last");
		await call("task_archive", { id: "task-4" });
		expect(getText((await call("task_create", { title: "While archived" })).content)).toContain("Task TASK-5 - ");
		await call("task_archive", { id: "task-5" });
		await call("task_delete", { id: "task-5" });
		await call("task_delete", { id: "task-4" });
		expect(getText((await call("task_create", { title: "After delete" })).content)).toContain(
			"Task TASK-4 - After delete",
		);

		const tools = (await mcpServer.testInterface.listTools()).tools;
		const deleteTool = tools.find((tool) => tool.name === "task_delete");
		expect(deleteTool?.description).toContain("release its ID once no other branch or worktree still holds the task");
		expect(deleteTool?.description).toContain(
			"removes the dependencies and references other tasks and drafts hold to it",
		);
		expect(deleteTool?.description).toContain("must have no subtasks, as tasks or as drafts");
		// One task ID and nothing else: no confirmation argument.
		expect(deleteTool?.inputSchema).toMatchObject({
			properties: { id: { type: "string" } },
			required: ["id"],
			additionalProperties: false,
		});
	});

	it.each(["commit", "lock release"])("reports an applied deletion when %s fails", async (failedStep) => {
		await enableGitTestProject();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		const call = async (name: string, args: Record<string, unknown>) =>
			await mcpServer.testInterface.callTool({ params: { name, arguments: args } });
		await call("task_create", { title: "Delete failure target" });
		await call("task_archive", { id: "TASK-1" });
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Archive before deletion failure"`.cwd(TEST_DIR).quiet();
		const config = await loadConfig(mcpServer);
		await mcpServer.filesystem.saveConfig({ ...config, autoCommit: true });

		const originalLock = mcpServer.filesystem.withCreateLock.bind(mcpServer.filesystem);
		const failure =
			failedStep === "commit"
				? spyOn(mcpServer.gitOps, "commitFiles").mockRejectedValue(new Error("commit hook failed"))
				: spyOn(mcpServer.filesystem, "withCreateLock").mockImplementation(async (run, options) => {
						await originalLock(run, options);
						throw new Error("allocator lock release failed");
					});
		try {
			const result = await call("task_delete", { id: "TASK-1" });
			expect(result.isError).toBe(true);
			expect(result.structuredContent).toMatchObject({ code: "OPERATION_FAILED" });
			expect(getText(result.content)).toBe(
				failedStep === "commit"
					? "Task TASK-1 was deleted, but committing the change failed: commit hook failed"
					: "Task TASK-1 was deleted, but releasing deletion locks failed: allocator lock release failed",
			);
		} finally {
			failure.mockRestore();
		}

		const view = await call("task_view", { id: "TASK-1" });
		expect(view.isError).toBe(true);
		expect(getText(view.content)).toBe("Task TASK-1 not found.");
		expect((await $`git log -1 --format=%s`.cwd(TEST_DIR).text()).trim()).toBe(
			failedStep === "commit" ? "Archive before deletion failure" : "backlog: Delete task TASK-1",
		);
		if (failedStep === "lock release") {
			expect((await $`git show --name-status --format= HEAD`.cwd(TEST_DIR).text()).trim()).toBe(
				"D\tbacklog/archive/tasks/task-1 - Delete-failure-target.md",
			);
		}
	});

	it("archives the local task when merge policy selects a same-path padded ID variant", async () => {
		await enableGitTestProject();
		const config = await loadConfig(mcpServer);
		await mcpServer.filesystem.saveConfig({
			...config,
			checkActiveBranches: true,
			remoteOperations: false,
			taskResolutionStrategy: "most_progressed",
			prefixes: { ...config.prefixes, task: "back" },
		});

		const localTask: Task = {
			id: "BACK-1",
			title: "Local task version",
			status: "To Do",
			assignee: [],
			createdDate: "2026-07-30",
			labels: [],
			dependencies: [],
			description: "Local task version",
		};
		await commitSamePathBranchTaskVariant(mcpServer, localTask, {
			...localTask,
			id: "BACK-001",
			title: "Progressed branch version",
			status: "Done",
		});

		const archiveResult = await mcpServer.testInterface.callTool({
			params: { name: "task_archive", arguments: { id: "BACK-1" } },
		});

		expect(archiveResult.isError).not.toBe(true);
		expect(await mcpServer.filesystem.loadTask("BACK-1")).toBeNull();
		const archivedTasks = await mcpServer.filesystem.listArchivedTasks();
		expect(archivedTasks.map((task) => task.id)).toContain("BACK-1");
	});

	it("refreshes branch identities before a long-lived MCP mutation", async () => {
		await enableGitTestProject();
		const config = await loadConfig(mcpServer);
		await mcpServer.filesystem.saveConfig({
			...config,
			checkActiveBranches: true,
			remoteOperations: false,
			prefixes: { ...config.prefixes, task: "back" },
		});
		const localTask: Task = {
			id: "BACK-1",
			title: "Local identity",
			status: "To Do",
			assignee: [],
			createdDate: "2026-08-01",
			labels: [],
			dependencies: [],
		};
		await mcpServer.filesystem.saveTask(localTask);
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add local identity"`.cwd(TEST_DIR).quiet();

		const initialView = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "BACK-1" } },
		});
		expect(initialView.isError).not.toBe(true);

		await $`git switch -c late-mcp-collision`.cwd(TEST_DIR).quiet();
		await Bun.write(
			join(mcpServer.filesystem.tasksDir, "back-1 - Late-MCP-collision.md"),
			serializeTask({ ...localTask, title: "Late MCP collision" }),
		);
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add late MCP collision"`.cwd(TEST_DIR).quiet();
		await $`git switch main`.cwd(TEST_DIR).quiet();

		const lateView = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "BACK-1" } },
		});
		expect(lateView.isError).toBe(true);
		expect(getText(lateView.content)).toContain("is ambiguous");

		const editResult = await mcpServer.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "BACK-1", title: "Wrong target" } },
		});
		expect(editResult.isError).toBe(true);
		expect(getText(editResult.content)).toContain("is ambiguous");
		expect((await mcpServer.filesystem.loadTask("BACK-1"))?.title).toBe("Local identity");
	});

	it("assigns default tail ordinals for task_create and preserves explicit ordinals", async () => {
		const first = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "First MCP ordinal task",
				},
			},
		});
		expect(getText(first.content)).toContain("Ordinal: 1000");

		const second = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Second MCP ordinal task",
				},
			},
		});
		expect(getText(second.content)).toContain("Ordinal: 2000");

		const explicit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Explicit MCP ordinal task",
					ordinal: 9000,
				},
			},
		});
		expect(getText(explicit.content)).toContain("Ordinal: 9000");
	});

	it("searches tasks with a separate modifiedFiles filter", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Button search",
					modifiedFiles: ["src/web/components/Button.tsx"],
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Server search",
					modifiedFiles: ["src/server/index.ts"],
				},
			},
		});

		const searchResult = await mcpServer.testInterface.callTool({
			params: { name: "task_search", arguments: { modifiedFiles: ["components/Button"] } },
		});

		const searchText = getText(searchResult.content);
		expect(searchText).toContain("TASK-1 - Button search");
		expect(searchText).not.toContain("TASK-2 - Server search");
	});

	it("treats an explicit empty assignee as unassigned in task_create and task_edit", async () => {
		const config = await loadConfig(mcpServer);
		await mcpServer.filesystem.saveConfig({ ...config, defaultAssignee: ["@alice"] });
		await mcpServer.ensureConfigLoaded();

		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Default assignee applies" } },
		});
		expect((await mcpServer.filesystem.loadTask("task-1"))?.assignee).toEqual(["@alice"]);

		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Explicitly unassigned", assignee: [] } },
		});
		expect((await mcpServer.filesystem.loadTask("task-2"))?.assignee).toEqual([]);

		await mcpServer.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "task-1", assignee: [] } },
		});
		expect((await mcpServer.filesystem.loadTask("task-1"))?.assignee).toEqual([]);
	});

	it("appends and renders task comments through task_edit and task_view", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Commented MCP task",
				},
			},
		});

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					title: "Commented MCP task renamed",
					commentsAppend: ["MCP comment body"],
					commentAuthor: "@mcp",
				},
			},
		});
		const editText = getText(editResult.content);
		expect(editText).toMatch(/Created: \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC\)/);
		expect(editText).toContain("Comments:");
		expect(editText).toMatch(/#1 - @mcp - \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC\)/);
		expect(editText).toContain("MCP comment body");

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-1" } },
		});
		const viewText = getText(viewResult.content);
		expect(viewText).toContain("Task TASK-1 - Commented MCP task renamed");
		expect(viewText).toContain("Comments:");
		expect(viewText).toContain("MCP comment body");
	});

	it("rejects reserved comment markers through task_edit", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Invalid comment marker task",
				},
			},
		});

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					commentsAppend: ["Invalid <!-- COMMENT:END --> marker"],
				},
			},
		});
		expect(editResult.isError).toBe(true);
		expect(getText(editResult.content)).toContain("Comment body cannot contain Backlog comment markers.");

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-1" } },
		});
		expect(getText(viewResult.content)).not.toContain("Comments:");
	});

	it("filters task_list by milestone using closest matching and combines with status", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Milestone Task One",
					status: "To Do",
					milestone: "Release-1",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Milestone Task Two",
					status: "In Progress",
					milestone: "release-1",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Other Milestone Task",
					status: "To Do",
					milestone: "Release-2",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "No Milestone Task",
					status: "To Do",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Roadmap Milestone Task",
					status: "To Do",
					milestone: "Roadmap Alpha",
				},
			},
		});

		const milestoneResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { milestone: "RELEASE-1" } },
		});
		const milestoneText = (milestoneResult.content ?? [])
			.map((entry) => ("text" in entry ? entry.text : ""))
			.join("\n\n");
		expect(milestoneText).toContain("TASK-1 - Milestone Task One");
		expect(milestoneText).toContain("TASK-2 - Milestone Task Two");
		expect(milestoneText).not.toContain("TASK-3 - Other Milestone Task");
		expect(milestoneText).not.toContain("TASK-4 - No Milestone Task");
		expect(milestoneText).not.toContain("TASK-5 - Roadmap Milestone Task");

		const fuzzyResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { milestone: "roadmp" } },
		});
		const fuzzyText = (fuzzyResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
		expect(fuzzyText).toContain("TASK-5 - Roadmap Milestone Task");
		expect(fuzzyText).not.toContain("TASK-1 - Milestone Task One");
		expect(fuzzyText).not.toContain("TASK-2 - Milestone Task Two");
		expect(fuzzyText).not.toContain("TASK-3 - Other Milestone Task");
		expect(fuzzyText).not.toContain("TASK-4 - No Milestone Task");

		const combinedResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { milestone: "release-1", status: "To Do" } },
		});
		const combinedText = (combinedResult.content ?? [])
			.map((entry) => ("text" in entry ? entry.text : ""))
			.join("\n\n");
		expect(combinedText).toContain("TASK-1 - Milestone Task One");
		expect(combinedText).not.toContain("TASK-2 - Milestone Task Two");
		expect(combinedText).not.toContain("TASK-3 - Other Milestone Task");
		expect(combinedText).not.toContain("TASK-4 - No Milestone Task");
		expect(combinedText).not.toContain("TASK-5 - Roadmap Milestone Task");
	});

	it("applies milestone filtering in task_list draft status path", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Draft Milestone One",
					status: "Draft",
					milestone: "draft-alpha",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Draft Milestone Two",
					status: "Draft",
					milestone: "draft-beta",
				},
			},
		});

		const draftResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { status: "Draft", milestone: "draft-alph" } },
		});
		const draftText = getText(draftResult.content);
		expect(draftText).toContain("DRAFT-1 - Draft Milestone One");
		expect(draftText).not.toContain("DRAFT-2 - Draft Milestone Two");
	});

	it("filters task_list to unassigned tasks and rejects combining with assignee", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Assigned Task",
					assignee: ["alice"],
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Unassigned Task",
				},
			},
		});

		const unassignedResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { unassigned: true } },
		});
		const unassignedText = getText(unassignedResult.content);
		expect(unassignedText).toContain("TASK-2 - Unassigned Task");
		expect(unassignedText).not.toContain("TASK-1 - Assigned Task");

		const conflictResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { assignee: "alice", unassigned: true } },
		});
		expect(conflictResult.isError).toBe(true);
		expect(getText(conflictResult.content)).toContain("unassigned cannot be combined with assignee");
	});

	it("filters task_list by ready argument in MCP tool", async () => {
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Completed Dep", status: "Done" } },
		});
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "InProgress Dep", status: "In Progress" } },
		});
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Blocked Task", status: "To Do", dependencies: ["TASK-2"] } },
		});
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Ready Task", status: "To Do", dependencies: ["TASK-1"] } },
		});

		const readyResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { ready: true } },
		});
		const text = getText(readyResult.content);
		expect(text).toContain("TASK-4 - Ready Task");
		expect(text).not.toContain("TASK-3 - Blocked Task");
	});

	it("applies unassigned filtering in task_list draft status path", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Assigned Draft",
					status: "Draft",
					assignee: ["alice"],
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Unassigned Draft",
					status: "Draft",
				},
			},
		});

		const draftResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { status: "Draft", unassigned: true } },
		});
		const draftText = getText(draftResult.content);
		expect(draftText).toContain("DRAFT-2 - Unassigned Draft");
		expect(draftText).not.toContain("DRAFT-1 - Assigned Draft");
	});

	it("includes archived tasks in task_search results and marks them as archived", async () => {
		// The fixture is written straight to disk, so no content store and no file watcher exist
		// whose reconciliation could cross the branch-loading boundary inside the tripwire window.
		const base = { assignee: [], createdDate: "2026-08-01", labels: [], dependencies: [] };
		await mcpServer.filesystem.saveTask({ ...base, id: "TASK-1", title: "Active task", status: "To Do" });
		await mcpServer.filesystem.saveTask({ ...base, id: "TASK-2", title: "Finished task", status: "Done" });
		await mcpServer.filesystem.saveTask({ ...base, id: "TASK-3", title: "Set aside task", status: "To Do" });
		expect(await archiveTaskFile(mcpServer.filesystem, "TASK-2")).toBe(true);
		expect(await archiveTaskFile(mcpServer.filesystem, "TASK-3")).toBe(true);

		const tripwires = installCrossBranchTripwires(mcpServer);
		try {
			const searchResults = [
				await mcpServer.testInterface.callTool({
					params: { name: "task_search", arguments: { query: "task" } },
				}),
				await mcpServer.testInterface.callTool({
					params: { name: "task_search", arguments: { query: "task" } },
				}),
			];

			for (const searchResult of searchResults) {
				expect(searchResult.isError).not.toBe(true);
				expect(getText(searchResult.content)).toBe(
					"Tasks:\n  TASK-1 - Active task (To Do)\n  TASK-2 - Finished task (Done, archived)\n  TASK-3 - Set aside task (To Do, archived)",
				);
			}

			const limitedResult = await mcpServer.testInterface.callTool({
				params: { name: "task_search", arguments: { query: "task", limit: 1 } },
			});
			expect(limitedResult.isError).not.toBe(true);
			expect(getText(limitedResult.content)).toBe("Tasks:\n  TASK-1 - Active task (To Do)");
			tripwires.expectUntouched();
		} finally {
			tripwires.restore();
		}
	});

	it("searches one active lifecycle identity when the same path is also archived", async () => {
		const activeTask: Task = {
			id: "TASK-1",
			title: "Active lifecycle identity",
			status: "To Do",
			assignee: [],
			createdDate: "2026-08-10",
			labels: [],
			dependencies: [],
		};
		const activePath = await mcpServer.filesystem.saveTask(activeTask);
		await Bun.write(
			join(mcpServer.filesystem.archiveTasksDir, basename(activePath)),
			serializeTask({ ...activeTask, title: "Archived lifecycle identity", status: "Done" }),
		);

		const searchResult = await mcpServer.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "lifecycle identity" } },
		});

		expect(searchResult.isError).not.toBe(true);
		expect(getText(searchResult.content)).toBe("Tasks:\n  TASK-1 - Active lifecycle identity (To Do)");
	});

	it("exposes status enums and defaults from configuration", async () => {
		const config = await loadConfig(mcpServer);
		const configuredStatuses =
			config.statuses && config.statuses.length > 0 ? [...config.statuses] : Array.from(DEFAULT_STATUSES);
		const normalizedStatuses = configuredStatuses.map((status) => status.trim());
		const hasDraft = normalizedStatuses.some((status) => status.toLowerCase() === "draft");
		const expectedStatuses = hasDraft ? normalizedStatuses : ["Draft", ...normalizedStatuses];
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));

		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		const createStatusSchema = createSchema?.properties?.status;
		const editStatusSchema = editSchema?.properties?.status;

		expect(createStatusSchema?.enum).toEqual(expectedStatuses);
		expect(createStatusSchema?.default).toBe(normalizedStatuses[0] ?? DEFAULT_STATUSES[0]);
		expect(createStatusSchema?.enumCaseInsensitive).toBe(true);
		expect(createStatusSchema?.enumNormalizeWhitespace).toBe(true);

		expect(editStatusSchema?.enum).toEqual(expectedStatuses);
		expect(editStatusSchema?.default).toBe(normalizedStatuses[0] ?? DEFAULT_STATUSES[0]);
		expect(editStatusSchema?.enumCaseInsensitive).toBe(true);
		expect(editStatusSchema?.enumNormalizeWhitespace).toBe(true);
	});

	it("exposes configured priority enums and accepts custom priority values", async () => {
		const config = await loadConfig(mcpServer);
		config.priorities = ["Very High", "High", "Medium", "Low", "Very Low"];
		await mcpServer.filesystem.saveConfig(config);

		const customServer = new McpServer(TEST_DIR, "Test instructions");
		let primaryError: unknown;
		try {
			registerTaskTools(customServer, config);
			const tools = await customServer.testInterface.listTools();
			const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));

			const createPrioritySchema = (toolByName.get("task_create")?.inputSchema as JsonSchema | undefined)?.properties
				?.priority;
			const editPrioritySchema = (toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined)?.properties
				?.priority;
			const searchPrioritySchema = (toolByName.get("task_search")?.inputSchema as JsonSchema | undefined)?.properties
				?.priority;

			const expected = ["Very High", "High", "Medium", "Low", "Very Low"];
			expect(createPrioritySchema?.enum).toEqual(expected);
			expect(createPrioritySchema?.enumCaseInsensitive).toBe(true);
			expect(editPrioritySchema?.enum).toEqual(expected);
			expect(editPrioritySchema?.enumCaseInsensitive).toBe(true);
			expect(searchPrioritySchema?.enum).toEqual(expected);
			expect(searchPrioritySchema?.enumCaseInsensitive).toBe(true);

			const createResult = await customServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Custom priority MCP task",
						priority: "VERY HIGH",
					},
				},
			});
			expect(createResult.isError).not.toBe(true);
			const task = await customServer.getTask("task-1");
			expect(task?.priority).toBe("very high");
		} catch (error) {
			primaryError = error;
		}

		let cleanupError: unknown;
		try {
			await customServer.stop();
		} catch (error) {
			cleanupError = error;
		}

		if (primaryError !== undefined && cleanupError !== undefined) {
			throw new AggregateError([primaryError, cleanupError], "Test and MCP server cleanup both failed");
		}
		if (primaryError !== undefined) throw primaryError;
		if (cleanupError !== undefined) throw cleanupError;
	});

	it("describes Definition of Done fields as task-level in schemas", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		expect(createSchema?.properties?.definitionOfDoneAdd?.description).toContain("Task-specific");
		expect(createSchema?.properties?.disableDefinitionOfDoneDefaults?.description).toContain(
			"definition_of_done_defaults_upsert",
		);
		expect(editSchema?.properties?.definitionOfDoneAdd?.description).toContain("Task-specific");
		expect(editSchema?.properties?.definitionOfDoneCheck?.description).toContain("this task");
	});

	it("documents reserved comment delimiters in task_edit schema", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		expect(editSchema?.properties?.commentsAppend?.description).toContain("standalone '---' lines are reserved");
	});

	it("exposes ordinal in task schemas", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		expect(createSchema?.properties?.ordinal).toEqual({
			type: "number",
			minimum: 0,
			description:
				"Optional non-negative ordering value for manual task ordering. Lower values sort earlier. Prefer spaced integers such as 1000, 2000, 3000 to leave room for inserts.",
		});
		expect(editSchema?.properties?.ordinal).toEqual({
			type: "number",
			minimum: 0,
			description:
				"Set task ordinal for manual ordering. Lower values sort earlier. Prefer spaced integers such as 1000, 2000, 3000 to leave room for inserts.",
		});
	});

	it("allows case-insensitive and whitespace-normalized status values", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Status normalization",
					status: "done",
				},
			},
		});

		const createText = getText(createResult.content);
		expect(createText).toContain("Task TASK-1 - Status normalization");

		const createdTask = await mcpServer.getTask("task-1");
		expect(createdTask?.status).toBe("Done");

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					status: "inprogress",
				},
			},
		});

		const editText = getText(editResult.content);
		expect(editText).toContain("Task TASK-1 - Status normalization");

		const updatedTask = await mcpServer.getTask("task-1");
		expect(updatedTask?.status).toBe("In Progress");
	});

	it("edits tasks including plan, notes, dependencies, and acceptance criteria", async () => {
		// Seed primary task
		const seedTask = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Refine MCP documentation",
					status: "To Do",
				},
			},
		});

		expect(getText(seedTask.content)).toContain("Task TASK-1 - Refine MCP documentation");

		// Create dependency task
		const dependencyTask = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Placeholder dependency",
				},
			},
		});

		expect(getText(dependencyTask.content)).toContain("Task TASK-2 - Placeholder dependency");

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					status: "In Progress",
					labels: ["docs"],
					assignee: ["technical-writer"],
					dependencies: ["task-2"],
					planSet: "1. Audit existing content\n2. Remove non-MVP sections",
					notesAppend: ["Ensure CLI examples mirror MCP usage"],
					acceptanceCriteriaSet: ["Plan documented"],
					acceptanceCriteriaAdd: ["Agents can follow instructions end-to-end"],
				},
			},
		});

		const editText = getText(editResult.content);
		expect(editText).toContain("Status: ◒ In Progress");
		expect(editText).toContain("Labels: docs");
		expect(editText).toContain("Dependency Graph:");
		expect(editText).toContain("TASK-2");
		expect(editText).toContain("Implementation Plan:");
		expect(editText).toContain("Implementation Notes:");
		expect(editText).toContain("#1 Plan documented");
		expect(editText).toContain("#2 Agents can follow instructions end-to-end");

		// Uncheck criteria via task_edit
		const criteriaUpdate = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					acceptanceCriteriaCheck: [1],
					acceptanceCriteriaUncheck: [2],
				},
			},
		});

		const criteriaText = getText(criteriaUpdate.content);
		expect(criteriaText).toContain("- [x] #1 Plan documented");
		expect(criteriaText).toContain("- [ ] #2 Agents can follow instructions end-to-end");

		const replacement = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					acceptanceCriteriaSet: ["Agents can follow instructions end-to-end", " Plan documented ", "New requirement"],
				},
			},
		});
		expect(replacement.isError).toBeUndefined();
		expect((await mcpServer.getTask("task-1"))?.acceptanceCriteriaItems).toEqual([
			{ index: 1, text: "Agents can follow instructions end-to-end", checked: false },
			{ index: 2, text: "Plan documented", checked: true },
			{ index: 3, text: "New requirement", checked: false },
		]);
	});

	it("rejects self-referential and cyclic dependencies through task_edit", async () => {
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "First" } },
		});
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Second", dependencies: ["TASK-1"] } },
		});

		const selfResult = await mcpServer.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "TASK-1", dependencies: ["task-1"] } },
		});
		expect(selfResult.isError).toBe(true);
		expect(getText(selfResult.content)).toContain("cannot depend on itself");

		const cycleResult = await mcpServer.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "TASK-1", dependencies: ["TASK-2"] } },
		});
		expect(cycleResult.isError).toBe(true);
		expect(getText(cycleResult.content)).toContain(
			"These dependencies would create a cycle: TASK-1 -> TASK-2 -> TASK-1",
		);

		const view = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "TASK-1" } },
		});
		expect(getText(view.content)).not.toContain("Dependencies:");
	});

	it("does not clear labels from blank-only task_edit label arrays", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Label blank input",
					labels: ["docs", "workflow"],
				},
			},
		});

		const blankEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					labels: ["", "   "],
				},
			},
		});

		expect(getText(blankEdit.content)).toContain("Labels: docs, workflow");
		expect((await mcpServer.getTask("task-1"))?.labels).toEqual(["docs", "workflow"]);

		const clearEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					labels: [],
				},
			},
		});

		expect(getText(clearEdit.content)).not.toContain("Labels:");
		expect((await mcpServer.getTask("task-1"))?.labels).toEqual([]);
	});

	it("does not clear dependencies from blank-only task_edit dependency arrays", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Dependency target",
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Dependency blank input",
					dependencies: ["task-1"],
				},
			},
		});

		const blankEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-2",
					dependencies: ["", "   "],
				},
			},
		});

		expect(getText(blankEdit.content)).toContain("Dependency Graph:");
		expect(getText(blankEdit.content)).toContain("TASK-1");
		expect((await mcpServer.getTask("task-2"))?.dependencies).toEqual(["TASK-1"]);

		const clearEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-2",
					dependencies: [],
				},
			},
		});

		expect(getText(clearEdit.content)).not.toContain("Depends on (");
		expect((await mcpServer.getTask("task-2"))?.dependencies).toEqual([]);
	});

	it("creates, edits, lists, and views tasks with ordinal", async () => {
		const createdA = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Ordinal task A",
					status: "To Do",
					priority: "low",
					ordinal: 20,
				},
			},
		});
		const createdB = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Ordinal task B",
					status: "To Do",
					priority: "high",
					ordinal: 10,
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Ordinal task C",
					status: "To Do",
					priority: "medium",
				},
			},
		});

		expect(getText(createdA.content)).toContain("Ordinal: 20");
		expect(getText(createdB.content)).toContain("Ordinal: 10");

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { status: "To Do", search: "Ordinal task" } },
		});
		const listText = getText(listResult.content);
		expect(listText.indexOf("TASK-2 - Ordinal task B")).toBeLessThan(listText.indexOf("TASK-1 - Ordinal task A"));
		expect(listText.indexOf("TASK-1 - Ordinal task A")).toBeLessThan(listText.indexOf("TASK-3 - Ordinal task C"));

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-3",
					ordinal: 5,
				},
			},
		});
		expect(getText(editResult.content)).toContain("Ordinal: 5");

		const updatedTask = await mcpServer.getTask("task-3");
		expect(updatedTask?.ordinal).toBe(5);

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-3" } },
		});
		expect(getText(viewResult.content)).toContain("Ordinal: 5");
	});

	it("applies task_list limit after ordinal-aware sorting", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Limited ordinal later id",
					status: "To Do",
					ordinal: 2000,
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Limited ordinal first by order",
					status: "To Do",
					ordinal: 1000,
				},
			},
		});

		const listResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_list",
				arguments: {
					status: "To Do",
					search: "Limited ordinal",
					limit: 1,
				},
			},
		});

		const listText = getText(listResult.content);
		expect(listText).toContain("TASK-2 - Limited ordinal first by order");
		expect(listText).not.toContain("TASK-1 - Limited ordinal later id");
	});

	it("rejects invalid ordinal input", async () => {
		const invalidCreate = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Invalid ordinal create",
					ordinal: -1,
				},
			},
		});
		expect(invalidCreate.isError).toBe(true);
		expect(getText(invalidCreate.content)).toContain("must be at least 0");

		const nullCreate = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Null ordinal create",
					ordinal: null,
				},
			},
		});
		expect(nullCreate.isError).toBe(true);
		expect(getText(nullCreate.content)).toContain("Ordinal must be a non-negative number.");

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Valid task",
				},
			},
		});

		const invalidEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					ordinal: -1,
				},
			},
		});
		expect(invalidEdit.isError).toBe(true);
		expect(getText(invalidEdit.content)).toContain("must be at least 0");

		const nullEdit = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					ordinal: null,
				},
			},
		});
		expect(nullEdit.isError).toBe(true);
		expect(getText(nullEdit.content)).toContain("Ordinal must be a non-negative number.");
	});

	it("creates and edits Definition of Done items", async () => {
		const config = await loadConfig(mcpServer);
		config.definitionOfDone = ["Run tests", "Update docs"];
		await mcpServer.filesystem.saveConfig(config);

		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "DoD MCP task",
					definitionOfDoneAdd: ["Ship notes"],
				},
			},
		});

		const createText = getText(createResult.content);
		expect(createText).toContain("Definition of Done:");
		expect(createText).toContain("- [ ] #1 Run tests");
		expect(createText).toContain("- [ ] #2 Update docs");
		expect(createText).toContain("- [ ] #3 Ship notes");

		const disableResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "DoD no defaults",
					disableDefinitionOfDoneDefaults: true,
				},
			},
		});

		const disableText = getText(disableResult.content);
		expect(disableText).toContain("Definition of Done:");
		expect(disableText).toContain("No Definition of Done items defined");

		const checkResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					definitionOfDoneCheck: [2],
				},
			},
		});

		const checkText = getText(checkResult.content);
		expect(checkText).toContain("- [x] #2 Update docs");

		const removeResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					definitionOfDoneRemove: [1],
				},
			},
		});

		const removeText = getText(removeResult.content);
		expect(removeText).toContain("- [x] #1 Update docs");

		const uncheckResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					definitionOfDoneUncheck: [1],
				},
			},
		});

		const uncheckText = getText(uncheckResult.content);
		expect(uncheckText).toContain("- [ ] #1 Update docs");
	});

	it("includes subtask list in task_view output and hides it when empty", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Parent task",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Child task A",
					parentTaskId: "TASK-1",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Child task B",
					parentTaskId: "TASK-1",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Standalone task",
				},
			},
		});

		const parentView = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-1" } },
		});

		const parentText = getText(parentView.content);
		expect(parentText).toContain("Subtasks (2):");
		expect(parentText).toContain("- TASK-1.1 - Child task A");
		expect(parentText).toContain("- TASK-1.2 - Child task B");
		expect(parentText.indexOf("TASK-1.1")).toBeLessThan(parentText.indexOf("TASK-1.2"));

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1.1",
					title: "Child task A updated",
				},
			},
		});

		const parentAfterEdit = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-1" } },
		});

		const parentAfterEditText = getText(parentAfterEdit.content);
		expect(parentAfterEditText).toContain("- TASK-1.1 - Child task A updated");

		const standaloneView = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-2" } },
		});

		const standaloneText = getText(standaloneView.content);
		expect(standaloneText).not.toContain("Subtasks (");
		expect(standaloneText).not.toContain("Subtasks:");
	});

	it("creates and edits tasks with a semantic type and shows it in view and list output", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Typed task",
					type: "BUG",
					priority: "high",
				},
			},
		});
		expect(getText(createResult.content)).toContain("Type: bug");

		const createdTask = await mcpServer.getTask("task-1");
		expect(createdTask?.type).toBe("bug");

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Untyped task",
				},
			},
		});

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: {} },
		});
		const listText = (listResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
		expect(listText).toContain("[HIGH] [bug] TASK-1 - Typed task");
		expect(listText).toContain("  TASK-2 - Untyped task");

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					type: "Feature",
				},
			},
		});
		expect(getText(editResult.content)).toContain("Type: feature");

		const editedTask = await mcpServer.getTask("task-1");
		expect(editedTask?.type).toBe("feature");

		const untypedView = await mcpServer.testInterface.callTool({
			params: { name: "task_view", arguments: { id: "task-2" } },
		});
		expect(getText(untypedView.content)).not.toContain("Type:");
	});

	it("rejects invalid task types through task_create and task_edit", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Invalid type task",
					type: "banana",
				},
			},
		});
		expect(createResult.isError).toBe(true);
		expect(getText(createResult.content)).toContain(`must be one of: ${DEFAULT_TASK_TYPES.join(", ")}`);

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Valid task",
				},
			},
		});

		const editResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					type: "banana",
				},
			},
		});
		expect(editResult.isError).toBe(true);
		expect(getText(editResult.content)).toContain(`must be one of: ${DEFAULT_TASK_TYPES.join(", ")}`);

		const task = await mcpServer.getTask("task-1");
		expect(task?.type).toBeUndefined();
	});

	it("exposes task type enums from configuration without a default", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createTypeSchema = (toolByName.get("task_create")?.inputSchema as JsonSchema | undefined)?.properties?.type;
		const editTypeSchema = (toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined)?.properties?.type;

		expect(createTypeSchema?.enum).toEqual([...DEFAULT_TASK_TYPES]);
		expect(createTypeSchema?.enumCaseInsensitive).toBe(true);
		expect(createTypeSchema?.default).toBeUndefined();
		expect(createTypeSchema?.description).toContain(`Valid values: ${DEFAULT_TASK_TYPES.join(", ")}`);

		expect(editTypeSchema?.enum).toEqual([...DEFAULT_TASK_TYPES]);
		expect(editTypeSchema?.enumCaseInsensitive).toBe(true);
		expect(editTypeSchema?.default).toBeUndefined();

		const config = await loadConfig(mcpServer);
		config.types = ["Bug", "Epic"];
		await mcpServer.filesystem.saveConfig(config);

		const customServer = new McpServer(TEST_DIR, "Test instructions");
		let primaryError: unknown;
		try {
			registerTaskTools(customServer, await loadConfig(customServer));

			const customTools = await customServer.testInterface.listTools();
			const customCreateSchema = customTools.tools.find((tool) => tool.name === "task_create")?.inputSchema as
				| JsonSchema
				| undefined;
			expect(customCreateSchema?.properties?.type?.enum).toEqual(["Bug", "Epic"]);

			const createResult = await customServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Configured type task",
						type: "bug",
					},
				},
			});
			expect(getText(createResult.content)).toContain("Type: Bug");

			const invalidResult = await customServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Rejected type task",
						type: "feature",
					},
				},
			});
			expect(invalidResult.isError).toBe(true);
			expect(getText(invalidResult.content)).toContain("must be one of: Bug, Epic");
		} catch (error) {
			primaryError = error;
		}

		let cleanupError: unknown;
		try {
			await customServer.stop();
		} catch (error) {
			cleanupError = error;
		}

		if (primaryError !== undefined && cleanupError !== undefined) {
			throw new AggregateError([primaryError, cleanupError], "Test and MCP server cleanup both failed");
		}
		if (primaryError !== undefined) throw primaryError;
		if (cleanupError !== undefined) throw cleanupError;
	});

	it("omits the project field from tool schemas and rejects it when no projects are configured", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		expect(createSchema?.properties?.project).toBeUndefined();
		expect(editSchema?.properties?.project).toBeUndefined();

		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: { title: "Web task", project: "web" },
			},
		});
		expect(createResult.isError).toBe(true);
		expect(getText(createResult.content)).toContain("Unknown field 'project' is not allowed");
	});

	it("creates and edits tasks with a project when configured and shows it in view and list output", async () => {
		const config = await loadConfig(mcpServer);
		config.projects = ["Web", "API"];
		await mcpServer.filesystem.saveConfig(config);

		const customServer = new McpServer(TEST_DIR, "Test instructions");
		let primaryError: unknown;
		try {
			registerTaskTools(customServer, await loadConfig(customServer));

			const tools = await customServer.testInterface.listTools();
			const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
			const createProjectSchema = (toolByName.get("task_create")?.inputSchema as JsonSchema | undefined)?.properties
				?.project;
			expect(createProjectSchema?.enum).toEqual(["Web", "API"]);
			expect(createProjectSchema?.enumCaseInsensitive).toBe(true);

			const createResult = await customServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: { title: "Projected task", project: "web", priority: "high" },
				},
			});
			expect(getText(createResult.content)).toContain("Project: Web");

			const createdTask = await customServer.getTask("task-1");
			expect(createdTask?.project).toBe("Web");

			await customServer.testInterface.callTool({
				params: { name: "task_create", arguments: { title: "Unprojected task" } },
			});

			const listResult = await customServer.testInterface.callTool({
				params: { name: "task_list", arguments: {} },
			});
			const listText = (listResult.content ?? []).map((entry) => ("text" in entry ? entry.text : "")).join("\n\n");
			expect(listText).toContain("[HIGH] [Web] TASK-1 - Projected task");
			expect(listText).toContain("  TASK-2 - Unprojected task");

			const editResult = await customServer.testInterface.callTool({
				params: { name: "task_edit", arguments: { id: "task-1", project: "API" } },
			});
			expect(getText(editResult.content)).toContain("Project: API");

			const editedTask = await customServer.getTask("task-1");
			expect(editedTask?.project).toBe("API");

			const unprojectedView = await customServer.testInterface.callTool({
				params: { name: "task_view", arguments: { id: "task-2" } },
			});
			expect(getText(unprojectedView.content)).not.toContain("Project:");

			const invalidResult = await customServer.testInterface.callTool({
				params: { name: "task_create", arguments: { title: "Rejected project task", project: "mobile" } },
			});
			expect(invalidResult.isError).toBe(true);
			expect(getText(invalidResult.content)).toContain("must be one of: Web, API");
		} catch (error) {
			primaryError = error;
		}

		let cleanupError: unknown;
		try {
			await customServer.stop();
		} catch (error) {
			cleanupError = error;
		}

		if (primaryError !== undefined && cleanupError !== undefined) {
			throw new AggregateError([primaryError, cleanupError], "Test and MCP server cleanup both failed");
		}
		if (primaryError !== undefined) throw primaryError;
		if (cleanupError !== undefined) throw cleanupError;
	});
});
