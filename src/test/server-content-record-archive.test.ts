import { afterEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { BacklogServer } from "../server/index.ts";
import { createTestDirOutsideRepository, initializeTestProject, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;

const api = (path: string) => `http://127.0.0.1:${serverPort}${path}`;
const git = async (...args: string[]) => (await $`git ${args}`.cwd(TEST_DIR).quiet().text()).trim();

async function exists(path: string): Promise<boolean> {
	return (await lstat(path).catch(() => null)) !== null;
}

/** The archive route answers with a status and a JSON body. */
async function postArchive(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
	const response = await fetch(api(path), { method: "POST" });
	return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** The two kinds behind the Archive button: their routes, folders and the words core uses. */
const KINDS = [
	{
		kind: "document",
		route: (id: string) => `/api/docs/${id}/archive`,
		list: "/api/docs",
		searchType: "document",
		folder: "docs",
		archiveFolder: "archive/docs",
		id: "doc-1",
		otherId: "doc-9",
		missingId: "doc-42",
		cliCommand: "backlog doc",
		file: "doc-1 - Retired-runbook.md",
		noun: "Document",
		create: (core: Core, title: string) =>
			core.createDocumentFromInput({ title, content: "Runbook steps." }).then((document) => document.id),
	},
	{
		kind: "decision",
		route: (id: string) => `/api/decisions/${id}/archive`,
		list: "/api/decisions",
		searchType: "decision",
		folder: "decisions",
		archiveFolder: "archive/decisions",
		id: "decision-1",
		otherId: "decision-9",
		missingId: "decision-42",
		cliCommand: "backlog decision",
		file: "decision-1 - Retired-runbook.md",
		noun: "Decision",
		create: (core: Core, title: string) => core.createDecisionWithTitle(title).then((decision) => decision.id),
	},
] as const;

/**
 * A Git project with one record of each kind titled "Retired runbook" and one titled "Current
 * runbook", committed, and a server started on it.
 */
async function startServer(autoCommit: boolean): Promise<Core> {
	TEST_DIR = await createTestDirOutsideRepository("server-content-record-archive");
	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	const core = new Core(TEST_DIR);
	await initializeTestProject(core, "Server Archive Routes", true);
	const config = await core.filesystem.loadConfig();
	if (!config) throw new Error("Expected the project config");
	await core.filesystem.saveConfig({ ...config, autoCommit, remoteOperations: false });
	for (const { create } of KINDS) {
		await create(core, "Retired runbook");
		await create(core, "Current runbook");
	}
	await git("add", "-A");
	await git("commit", "-m", "Set up the project");

	server = new BacklogServer(TEST_DIR);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
	expect(serverPort).not.toBe(0);
	await retry(async () => {
		const response = await fetch(api("/api/docs"));
		if (!response.ok) throw new Error(`${response.status}`);
	});
	return core;
}

afterEach(async () => {
	if (server) {
		await server.stop();
		server = null;
	}
	await safeCleanup(TEST_DIR);
});

describe.each([...KINDS])("POST archive route for a $kind", (kind) => {
	const folderPath = (...segments: string[]) => join(TEST_DIR, "backlog", kind.folder, ...segments);
	const archivePath = (...segments: string[]) => join(TEST_DIR, "backlog", kind.archiveFolder, ...segments);

	it("archives the record the way the CLI does, commit included, and takes it out of the lists at once", async () => {
		await startServer(true);
		const before = await readFile(folderPath(kind.file));

		const archived = await postArchive(kind.route(kind.id));

		expect(archived).toEqual({ status: 200, body: { success: true } });
		expect(await exists(folderPath(kind.file))).toBe(false);
		expect((await readFile(archivePath(kind.file))).equals(before)).toBe(true);
		expect(await git("log", "-1", "--format=%s")).toBe(`backlog: Archive ${kind.kind} ${kind.id}`);
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(
			`R100\tbacklog/${kind.folder}/${kind.file}\tbacklog/${kind.archiveFolder}/${kind.file}`,
		);
		// No reload: the next read of the sidebar and of search leaves the record out.
		const list = (await (await fetch(api(kind.list))).json()) as Array<{ title: string }>;
		const search = (await (await fetch(api(`/api/search?type=${kind.searchType}&query=runbook`))).json()) as Array<
			Record<string, { title: string }>
		>;
		expect(list.map((record) => record.title)).toEqual(["Current runbook"]);
		expect(search.map((result) => result[kind.searchType]?.title)).toEqual(["Current runbook"]);
	});

	it("answers 404 with core's message for an ID that no record claims", async () => {
		await startServer(false);

		const missing = await postArchive(kind.route(kind.missingId));

		expect(missing.status).toBe(404);
		expect(missing.body.error).toBe(`${kind.noun} not found: ${kind.missingId}`);
	});

	it("answers 409 for an ID claimed in both folders, and moves nothing", async () => {
		await startServer(false);
		await mkdir(archivePath(), { recursive: true });
		await writeFile(archivePath(kind.file), await readFile(folderPath(kind.file)));

		const ambiguous = await postArchive(kind.route(kind.id));

		expect(ambiguous.status).toBe(409);
		expect(ambiguous.body.error).toContain(`${kind.noun} ID ${kind.id} is ambiguous; 2 files match:`);
		expect(await exists(folderPath(kind.file))).toBe(true);
	});

	it("answers 400 with core's message for a refusal, and moves nothing", async () => {
		await startServer(false);
		// The archive already has a file of that name, claiming another ID.
		const content = await readFile(folderPath(kind.file), "utf8");
		await mkdir(archivePath(), { recursive: true });
		await writeFile(archivePath(kind.file), content.replace(`id: ${kind.id}`, `id: ${kind.otherId}`));

		const refused = await postArchive(kind.route(kind.id));

		expect(refused.status).toBe(400);
		expect(refused.body).toEqual({
			error: `${kind.noun} ${kind.id} cannot be archived: the archive already has a file at backlog/${kind.archiveFolder}/${kind.file}.`,
		});
		expect(await readFile(folderPath(kind.file), "utf8")).toBe(content);
	});

	it("answers 400 with the read-only message for a record that is archived already", async () => {
		await startServer(false);
		expect((await postArchive(kind.route(kind.id))).status).toBe(200);

		const again = await postArchive(kind.route(kind.id));

		expect(again.status).toBe(400);
		expect(again.body.error).toBe(
			`${kind.noun} ${kind.id} is archived. Archived ${kind.kind}s are read-only. Restore it first: ${kind.cliCommand} restore ${kind.id}`,
		);
	});

	it("answers 500 with archiveState moved when the record moved and only the commit failed", async () => {
		await startServer(true);
		// Another Git process holds the index, so the move cannot be committed.
		await writeFile(join(TEST_DIR, ".git", "index.lock"), "");

		const failed = await postArchive(kind.route(kind.id));

		expect(failed.status).toBe(500);
		expect(failed.body.archiveState).toBe("moved");
		expect(String(failed.body.error)).toStartWith(
			`${kind.noun} ${kind.id} was archived, but committing the change failed:`,
		);
		expect(await exists(archivePath(kind.file))).toBe(true);
	});
});

describe("the web has no delete or restore route for documents and decisions", () => {
	it.each([
		"/api/docs/doc-1/delete",
		"/api/docs/doc-1/restore",
		"/api/decisions/decision-1/delete",
		"/api/decisions/decision-1/restore",
	])("POST %s changes nothing", async (path) => {
		await startServer(false);
		expect((await postArchive(path.replace(/\/(delete|restore)$/, "/archive"))).status).toBe(200);
		const archivedFiles = await git("status", "--porcelain");

		const response = await fetch(api(path), { method: "POST" });

		expect(response.status).not.toBe(200);
		expect(await git("status", "--porcelain")).toBe(archivedFiles);
	});
});
