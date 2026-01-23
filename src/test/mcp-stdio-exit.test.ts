import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createUniqueTestDir, getPlatformTimeout, isWindows, safeCleanup, sleep } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const START_MESSAGE = "Backlog.md MCP server started (stdio transport)";

let TEST_DIR: string;

type ExitResult = { code: number | null; signal: NodeJS.Signals | null };

function waitForSubstring(stream: NodeJS.ReadableStream, substring: string, timeoutMs: number): Promise<void> {
	return new Promise((resolve, reject) => {
		let buffer = "";
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error(`Timed out waiting for: ${substring}`));
		}, timeoutMs);

		const onData = (chunk: Buffer) => {
			buffer += chunk.toString();
			if (buffer.includes(substring)) {
				cleanup();
				resolve();
			}
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const onEnd = () => {
			cleanup();
			reject(new Error(`Stream ended before receiving: ${substring}`));
		};

		const cleanup = () => {
			clearTimeout(timer);
			stream.off("data", onData);
			stream.off("error", onError);
			stream.off("end", onEnd);
		};

		stream.on("data", onData);
		stream.on("error", onError);
		stream.on("end", onEnd);
	});
}

function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<ExitResult> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error("Timed out waiting for MCP process to exit"));
		}, timeoutMs);

		child.once("exit", (code, signal) => {
			clearTimeout(timer);
			resolve({ code, signal });
		});
	});
}

describe("MCP stdio shutdown", () => {
	const itIfNotWindows = isWindows() ? it.skip : it;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-stdio");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	itIfNotWindows("exits when stdin closes", async () => {
		const timeout = getPlatformTimeout(4000);
		const child = spawn("bun", [CLI_PATH, "mcp", "start", "--debug"], {
			cwd: TEST_DIR,
			stdio: ["pipe", "pipe", "pipe"],
		});

		if (!child.stderr || !child.stdin) {
			child.kill("SIGKILL");
			throw new Error("Failed to spawn MCP process with stdio pipes");
		}

		await waitForSubstring(child.stderr, START_MESSAGE, timeout);
		await sleep(50);
		child.stdin.end();

		const result = await waitForExit(child, timeout);
		expect(result.code).toBe(0);
		expect(result.signal).toBeNull();
	});
});
