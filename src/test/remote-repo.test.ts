import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { authArgs, ensureRemoteRepo, getRemoteCacheDir, parseRemoteSpec } from "../remote/remote-repo.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

async function runGit(args: string[], cwd?: string): Promise<void> {
	const proc = Bun.spawn(["git", ...args], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
	const stderr = proc.stderr ? await new Response(proc.stderr).text() : "";
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
	}
}

describe("parseRemoteSpec", () => {
	test("owner/name shorthand defaults to github.com https", () => {
		const spec = parseRemoteSpec("apetersson/ModuleWarden");
		expect(spec.host).toBe("github.com");
		expect(spec.owner).toBe("apetersson");
		expect(spec.name).toBe("ModuleWarden");
		expect(spec.cloneUrl).toBe("https://github.com/apetersson/ModuleWarden.git");
		expect(spec.ref).toBeUndefined();
		expect(spec.label).toBe("apetersson/ModuleWarden");
	});

	test("https URL with .git and trailing slash", () => {
		const spec = parseRemoteSpec("https://github.com/owner/name.git/");
		expect(spec.host).toBe("github.com");
		expect(spec.owner).toBe("owner");
		expect(spec.name).toBe("name");
		expect(spec.cloneUrl).toBe("https://github.com/owner/name.git");
	});

	test("https URL on a non-github host", () => {
		const spec = parseRemoteSpec("https://gitlab.example.com/grp/proj");
		expect(spec.host).toBe("gitlab.example.com");
		expect(spec.owner).toBe("grp");
		expect(spec.name).toBe("proj");
	});

	test("scp-style ssh URL", () => {
		const spec = parseRemoteSpec("git@github.com:owner/name.git");
		expect(spec.host).toBe("github.com");
		expect(spec.owner).toBe("owner");
		expect(spec.name).toBe("name");
		expect(spec.cloneUrl).toBe("git@github.com:owner/name.git");
	});

	test("ref is attached and reflected in the label", () => {
		const spec = parseRemoteSpec("owner/name", "develop");
		expect(spec.ref).toBe("develop");
		expect(spec.label).toBe("owner/name@develop");
	});

	test("rejects unparseable input", () => {
		expect(() => parseRemoteSpec("not a repo")).toThrow();
		expect(() => parseRemoteSpec("")).toThrow();
	});
});

describe("getRemoteCacheDir", () => {
	const original = process.env.BACKLOG_REMOTE_CACHE;
	afterEach(() => {
		if (original === undefined) delete process.env.BACKLOG_REMOTE_CACHE;
		else process.env.BACKLOG_REMOTE_CACHE = original;
	});

	test("honors BACKLOG_REMOTE_CACHE override", () => {
		process.env.BACKLOG_REMOTE_CACHE = join("custom", "cache");
		const spec = parseRemoteSpec("owner/name");
		expect(getRemoteCacheDir(spec)).toBe(join("custom", "cache", "github.com", "owner", "name"));
	});
});

