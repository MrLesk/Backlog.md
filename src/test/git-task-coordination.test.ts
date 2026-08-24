import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { initializeProject } from "../core/init.ts";
import { GitOperations, TaskCoordinationConflictError } from "../git/operations.ts";
import type { BacklogConfig } from "../types/index.ts";

const TEST_CONFIG = {
	projectName: "Coordination test",
	statuses: [],
	labels: [],
	dateFormat: "YYYY-MM-DD",
	remoteOperations: true,
} satisfies BacklogConfig;

const CLI_PATH = join(import.meta.dir, "..", "cli.ts");

async function git(cwd: string, args: string[]): Promise<string> {
	const process = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
	const [exitCode, stdout, stderr] = await Promise.all([
		process.exited,
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
	]);
	if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
	return stdout.trim();
}

async function cli(cwd: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const child = Bun.spawn([process.execPath, CLI_PATH, ...args], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exitCode, stdout, stderr };
}

describe("Git task coordination", () => {
	let root: string;
	let repo: string;
	let remote: string;
	let operations: GitOperations;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-coordination-"));
		repo = join(root, "repo");
		remote = join(root, "remote.git");
		await git(root, ["init", "--bare", remote]);
		await git(root, ["init", repo]);
		await git(repo, ["remote", "add", "origin", remote]);
		operations = new GitOperations(repo, TEST_CONFIG);
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("allows exactly one concurrent claimant", async () => {
		const results = await Promise.allSettled([
			operations.claimTask("BACK-123", "alice"),
			new GitOperations(repo, TEST_CONFIG).claimTask("BACK-123", "bob"),
		]);

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
		expect(results.find((result) => result.status === "rejected")?.reason).toBeInstanceOf(
			TaskCoordinationConflictError,
		);
	});

	it("atomically replaces an expired lease", async () => {
		await operations.claimTask("BACK-123", "alice", {
			now: new Date("2026-08-24T00:00:00.000Z"),
			leaseMs: 1_000,
		});
		const replacement = await operations.claimTask("BACK-123", "bob", {
			now: new Date("2026-08-24T00:00:02.000Z"),
		});

		expect(replacement.state.owner).toBe("bob");
		expect(replacement.state.revision).toBe(2);
	});

	it("renews only the current owner's active claim", async () => {
		const original = await operations.claimTask("BACK-123", "alice", {
			now: new Date("2026-08-24T00:00:00.000Z"),
			leaseMs: 60_000,
		});
		const renewed = await operations.claimTask("BACK-123", "alice", {
			now: new Date("2026-08-24T00:00:30.000Z"),
			leaseMs: 60_000,
			renew: true,
		});

		expect(renewed.state.claimedAt).toBe(original.state.claimedAt);
		expect(renewed.state.revision).toBe(2);
		await expect(
			operations.claimTask("BACK-123", "bob", {
				now: new Date("2026-08-24T00:00:40.000Z"),
				renew: true,
			}),
		).rejects.toBeInstanceOf(TaskCoordinationConflictError);
	});

	it("does not let an old owner release a replacement claim", async () => {
		await operations.claimTask("BACK-123", "alice", {
			now: new Date("2026-08-24T00:00:00.000Z"),
			leaseMs: 1_000,
		});
		await operations.claimTask("BACK-123", "bob", {
			now: new Date("2026-08-24T00:00:02.000Z"),
		});

		await expect(operations.releaseTask("BACK-123", "alice")).rejects.toBeInstanceOf(TaskCoordinationConflictError);
		expect((await operations.readTaskCoordination("BACK-123"))?.state.owner).toBe("bob");
	});

	it("fails closed when remote operations are disabled", async () => {
		const offline = new GitOperations(repo, { ...TEST_CONFIG, remoteOperations: false });
		await expect(offline.claimTask("BACK-123", "alice")).rejects.toThrow("remoteOperations");
	});

	it("fails closed with an actionable error when the remote is unavailable", async () => {
		await expect(operations.claimTask("BACK-123", "alice", { remote: "missing" })).rejects.toThrow(
			"configured Git remote named 'missing'",
		);
	});

	it("rejects a stale live-state publication", async () => {
		const claim = await operations.claimTask("BACK-123", "alice");
		await operations.publishTaskCoordination(
			{ ...claim.state, status: "In Progress", assignee: ["@alice"] },
			claim.objectId,
		);

		await expect(
			operations.publishTaskCoordination({ ...claim.state, status: "Done" }, claim.objectId),
		).rejects.toBeInstanceOf(TaskCoordinationConflictError);
		expect((await operations.readTaskCoordination("BACK-123"))?.state.status).toBe("In Progress");
	});

	it("does not add coordination events to branch history", async () => {
		const before = await git(repo, ["rev-list", "--all", "--count"]);
		await operations.claimTask("BACK-123", "alice");
		await operations.releaseTask("BACK-123", "alice");
		const after = await git(repo, ["rev-list", "--all", "--count"]);

		expect(after).toBe(before);
	});

	it("exposes claim, list, and release through the canonical CLI", async () => {
		const core = new Core(repo);
		await initializeProject(core, {
			projectName: "Coordination CLI test",
			integrationMode: "none",
			advancedConfig: { remoteOperations: true, autoCommit: false },
		});
		const { task } = await core.createTaskFromInput({ title: "Coordinate me" });

		const claimed = await cli(repo, ["task", "claim", task.id, "--owner", "alice"]);
		expect(claimed.exitCode).toBe(0);
		expect(claimed.stdout).toContain(`Claimed ${task.id} for alice`);

		const rejected = await cli(repo, ["task", "claim", task.id, "--owner", "bob"]);
		expect(rejected.exitCode).toBe(1);
		expect(rejected.stderr).toContain("already claimed by alice");

		const listed = await cli(repo, ["task", "claims", "--json"]);
		expect(listed.exitCode).toBe(0);
		expect(JSON.parse(listed.stdout)).toEqual([expect.objectContaining({ taskId: task.id, owner: "alice" })]);

		const released = await cli(repo, ["task", "release", task.id, "--owner", "alice"]);
		expect(released.exitCode).toBe(0);
		expect(await operations.readTaskCoordination(task.id)).toBeNull();

		const started = await cli(repo, ["task", "start", task.id, "--owner", "alice"]);
		expect(started.exitCode).toBe(0);
		expect(started.stdout).toContain(`Started ${task.id}`);
		const startedTask = await core.loadTaskById(task.id, { includeCrossBranch: false });
		expect(startedTask?.status).toBe("In Progress");
		expect(startedTask?.assignee).toEqual(["@alice"]);
		expect((await operations.readTaskCoordination(task.id))?.state.status).toBe("In Progress");

		await core.updateTaskFromInput(task.id, { status: "To Do" });
		const published = await cli(repo, ["task", "publish", task.id]);
		expect(published.exitCode).toBe(0);
		expect((await operations.readTaskCoordination(task.id))?.state.status).toBe("To Do");
	});
});
