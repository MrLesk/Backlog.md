import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let WORK_DIR: string;
let BARE_DIR: string;

async function revParse(dir: string, ref: string): Promise<string> {
	const { stdout } = await $`git rev-parse ${ref}`.cwd(dir).quiet();
	return stdout.toString().trim();
}

describe("Auto-push after commit", () => {
	let core: Core;

	beforeEach(async () => {
		BARE_DIR = `${createUniqueTestDir("auto-push-remote")}.git`;
		await mkdir(BARE_DIR, { recursive: true });
		await $`git init --bare -b main`.cwd(BARE_DIR).quiet();

		WORK_DIR = createUniqueTestDir("auto-push-work");
		await rm(WORK_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(WORK_DIR, { recursive: true });
		await $`git init -b main`.cwd(WORK_DIR).quiet();
		await $`git config user.email robot@host`.cwd(WORK_DIR).quiet();
		await $`git config user.name "Backlog Robot"`.cwd(WORK_DIR).quiet();
		await $`git remote add origin ${BARE_DIR}`.cwd(WORK_DIR).quiet();

		core = new Core(WORK_DIR);
		// Third arg seeds an initial commit; push it so origin/main exists.
		await initializeTestProject(core, "Auto Push Project", true);
		await $`git push -u origin main`.cwd(WORK_DIR).quiet();
	});

	afterEach(async () => {
		await safeCleanup(WORK_DIR);
		await safeCleanup(BARE_DIR);
	});

	it("pushes to the remote after a commit when autoPush is enabled", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("no config");
		config.autoCommit = true;
		config.autoPush = true;
		config.remoteOperations = true;
		await core.filesystem.saveConfig(config);

		await core.createTaskFromInput({ title: "Pushed automatically" }, true);

		const localHead = await revParse(WORK_DIR, "HEAD");
		const remoteHead = await revParse(BARE_DIR, "main");
		expect(remoteHead).toBe(localHead);
	});

	it("does not push when autoPush is disabled", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("no config");
		config.autoCommit = true;
		config.autoPush = false;
		config.remoteOperations = true;
		await core.filesystem.saveConfig(config);

		const remoteBefore = await revParse(BARE_DIR, "main");
		await core.createTaskFromInput({ title: "Local only" }, true);

		const localHead = await revParse(WORK_DIR, "HEAD");
		const remoteAfter = await revParse(BARE_DIR, "main");
		// the local repo advanced, the remote did not
		expect(localHead).not.toBe(remoteBefore);
		expect(remoteAfter).toBe(remoteBefore);
	});

	it("does not push when remoteOperations is disabled, even with autoPush", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("no config");
		config.autoCommit = true;
		config.autoPush = true;
		config.remoteOperations = false;
		await core.filesystem.saveConfig(config);

		const remoteBefore = await revParse(BARE_DIR, "main");
		await core.createTaskFromInput({ title: "No remote ops" }, true);

		const remoteAfter = await revParse(BARE_DIR, "main");
		expect(remoteAfter).toBe(remoteBefore);
	});
});