describe("authArgs", () => {
	const saved = {
		t: process.env.BACKLOG_REMOTE_TOKEN,
		gh: process.env.GH_TOKEN,
		gt: process.env.GITHUB_TOKEN,
	};
	afterEach(() => {
		for (const k of ["BACKLOG_REMOTE_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"] as const) delete process.env[k];
		if (saved.t !== undefined) process.env.BACKLOG_REMOTE_TOKEN = saved.t;
		if (saved.gh !== undefined) process.env.GH_TOKEN = saved.gh;
		if (saved.gt !== undefined) process.env.GITHUB_TOKEN = saved.gt;
	});

	test("no token -> no auth args", () => {
		for (const k of ["BACKLOG_REMOTE_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"] as const) delete process.env[k];
		expect(authArgs(parseRemoteSpec("owner/name"))).toEqual([]);
	});

	test("token + https -> scoped extraheader with base64 of x-access-token:TOKEN", () => {
		for (const k of ["GH_TOKEN", "GITHUB_TOKEN"] as const) delete process.env[k];
		process.env.BACKLOG_REMOTE_TOKEN = "secret123";
		const args = authArgs(parseRemoteSpec("owner/name"));
		expect(args[0]).toBe("-c");
		const expected = Buffer.from("x-access-token:secret123").toString("base64");
		expect(args[1]).toBe(`http.https://github.com/.extraheader=AUTHORIZATION: basic ${expected}`);
	});

	test("ssh remote -> no auth args even with token set", () => {
		process.env.BACKLOG_REMOTE_TOKEN = "secret123";
		expect(authArgs(parseRemoteSpec("git@github.com:owner/name.git"))).toEqual([]);
	});

	test("falls back to GH_TOKEN then GITHUB_TOKEN", () => {
		for (const k of ["BACKLOG_REMOTE_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"] as const) delete process.env[k];
		process.env.GH_TOKEN = "ghtok";
		expect(authArgs(parseRemoteSpec("owner/name"))[1]).toContain(
			Buffer.from("x-access-token:ghtok").toString("base64"),
		);
	});
});

describe("ensureRemoteRepo (integration, local file remote)", () => {
	let sourceDir: string;
	let cacheRoot: string;

	beforeEach(() => {
		sourceDir = createUniqueTestDir("remote-source");
		cacheRoot = createUniqueTestDir("remote-cache");
	});

	afterEach(async () => {
		await safeCleanup(sourceDir);
		await safeCleanup(cacheRoot);
	});

	test("clones a remote's backlog/ and Core loads the seeded task", async () => {
		// Build a fake "remote" repo with a committed backlog/ folder.
		await mkdir(join(sourceDir, "backlog", "tasks"), { recursive: true });
		await writeFile(
			join(sourceDir, "backlog", "config.yml"),
			[
				'project_name: "RemoteFixture"',
				'statuses: ["To Do", "In Progress", "Done"]',
				"labels: []",
				'default_status: "To Do"',
				"date_format: yyyy-mm-dd",
				"remote_operations: false",
				"check_active_branches: false",
				"auto_commit: false",
				"",
			].join("\n"),
		);
		await writeFile(
			join(sourceDir, "backlog", "tasks", "task-1 - Seeded-remote-task.md"),
			[
				"---",
				"id: task-1",
				"title: Seeded remote task",
				"status: To Do",
				"assignee: []",
				"created_date: '2026-05-28'",
				"labels: []",
				"dependencies: []",
				"---",
				"",
				"## Description",
				"A task that lives in the remote fixture repo.",
				"",
			].join("\n"),
		);
		await writeFile(join(sourceDir, "README.md"), "# Remote fixture\n");

		await runGit(["init", "-b", "main"], sourceDir);
		await runGit(["config", "user.email", "test@example.com"], sourceDir);
		await runGit(["config", "user.name", "Test"], sourceDir);
		await runGit(["add", "-A"], sourceDir);
		await runGit(["commit", "-m", "seed backlog"], sourceDir);

		const spec = {
			host: "local",
			owner: "fixture",
			name: "repo",
			cloneUrl: sourceDir,
			label: "fixture/repo",
		};

		const resolved = await ensureRemoteRepo(spec, { cacheDir: cacheRoot, refresh: false });
		expect(resolved).toBe(cacheRoot);

		// The backlog folder must have been checked out into the cache.
		const taskFile = Bun.file(join(cacheRoot, "backlog", "tasks", "task-1 - Seeded-remote-task.md"));
		expect(await taskFile.exists()).toBe(true);

		// And the normal Core path should load it (Core normalizes ids, e.g. task-1 -> TASK-1).
		const core = new Core(cacheRoot);
		const tasks = await core.loadTasks();
		const seeded = tasks.find((t) => t.id.toLowerCase() === "task-1");
		expect(seeded).toBeDefined();
		expect(seeded?.title).toBe("Seeded remote task");
	}, 30000);
});
