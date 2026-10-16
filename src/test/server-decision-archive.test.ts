import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import { BacklogServer } from "../server/index.ts";
import type { Decision } from "../types/index.ts";
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
 * A project with two decisions, the first of them archived the way `backlog decision archive` does
 * it, and a server started on it afterwards. The server gets no archive route in this change, so
 * what these tests cover is what it shares with core: its lists, its lookup by ID and its save.
 */
describe("BacklogServer with an archived decision", () => {
	let archivedFile: string;

	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("server-decision-archive");
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Server Decision Archive");
		await core.createDecisionWithTitle("Retired runbook policy");
		await core.createDecisionWithTitle("Current runbook policy");
		expect(await core.archiveContentRecord("decision", "decision-1")).not.toBeNull();
		archivedFile = join(TEST_DIR, "backlog", "archive", "decisions", "decision-1 - Retired-runbook-policy.md");

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		serverPort = server.getPort() ?? 0;
		expect(serverPort).not.toBe(0);
		await retry(async () => {
			await getJson<Decision[]>("/api/decisions");
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

		const response = await fetch(api("/api/decisions/decision-1"), {
			method: "PUT",
			body: "---\nid: decision-1\ntitle: Must not change\n---\n\n## Context\n\nNew context\n",
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error:
				"Decision decision-1 is archived. Archived decisions are read-only. Restore it first: backlog decision restore decision-1",
		});
		expect(await readFile(archivedFile, "utf8")).toBe(before);
		expect(await readdir(join(TEST_DIR, "backlog", "decisions"))).toEqual(["decision-2 - Current-runbook-policy.md"]);
	});

	it("leaves the archived decision out of the sidebar list and out of search", async () => {
		const sidebar = await getJson<Array<{ id: string; title: string }>>("/api/decisions");
		const search = await getJson<Array<{ decision: { id: string; title: string } }>>(
			"/api/search?type=decision&query=runbook",
		);

		expect(sidebar.map((decision) => decision.title)).toEqual(["Current runbook policy"]);
		expect(search.map((result) => result.decision.title)).toEqual(["Current runbook policy"]);
	});

	it("still serves the archived decision by ID, marked as archived", async () => {
		const archived = await getJson<Decision>("/api/decisions/decision-1");
		const current = await getJson<Decision>("/api/decisions/decision-2");

		expect(archived.archived).toBe(true);
		expect(archived.title).toBe("Retired runbook policy");
		expect(current.archived).toBeUndefined();
	});
});
