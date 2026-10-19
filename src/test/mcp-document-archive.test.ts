import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { createTestDirOutsideRepository, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let mcpServer: McpServer;

const READ_ONLY_MESSAGE =
	"Document doc-1 is archived. Archived documents are read-only. Restore it first: backlog doc restore doc-1";
const ARCHIVED_LINE = "This document is archived and read-only.";

type ToolResult = { isError: boolean; text: string; code?: string };

/** Call a tool and return the text and the error code an MCP client receives. */
async function call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
	const result = await mcpServer.testInterface.callTool({ params: { name, arguments: args } });
	const first = result.content?.[0] as { text?: string } | undefined;
	const structured = result.structuredContent as { code?: string } | undefined;
	return { isError: result.isError === true, text: first?.text ?? "", code: structured?.code };
}

const docsPath = (...segments: string[]) => join(TEST_DIR, "backlog", "docs", ...segments);
const archivePath = (...segments: string[]) => join(TEST_DIR, "backlog", "archive", "docs", ...segments);

async function exists(path: string): Promise<boolean> {
	return (await lstat(path).catch(() => null)) !== null;
}

/** The content of every file directly inside a folder, by file name. */
async function readFolder(dir: string): Promise<Record<string, string>> {
	const files: Record<string, string> = {};
	for (const name of await readdir(dir).catch(() => [])) {
		files[name] = await readFile(join(dir, name), "utf8");
	}
	return files;
}

/** Create a document through the tool, as an MCP client does, and return its file name. */
async function createDocument(title: string, content = `Body of ${title}`): Promise<string> {
	const created = await call("document_create", { title, content });
	expect(created.isError).toBe(false);
	const path = created.text.match(/^Path: (.+)$/m)?.[1] ?? "";
	return path.split("/").pop() ?? "";
}

