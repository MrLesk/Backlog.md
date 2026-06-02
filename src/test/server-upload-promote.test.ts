import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { utimes } from "node:fs/promises";
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

describe("BacklogServer upload and promote", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-upload");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();

		await filesystem.saveConfig({
			projectName: "Upload Test",
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

	it("uploads a file via multipart/form-data to temp directory", async () => {
		const formData = new FormData();
		formData.append("file", new Blob(["fake-png-data"], { type: "image/png" }), "screenshot.png");

		const res = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			body: formData,
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.url).toMatch(/^\/assets\/\.temp\/[\w-]+\.png$/);

		// Verify file exists on disk
		const backlogRoot = dirname(filesystem.docsDir);
		const assetsDir = join(backlogRoot, "assets");
		const tempFile = join(assetsDir, ".temp", data.url.replace("/assets/.temp/", ""));
		const file = Bun.file(tempFile);
		expect(await file.exists()).toBe(true);
		expect(await file.text()).toBe("fake-png-data");
	});

	it("uploads a file via JSON dataUri to temp directory", async () => {
		const base64 = btoa("hello-image");
		const dataUri = `data:image/png;base64,${base64}`;

		const res = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dataUri }),
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.url).toMatch(/^\/assets\/\.temp\/[\w-]+\.png$/);

		const backlogRoot = dirname(filesystem.docsDir);
		const assetsDir = join(backlogRoot, "assets");
		const tempFile = join(assetsDir, ".temp", data.url.replace("/assets/.temp/", ""));
		const file = Bun.file(tempFile);
		expect(await file.exists()).toBe(true);
	});

	it("rejects upload without file", async () => {
		const formData = new FormData();
		const res = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			body: formData,
		});
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe("No file provided");
	});

	it("rejects upload with unsupported content type", async () => {
		const res = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: "hello",
		});
		expect(res.status).toBe(400);
	});

	it("promotes temp assets to paste directory", async () => {
		// Upload a temp file first
		const formData = new FormData();
		formData.append("file", new Blob(["promote-me"], { type: "image/png" }), "test.png");
		const uploadRes = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			body: formData,
		});
		const uploadData = await uploadRes.json();
		const tempUrl = uploadData.url;

		// Promote it
		const promoteRes = await fetchWithTimeout("/api/assets/promote", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ urls: [tempUrl] }),
		});
		expect(promoteRes.status).toBe(200);
		const promoteData = await promoteRes.json();
		expect(promoteData[tempUrl]).toMatch(/^\/assets\/paste\/[\w-]+\.png$/);

		// Verify temp file is gone and paste file exists
		const backlogRoot = dirname(filesystem.docsDir);
		const assetsDir = join(backlogRoot, "assets");
		const tempPath = join(assetsDir, ".temp", tempUrl.replace("/assets/.temp/", ""));
		const pastePath = join(assetsDir, "paste", promoteData[tempUrl].replace("/assets/paste/", ""));

		expect(await Bun.file(tempPath).exists()).toBe(false);
		expect(await Bun.file(pastePath).exists()).toBe(true);
		expect(await Bun.file(pastePath).text()).toBe("promote-me");
	});

	it("ignores invalid URLs during promote", async () => {
		const res = await fetchWithTimeout("/api/assets/promote", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ urls: ["/assets/paste/already-promoted.png", "/assets/../escape.png"] }),
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(Object.keys(data)).toHaveLength(0);
	});

	it("blocks download from localhost", async () => {
		const res = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: "http://localhost:8080/image.png" }),
		});
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe("Failed to download image");
	});

	it("blocks download from private IP", async () => {
		const res = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: "http://192.168.1.1/image.png" }),
		});
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe("Failed to download image");
	});

	it("cleans up temp assets older than 30 min on server start", async () => {
		// Upload two temp files
		const formData1 = new FormData();
		formData1.append("file", new Blob(["old"], { type: "image/png" }), "old.png");
		const uploadRes1 = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			body: formData1,
		});
		const uploadData1 = await uploadRes1.json();
		const oldUrl = uploadData1.url;

		const formData2 = new FormData();
		formData2.append("file", new Blob(["fresh"], { type: "image/png" }), "fresh.png");
		const uploadRes2 = await fetchWithTimeout("/api/upload?temp=1", {
			method: "POST",
			body: formData2,
		});
		const uploadData2 = await uploadRes2.json();
		const freshUrl = uploadData2.url;

		const backlogRoot = dirname(filesystem.docsDir);
		const assetsDir = join(backlogRoot, "assets");
		const oldPath = join(assetsDir, ".temp", oldUrl.replace("/assets/.temp/", ""));
		const freshPath = join(assetsDir, ".temp", freshUrl.replace("/assets/.temp/", ""));

		// Age the first file to 31 minutes ago
		const agedTime = new Date(Date.now() - 31 * 60 * 1000);
		await utimes(oldPath, agedTime, agedTime);

		// Stop and restart the server
		if (server) {
			await server.stop();
			server = null;
		}
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

		// Give cleanup a moment to run (it's async)
		await new Promise((resolve) => setTimeout(resolve, 200));

		expect(await Bun.file(oldPath).exists()).toBe(false);
		expect(await Bun.file(freshPath).exists()).toBe(true);
	});
});
