import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;

describe("BacklogServer asset serving", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-assets");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();

		// ensure config so server starts cleanly
		await filesystem.saveConfig({
			projectName: "Server Assets",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		// create backlog/assets and nested dirs
		const backlogRoot = dirname(filesystem.docsDir);
		const assetsDir = join(backlogRoot, "assets");
		await mkdir(join(assetsDir, "images"), { recursive: true });
		await mkdir(join(assetsDir, "docs"), { recursive: true });

		// write a small test asset and a text file
		await Bun.write(join(assetsDir, "images", "test.png"), "PNGTEST");
		await Bun.write(join(assetsDir, "docs", "readme.txt"), "Hello assets\n");

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		// wait for server to be reachable
		await retry(
			async () => {
				const res = await fetch(`http://127.0.0.1:${serverPort}/`);
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

	it("serves existing image assets with appropriate Content-Type and body", async () => {
		const res = await fetch(`http://127.0.0.1:${serverPort}/assets/images/test.png`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/png");
		const body = await res.text();
		expect(body).toBe("PNGTEST");
	});

	it("serves text files with text/plain Content-Type", async () => {
		const res = await fetch(`http://127.0.0.1:${serverPort}/assets/docs/readme.txt`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("text/plain");
		const body = await res.text();
		expect(body).toBe("Hello assets\n");
	});

	it("returns 404 for missing files", async () => {
		const res = await fetch(`http://127.0.0.1:${serverPort}/assets/images/missing.png`);
		expect(res.status).toBe(404);
	});

	it("rejects path traversal attempts with 404", async () => {
		// attempt to escape assets via ..
		const res = await fetch(`http://127.0.0.1:${serverPort}/assets/../config.yml`);
		expect(res.status).toBe(404);

		// encoded traversal
		const res2 = await fetch(`http://127.0.0.1:${serverPort}/assets/%2e%2e/config.yml`);
		expect(res2.status).toBe(404);
	});
});