describe("MCP document_archive", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("mcp-document-archive");
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await initializeTestProject(mcpServer, "Document Archive Project", true);
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await mcpServer.filesystem.saveConfig({ ...config, remoteOperations: false });
		await mcpServer.ensureConfigLoaded();
		registerDocumentTools(mcpServer, config);
	});

	afterEach(async () => {
		await mcpServer.stop().catch(() => {});
		await safeCleanup(TEST_DIR);
	});

	it("is offered with the one-ID input of document_view and rejects any other field", async () => {
		const tools = (await mcpServer.testInterface.listTools()).tools;
		const archiveTool = tools.find((tool) => tool.name === "document_archive");
		const viewTool = tools.find((tool) => tool.name === "document_view");

		expect(archiveTool?.description).toContain("keeps its ID reserved");
		expect(archiveTool?.inputSchema).toEqual(viewTool?.inputSchema);
		expect(archiveTool?.inputSchema).toMatchObject({
			properties: { id: { type: "string" } },
			required: ["id"],
			additionalProperties: false,
		});

		const name = await createDocument("Kept");
		const rejected = await call("document_archive", { id: "doc-1", confirm: true });

		expect(rejected.isError).toBe(true);
		expect(rejected.text).toContain("Unknown field 'confirm' is not allowed");
		expect(await exists(docsPath(name))).toBe(true);
	});

	it("moves the file unchanged and names the tasks and drafts that list it as documentation", async () => {
		const name = await createDocument("API Guidelines");
		const path = `backlog/docs/${name}`;
		const before = await readFile(docsPath(name), "utf8");
		await mcpServer.createTaskFromInput({ title: "Names the file", documentation: [path] });
		await mcpServer.createTaskFromInput({ title: "Names a URL", documentation: [`https://example.com/${path}`] });
		await mcpServer.createTaskFromInput({ title: "Draft", status: "Draft", documentation: [`./${path}#usage`] });
		const tasksBefore = await readFolder(join(TEST_DIR, "backlog", "tasks"));
		const draftsBefore = await readFolder(join(TEST_DIR, "backlog", "drafts"));

		const archived = await call("document_archive", { id: "1" });

		expect(archived.isError).toBe(false);
		// The CLI prints the same two lines, without the closing periods.
		expect(archived.text).toBe("Archived document doc-1.\nStill listed as documentation by: TASK-1, DRAFT-1.");
		expect(await exists(docsPath(name))).toBe(false);
		expect(await readFile(archivePath(name), "utf8")).toBe(before);
		expect(await readFolder(join(TEST_DIR, "backlog", "tasks"))).toEqual(tasksBefore);
		expect(await readFolder(join(TEST_DIR, "backlog", "drafts"))).toEqual(draftsBefore);
	});

	it("returns only the confirmation when no task names the file", async () => {
		await createDocument("Nobody refers to this");

		const archived = await call("document_archive", { id: "doc-1" });

		expect(archived.text).toBe("Archived document doc-1.");
	});

	it("leaves an archived document out of document_list and document_search at once", async () => {
		await createDocument("Retired runbook", "Runbook steps nobody follows any more.");
		await createDocument("Current runbook", "Runbook steps in use.");
		// The search index is built before the archive, so this checks that it is updated, not rebuilt.
		expect((await call("document_search", { query: "runbook" })).text).toContain("doc-1 - Retired runbook");

		expect((await call("document_archive", { id: "doc-1" })).isError).toBe(false);

		const list = await call("document_list", {});
		const search = await call("document_search", { query: "runbook" });
		for (const result of [list, search]) {
			expect(result.isError).toBe(false);
			expect(result.text).toContain("doc-2 - Current runbook");
			expect(result.text).not.toContain("Retired runbook");
		}
	});

	it("still returns an archived document from document_view, with the line that says it is archived", async () => {
		await createDocument("Kept for reference", "The body that stays readable.");
		const viewBeforeArchive = await call("document_view", { id: "doc-1" });
		expect(viewBeforeArchive.text).not.toContain(ARCHIVED_LINE);
		expect((await call("document_archive", { id: "doc-1" })).isError).toBe(false);

		const view = await call("document_view", { id: "doc-1" });

		expect(view.isError).toBe(false);
		// The document as before the archive, under the line the CLI prints as well.
		expect(view.text).toBe(`${ARCHIVED_LINE}\n\n${viewBeforeArchive.text}`);
		expect(view.text).toContain("The body that stays readable.");
	});

	it("refuses document_update on an archived document with the message the CLI prints", async () => {
		const name = await createDocument("Read-only while archived");
		expect((await call("document_archive", { id: "doc-1" })).isError).toBe(false);
		const before = await readFile(archivePath(name), "utf8");

		const update = await call("document_update", { id: "doc-1", title: "Must not change", content: "New body" });

		expect(update.isError).toBe(true);
		expect(update.code).toBe("VALIDATION_ERROR");
		expect(update.text).toContain(READ_ONLY_MESSAGE);
		expect(update.text).not.toContain("Failed to update document");
		expect(await readFile(archivePath(name), "utf8")).toBe(before);
		expect(await readdir(docsPath())).toEqual([]);
	});

	it("refuses with core's messages: already archived, destination taken, not found, ambiguous", async () => {
		const first = await createDocument("Archived once");
		expect((await call("document_archive", { id: "doc-1" })).isError).toBe(false);

		const again = await call("document_archive", { id: "doc-1" });
		expect(again.isError).toBe(true);
		expect(again.code).toBe("VALIDATION_ERROR");
		expect(again.text).toContain(READ_ONLY_MESSAGE);

		// Another document's file already sits at the path doc-2 would move to.
		const second = await createDocument("Same name");
		await writeFile(archivePath(second), (await readFile(docsPath(second), "utf8")).replace("id: doc-2", "id: doc-9"));
		const taken = await call("document_archive", { id: "doc-2" });
		expect(taken.isError).toBe(true);
		expect(taken.code).toBe("VALIDATION_ERROR");
		expect(taken.text).toContain(
			`Document doc-2 cannot be archived: the archive already has a file at backlog/archive/docs/${second}.`,
		);
		expect(await exists(docsPath(second))).toBe(true);

		const missing = await call("document_archive", { id: "77" });
		expect(missing.isError).toBe(true);
		expect(missing.code).toBe("DOCUMENT_NOT_FOUND");
		expect(missing.text).toContain("Document not found: 77");

		// A copy of the archived file under the docs folder: two files claim doc-1.
		await mkdir(docsPath(), { recursive: true });
		await writeFile(docsPath(first), await readFile(archivePath(first)));
		for (const tool of ["document_archive", "document_view"]) {
			const ambiguous = await call(tool, { id: "doc-1" });
			expect(ambiguous.isError).toBe(true);
			expect(ambiguous.code).toBe("AMBIGUOUS_ID");
			expect(ambiguous.text).toContain("Document ID doc-1 is ambiguous; 2 files match:");
			expect(ambiguous.text).toContain(`  - backlog/archive/docs/${first}`);
			expect(ambiguous.text).toContain(`  - backlog/docs/${first}`);
		}
		expect(await exists(docsPath(first))).toBe(true);
		expect(await exists(archivePath(first))).toBe(true);
	});

	it("keeps the archived ID reserved for the next document_create", async () => {
		await createDocument("Stays");
		await createDocument("Goes to the archive");
		expect((await call("document_archive", { id: "doc-2" })).isError).toBe(false);

		const created = await call("document_create", { title: "Created afterwards", content: "Body" });

		expect(created.text).toContain("Document doc-3 - Created afterwards");
	});

	it("commits the move and nothing else when auto-commit is on", async () => {
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await mcpServer.filesystem.saveConfig({ ...config, autoCommit: true });
		const name = await createDocument("Committed document");
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Set up the project"`.cwd(TEST_DIR).quiet().nothrow();

		const archived = await call("document_archive", { id: "doc-1" });

		expect(archived.isError).toBe(false);
		expect((await $`git log -1 --format=%s`.cwd(TEST_DIR).text()).trim()).toBe("backlog: Archive document doc-1");
		expect((await $`git show --name-status --format= HEAD`.cwd(TEST_DIR).text()).trim()).toBe(
			`R100\tbacklog/docs/${name}\tbacklog/archive/docs/${name}`,
		);
		expect((await $`git status --porcelain`.cwd(TEST_DIR).text()).trim()).toBe("");
	});

	it("says that the document was archived when only the commit fails", async () => {
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await mcpServer.filesystem.saveConfig({ ...config, autoCommit: true });
		const name = await createDocument("Committed document");
		// Another Git process holds the index, so the move cannot be staged.
		await writeFile(join(TEST_DIR, ".git", "index.lock"), "");

		const archived = await call("document_archive", { id: "doc-1" });

		expect(archived.isError).toBe(true);
		expect(archived.code).toBe("OPERATION_FAILED");
		expect(archived.text).toContain("Document doc-1 was archived, but committing the change failed:");
		expect(await exists(archivePath(name))).toBe(true);
	});
});
