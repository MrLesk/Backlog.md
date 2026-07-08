import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { platform } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { $ } from "bun";
import { createUniqueTestDir, getPlatformTimeout, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const isWindows = platform() === "win32";
const executableName = isWindows ? "backlog.exe" : "backlog";

function withTimeout<T>(operation: Promise<T>, label: string, timeoutMs: number, details: () => string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`${label} timed out after ${timeoutMs}ms.${details()}`));
		}, timeoutMs);

		operation.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function findAvailablePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close(() => reject(new Error("Unable to allocate test port.")));
				return;
			}
			server.close(() => resolve(address.port));
		});
	});
}

async function waitForHttp(url: string, isServerExited: () => boolean, timeoutMs: number): Promise<Response> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;

	while (Date.now() < deadline) {
		if (isServerExited()) {
			throw new Error("Compiled browser server exited before responding.");
		}

		try {
			const response = await fetch(url);
			if (response.ok) {
				return response;
			}
			lastError = new Error(`Unexpected status ${response.status}`);
		} catch (error) {
			lastError = error;
		}

		await sleep(100);
	}

	throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

describe("CLI packaging", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-build");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should build and run compiled executable", async () => {
		const OUTFILE = join(TEST_DIR, executableName);

		// Read version from package.json
		const packageJson = await Bun.file("package.json").json();
		const version = packageJson.version;

		try {
			const build = Bun.spawn(["bun", "scripts/build.ts"], {
				env: {
					...process.env,
					BACKLOG_BUILD_OUTFILE: OUTFILE,
					BACKLOG_BUILD_VERSION: version,
				},
				stderr: "pipe",
				stdout: "pipe",
			});
			const exitCode = await build.exited;
			if (exitCode !== 0) {
				const stderr = await new Response(build.stderr).text();
				throw new Error(stderr);
			}
		} catch (error: unknown) {
			// Skip test if build fails due to cross-filesystem issues (e.g., virtiofs)
			// This is environment-specific and doesn't indicate a code problem
			const err = error as { stderr?: { toString(): string } };
			const errorMsg = err?.stderr?.toString() || String(error);
			if (errorMsg.includes("failed to rename") || errorMsg.includes("ENOENT")) {
				console.warn("Skipping build test due to cross-filesystem limitation");
				return;
			}
			throw error;
		}

		const helpResult = await $`${OUTFILE} --help`.quiet();
		const helpOutput = helpResult.stdout.toString();
		expect(helpOutput).toContain("Backlog.md - Project management CLI");

		// Also test version command
		const versionResult = await $`${OUTFILE} --version`.quiet();
		const versionOutput = versionResult.stdout.toString().trim();
		expect(versionOutput).toBe(version);

		const port = await findAvailablePort();
		const browserServer = Bun.spawn([OUTFILE, "browser", "--no-open", "--non-interactive", "--port", String(port)], {
			cwd: process.cwd(),
			stderr: "pipe",
			stdout: "ignore",
		});
		let browserServerExited = false;
		void browserServer.exited.then(() => {
			browserServerExited = true;
		});

		try {
			const baseUrl = `http://127.0.0.1:${port}`;
			const htmlResponse = await waitForHttp(`${baseUrl}/`, () => browserServerExited, getPlatformTimeout(8000));
			expect(htmlResponse.headers.get("cache-control")).toBe("no-store, max-age=0, must-revalidate");

			const html = await htmlResponse.text();
			const stylesheetPath = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
			const scriptPath = html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
			const faviconPath = html.match(/<link rel="icon"[^>]*href="([^"]+)"/)?.[1];

			expect(stylesheetPath).toMatch(/^\/chunk-[a-z0-9]+\.css$/);
			expect(scriptPath).toMatch(/^\/chunk-[a-z0-9]+\.js$/);
			expect(faviconPath).toMatch(/^\/favicon-[a-z0-9]+\.png$/);

			const stylesheetResponse = await fetch(`${baseUrl}${stylesheetPath}`);
			expect(stylesheetResponse.status).toBe(200);
			expect(stylesheetResponse.headers.get("content-type")).toContain("text/css");
			const stylesheet = await stylesheetResponse.text();
			expect(stylesheet).toContain(".flex{display:flex}");
			expect(stylesheet).toContain(".wmde-markdown");

			const scriptResponse = await fetch(`${baseUrl}${scriptPath}`, { method: "HEAD" });
			expect(scriptResponse.status).toBe(200);
			expect(scriptResponse.headers.get("content-type")).toContain("text/javascript");

			const faviconResponse = await fetch(`${baseUrl}${faviconPath}`, { method: "HEAD" });
			expect(faviconResponse.status).toBe(200);
			expect(faviconResponse.headers.get("content-type")).toContain("image/png");
		} finally {
			browserServer.kill();
			await browserServer.exited.catch(() => {});
		}

		const timeout = getPlatformTimeout(8000);
		let stderr = "";
		const transport = new StdioClientTransport({
			command: OUTFILE,
			args: ["mcp", "start", "--cwd", process.cwd(), "--debug"],
			cwd: process.cwd(),
			stderr: "pipe",
		});
		transport.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		const client = new Client({ name: "Compiled MCP Smoke Test", version: "1.0.0" }, { capabilities: {} });
		try {
			await withTimeout(client.connect(transport), "connect", timeout, () => ` stderr:\n${stderr}`);

			const tools = await withTimeout(client.listTools(), "listTools", timeout, () => ` stderr:\n${stderr}`);
			expect(tools.tools.map((tool) => tool.name)).toContain("task_list");

			const resources = await withTimeout(
				client.listResources(),
				"listResources",
				timeout,
				() => ` stderr:\n${stderr}`,
			);
			expect(resources.resources.map((resource) => resource.uri)).toContain("backlog://workflow/overview");
		} finally {
			await client.close().catch(() => {});
		}
	});
});
