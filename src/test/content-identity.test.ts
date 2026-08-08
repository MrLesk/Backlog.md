import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { serializeDecision, serializeDocument } from "../markdown/serializer.ts";
import type { Decision, Document } from "../types/index.ts";
import { decisionIdKey } from "../utils/decision-id.ts";
import { documentIdKey, documentIdsEqual } from "../utils/document-id.ts";
import { hasContentIdentityIssues } from "../utils/duplicate-detection.ts";
import { AmbiguousIdError } from "../utils/entity-id.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, isWindows, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;

function makeDocument(id: string, title: string): Document {
	return {
		id,
		title,
		type: "other",
		createdDate: "2026-08-01 00:00",
		rawContent: `${title} body`,
	};
}

function makeDecision(id: string, title: string): Decision {
	return {
		id,
		title,
		date: "2026-08-01 00:00",
		status: "proposed",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	};
}

async function writeDocument(relativePath: string, document: Document): Promise<string> {
	const filePath = join(core.filesystem.docsDir, ...relativePath.split("/"));
	await mkdir(join(filePath, ".."), { recursive: true });
	await Bun.write(filePath, serializeDocument(document));
	return filePath;
}

async function writeDecision(filename: string, decision: Decision): Promise<string> {
	const filePath = join(core.filesystem.decisionsDir, filename);
	await mkdir(core.filesystem.decisionsDir, { recursive: true });
	await Bun.write(filePath, serializeDecision(decision));
	return filePath;
}

// gray-matter rejects an unterminated flow collection, so these files cannot be parsed at all.
function malformedFrontmatter(id: string): string {
	return `---\nid: ${id}\ntitle: [unterminated\n---\n\n${id} body\n`;
}

async function writeRaw(directory: string, relativePath: string, content: string): Promise<void> {
	const filePath = join(directory, ...relativePath.split("/"));
	await mkdir(join(filePath, ".."), { recursive: true });
	await Bun.write(filePath, content);
}

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("content-identity");
	await mkdir(TEST_DIR, { recursive: true });
	core = new Core(TEST_DIR);
	await initializeFilesystemTestProject(core, "Content identity");
});

afterEach(async () => {
	core.disposeSearchService();
	core.disposeContentStore();
	await safeCleanup(TEST_DIR);
});

describe("blank entity IDs", () => {
	it("never match another ID, including another blank one", () => {
		expect(documentIdsEqual("", "")).toBe(false);
		expect(documentIdsEqual("doc-", "doc-")).toBe(false);
		expect(documentIdsEqual("   ", "doc-1")).toBe(false);
		expect(documentIdsEqual("doc-1", "doc-001")).toBe(true);
	});

	it("have no canonical lookup key", () => {
		expect(documentIdKey("")).toBeNull();
		expect(documentIdKey("doc-")).toBeNull();
		expect(decisionIdKey("")).toBeNull();
		expect(documentIdKey("doc-01")).toBe("doc-1");
		expect(decisionIdKey("2")).toBe("decision-2");
	});

	it("keep documents and decisions without an id in frontmatter unaddressable", async () => {
		await writeDocument("no-id.md", { ...makeDocument("", "Unidentified doc"), id: "" });
		await writeDecision("decision-blank.md", { ...makeDecision("", "Unidentified decision"), id: "" });

		expect((await core.filesystem.listDocuments()).map((document) => document.title)).toContain("Unidentified doc");
		expect((await core.filesystem.listDecisions()).map((decision) => decision.title)).toContain(
			"Unidentified decision",
		);

		expect(await core.getDocument("")).toBeNull();
		expect(await core.getDocumentContent("")).toBeNull();
		expect(core.filesystem.loadDocument("")).rejects.toThrow("Document not found");
		expect(await core.filesystem.loadDecision("")).toBeNull();
		expect(await core.filesystem.loadDecision("decision-")).toBeNull();
	});
});

