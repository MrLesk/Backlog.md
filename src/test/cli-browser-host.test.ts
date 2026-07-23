import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { type ChildProcessByStdio, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import {
	closeServer,
	createUniqueTestDir,
	initializeTestProject,
	listenOnEphemeralPort,
	safeCleanup,
} from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
type BrowserProcess = ChildProcessByStdio<null, Readable, Readable>;

let TEST_DIR: string;

async function waitForOutput(child: BrowserProcess, expected: string): Promise<string> {
	let output = "";
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error(`Timed out waiting for "${expected}". Output:\n${output}`));
		}, 10000);
		const onData = (chunk: Buffer) => {
			output += chunk.toString();
			if (output.includes(expected)) {
				cleanup();
				resolve(output);
			}
		};
		const onExit = (code: number | null) => {
			cleanup();
			reject(new Error(`Process exited with code ${code} before "${expected}". Output:\n${output}`));
		};
		const cleanup = () => {
			clearTimeout(timer);
			child.stdout.off("data", onData);
			child.stderr.off("data", onData);
			child.off("exit", onExit);
		};

		child.stdout.on("data", onData);
		child.stderr.on("data", onData);
		child.once("exit", onExit);
	});
}

async function stopChild(child: BrowserProcess): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return;
	await new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill("SIGKILL");
			}
			resolve();
		}, 2000);
		child.once("exit", () => {
			clearTimeout(timer);
			resolve();
		});
		child.kill();
	});
}

describe("browser command --host flag", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-browser-host");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Browser Host Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("accepts an opt-in --host flag and starts the server instead of rejecting it as unknown", async () => {
		const { server: portProbe, port } = await listenOnEphemeralPort();
		await closeServer(portProbe);

		const child = spawn("bun", [CLI_PATH, "browser", "--host", "0.0.0.0", "--port", String(port), "--no-open"], {
			cwd: TEST_DIR,
			env: { ...process.env, NO_COLOR: "1" },
			stdio: ["ignore", "pipe", "pipe"],
		});

		try {
			const output = await waitForOutput(child, "browser interface running");
			expect(output).not.toContain("unknown option");
		} finally {
			await stopChild(child);
		}
	});
});
