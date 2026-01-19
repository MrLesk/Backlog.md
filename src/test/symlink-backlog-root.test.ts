import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, isWindows, safeCleanup } from "./test-utils.ts";

describe("Symlinked backlog root", () => {
	const itIfSymlinks = isWindows() ? it.skip : it;
	let repoDir: string;
	let backlogDir: string;

	beforeEach(async () => {
		repoDir = createUniqueTestDir("test-symlink-root-repo");
		backlogDir = createUniqueTestDir("test-symlink-root-backlog");
		await mkdir(repoDir, { recursive: true });
		await mkdir(backlogDir, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(repoDir);
		await safeCleanup(backlogDir);
	});

	itIfSymlinks("creates tasks when backlog root is a symlink and autoCommit is false", async () => {
		await mkdir(join(backlogDir, "tasks"), { recursive: true });
		await mkdir(join(backlogDir, "drafts"), { recursive: true });
		await writeFile(
			join(backlogDir, "config.yml"),
			`project_name: "Symlink Root"
statuses: ["To Do", "In Progress", "Done"]
auto_commit: false
`,
		);

		await symlink(backlogDir, join(repoDir, "backlog"));

		const core = new Core(repoDir);
		const { task } = await core.createTaskFromInput({ title: "Symlink root task" });

		const files = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: join(backlogDir, "tasks") }));
		expect(files.length).toBe(1);
		expect(task.id).toBe("TASK-1");

		const tasks = await core.listTasksWithMetadata();
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.id).toBe("TASK-1");
	});

	itIfSymlinks("auto-commit writes to the symlinked backlog repo when enabled", async () => {
		await $`git init`.cwd(backlogDir).quiet();
		await $`git config user.email test@example.com`.cwd(backlogDir).quiet();
		await $`git config user.name "Test User"`.cwd(backlogDir).quiet();
		await writeFile(join(backlogDir, "README.md"), "# Backlog Repo");
		await $`git add README.md`.cwd(backlogDir).quiet();
		await $`git commit -m "Initial commit"`.cwd(backlogDir).quiet();

		await mkdir(join(backlogDir, "tasks"), { recursive: true });
		await mkdir(join(backlogDir, "drafts"), { recursive: true });
		await writeFile(
			join(backlogDir, "config.yml"),
			`project_name: "Symlink Root"
statuses: ["To Do", "In Progress", "Done"]
auto_commit: true
`,
		);

		await symlink(backlogDir, join(repoDir, "backlog"));

		const core = new Core(repoDir);
		await core.createTaskFromInput({ title: "Symlink root auto-commit" });

		const { stdout } = await $`git log -1 --pretty=format:%s`.cwd(backlogDir).quiet();
		expect(stdout.toString()).toContain("Create task");
	});
});
