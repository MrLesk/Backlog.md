import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const isWindows = platform() === "win32";
const executableName = isWindows ? "backlog.exe" : "backlog";

describe("CLI packaging", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-build");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should build and run compiled executable", async () => {
		const OUTFILE = join(TEST_DIR, executableName);

		// Read version from package.json
		const packageJson = await Bun.file("package.json").json();
		const version = packageJson.version;

		await $`bun build src/cli.ts --compile --define __EMBEDDED_VERSION__="\"${version}\"" --outfile ${OUTFILE}`.quiet();

		const helpResult = await $`${OUTFILE} --help`.quiet();
		const helpOutput = helpResult.stdout.toString();
		expect(helpOutput).toContain("Backlog.md - Project management CLI");

		// Also test version command
		const versionResult = await $`${OUTFILE} --version`.quiet();
		const versionOutput = versionResult.stdout.toString().trim();
		expect(versionOutput).toBe(version);
	});
});
