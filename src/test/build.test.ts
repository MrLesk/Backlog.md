import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
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
			await $`bun build src/cli.ts --compile --minify --define __EMBEDDED_VERSION__="\"${version}\"" --outfile ${OUTFILE}`.quiet();
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
