import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Core } from "../core/backlog.ts";
import { initializeProject } from "../core/init.ts";
import { createUniqueTestDir, getPlatformTimeout, isWindows, observeChildClose, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const START_MESSAGE = "Backlog.md MCP server started (stdio transport)";

let TEST_DIR: string;

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

function getText(content: unknown): string {
	if (!Array.isArray(content)) {
		return "";
	}

	const item = content[0];
	if (!item || typeof item !== "object" || !("text" in item)) {
		return "";
	}

	const text = (item as { text?: unknown }).text;
	return typeof text === "string" ? text : "";
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
		const childClose = observeChildClose(child, "MCP process", Math.min(timeout, 2000));
		const closeOutcome = childClose.result.then(
			(result) => ({ ok: true as const, result }),
			(error: unknown) => ({ ok: false as const, error }),
		);

		let primaryError: unknown;
		try {
			if (!child.stderr || !child.stdin) {
				throw new Error("Failed to spawn MCP process with stdio pipes");
			}

			await waitForSubstring(child.stderr, START_MESSAGE, timeout);
			child.stdin.end();
			childClose.startTimeout();

			const primaryCloseOutcome = await closeOutcome;
			if (!primaryCloseOutcome.ok) throw primaryCloseOutcome.error;
			expect(primaryCloseOutcome.result.code).toBe(0);
			expect(primaryCloseOutcome.result.signal).toBeNull();
		} catch (error) {
			primaryError = error;
		}

		childClose.startTimeout();
		let cleanupError: unknown;
		try {
			if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
		} catch (error) {
			cleanupError = error;
		}
		const cleanupCloseOutcome = await closeOutcome;
		if (!cleanupCloseOutcome.ok && cleanupCloseOutcome.error !== primaryError) {
			cleanupError =
				cleanupError === undefined
					? cleanupCloseOutcome.error
					: new AggregateError(
							[cleanupError, cleanupCloseOutcome.error],
							"MCP process kill and close wait both failed",
						);
		}

		if (primaryError !== undefined && cleanupError !== undefined) {
			throw new AggregateError([primaryError, cleanupError], "Test and MCP process cleanup both failed");
		}
		if (primaryError !== undefined) throw primaryError;
		if (cleanupError !== undefined) throw cleanupError;
	});

	it("keeps stdio sessions alive after listing tools so document calls can respond", async () => {
		const timeout = getPlatformTimeout(5000);
		const core = new Core(TEST_DIR);
		await initializeProject(core, {
			projectName: "MCP Stdio Document Project",
			integrationMode: "none",
			agentInstructions: [],
			advancedConfig: { autoCommit: false },
		});
		await core.disposeContentStore();

		let stderr = "";
		const transport = new StdioClientTransport({
			command: "bun",
			args: [CLI_PATH, "mcp", "start", "--cwd", TEST_DIR, "--debug"],
			cwd: process.cwd(),
			stderr: "pipe",
		});
		transport.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		const client = new Client({ name: "MCP Stdio Document Test", version: "1.0.0" }, { capabilities: {} });

		let primaryError: unknown;
		try {
			await withTimeout(client.connect(transport), "connect", timeout, () => ` stderr:\n${stderr}`);

			const tools = await withTimeout(client.listTools(), "listTools", timeout, () => ` stderr:\n${stderr}`);
			expect(tools.tools.map((tool) => tool.name)).toContain("document_create");

			const result = await withTimeout(
				client.callTool({
					name: "document_create",
					arguments: {
						title: "Stdio Repro Doc",
						content: "Created through stdio transport.",
					},
				}),
				"document_create",
				timeout,
				() => ` stderr:\n${stderr}`,
			);

			const text = getText(result.content);
			expect(text).toContain("Document created successfully.");
			expect(text).toContain("Document doc-1 - Stdio Repro Doc");
		} catch (error) {
			primaryError = error;
		}

		const child = (transport as unknown as { _process?: ReturnType<typeof spawn> })._process;
		const childClose = child ? observeChildClose(child, "MCP transport process", Math.min(timeout, 2000)) : undefined;
		childClose?.startTimeout();
		const exitOutcome = childClose
			? childClose.result.then(
					() => ({ error: undefined }),
					(error: unknown) => ({ error }),
				)
			: Promise.resolve({ error: undefined });
		let cleanupError: unknown;
		try {
			await client.close();
		} catch (error) {
			cleanupError = error;
		}
		const { error: exitError } = await exitOutcome;
		if (exitError !== undefined) {
			cleanupError =
				cleanupError === undefined
					? exitError
					: new AggregateError([cleanupError, exitError], "MCP client and process cleanup both failed");
		}

		if (primaryError !== undefined && cleanupError !== undefined) {
			throw new AggregateError([primaryError, cleanupError], "Test and MCP client cleanup both failed");
		}
		if (primaryError !== undefined) throw primaryError;
		if (cleanupError !== undefined) throw cleanupError;
	});
});
