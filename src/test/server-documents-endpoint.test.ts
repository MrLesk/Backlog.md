import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
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
