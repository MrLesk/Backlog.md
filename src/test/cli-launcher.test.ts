import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import {
	closeServer,
	createLauncherInstall,
	initializeFilesystemTestProject,
	listenOnEphemeralPort,
	observeChildClose,
	waitUntil,
	withTimeout,
} from "./test-utils.ts";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getCandidatePackageNames } = require("../../scripts/resolveBinary.cjs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getSignalExitCode, isArchitectureSignal, isBinaryInstallError } = require("../../scripts/cli.cjs");

const isWindows = process.platform === "win32";
const tempDirs: string[] = [];

/** Copy the launcher scripts into a temp dir with an optional fixture platform binary. */
async function createLauncherDir(binaryContent?: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "backlog-launcher-"));
	tempDirs.push(dir);
	await createLauncherInstall(dir, binaryContent === undefined ? undefined : (path) => writeFile(path, binaryContent));
	return dir;
}

function runLauncher(dir: string, args: string[] = []) {
	// The published launcher has a Node shebang. Running it through the Bun test
	// process can deadlock when a fixture executable exits via a Unix signal.
	return spawnSync("node", [join(dir, "cli.cjs"), ...args], { encoding: "utf8", timeout: 5000 });
}

afterAll(async () => {
	await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("cli launcher", () => {
	it("prints install guidance and exits 1 when no platform package is installed", async () => {
		const dir = await createLauncherDir();
		const result = runLauncher(dir, ["--version"]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(`Binary package not installed for ${process.platform}-${process.arch}.`);
		expect(result.stderr).toContain(`Tried packages: ${getCandidatePackageNames().join(", ")}`);
		expect(result.stderr).toContain(`Detected: ${process.platform}-${process.arch}`);
	});

	it.skipIf(isWindows)("spawns the installed binary, forwarding args and exit code", async () => {
		const dir = await createLauncherDir('#!/bin/sh\necho "args: $@"\nexit 7\n');
		const result = runLauncher(dir, ["task", "list"]);
		expect(result.status).toBe(7);
		expect(result.stdout).toContain("args: task list");
	});
});

// A fixture binary that handles the signals named in its args: it records each delivery and exits
// with 3 a moment later, so a duplicate delivery is counted too. Other signals keep their default.
const SIGNAL_FIXTURE_BINARY = `#!/usr/bin/env node
const received = [];
for (const signal of process.argv.slice(2)) {
	process.on(signal, () => {
		received.push(signal);
		setTimeout(() => {
			console.log("received " + received.join(","));
			process.exit(3);
		}, 200);
	});
}
console.log("ready " + process.pid);
setInterval(() => {}, 1000);
`;

const signalFixtures: { launcher: ChildProcess; closed: ReturnType<typeof observeChildClose>; isClosed: boolean }[] =
	[];

function isRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
		throw error;
	}
}

/** Start the launcher in its own process group, as a terminal starts a foreground command. */
async function startSignalFixture(handledSignals: string[]) {
	const dir = await createLauncherDir(SIGNAL_FIXTURE_BINARY);
	return startLauncher(dir, handledSignals);
}

async function startLauncher(dir: string, args: string[]) {
	const launcher = spawn("node", [join(dir, "cli.cjs"), ...args], {
		cwd: dir,
		stdio: ["pipe", "pipe", "pipe"],
		detached: true,
	});
	// Own the whole group before waiting for readiness, including startup failure paths.
	const closed = observeChildClose(launcher, "fixture launcher", 2000);
	const fixture = { launcher, closed, isClosed: false };
	signalFixtures.push(fixture);
	void closed.result.catch(() => {});
	launcher.once("close", () => {
		fixture.isClosed = true;
	});
	let output = "";
	launcher.stdout.on("data", (chunk) => {
		output += chunk;
	});
	let errorOutput = "";
	launcher.stderr.on("data", (chunk) => {
		errorOutput += chunk;
	});
	launcher.once("error", (error) => {
		errorOutput += error.message;
	});
	await waitUntil(() => /ready \d+/.test(output) || fixture.isClosed, "the fixture binary to start", 3000);
	if (!/ready \d+/.test(output)) throw new Error(`Launcher exited before readiness: ${errorOutput}`);
	const binaryPid = Number(output.match(/ready (\d+)/)?.[1]);
	return {
		launcher,
		closed: () => withTimeout(closed.result, "the launcher and fixture to close", 3000),
		binaryPid,
		output: () => output,
	};
}

async function startShutdownOwner(owner: "browser" | "mcp") {
	const dir = await createLauncherDir();
	await createLauncherInstall(dir, (path) => copyFile(process.execPath, path));
	const core = new Core(dir);
	await initializeFilesystemTestProject(core, "Launcher shutdown");
	core.disposeContentStore();
	core.disposeSearchService();
	let args = ["mcp", "start"];
	if (owner === "browser") {
		const { server, port } = await listenOnEphemeralPort();
		await closeServer(server);
		args = ["browser", "--no-open", "--port", String(port)];
	}
	// Load the real CLI and server class in the same process. Only stop duration is changed:
	// the CLI still owns signal registration, its guard, exit status and actual resource cleanup.
	const module = join(import.meta.dir, "..", owner === "browser" ? "server/index.ts" : "mcp/server.ts");
	const className = owner === "browser" ? "BacklogServer" : "McpServer";
	const fixture = join(dir, "shutdown.ts");
	await writeFile(
		fixture,
		`import { ${className} as Server } from ${JSON.stringify(module)};
const start = Server.prototype.start;
Server.prototype.start = async function (...args) {
	await start.apply(this, args);
	setImmediate(() => console.log("ready " + process.pid));
};
const stop = Server.prototype.stop;
Server.prototype.stop = async function () {
	console.log("cleanup started");
	await Bun.sleep(300);
	await stop.call(this);
	console.log("cleanup completed");
};
process.argv = [process.argv[0], ${JSON.stringify(join(import.meta.dir, "..", "cli.ts"))}, ...${JSON.stringify(args)}];
await import(${JSON.stringify(join(import.meta.dir, "..", "cli.ts"))});
`,
	);
	return startLauncher(dir, [fixture]);
}

describe.skipIf(isWindows)("launcher signal handling", () => {
	afterEach(async () => {
		for (const fixture of signalFixtures.splice(0)) {
			if (!fixture.isClosed && fixture.launcher.pid) {
				try {
					process.kill(-fixture.launcher.pid, "SIGKILL");
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
				}
			}
			fixture.closed.startTimeout();
			await fixture.closed.result;
		}
	});

	for (const signal of ["SIGTERM", "SIGHUP", "SIGQUIT"] as const) {
		it(`forwards ${signal} sent to the launcher and exits with the binary's code`, async () => {
			const fixture = await startSignalFixture([signal]);
			fixture.launcher.kill(signal);
			expect(await fixture.closed()).toEqual({ code: 3, signal: null });
			expect(fixture.output()).toContain(`received ${signal}\n`);
			expect(isRunning(fixture.binaryPid)).toBe(false);
		});
	}

	it("exits with 128 + the signal number when the forwarded signal kills the binary", async () => {
		const fixture = await startSignalFixture([]);
		fixture.launcher.kill("SIGTERM");
		expect(await fixture.closed()).toEqual({ code: 128 + 15, signal: null });
		expect(isRunning(fixture.binaryPid)).toBe(false);
	});

	it("waits for the binary on Ctrl+C without delivering SIGINT to it twice", async () => {
		const fixture = await startSignalFixture(["SIGINT"]);
		// The terminal sends Ctrl+C to the whole foreground process group.
		process.kill(-(fixture.launcher.pid as number), "SIGINT");
		expect(await fixture.closed()).toEqual({ code: 3, signal: null });
		expect(fixture.output()).toContain("received SIGINT\n");
		expect(isRunning(fixture.binaryPid)).toBe(false);
	});

	it("keeps waiting after PID-only SIGINT until a forwarded termination signal stops the binary", async () => {
		const fixture = await startSignalFixture(["SIGINT", "SIGTERM"]);
		fixture.launcher.kill("SIGINT");
		await Bun.sleep(100);
		expect(fixture.launcher.exitCode).toBeNull();
		expect(fixture.launcher.signalCode).toBeNull();
		expect(isRunning(fixture.binaryPid)).toBe(true);
		fixture.launcher.kill("SIGTERM");
		expect(await fixture.closed()).toEqual({ code: 3, signal: null });
		expect(fixture.output()).toContain("received SIGTERM\n");
		expect(isRunning(fixture.binaryPid)).toBe(false);
	});

	for (const owner of ["browser", "mcp"] as const) {
		for (const signal of owner === "browser" ? ["SIGTERM", "SIGQUIT", "SIGINT"] : ["SIGTERM", "SIGHUP", "SIGINT"]) {
			it(`completes ${owner} cleanup once after group ${signal}`, async () => {
				const fixture = await startShutdownOwner(owner);
				process.kill(-(fixture.launcher.pid as number), signal as NodeJS.Signals);
				if (signal !== "SIGINT") {
					await waitUntil(
						() => fixture.output().includes("cleanup started") || fixture.launcher.exitCode !== null,
						"owner cleanup to start",
						2000,
					);
					// Repeat after cleanup starts as well, so signal coalescing cannot hide a once-handler regression.
					if (fixture.launcher.exitCode === null) {
						try {
							process.kill(-(fixture.launcher.pid as number), signal as NodeJS.Signals);
						} catch (error) {
							if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
						}
					}
				}
				expect(await fixture.closed()).toEqual({ code: 0, signal: null });
				expect(fixture.output().match(/cleanup started/g)).toHaveLength(1);
				expect(fixture.output().match(/cleanup completed/g)).toHaveLength(1);
				expect(isRunning(fixture.binaryPid)).toBe(false);
			});
		}

		it(`preserves the second Ctrl+C force exit during ${owner} cleanup`, async () => {
			const fixture = await startShutdownOwner(owner);
			process.kill(-(fixture.launcher.pid as number), "SIGINT");
			await waitUntil(() => fixture.output().includes("cleanup started"), "owner cleanup to start", 2000);
			process.kill(-(fixture.launcher.pid as number), "SIGINT");
			expect(await fixture.closed()).toEqual({ code: 130, signal: null });
			expect(fixture.output().match(/cleanup started/g)).toHaveLength(1);
			expect(fixture.output()).not.toContain("cleanup completed");
			expect(isRunning(fixture.binaryPid)).toBe(false);
		});
	}
});

describe("launcher error and signal mapping", () => {
	it("matches missing and wrong-architecture spawn failures", () => {
		expect(isBinaryInstallError({ errno: -86, code: "Unknown system error -86" })).toBe(true);
		expect(isBinaryInstallError({ code: "EBADARCH" })).toBe(true);
		expect(isBinaryInstallError({ code: "ENOEXEC", errno: -8 })).toBe(true);
		expect(isBinaryInstallError({ code: "ENOENT", errno: -2 })).toBe(true);
	});

	it("does not match unrelated spawn failures", () => {
		expect(isBinaryInstallError({ code: "EACCES", errno: -13 })).toBe(false);
		expect(isBinaryInstallError({})).toBe(false);
	});

	it("classifies architecture signals", () => {
		expect(isArchitectureSignal("SIGILL")).toBe(true);
		expect(isArchitectureSignal("SIGTRAP")).toBe(true);
		expect(isArchitectureSignal("SIGTERM")).toBe(false);
	});

	it.skipIf(isWindows)("maps Unix signals to conventional process exit codes", () => {
		expect(getSignalExitCode("SIGTERM")).toBe(128 + 15);
		expect(getSignalExitCode("UNKNOWN")).toBe(1);
	});
});
