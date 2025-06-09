import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const TEST_DIR = join(process.cwd(), "test-build");
const OUTFILE = join(TEST_DIR, "backlog");

describe("CLI packaging", () => {
	beforeEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
	});

	it("should build and run compiled executable", async () => {
		await Bun.spawn(["bun", "build", "src/cli.ts", "--compile", "--outfile", OUTFILE]).exited;

		const result = Bun.spawnSync({ cmd: [OUTFILE, "--help"] });
		const output = result.stdout.toString();
		expect(output).toContain("Backlog project management CLI");
	});
});