describe("ambiguous content identity", () => {
	it("fails closed when a document ID matches several files", async () => {
		await writeDocument("doc-1 - Alpha.md", makeDocument("doc-1", "Alpha"));
		await writeDocument("nested/doc-01 - Beta.md", makeDocument("doc-01", "Beta"));

		expect(core.getDocument("doc-1")).rejects.toBeInstanceOf(AmbiguousIdError);
		expect(core.filesystem.loadDocument("DOC-001")).rejects.toBeInstanceOf(AmbiguousIdError);

		const error = await core.getDocument("doc-1").catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(AmbiguousIdError);
		expect((error as AmbiguousIdError).message).toContain("Document ID doc-1 is ambiguous; 2 files match:");
		expect((error as AmbiguousIdError).candidates).toEqual(["doc-1 - Alpha.md", "nested/doc-01 - Beta.md"]);
		expect((error as AmbiguousIdError).message).toContain("backlog doctor");
	});

	it("fails closed when a decision ID matches several files", async () => {
		await writeDecision("decision-1 - Alpha.md", makeDecision("decision-1", "Alpha"));
		await writeDecision("decision-01 - Beta.md", makeDecision("decision-01", "Beta"));

		const error = await core.filesystem.loadDecision("decision-1").catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(AmbiguousIdError);
		expect((error as AmbiguousIdError).message).toContain("Decision ID decision-1 is ambiguous; 2 files match:");
		expect((error as AmbiguousIdError).candidates).toEqual(["decision-01 - Beta.md", "decision-1 - Alpha.md"]);
	});

	it("still resolves unambiguous IDs", async () => {
		await writeDocument("doc-1 - Alpha.md", makeDocument("doc-1", "Alpha"));
		await writeDecision("decision-2 - Beta.md", makeDecision("decision-2", "Beta"));

		expect((await core.getDocument("1"))?.title).toBe("Alpha");
		expect((await core.filesystem.loadDecision("2"))?.title).toBe("Beta");
		expect(await core.getDocument("doc-9")).toBeNull();
		expect(await core.filesystem.loadDecision("decision-9")).toBeNull();
	});
});

describe("diagnoseContentIdentity", () => {
	it("reports nothing for a healthy project", async () => {
		await writeDocument("doc-1 - Alpha.md", makeDocument("doc-1", "Alpha"));
		await writeDecision("decision-1 - Alpha.md", makeDecision("decision-1", "Alpha"));

		expect(await core.diagnoseContentIdentity()).toEqual({
			documents: { duplicates: [], missingIds: [], unreadable: [] },
			decisions: { duplicates: [], missingIds: [], unreadable: [] },
		});
	});

	it("groups duplicate document and decision IDs by canonical ID", async () => {
		await writeDocument("doc-1 - Alpha.md", makeDocument("doc-1", "Alpha"));
		await writeDocument("nested/doc-01 - Beta.md", makeDocument("doc-01", "Beta"));
		await writeDecision("decision-3 - Gamma.md", makeDecision("decision-3", "Gamma"));
		await writeDecision("decision-003 - Delta.md", makeDecision("decision-003", "Delta"));

		const report = await core.diagnoseContentIdentity();
		expect(report.documents.duplicates).toEqual([
			{ id: "doc-1", paths: ["backlog/docs/doc-1 - Alpha.md", "backlog/docs/nested/doc-01 - Beta.md"] },
		]);
		expect(report.decisions.duplicates).toEqual([
			{
				id: "decision-3",
				paths: ["backlog/decisions/decision-003 - Delta.md", "backlog/decisions/decision-3 - Gamma.md"],
			},
		]);
	});

	it("reports documents and decisions with no id as malformed", async () => {
		await writeDocument("no-id.md", { ...makeDocument("", "Unidentified doc"), id: "" });
		await writeDecision("decision-blank.md", { ...makeDecision("", "Unidentified decision"), id: "" });

		const report = await core.diagnoseContentIdentity();
		expect(report.documents.missingIds).toEqual(["backlog/docs/no-id.md"]);
		expect(report.decisions.missingIds).toEqual(["backlog/decisions/decision-blank.md"]);
		expect(report.documents.duplicates).toEqual([]);
		expect(report.decisions.duplicates).toEqual([]);
	});
});

