import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";

let projectDir: string;
let tarball: string;

describe("local bunx/npx execution", () => {
	const isWindows = platform() === "win32";
	beforeAll(async () => {
		projectDir = await mkdtemp(join(tmpdir(), "backlog-local-"));

		// Initialize npm project
		const initResult = await Bun.spawn(["npm", "init", "-y"], { cwd: projectDir }).exited;
		if (initResult !== 0) {
			throw new Error(`npm init failed with exit code ${initResult}`);
		}

		// Build the npm package (not the standalone executable)
		const buildResult = await Bun.spawn(["bun", "run", "build:npm"]).exited;
		if (buildResult !== 0) {
			throw new Error(`bun run build:npm failed with exit code ${buildResult}`);
		}

		// Pack the npm package
		const pack = Bun.spawnSync(["npm", "pack"], { stdout: "pipe", stderr: "pipe" });
		if (pack.exitCode !== 0) {
			throw new Error(`npm pack failed: ${pack.stderr.toString()}`);
		}

		const lines = pack.stdout.toString().trim().split("\n");
		tarball = lines[lines.length - 1] ?? "";
		if (!tarball) {
			throw new Error("Failed to get tarball filename from npm pack");
		}

		// Install the package
		const installResult = await Bun.spawn(["npm", "install", join(process.cwd(), tarball)], {
			cwd: projectDir,
			stdout: "pipe",
			stderr: "pipe",
		}).exited;

		if (installResult !== 0) {
			throw new Error(`npm install failed with exit code ${installResult}`);
		}
	});

	afterAll(async () => {
		// Wait a bit on Windows to avoid file locking issues
		if (platform() === "win32") {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		try {
			await rm(projectDir, { recursive: true, force: true });
		} catch (error) {
			console.warn("Failed to remove project dir:", error);
		}

		try {
			await rm(tarball, { force: true });
		} catch (error) {
			// Ignore tarball removal errors
		}
	});

	it("runs via npx", async () => {
		// On Windows, use cmd.exe to run npx
		const command = isWindows ? ["cmd", "/c", "npx", "backlog", "--help"] : ["npx", "backlog", "--help"];

		const proc = Bun.spawn(command, {
			cwd: projectDir,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, FORCE_COLOR: "0" }, // Disable color output
		});

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();

		if (exitCode !== 0) {
			console.error("npx command failed with exit code:", exitCode);
			console.error("stderr:", stderr);
			console.error("stdout:", stdout);
		}

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Backlog.md - Project management CLI");
	});

	it("runs via bunx", async () => {
		// On Windows, use cmd.exe to run bunx
		const command = isWindows ? ["cmd", "/c", "bun", "x", "backlog", "--help"] : ["bun", "x", "backlog", "--help"];

		const proc = Bun.spawn(command, {
			cwd: projectDir,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, FORCE_COLOR: "0" }, // Disable color output
		});

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();

		if (exitCode !== 0) {
			console.error("bunx command failed with exit code:", exitCode);
			console.error("stderr:", stderr);
			console.error("stdout:", stdout);
		}

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Backlog.md - Project management CLI");
	});
});
