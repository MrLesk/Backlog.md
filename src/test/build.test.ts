import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";

const TEST_DIR = join(process.cwd(), "test-build");
const isWindows = platform() === "win32";
const executableName = isWindows ? "backlog.exe" : "backlog";
const OUTFILE = join(TEST_DIR, executableName);

describe("CLI packaging", () => {
	beforeEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
	});

	it("should build and run compiled executable", async () => {
		// Read version from package.json
		const packageJson = await Bun.file("package.json").json();
		const version = packageJson.version;

		await Bun.spawn([
			"bun",
			"build",
			"src/cli.ts",
			"--compile",
			"--external",
			"blessed",
			"--define",
			`__EMBEDDED_VERSION__="${version}"`,
			"--outfile",
			OUTFILE,
		]).exited;

		const helpResult = Bun.spawnSync({ cmd: [OUTFILE, "--help"] });
		const helpOutput = helpResult.stdout.toString();
		expect(helpOutput).toContain("Backlog.md - Project management CLI");

		// Also test version command
		const versionResult = Bun.spawnSync({ cmd: [OUTFILE, "--version"] });
		const versionOutput = versionResult.stdout.toString().trim();
		expect(versionOutput).toBe(version);
	});
});
