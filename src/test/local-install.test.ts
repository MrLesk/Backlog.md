import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let projectDir: string;
let tarball: string;

describe("local bunx/npx execution", () => {
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
		await rm(projectDir, { recursive: true, force: true });
		await rm(tarball, { force: true }).catch(() => {});
	});

	it("runs via npx", () => {
		const result = Bun.spawnSync(["npx", "backlog", "--help"], {
			cwd: projectDir,
			stdout: "pipe",
			stderr: "pipe",
		});

		if (result.exitCode !== 0) {
			console.error("npx command failed with exit code:", result.exitCode);
			console.error("stderr:", result.stderr.toString());
			console.error("stdout:", result.stdout.toString());
		}

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Backlog.md - Project management CLI");
	});

	it("runs via bunx", () => {
		const result = Bun.spawnSync(["bun", "x", "backlog", "--help"], {
			cwd: projectDir,
			stdout: "pipe",
			stderr: "pipe",
		});

		if (result.exitCode !== 0) {
			console.error("bunx command failed with exit code:", result.exitCode);
			console.error("stderr:", result.stderr.toString());
			console.error("stdout:", result.stdout.toString());
		}

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Backlog.md - Project management CLI");
	});
});
