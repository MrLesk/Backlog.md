import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { platform } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { createTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const isWindows = platform() === "win32";
const executableName = isWindows ? "backlog.exe" : "backlog";

describe("CLI packaging", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-build");
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

		try {
			await $`bun build src/cli.ts --compile --define __EMBEDDED_VERSION__="\"${version}\"" --outfile ${OUTFILE}`.quiet();
		} catch (error: unknown) {
			// Skip test if build fails due to cross-filesystem issues (e.g., virtiofs)
			// This is environment-specific and doesn't indicate a code problem
			const err = error as { stderr?: { toString(): string } };
			const errorMsg = err?.stderr?.toString() || String(error);
			if (errorMsg.includes("failed to rename") || errorMsg.includes("ENOENT")) {
				console.warn("Skipping build test due to cross-filesystem limitation");
				return;
			}
			throw error;
		}

		const helpResult = await $`${OUTFILE} --help`.quiet();
		const helpOutput = helpResult.stdout.toString();
		expect(helpOutput).toContain("Backlog.md - Project management CLI");

		// Also test version command
		const versionResult = await $`${OUTFILE} --version`.quiet();
		const versionOutput = versionResult.stdout.toString().trim();
		expect(versionOutput).toBe(version);
	});
});
