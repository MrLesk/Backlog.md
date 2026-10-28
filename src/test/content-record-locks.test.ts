import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, utimes } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { McpServer } from "../mcp/server.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { BacklogServer } from "../server/index.ts";
import type { ContentRecordKind } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const cli = getTestCliPath();
const busy = "is being modified by another process";

describe("document and decision mutation locks", () => {
	let directory: string;
	let core: Core;

	beforeEach(async () => {
		directory = createUniqueTestDir("content-record-locks");
		core = new Core(directory);
		await initializeFilesystemTestProject(core, "Content locks");
		await core.createDocumentFromInput({ title: "Guide", content: "Original" });
		await core.createDecisionFromInput({ title: "Choice" });
	});

	afterEach(async () => {
		core.disposeContentStore();
		await safeCleanup(directory);
	});

	const idFor = (kind: ContentRecordKind) => (kind === "document" ? "doc-1" : "decision-1");
	async function update(kind: ContentRecordKind) {
		return kind === "document"
			? core.updateDocumentFromInput({ id: "doc-1", content: "Changed" })
			: core.updateDecisionFromInput("decision-1", { status: "accepted" });
	}

	it.each(["document", "decision"] as const)("refuses competing %s CLI, HTTP, and lifecycle writes", async (kind) => {
		const id = idFor(kind);
		const record = kind === "document" ? await core.getDocument(id) : await core.getDecision(id);
		if (!record) throw new Error("Fixture missing");
		const file = core.fs.contentRecordFilePath(kind, record);
		const before = (await Bun.file(file).text()).replace(`id: ${id}`, `id: ${id.toUpperCase().replace("-1", "-001")}`);
		await Bun.write(file, before);
		// An occupied lock directory models another process with the same lock policy.
		const lock = join(core.fs.backlogDir, ".locks", `${kind}-${id}`);
		await mkdir(lock, { recursive: true });
		const result =
			kind === "document"
				? await $`bun ${cli} doc update doc-1 --content Changed`.cwd(directory).quiet().nothrow()
				: await $`bun ${cli} decision edit decision-1 -s accepted`.cwd(directory).quiet().nothrow();
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toString()).toContain(busy);
		await expect(core.archiveContentRecord(kind, id)).rejects.toThrow(busy);

		const server = new BacklogServer(directory);
		await server.start(0, false);
		try {
			const route = kind === "document" ? "docs" : "decisions";
			const response = await fetch(`http://127.0.0.1:${server.getPort()}/api/${route}/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(kind === "document" ? { content: "Changed" } : { context: "Changed" }),
			});
			expect(response.status).toBe(409);
			expect((await response.json()).error).toContain(busy);
			const archived = await fetch(`http://127.0.0.1:${server.getPort()}/api/${route}/${id}/archive`, {
				method: "POST",
			});
			expect(archived.status).toBe(409);
		} finally {
			await server.stop();
		}
		expect(await Bun.file(file).text()).toBe(before);
	});

	it("returns a document_update MCP error for an occupied record", async () => {
		await mkdir(join(core.fs.backlogDir, ".locks", "document-doc-1"), { recursive: true });
		const mcp = new McpServer(directory, "Tests");
		try {
			const config = await mcp.fs.loadConfig();
			if (!config) throw new Error("Fixture config missing");
			registerDocumentTools(mcp, config);
			const result = await mcp.testInterface.callTool({
				params: {
					name: "document_update",
					arguments: { id: "doc-1", content: "Changed" },
				},
			});
			expect(result.isError).toBe(true);
			expect(JSON.stringify(result.content)).toContain(busy);
			expect((await core.getDocument("doc-1"))?.rawContent).toBe("Original");
		} finally {
			await mcp.stop();
		}
	});

	it.each(["document", "decision"] as const)(
		"locks archived %s restore and delete, and recovers a stale lock",
		async (kind) => {
			const id = idFor(kind);
			await core.archiveContentRecord(kind, id);
			const lock = join(core.fs.backlogDir, ".locks", `${kind}-${id}`);
			await mkdir(lock, { recursive: true });
			await expect(core.restoreContentRecord(kind, id)).rejects.toThrow(busy);
			await expect(core.deleteContentRecord(kind, id)).rejects.toThrow(busy);
			const old = new Date(Date.now() - 60_000);
			await utimes(lock, old, old);
			expect(await core.restoreContentRecord(kind, id)).not.toBeNull();
		},
	);

	it.each(["document", "decision"] as const)(
		"keeps every successful field change during concurrent %s updates",
		async (kind) => {
			const first = new Core(directory);
			const second = new Core(directory);
			const results = await Promise.allSettled(
				kind === "document"
					? [
							first.updateDocumentFromInput({ id: "doc-1", title: "New title", content: "Original" }),
							second.updateDocumentFromInput({ id: "doc-1", tags: ["new"], content: "Original" }),
						]
					: [
							first.updateDecisionFromInput("decision-1", { context: "New context" }),
							second.updateDecisionFromInput("decision-1", { status: "accepted" }),
						],
			);
			expect(results.some((result) => result.status === "fulfilled")).toBe(true);
			for (const result of results) if (result.status === "rejected") expect(result.reason.message).toContain(busy);
			if (kind === "document") {
				const document = await core.getDocument("doc-1");
				if (results[0]?.status === "fulfilled") expect(document?.title).toBe("New title");
				if (results[1]?.status === "fulfilled") expect(document?.tags).toEqual(["new"]);
			} else {
				const decision = await core.getDecision("decision-1");
				if (results[0]?.status === "fulfilled") expect(decision?.context).toBe("New context");
				if (results[1]?.status === "fulfilled") expect(decision?.status).toBe("accepted");
			}
		},
	);

	it.each(["document", "decision"] as const)("rereads the %s after acquiring the lock", async (kind) => {
		const originalLock = core.fs.withContentRecordLock.bind(core.fs);
		const other = new Core(directory);
		core.fs.withContentRecordLock = async (lockedKind, record, operation) => {
			if (kind === "document") {
				await other.updateDocumentFromInput({ id: "doc-1", content: "Original", tags: ["saved first"] });
			} else {
				await other.updateDecisionFromInput("decision-1", { context: "Saved first" });
			}
			return originalLock(lockedKind, record, operation);
		};
		await update(kind);
		if (kind === "document") expect((await core.getDocument("doc-1"))?.tags).toEqual(["saved first"]);
		else expect((await core.getDecision("decision-1"))?.context).toBe("Saved first");
	});

	it("keeps a newer document body when a metadata-only edit reaches the lock later", async () => {
		const originalLock = core.fs.withContentRecordLock.bind(core.fs);
		core.fs.withContentRecordLock = async (kind, record, operation) => {
			await new Core(directory).updateDocumentFromInput({ id: "doc-1", content: "Saved before the lock" });
			return originalLock(kind, record, operation);
		};
		await core.updateDocumentFromInput({ id: "doc-1", title: "Renamed" });
		expect(await core.getDocument("doc-1")).toMatchObject({ title: "Renamed", rawContent: "Saved before the lock" });
	});

	it("does not block other records or mix document and decision locks", async () => {
		await mkdir(join(core.fs.backlogDir, ".locks", "document-doc-1"), { recursive: true });
		await core.createDocumentFromInput({ title: "Other", content: "Other" });
		await core.updateDocumentFromInput({ id: "doc-2", content: "Updated" });
		await update("decision");
		expect((await core.getDocument("doc-2"))?.rawContent).toBe("Updated");
		expect((await core.getDecision("decision-1"))?.status).toBe("accepted");
	});
});
