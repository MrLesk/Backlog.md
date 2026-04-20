import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { writeProjectRegistry } from "../utils/project-registry.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

async function setupMultiProjectRepo(testDir: string): Promise<void> {
	await mkdir(testDir, { recursive: true });

	const webCore = new Core(testDir);
	await initializeTestProject(webCore, "Web App");

	const opsCore = new Core(testDir);
	await initializeTestProject(opsCore, "Ops");

	await mkdir(join(testDir, "apps", "web", "src"), { recursive: true });
	await mkdir(join(testDir, "services", "ops", "src"), { recursive: true });

	await writeProjectRegistry(testDir, {
		version: 1,
		defaultProject: "web-app",
		projects: [
			{ key: "web-app", path: "apps/web" },
			{ key: "ops", path: "services/ops" },
		],
	});
}

describe("CLI project resolution", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-cli-project-resolution");
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
		await setupMultiProjectRepo(testDir);
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("uses --project when provided", async () => {
		const result = await $`bun ${CLI_PATH} config get projectName --project ops`.cwd(testDir).nothrow();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).toBe(0);
		expect(output.trim()).toBe("Ops");
	});

	it("uses cwd path matches when no explicit project is provided", async () => {
		const cwd = join(testDir, "services", "ops", "src");
		const result = await $`bun ${CLI_PATH} config get projectName`.cwd(cwd).nothrow();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).toBe(0);
		expect(output.trim()).toBe("Ops");
	});

	it("fails with a helpful error when multiple projects exist and none resolves", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			projects: [
				{ key: "web-app", path: "apps/web" },
				{ key: "ops", path: "services/ops" },
			],
		});

		const result = await $`bun ${CLI_PATH} config get projectName`.cwd(testDir).nothrow();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).toBe(1);
		expect(output).toContain("Use --project <key>");
	});
});
