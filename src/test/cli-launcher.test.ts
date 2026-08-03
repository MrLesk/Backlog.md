import { afterAll, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getCandidatePackageNames } = require("../../scripts/resolveBinary.cjs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isBinaryInstallError } = require("../../scripts/cli.cjs");

const isWindows = process.platform === "win32";
const scriptsDir = join(import.meta.dir, "..", "..", "scripts");
const tempDirs: string[] = [];

/** Copy the launcher scripts into a temp dir with an optional fixture platform binary. */
async function createLauncherDir(binaryContent?: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "backlog-launcher-"));
	tempDirs.push(dir);
	await cp(join(scriptsDir, "cli.cjs"), join(dir, "cli.cjs"));
	await cp(join(scriptsDir, "resolveBinary.cjs"), join(dir, "resolveBinary.cjs"));
	// A package.json and node_modules dir keep Bun's auto-install from resolving real packages
	await writeFile(join(dir, "package.json"), "{}");
	await mkdir(join(dir, "node_modules"), { recursive: true });
	if (binaryContent !== undefined) {
		const [packageName] = getCandidatePackageNames();
		const packageDir = join(dir, "node_modules", packageName);
		await mkdir(packageDir, { recursive: true });
		const binaryPath = join(packageDir, isWindows ? "backlog.exe" : "backlog");
		await writeFile(binaryPath, binaryContent);
		await chmod(binaryPath, 0o755);
	}
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

	it.skipIf(isWindows)("prints architecture guidance when the binary dies with SIGILL", async () => {
		const dir = await createLauncherDir("#!/bin/sh\nkill -ILL $$\n");
		const result = runLauncher(dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("backlog crashed with SIGILL");
		expect(result.stderr).toContain("different CPU architecture");
		expect(result.stderr).toContain("Detected:");
	});

	it.skipIf(isWindows)("exits with 128+signal for other signal deaths", async () => {
		const dir = await createLauncherDir("#!/bin/sh\nkill -TERM $$\n");
		const result = runLauncher(dir);
		expect(result.status).toBe(128 + 15);
	});

	it.skipIf(isWindows)("prints install guidance when the binary is not executable (ENOEXEC)", async () => {
		// No shebang and not a real executable: exec fails with ENOEXEC (sync throw or 'error' event)
		const dir = await createLauncherDir("not-a-binary");
		const result = runLauncher(dir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("Cannot execute");
		expect(result.stderr).toContain("was built for a different CPU architecture");
		expect(result.stderr).toContain("Detected:");
	});
});

describe("isBinaryInstallError", () => {
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
});
