import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { FileSystem } from "../file-system/operations.ts";
import { parseMarkdown, parseTask } from "../markdown/parser.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { BacklogServer } from "../server/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createTestDirOutsideRepository, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
const METADATA = [
	"# external approval",
	"approval:",
	"  origin:",
	"    app: example-capture",
	"  state: awaiting",
	"  # Keep this comment and the written values.",
	"  version: 1.10",
	"  checks: [one, 'two']",
	"  note: |",
	"    title: text inside a value",
	"    ---",
	"reviewed: 2026-02-01",
	"code: 007",
	"ratio: 1.10",
	"values: [one, 'two'] # keep flow style",
	"external: &external {ratio: 1.10}",
	"external_copy: *external",
	"",
].join("\n");
const BODY =
	"## Description\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\nOriginal body\n<!-- SECTION:DESCRIPTION:END -->\n\n## Extra Notes\n\nKeep this section.\n";

let root: string;
let filesystem: FileSystem;
let server: BacklogServer | undefined;
let mcp: McpServer | undefined;

async function writeRecord(id = "TASK-1", metadata = METADATA, owned = ""): Promise<string> {
	const draft = id.startsWith("DRAFT-");
	const directory = draft ? await filesystem.getDraftsDir() : filesystem.tasksDir;
	const path = join(directory, `${id.toLowerCase()} - Original.md`);
	await Bun.write(
		path,
		`---\nid: ${id}\ntitle: Original\nstatus: ${draft ? "Draft" : "To Do"}\nassignee: [@alex]\ncreated_date: 2026-01-01\nlabels: []\ndependencies: []\n${owned}${metadata}---\n\n${BODY}`,
	);
	return path;
}

async function expectMetadata(path: string): Promise<string> {
	const source = await Bun.file(path).text();
	expect(source).toContain(METADATA);
	expect(source.match(/^approval:/gm)).toHaveLength(1);
	const metadata = parseMarkdown(source).frontmatter;
	expect(metadata.external_copy).toEqual(metadata.external);
	return source;
}

