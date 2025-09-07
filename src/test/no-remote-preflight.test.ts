import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, join as joinPath } from "node:path";
import { $ } from "bun";
import { loadRemoteTasks } from "../core/remote-tasks.ts";
import { GitOperations } from "../git/operations.ts";
import type { BacklogConfig } from "../types/index.ts";

describe("Missing git remote preflight", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "backlog-noremote-"));
		await $`git init`.cwd(tempDir).quiet();
		await $`git config user.email test@example.com`.cwd(tempDir).quiet();
		await $`git config user.name "Test User"`.cwd(tempDir).quiet();
		await writeFile(join(tempDir, "README.md"), "# Test");
		await $`git add README.md`.cwd(tempDir).quiet();
		await $`git commit -m "init"`.cwd(tempDir).quiet();
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("GitOperations.fetch() silently skips when no remotes exist", async () => {
		const gitOps = new GitOperations(tempDir, {
			projectName: "Test",
			statuses: ["To Do", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: true,
		} as BacklogConfig);

		// Capture console.warn to ensure no warning is printed during fetch
		const originalWarn = console.warn;
		const warns: string[] = [];
		console.warn = (msg: string) => {
			warns.push(msg);
		};

		await expect(async () => {
			await gitOps.fetch();
		}).not.toThrow();

		// Should not warn during fetch when no remotes
		expect(warns.length).toBe(0);

		console.warn = originalWarn;
	});

	it("loadRemoteTasks() handles no-remote repos without throwing", async () => {
		const config: BacklogConfig = {
			projectName: "Test",
			statuses: ["To Do", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: true,
		};

		const gitOps = new GitOperations(tempDir, config);
		const progress: string[] = [];
		const remoteTasks = await loadRemoteTasks(gitOps as unknown as typeof gitOps, config, (m) => progress.push(m));
		expect(Array.isArray(remoteTasks)).toBe(true);
		expect(remoteTasks.length).toBe(0);
	});

	it("CLI init with includeRemote=true in no-remote repo shows a final warning", async () => {
		const CLI_PATH = joinPath(process.cwd(), "src", "cli.ts");
		const result =
			await $`bun ${[CLI_PATH, "init", "NoRemoteProj", "--defaults", "--check-branches", "true", "--include-remote", "true", "--auto-open-browser", "false"]}`
				.cwd(tempDir)
				.nothrow()
				.quiet();
		expect(result.exitCode).toBe(0);
		const out = result.stdout.toString() + result.stderr.toString();
		expect(out.toLowerCase()).toContain("remoteoperations is enabled");
		expect(out.toLowerCase()).toContain("no git remotes are configured");
	});
});
