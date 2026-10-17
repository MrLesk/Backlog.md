import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import { BacklogServer } from "../server/index.ts";
import type { Document } from "../types/index.ts";
import { createTestDirOutsideRepository, initializeFilesystemTestProject, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;

const api = (path: string) => `http://127.0.0.1:${serverPort}${path}`;

async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(api(path));
	if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
	return (await response.json()) as T;
}

/**
 * A project with two documents, the first of them archived the way `backlog doc archive` does it,
 * and a server started on it afterwards. The server gets no archive route in this change, so what
 * these tests cover is what it shares with core: its lists, its lookup by ID and its save.
 */
describe("BacklogServer with an archived document", () => {
	let archivedFile: string;

	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("server-document-archive");
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Server Document Archive");
		const retired = await core.createDocumentFromInput({
			title: "Retired runbook",
			content: "Runbook steps nobody follows any more.",
		});
		await core.createDocumentFromInput({ title: "Current runbook", content: "Runbook steps in use." });
		expect(await core.archiveContentRecord("document", "doc-1")).not.toBeNull();
		archivedFile = join(TEST_DIR, "backlog", "archive", "docs", retired.path ?? "");

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		serverPort = server.getPort() ?? 0;
		expect(serverPort).not.toBe(0);
		await retry(async () => {
			await getJson<Document[]>("/api/docs");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("refuses the save with 400 and core's read-only message, and writes no file", async () => {
		const before = await readFile(archivedFile, "utf8");

		const response = await fetch(api("/api/docs/doc-1"), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Must not change", content: "New body" }),
		});

		expect(response.status).toBe(400);
		// The message `backlog doc update` prints for the same document.
		expect(await response.json()).toEqual({
			error:
				"Document doc-1 is archived. Archived documents are read-only. Restore it first: backlog doc restore doc-1",
		});
		expect(await readFile(archivedFile, "utf8")).toBe(before);
		expect(await readdir(join(TEST_DIR, "backlog", "docs"))).toEqual(["doc-2 - Current-runbook.md"]);
	});

	it("leaves the archived document out of the sidebar list and out of search", async () => {
		const sidebar = await getJson<Array<{ id: string; title: string }>>("/api/docs");
		const search = await getJson<Array<{ document: { id: string; title: string } }>>(
			"/api/search?type=document&query=runbook",
		);

		expect(sidebar.map((document) => document.title)).toEqual(["Current runbook"]);
		expect(search.map((result) => result.document.title)).toEqual(["Current runbook"]);
	});

	it("still serves the archived document by ID, marked as archived", async () => {
		const archived = await getJson<Document>("/api/docs/doc-1");
		const current = await getJson<Document>("/api/docs/doc-2");

		expect(archived.archived).toBe(true);
		expect(archived.id).toBe("doc-1");
		expect(archived.rawContent).toBe("Runbook steps nobody follows any more.");
		expect(current.archived).toBeUndefined();
	});
});
