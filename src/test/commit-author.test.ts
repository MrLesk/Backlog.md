import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { runWithCommitAuthor } from "../git/commit-context.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Commit author from request context", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-commit-author");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email robot@host`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Backlog Robot"`.cwd(TEST_DIR).quiet();
		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Commit Author Project", true);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("sets the commit author from runWithCommitAuthor while keeping the committer", async () => {
		await runWithCommitAuthor("Jane Doe <jane@example.com>", async () => {
			await core.createTaskFromInput({ title: "Authored by Jane" }, true);
		});

		const { stdout } = await $`git log -1 --format=%an%x09%ae%x09%cn%x09%ce`.cwd(TEST_DIR).quiet();
		const [authorName, authorEmail, committerName, committerEmail] = stdout.toString().trim().split("\t");
		expect(authorName).toBe("Jane Doe");
		expect(authorEmail).toBe("jane@example.com");
		// committer stays the server/git identity
		expect(committerName).toBe("Backlog Robot");
		expect(committerEmail).toBe("robot@host");
	});

	it("falls back to the git identity when no author context is set", async () => {
		await core.createTaskFromInput({ title: "No context" }, true);

		const { stdout } = await $`git log -1 --format=%an%x09%ae`.cwd(TEST_DIR).quiet();
		const [authorName, authorEmail] = stdout.toString().trim().split("\t");
		expect(authorName).toBe("Backlog Robot");
		expect(authorEmail).toBe("robot@host");
	});
});
