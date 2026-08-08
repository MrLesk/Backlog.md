import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { serializeDecision, serializeDocument } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { Document } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
	if (!response.ok) {
		throw new Error(`${response.status}: ${await response.text()}`);
	}
	return response.json();
}

describe("BacklogServer document endpoints", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-documents");
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Documents",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetchJson<Document[]>("/api/docs");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("creates, lists, views, and moves documents with path metadata", async () => {
		const created = await fetchJson<Document & { success: boolean }>("/api/docs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Setup Guide",
				content: "# Setup",
				type: "guide",
				path: "guides / setup",
				tags: ["setup"],
			}),
		});

		expect(created.success).toBe(true);
		expect(created.id).toBe("doc-1");
		expect(created.path).toBe("guides/setup/doc-1 - Setup-Guide.md");
		expect(created.tags).toEqual(["setup"]);

		const list = await fetchJson<Document[]>("/api/docs");
		expect(list[0]?.path).toBe("guides/setup/doc-1 - Setup-Guide.md");

		const viewed = await fetchJson<Document>("/api/docs/doc-1");
		expect(viewed.rawContent).toBe("# Setup");
		expect(viewed.path).toBe("guides/setup/doc-1 - Setup-Guide.md");

		const updated = await fetchJson<Document & { success: boolean }>("/api/docs/doc-1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Install Guide",
				content: "# Install",
				path: "runbooks",
			}),
		});

		expect(updated.success).toBe(true);
		expect(updated.title).toBe("Install Guide");
		expect(updated.path).toBe("runbooks/doc-1 - Install-Guide.md");
	});

	it("rejects unsafe document paths", async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/docs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Unsafe",
				content: "Content",
				path: "../outside",
			}),
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Document path cannot include traversal segments.");
	});

	it("rejects invalid document metadata", async () => {
		const invalidCreateTypeShape = await fetch(`http://127.0.0.1:${serverPort}/api/docs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Invalid Type",
				content: "Content",
				type: { name: "guide" },
			}),
		});
		expect(invalidCreateTypeShape.status).toBe(400);
		expect(await invalidCreateTypeShape.text()).toContain("Document type must be a string.");

		const invalidCreateType = await fetch(`http://127.0.0.1:${serverPort}/api/docs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Unsupported Type",
				content: "Content",
				type: "unexpected",
			}),
		});
		expect(invalidCreateType.status).toBe(400);
		expect(await invalidCreateType.text()).toContain("Document type must be one of");

		const invalidCreateTags = await fetch(`http://127.0.0.1:${serverPort}/api/docs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Invalid Tags",
				content: "Content",
				type: "guide",
				tags: [{ label: "setup" }],
			}),
		});
		expect(invalidCreateTags.status).toBe(400);
		expect(await invalidCreateTags.text()).toContain("Document tags must be an array of strings.");

		const created = await fetchJson<Document & { success: boolean }>("/api/docs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Valid Metadata",
				content: "Content",
				type: "guide",
				tags: ["setup"],
			}),
		});

		const invalidUpdateType = await fetch(`http://127.0.0.1:${serverPort}/api/docs/${created.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: "Updated",
				type: "unexpected",
			}),
		});
		expect(invalidUpdateType.status).toBe(400);
		expect(await invalidUpdateType.text()).toContain("Document type must be one of");

		const invalidUpdateTags = await fetch(`http://127.0.0.1:${serverPort}/api/docs/${created.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: "Updated",
				tags: [{ label: "setup" }],
			}),
		});
		expect(invalidUpdateTags.status).toBe(400);
		expect(await invalidUpdateTags.text()).toContain("Document tags must be an array of strings.");
	});

	it("preserves 500 status for unexpected document create and update failures", async () => {
		if (!server) {
			throw new Error("Expected server to be started");
		}
		const core = (
			server as unknown as {
				core: {
					createDocumentFromInput: (...args: unknown[]) => Promise<Document>;
					updateDocumentFromInput: (...args: unknown[]) => Promise<Document>;
				};
			}
		).core;

		core.createDocumentFromInput = async () => {
			throw new Error("disk full");
		};
		const createResponse = await fetch(`http://127.0.0.1:${serverPort}/api/docs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Create Failure",
				content: "Content",
				type: "guide",
			}),
		});
		expect(createResponse.status).toBe(500);
		expect(await createResponse.text()).toContain("Failed to create document");

		core.updateDocumentFromInput = async () => {
			throw new Error("rename failed");
		};
		const updateResponse = await fetch(`http://127.0.0.1:${serverPort}/api/docs/doc-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: "Updated",
				type: "guide",
			}),
		});
		expect(updateResponse.status).toBe(500);
		expect(await updateResponse.text()).toContain("Failed to update document");
	});
});

// The second file's raw frontmatter ID is a parameter: `doc-01` differs from `doc-1` as a raw
// map key, while an identical `doc-1` also collides inside the ContentStore's by-ID maps.
async function startServerWithColliding(secondDocumentId: string, secondDecisionId: string): Promise<void> {
	TEST_DIR = createUniqueTestDir("server-content-identity");
	const filesystem = new FileSystem(TEST_DIR);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Server Content Identity",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});

	const document = (id: string, title: string): string =>
		serializeDocument({ id, title, type: "other", createdDate: "2026-01-01 00:00", rawContent: title });
	const decision = (id: string, title: string): string =>
		serializeDecision({
			id,
			title,
			date: "2026-01-01 00:00",
			status: "proposed",
			context: "",
			decision: "",
			consequences: "",
			rawContent: "",
		});
	await Bun.write(join(filesystem.docsDir, "doc-1 - Alpha.md"), document("doc-1", "Alpha"));
	await Bun.write(join(filesystem.docsDir, "nested", "doc-01 - Beta.md"), document(secondDocumentId, "Beta"));
	await Bun.write(join(filesystem.decisionsDir, "decision-1 - Alpha.md"), decision("decision-1", "Alpha"));
	await Bun.write(join(filesystem.decisionsDir, "decision-01 - Beta.md"), decision(secondDecisionId, "Beta"));

	server = new BacklogServer(TEST_DIR);
	await server.start(0, false);
	const port = server.getPort();
	expect(port).not.toBeNull();
	serverPort = port ?? 0;

	await retry(async () => {
		await fetchJson<Document[]>("/api/docs");
	});
}

async function stopServer(): Promise<void> {
	if (server) {
		await server.stop();
		server = null;
	}
	await safeCleanup(TEST_DIR);
}

describe("BacklogServer ambiguous content identity", () => {
	beforeEach(async () => {
		await startServerWithColliding("doc-01", "decision-01");
	});

	afterEach(stopServer);

	it("answers 409 instead of picking a winner", async () => {
		const documentResponse = await fetch(`http://127.0.0.1:${serverPort}/api/docs/doc-1`);
		expect(documentResponse.status).toBe(409);
		const documentBody = await documentResponse.text();
		expect(documentBody).toContain("Document ID doc-1 is ambiguous");
		expect(documentBody).toContain("nested/doc-01 - Beta.md");

		const decisionResponse = await fetch(`http://127.0.0.1:${serverPort}/api/decisions/decision-1`);
		expect(decisionResponse.status).toBe(409);
		const decisionBody = await decisionResponse.text();
		expect(decisionBody).toContain("Decision ID decision-1 is ambiguous");
		expect(decisionBody).toContain("decision-01 - Beta.md");
	});

	it("answers 409 on writes and leaves every candidate file untouched", async () => {
		const filesystem = new FileSystem(TEST_DIR);
		const documentPath = join(filesystem.docsDir, "doc-1 - Alpha.md");
		const decisionPath = join(filesystem.decisionsDir, "decision-1 - Alpha.md");
		const documentBefore = await Bun.file(documentPath).text();
		const decisionBefore = await Bun.file(decisionPath).text();

		const documentResponse = await fetch(`http://127.0.0.1:${serverPort}/api/docs/doc-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Changed", content: "Changed body" }),
		});
		expect(documentResponse.status).toBe(409);
		expect(await documentResponse.text()).toContain("Document ID doc-1 is ambiguous");

		const decisionResponse = await fetch(`http://127.0.0.1:${serverPort}/api/decisions/decision-1`, {
			method: "PUT",
			headers: { "Content-Type": "text/plain" },
			body: "## Context\n\nChanged\n",
		});
		expect(decisionResponse.status).toBe(409);
		expect(await decisionResponse.text()).toContain("Decision ID decision-1 is ambiguous");

		expect(await Bun.file(documentPath).text()).toBe(documentBefore);
		expect(await Bun.file(decisionPath).text()).toBe(decisionBefore);
	});
});

describe("BacklogServer identical raw content IDs", () => {
	beforeEach(async () => {
		await startServerWithColliding("doc-1", "decision-1");
	});

	afterEach(stopServer);

	it("still answers 409 when both files carry the exact same frontmatter ID", async () => {
		const documentResponse = await fetch(`http://127.0.0.1:${serverPort}/api/docs/doc-1`);
		expect(documentResponse.status).toBe(409);
		const documentBody = await documentResponse.text();
		expect(documentBody).toContain("Document ID doc-1 is ambiguous; 2 files match:");
		expect(documentBody).toContain("doc-1 - Alpha.md");
		expect(documentBody).toContain("nested/doc-01 - Beta.md");

		const decisionResponse = await fetch(`http://127.0.0.1:${serverPort}/api/decisions/decision-1`);
		expect(decisionResponse.status).toBe(409);
		const decisionBody = await decisionResponse.text();
		expect(decisionBody).toContain("Decision ID decision-1 is ambiguous; 2 files match:");
		expect(decisionBody).toContain("decision-1 - Alpha.md");
		expect(decisionBody).toContain("decision-01 - Beta.md");
	});
});