describe("unreadable content files", () => {
	it("keeps every other document and decision resolvable", async () => {
		await writeDocument("doc-1 - Alpha.md", makeDocument("doc-1", "Alpha"));
		await writeRaw(core.filesystem.docsDir, "doc-2 - Broken.md", malformedFrontmatter("doc-2"));
		await writeDecision("decision-1 - Alpha.md", makeDecision("decision-1", "Alpha"));
		await writeRaw(core.filesystem.decisionsDir, "decision-2 - Broken.md", malformedFrontmatter("decision-2"));

		const unreadableDocuments: string[] = [];
		const documents = await core.filesystem.listDocuments(unreadableDocuments);
		expect(documents.map((document) => document.id)).toEqual(["doc-1"]);
		expect(unreadableDocuments).toEqual(["doc-2 - Broken.md"]);

		const unreadableDecisions: string[] = [];
		const decisions = await core.filesystem.listDecisions(unreadableDecisions);
		expect(decisions.map((decision) => decision.id)).toEqual(["decision-1"]);
		expect(unreadableDecisions).toEqual(["decision-2 - Broken.md"]);

		expect((await core.getDocument("doc-1"))?.title).toBe("Alpha");
		expect((await core.filesystem.loadDecision("decision-1"))?.title).toBe("Alpha");
	});

	it("are reported as findings so identity is never called healthy on an unread file", async () => {
		await writeRaw(core.filesystem.docsDir, "nested/doc-2 - Broken.md", malformedFrontmatter("doc-9"));
		await writeRaw(core.filesystem.decisionsDir, "decision-2 - Broken.md", malformedFrontmatter("decision-9"));

		const report = await core.diagnoseContentIdentity();
		expect(report.documents.unreadable).toEqual(["backlog/docs/nested/doc-2 - Broken.md"]);
		expect(report.decisions.unreadable).toEqual(["backlog/decisions/decision-2 - Broken.md"]);
		expect(report.documents.duplicates).toEqual([]);
		expect(report.documents.missingIds).toEqual([]);
		expect(hasContentIdentityIssues(report)).toBe(true);
	});
});

describe("unreadable content directories", () => {
	// chmod has no effect for root, and Windows ignores these mode bits, so confirm the directory
	// really became unreadable before asserting on the finding.
	async function lockDirectory(directory: string): Promise<boolean> {
		if (isWindows()) return false;
		await chmod(directory, 0o000);
		try {
			await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: directory, followSymlinks: true }));
			await chmod(directory, 0o755);
			return false;
		} catch {
			return true;
		}
	}

	it("reports a directory that cannot be scanned instead of calling identity healthy", async () => {
		await writeDocument("doc-1 - Alpha.md", makeDocument("doc-1", "Alpha"));
		const locked = await lockDirectory(core.filesystem.docsDir);
		if (!locked) return;

		try {
			const unreadable: string[] = [];
			expect(await core.filesystem.listDocuments(unreadable)).toEqual([]);
			expect(unreadable).toEqual([""]);

			const report = await core.diagnoseContentIdentity();
			expect(report.documents.unreadable).toEqual(["backlog/docs"]);
			expect(hasContentIdentityIssues(report)).toBe(true);
		} finally {
			await chmod(core.filesystem.docsDir, 0o755);
		}
	});

	it("still treats a directory that does not exist as empty", async () => {
		// A project that has never created docs or decisions is healthy, not broken.
		const bareDir = createUniqueTestDir("content-identity-bare");
		await mkdir(bareDir, { recursive: true });
		const bare = new Core(bareDir);
		await initializeFilesystemTestProject(bare, "Bare project");
		await safeCleanup(bare.filesystem.docsDir);
		await safeCleanup(bare.filesystem.decisionsDir);

		try {
			const unreadable: string[] = [];
			expect(await bare.filesystem.listDocuments(unreadable)).toEqual([]);
			expect(await bare.filesystem.listDecisions(unreadable)).toEqual([]);
			expect(unreadable).toEqual([]);
			expect(hasContentIdentityIssues(await bare.diagnoseContentIdentity())).toBe(false);
		} finally {
			bare.disposeSearchService();
			bare.disposeContentStore();
			await safeCleanup(bareDir);
		}
	});
});