describe("task and draft unknown frontmatter", () => {
	beforeEach(async () => {
		root = await createTestDirOutsideRepository("task-frontmatter");
		filesystem = new FileSystem(root);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Task frontmatter",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			projects: ["app"],
			prefixes: { task: "task" },
			dateFormat: "YYYY-MM-DD",
			filesystemOnly: true,
			remoteOperations: false,
			autoCommit: false,
		});
	});

	afterEach(async () => {
		await server?.stop();
		server = undefined;
		await mcp?.stop();
		mcp = undefined;
		await safeCleanup(root);
	});

	it("keeps the #918 approval block through actual CLI creation and repeated status edits", async () => {
		await $`bun ${CLI_PATH} init Repro --defaults --no-git --integration-mode none`.cwd(root).quiet();
		await $`bun ${CLI_PATH} task create "Chase deposit refund" --description test`.cwd(root).quiet();
		const path = join(filesystem.tasksDir, "task-1 - Chase-deposit-refund.md");
		const original = await Bun.file(path).text();
		await Bun.write(path, original.replace("\n---\n", `\n${METADATA}---\n`));
		for (const status of ["In Progress", "Done"]) {
			await $`bun ${CLI_PATH} task edit TASK-1 -s ${status}`.cwd(root).quiet();
			const saved = await expectMetadata(path);
			expect(parseTask(saved)).toMatchObject({ status, description: "test" });
			expect(parseTask(saved).updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
		}
		const output = await $`bun ${CLI_PATH} task view TASK-1 --json`.cwd(root).text();
		expect(output).not.toContain("example-capture");
		expect(output).not.toContain("external_copy");
	});

	it("keeps opaque metadata while clearing owned fields and skips unchanged task and draft edits", async () => {
		for (const id of ["TASK-1", "DRAFT-1"]) {
			const command = id.startsWith("DRAFT-") ? "draft" : "task";
			const path = await writeRecord(
				id,
				METADATA,
				"due_date: 2026-02-01\nreferences: [old]\ndocumentation: [old]\nmodified_files: []\ntype: bug\nproject: app\nreporter: ''\nparent_task_id: ''\nsubtasks: []\npriority: ''\nonStatusChange: ''\n",
			);
			await $`bun ${CLI_PATH} ${command} edit ${id} --clear-due-date --clear-refs --clear-docs --type ${""} --project ${""} --label changed`
				.cwd(root)
				.quiet();
			const saved = await expectMetadata(path);
			const metadata = parseMarkdown(saved).frontmatter;
			for (const key of [
				"due_date",
				"references",
				"documentation",
				"modified_files",
				"type",
				"project",
				"reporter",
				"parent_task_id",
				"subtasks",
				"priority",
				"onStatusChange",
			])
				expect(metadata).not.toHaveProperty(key);
			expect(parseTask(saved).rawContent).toBe(BODY.trim());
			const before = await stat(path, { bigint: true });
			await $`bun ${CLI_PATH} ${command} edit ${id} --label changed`.cwd(root).quiet();
			expect(await Bun.file(path).text()).toBe(saved);
			expect((await stat(path, { bigint: true })).mtimeNs).toBe(before.mtimeNs);
		}
	});

	it("keeps metadata through draft renames, dedicated promotion/demotion, archive and restore", async () => {
		const originalPath = await writeRecord("DRAFT-1");
		await $`bun ${CLI_PATH} draft edit DRAFT-1 --title Renamed --ac "Keep checks"`.cwd(root).quiet();
		const renamedPath = join(await filesystem.getDraftsDir(), "draft-1 - Renamed.md");
		expect(await Bun.file(originalPath).exists()).toBe(false);
		await expectMetadata(renamedPath);
		await $`bun ${CLI_PATH} draft promote DRAFT-1`.cwd(root).quiet();
		const taskPath = join(filesystem.tasksDir, "task-1 - Renamed.md");
		await expectMetadata(taskPath);
		expect(await Bun.file(renamedPath).exists()).toBe(false);
		await $`bun ${CLI_PATH} task edit TASK-1 --check-ac 1`.cwd(root).quiet();
		const beforeArchive = await expectMetadata(taskPath);
		await $`bun ${CLI_PATH} task archive TASK-1`.cwd(root).quiet();
		const archived = (await filesystem.listArchivedTasks())[0];
		if (!archived?.filePath) throw new Error("Missing archived task");
		expect(await Bun.file(archived.filePath).text()).toBe(beforeArchive);
		await $`bun ${CLI_PATH} task restore TASK-1`.cwd(root).quiet();
		expect(await Bun.file(taskPath).text()).toBe(beforeArchive);
		await $`bun ${CLI_PATH} task demote TASK-1`.cwd(root).quiet();
		const demoted = (await filesystem.listDrafts())[0];
		if (!demoted?.filePath) throw new Error("Missing demoted draft");
		const beforeDraftArchive = await expectMetadata(demoted.filePath);
		expect(parseTask(beforeDraftArchive).acceptanceCriteriaItems?.[0]?.checked).toBe(true);
		await $`bun ${CLI_PATH} draft archive ${demoted.id}`.cwd(root).quiet();
		const archivedDrafts = join(filesystem.backlogDir, "archive/drafts");
		const filename = (await readdir(archivedDrafts))[0];
		if (!filename) throw new Error("Missing archived draft");
		expect(await Bun.file(join(archivedDrafts, filename)).text()).toBe(beforeDraftArchive);
	});

	it("keeps metadata through watched HTTP task/draft edits and status transitions", async () => {
		const taskPath = await writeRecord("TASK-1", METADATA, "modified_files: [old]\n");
		await writeRecord("DRAFT-1");
		server = new BacklogServer(root);
		await server.start(0, false);
		const port = server.getPort();
		const put = async (id: string, updates: unknown) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/tasks/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updates),
			});
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).not.toHaveProperty("approval");
			expect(body).not.toHaveProperty("customFields");
			await expectMetadata(body.filePath);
			return body;
		};
		await put("TASK-1", { status: "In Progress", description: "HTTP body", modifiedFiles: [] });
		await put("TASK-1", { title: "HTTP task", labels: ["http"] });
		expect(parseTask(await expectMetadata(taskPath)).description).toBe("HTTP body");
		expect(parseMarkdown(await Bun.file(taskPath).text()).frontmatter).not.toHaveProperty("modified_files");
		await put("DRAFT-1", { title: "HTTP draft", status: "Draft" });
		const promoted = await put("DRAFT-1", { title: "Promoted", status: "To Do" });
		await put(promoted.id, { title: "Demoted", status: "Draft" });
	});

	it("keeps metadata through MCP task/draft edits and both status transitions", async () => {
		await writeRecord();
		await writeRecord("DRAFT-1");
		mcp = new McpServer(root, "Test instructions");
		const config = await mcp.filesystem.loadConfig();
		if (!config) throw new Error("Missing config");
		registerTaskTools(mcp, config);
		for (const [id, updates] of [
			["TASK-1", { labels: ["mcp"] }],
			["DRAFT-1", { title: "MCP draft" }],
			["DRAFT-1", { title: "MCP task", status: "In Progress" }],
			["TASK-2", { title: "MCP demoted", status: "Draft" }],
		] as const) {
			const result = await mcp.testInterface.callTool({
				params: { name: "task_edit", arguments: { id, ...updates } },
			});
			expect(result.isError).not.toBe(true);
			expect(JSON.stringify(result)).not.toContain("example-capture");
			for (const record of [...(await filesystem.listTasks()), ...(await filesystem.listDrafts())]) {
				if (!record.filePath) throw new Error("Missing record path");
				await expectMetadata(record.filePath);
			}
		}
	});

	it("keeps metadata when the TUI closes an edited task or draft", async () => {
		const core = new Core(root);
		const editor = spyOn(core, "openEditor").mockImplementation(async (path) => {
			await Bun.write(path, `${await Bun.file(path).text()}\nEditor addition\n`);
			return true;
		});
		try {
			for (const id of ["TASK-1", "DRAFT-1"]) {
				const path = await writeRecord(id);
				const selected = { ...parseTask(await Bun.file(path).text()), filePath: path };
				const result = await core.editTaskInTui(id, {} as Parameters<Core["editTaskInTui"]>[1], selected);
				expect(result.changed).toBe(true);
				const saved = await expectMetadata(path);
				expect(saved).toContain("Editor addition");
				expect(parseTask(saved).updatedDate).toMatch(/Z$/);
			}
		} finally {
			editor.mockRestore();
		}
	});

	it("refuses reference-breaking edits and transitions before writing or deleting either file", async () => {
		for (const id of ["TASK-1", "DRAFT-1"]) {
			const command = id.startsWith("DRAFT-") ? "draft" : "task";
			const path = await writeRecord(id, "owner: *title\n");
			const source = (await Bun.file(path).text()).replace("title: Original", "title: &title Original");
			await Bun.write(path, source);
			const edit = await $`bun ${CLI_PATH} ${command} edit ${id} --title Changed`.cwd(root).quiet().nothrow();
			const transition =
				id === "TASK-1"
					? await $`bun ${CLI_PATH} task demote ${id}`.cwd(root).quiet().nothrow()
					: await $`bun ${CLI_PATH} draft promote ${id}`.cwd(root).quiet().nothrow();
			for (const result of [edit, transition]) {
				expect(result.exitCode).not.toBe(0);
				expect(result.stderr.toString()).toContain("the update would break a YAML reference");
				expect(await Bun.file(path).text()).toBe(source);
			}
		}
		expect(await readdir(filesystem.tasksDir)).toEqual(["task-1 - Original.md"]);
		expect(await readdir(await filesystem.getDraftsDir())).toEqual(["draft-1 - Original.md"]);
	});

	it("refuses a clear that a preserved YAML merge would undo", async () => {
		const path = await writeRecord("TASK-1", "defaults: &defaults {due_date: 2026-02-01}\n<<: *defaults\n");
		const source = await Bun.file(path).text();
		const result = await $`bun ${CLI_PATH} task edit TASK-1 --clear-due-date`.cwd(root).quiet().nothrow();
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toString()).toContain('prevents applying the requested change to "due_date"');
		expect(await Bun.file(path).text()).toBe(source);
	});

	it("keeps metadata through the automatic legacy draft-prefix migration", async () => {
		const path = join(await filesystem.getDraftsDir(), "task-1 - Original.md");
		await Bun.write(path, `---\nid: TASK-1\ntitle: Original\nstatus: Draft\n${METADATA}---\n${BODY}`);
		const config = await filesystem.loadConfig();
		if (!config) throw new Error("Missing config");
		await filesystem.saveConfig({ ...config, prefixes: undefined });
		await $`bun ${CLI_PATH} draft list --plain`.cwd(root).quiet();
		expect(await Bun.file(path).exists()).toBe(false);
		await expectMetadata(join(await filesystem.getDraftsDir(), "draft-1 - Original.md"));
	});

	it("keeps metadata on linked tasks, archived tasks and drafts during permanent-delete cleanup", async () => {
		await writeRecord();
		const activePath = await writeRecord("TASK-2", METADATA, "references: [TASK-1]\n");
		await writeRecord("TASK-3", METADATA, "references: [TASK-1]\n");
		const draftPath = await writeRecord("DRAFT-1", METADATA, "references: [TASK-1]\n");
		await $`bun ${CLI_PATH} task archive TASK-3`.cwd(root).quiet();
		const archived = (await filesystem.listArchivedTasks())[0];
		if (!archived?.filePath) throw new Error("Missing archived linked task");
		await $`bun ${CLI_PATH} task archive TASK-1`.cwd(root).quiet();
		await $`bun ${CLI_PATH} task delete TASK-1`.cwd(root).quiet();
		for (const path of [activePath, archived.filePath, draftPath]) {
			const saved = await expectMetadata(path);
			expect(parseMarkdown(saved).frontmatter).not.toHaveProperty("references");
			expect(parseTask(saved).rawContent).toBe(BODY.trim());
		}
	});
});
