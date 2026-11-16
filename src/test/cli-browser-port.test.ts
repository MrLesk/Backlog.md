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
	initializeFilesystemTestProject,
	listenOnEphemeralPort,
	safeCleanup,
} from "./test-utils.ts";

// This suite exercises browser assets that are embedded only in the compiled release binary.
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

describe("browser command port selection", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-browser-port");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Browser Port Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("auto-selects the next available port without prompting in non-TTY runs", async () => {
		const { server, port } = await listenOnEphemeralPort();
		const child = spawn("bun", [CLI_PATH, "browser", "--port", String(port), "--no-open"], {
			cwd: TEST_DIR,
			env: { ...process.env, NO_COLOR: "1" },
			stdio: ["ignore", "pipe", "pipe"],
		});

		try {
			const output = await waitForOutput(child, "browser interface running");
			expect(output).toContain(`Port ${port} is already in use. Using port`);
			expect(output).not.toContain("Start on port");
			expect(output).toContain("http://127.0.0.1:");
			expect(output).not.toContain("Opening browser");
		} finally {
			await stopChild(child);
			await closeServer(server);
		}
	});

	it.each([
		{ saved: "0.0.0.0", override: undefined, remote: true },
		{ saved: "0.0.0.0", override: "127.0.0.1", remote: false },
		{ saved: "127.0.0.1", override: "0.0.0.0", remote: true },
	])("warns according to the effective host without changing config: %j", async ({ saved, override, remote }) => {
		const core = new Core(TEST_DIR);
		const before = await core.filesystem.loadConfig();
		if (!before) throw new Error("Missing fixture config");
		await core.filesystem.saveConfig({ ...before, browserHostname: saved });
		const probe = await listenOnEphemeralPort();
		await closeServer(probe.server);
		const child = spawn(
			"bun",
			[
				CLI_PATH,
				"browser",
				...(override ? ["--host", override] : []),
				"--port",
				String(probe.port),
				"--no-open",
				"--non-interactive",
			],
			{
				cwd: TEST_DIR,
				env: { ...process.env, NO_COLOR: "1" },
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		try {
			const output = await waitForOutput(child, "browser interface running");
			expect(output).not.toContain("Opening browser");
			expect((await fetch(`http://127.0.0.1:${probe.port}/api/status`)).status).toBe(200);
			if (remote) {
				expect(stderr).toContain("INSECURE REMOTE ACCESS");
				expect(stderr).toContain("commands");
			} else {
				expect(stderr).not.toContain("INSECURE REMOTE ACCESS");
			}
			expect(stderr).not.toContain("\u001b[");
			const config = await new Core(TEST_DIR).filesystem.loadConfig();
			expect(config?.browserHostname).toBe(saved);
		} finally {
			await stopChild(child);
		}
	});

	it("documents the safe default and the one-run hostname override", async () => {
		const output = await $`bun ${CLI_PATH} browser --help`.cwd(TEST_DIR).text();

		expect(output).toContain("127.0.0.1");
		expect(output).toContain("--host <hostname>");
		expect(output).not.toContain("browserHostname");
		expect(output).toContain("INSECURE REMOTE ACCESS");
		expect(output).toContain("authentication");
		expect(output).toContain("commands");
		expect(output).toContain("not encrypted");
	});
});
