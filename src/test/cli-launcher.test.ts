import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLauncherInstall, waitUntil } from "./test-utils.ts";

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
	return spawnSync("node", [join(dir, "cli.cjs"), ...args], { encoding: "utf8" });
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

const binaryPids: number[] = [];

function isRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** Start the launcher in its own process group, as a terminal starts a foreground command. */
async function startSignalFixture(handledSignals: string[]) {
	const dir = await createLauncherDir(SIGNAL_FIXTURE_BINARY);
	const launcher = spawn("node", [join(dir, "cli.cjs"), ...handledSignals], {
		stdio: ["ignore", "pipe", "pipe"],
		detached: true,
	});
	let output = "";
	launcher.stdout.on("data", (chunk) => {
		output += chunk;
	});
	const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
		launcher.on("exit", (code, signal) => resolve({ code, signal }));
	});
	await waitUntil(() => /ready \d+/.test(output), "the fixture binary to start");
	const binaryPid = Number(output.match(/ready (\d+)/)?.[1]);
	binaryPids.push(binaryPid);
	return { launcher, exited, binaryPid, output: () => output };
}

describe.skipIf(isWindows)("launcher signal handling", () => {
	afterEach(() => {
		for (const pid of binaryPids.splice(0)) {
			if (isRunning(pid)) process.kill(pid, "SIGKILL");
		}
	});

	for (const signal of ["SIGTERM", "SIGHUP", "SIGQUIT"] as const) {
		it(`forwards ${signal} sent to the launcher and exits with the binary's code`, async () => {
			const fixture = await startSignalFixture([signal]);
			fixture.launcher.kill(signal);
			expect(await fixture.exited).toEqual({ code: 3, signal: null });
			await waitUntil(() => fixture.output().includes("received"), "the binary to report");
			expect(fixture.output()).toContain(`received ${signal}\n`);
			expect(isRunning(fixture.binaryPid)).toBe(false);
		});
	}

	it("exits with 128 + the signal number when the forwarded signal kills the binary", async () => {
		const fixture = await startSignalFixture([]);
		fixture.launcher.kill("SIGTERM");
		expect(await fixture.exited).toEqual({ code: 128 + 15, signal: null });
		expect(isRunning(fixture.binaryPid)).toBe(false);
	});

	it("waits for the binary on Ctrl+C without delivering SIGINT to it twice", async () => {
		const fixture = await startSignalFixture(["SIGINT"]);
		// The terminal sends Ctrl+C to the whole foreground process group.
		process.kill(-(fixture.launcher.pid as number), "SIGINT");
		expect(await fixture.exited).toEqual({ code: 3, signal: null });
		await waitUntil(() => fixture.output().includes("received"), "the binary to report");
		expect(fixture.output()).toContain("received SIGINT\n");
	});
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
