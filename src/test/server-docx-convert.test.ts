import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { dirname, join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;

async function fetchWithTimeout(path: string, options: RequestInit = {}, timeoutMs = 1000): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(`http://127.0.0.1:${serverPort}${path}`, { ...options, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

describe("BacklogServer docx convert", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-docx");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();

		await filesystem.saveConfig({
			projectName: "Docx Test",
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

		await retry(
			async () => {
				const res = await fetchWithTimeout("/api/status", {}, 500);
				if (!res.ok) throw new Error("server not ready");
				return true;
			},
			10,
			50,
		);
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("rejects conversion without file", async () => {
		const formData = new FormData();
		const res = await fetchWithTimeout("/api/docx/convert", {
			method: "POST",
			body: formData,
		});
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe("No file provided");
	});

	it("rejects non-docx files", async () => {
		const formData = new FormData();
		formData.append("file", new Blob(["not a docx"], { type: "text/plain" }), "readme.txt");
		const res = await fetchWithTimeout("/api/docx/convert", {
			method: "POST",
			body: formData,
		});
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe("Only .docx files are supported");
	});

	it("converts a simple docx to markdown", async () => {
		const docxPath = join(import.meta.dir, "../../node_modules/mammoth/test/test-data/single-paragraph.docx");
		const buffer = await Bun.file(docxPath).arrayBuffer();

		const formData = new FormData();
		formData.append(
			"file",
			new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
			"test.docx",
		);

		const res = await fetchWithTimeout("/api/docx/convert", {
			method: "POST",
			body: formData,
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(typeof data.html).toBe("string");
		expect(data.html.length).toBeGreaterThan(0);
		expect(Array.isArray(data.images)).toBe(true);
		expect(Array.isArray(data.messages)).toBe(true);
	});

	it("extracts images from docx and saves to temp directory", async () => {
		const docxPath = join(import.meta.dir, "../../node_modules/mammoth/test/test-data/tiny-picture.docx");
		const buffer = await Bun.file(docxPath).arrayBuffer();

		const formData = new FormData();
		formData.append(
			"file",
			new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
			"image.docx",
		);

		const res = await fetchWithTimeout("/api/docx/convert", {
			method: "POST",
			body: formData,
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.images.length).toBeGreaterThan(0);

		const tempUrl = data.images[0].tempUrl;
		expect(tempUrl).toMatch(/^\/assets\/\.temp\/[\w-]+\.png$/);

		// Verify file exists on disk
		const backlogRoot = dirname(filesystem.docsDir);
		const assetsDir = join(backlogRoot, "assets");
		const tempFile = join(assetsDir, ".temp", tempUrl.replace("/assets/.temp/", ""));
		expect(await Bun.file(tempFile).exists()).toBe(true);
	});
});
