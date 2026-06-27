import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, initializeTestProject, retry, safeCleanup } from "./test-utils.ts";

let BARE_DIR: string;
let SEED_DIR: string;
let OTHER_DIR: string;
let WEB_DIR: string;
let server: BacklogServer | null = null;

async function rev(dir: string, ref: string): Promise<string> {
	const { stdout } = await $`git rev-parse ${ref}`.cwd(dir).quiet();
	return stdout.toString().trim();
}

async function configGit(dir: string) {
	await $`git config user.email robot@host`.cwd(dir).quiet();
	await $`git config user.name "Backlog Robot"`.cwd(dir).quiet();
}

async function startServer(dir: string, autoPull: boolean): Promise<number> {
	const core = new Core(dir);
	const config = await core.filesystem.loadConfig();
	if (!config) throw new Error("no config");
	config.autoPull = autoPull;
	config.remoteOperations = true;
	await core.filesystem.saveConfig(config);

	server = new BacklogServer(dir);
	await server.start(0, false);
	const port = server.getPort();
	expect(port).toBeGreaterThan(0);
	return port ?? 0;
}

describe("BacklogServer auto-pull", () => {
	beforeEach(async () => {
		BARE_DIR = `${createUniqueTestDir("web-pull-remote")}.git`;
		await mkdir(BARE_DIR, { recursive: true });
		await $`git init --bare -b main`.cwd(BARE_DIR).quiet();

		SEED_DIR = createUniqueTestDir("web-pull-seed");
		await mkdir(SEED_DIR, { recursive: true });
		await $`git init -b main`.cwd(SEED_DIR).quiet();
		await configGit(SEED_DIR);
		await $`git remote add origin ${BARE_DIR}`.cwd(SEED_DIR).quiet();
		await initializeTestProject(new Core(SEED_DIR), "Web Pull Project", true);
		await $`git push -u origin main`.cwd(SEED_DIR).quiet();

		WEB_DIR = createUniqueTestDir("web-pull-web");
		await $`git clone ${BARE_DIR} ${WEB_DIR}`.quiet();
		await configGit(WEB_DIR);

		OTHER_DIR = createUniqueTestDir("web-pull-other");
		await $`git clone ${BARE_DIR} ${OTHER_DIR}`.quiet();
		await configGit(OTHER_DIR);
		await Bun.write(`${OTHER_DIR}/backlog/docs/remote-note.md`, "# remote change\n");
		await $`git add backlog/docs/remote-note.md`.cwd(OTHER_DIR).quiet();
		await $`git commit -m "docs: remote change"`.cwd(OTHER_DIR).quiet();
		await $`git push origin main`.cwd(OTHER_DIR).quiet();
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(BARE_DIR);
		await safeCleanup(SEED_DIR);
		await safeCleanup(OTHER_DIR);
		await safeCleanup(WEB_DIR);
	});

	it("pulls remote commits on an API request when autoPull is enabled", async () => {
		const remoteHead = await rev(BARE_DIR, "main");
		expect(await rev(WEB_DIR, "HEAD")).not.toBe(remoteHead);

		const port = await startServer(WEB_DIR, true);

		await retry(
			async () => {
				await fetch(`http://localhost:${port}/api/tasks`);
				const head = await rev(WEB_DIR, "HEAD");
				if (head !== remoteHead) throw new Error("not pulled yet");
				return head;
			},
			20,
			100,
		);

		expect(await rev(WEB_DIR, "HEAD")).toBe(remoteHead);
	});

	it("does not pull when autoPull is disabled", async () => {
		const before = await rev(WEB_DIR, "HEAD");
		const remoteHead = await rev(BARE_DIR, "main");
		expect(before).not.toBe(remoteHead);

		const port = await startServer(WEB_DIR, false);
		await fetch(`http://localhost:${port}/api/tasks`);
		// give any (unexpected) async pull a chance, then assert HEAD is unchanged
		await fetch(`http://localhost:${port}/api/tasks`);

		expect(await rev(WEB_DIR, "HEAD")).toBe(before);
	});
});
