import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let projectDir: string;
let tarball: string;

describe("local bunx/npx execution", () => {
	beforeAll(async () => {
		projectDir = await mkdtemp(join(tmpdir(), "backlog-local-"));
		await Bun.spawn(["npm", "init", "-y"], { cwd: projectDir }).exited;
		await Bun.spawn(["bun", "run", "build"]).exited;
		const pack = Bun.spawnSync(["npm", "pack"], { stdout: "pipe" });
		const lines = pack.stdout.toString().trim().split("\n");
		tarball = lines[lines.length - 1] ?? "";
		await Bun.spawn(["npm", "install", join(process.cwd(), tarball)], { cwd: projectDir }).exited;
	});

	afterAll(async () => {
		await rm(projectDir, { recursive: true, force: true });
		await rm(tarball, { force: true }).catch(() => {});
	});

	it("runs via npx", () => {
		const result = Bun.spawnSync(["npx", "backlog", "--help"], { cwd: projectDir });
		expect(result.stdout.toString()).toContain("Backlog.md - Project management CLI");
	});

	it("runs via bunx", () => {
		const result = Bun.spawnSync(["bun", "x", "backlog", "--help"], { cwd: projectDir });
		expect(result.stdout.toString()).toContain("Backlog.md - Project management CLI");
	});
});
