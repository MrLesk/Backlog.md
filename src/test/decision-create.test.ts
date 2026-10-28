import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { CREATE_LOCK_ERROR_MESSAGE } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { initializeTestProject } from "./test-utils.ts";

const cli = getTestCliPath();

describe("decision creation", () => {
	let directory: string;
	let core: Core;
	let server: BacklogServer | undefined;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), "backlog-decision-create-"));
		core = new Core(directory);
		await initializeTestProject(core, "Decision creation");
	});

	afterEach(async () => {
		await server?.stop();
		server = undefined;
		await rm(directory, { recursive: true, force: true });
	});

	it("keeps all twelve concurrent CLI creates and reports their persisted IDs", async () => {
		const results = await Promise.all(
			Array.from({ length: 12 }, (_, index) =>
				$`bun ${cli} decision create ${`Choice ${index}`} --plain`.cwd(directory).quiet().nothrow(),
			),
		);
		const ids = results.map((result) => {
			expect(result.exitCode).toBe(0);
			return result.stdout.toString().trim().replace("Created decision ", "");
		});
		expect(new Set(ids).size).toBe(12);
		expect(await readdir(core.fs.decisionsDir)).toHaveLength(12);
		for (const id of ids) expect(await core.getDecision(id)).not.toBeNull();
		const listed = await $`bun ${cli} decision list --plain`.cwd(directory).quiet();
		expect(listed.stdout.toString().trim().split("\n")).toHaveLength(12);
		const diagnosis = await $`bun ${cli} doctor`.cwd(directory).quiet().nothrow();
		expect(diagnosis.exitCode).toBe(0);
	});

	it("creates the same empty sections through HTTP and CLI", async () => {
		await $`bun ${cli} decision create "Same choice"`.cwd(directory).quiet();
		server = new BacklogServer(directory);
		await server.start(0, false);
		const response = await fetch(`http://127.0.0.1:${server.getPort()}/api/decisions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Same choice" }),
		});
		expect(response.status).toBe(201);
		const decisions = await core.fs.listDecisions();
		expect(decisions).toHaveLength(2);
		const contents = await Promise.all(
			decisions.map(async (decision) =>
				(await Bun.file(join(core.fs.decisionsDir, decision.path ?? "")).text())
					.replace(/^id:.*$/m, "id: ignored")
					.replace(/^date:.*$/m, "date: ignored"),
			),
		);
		expect(contents[1]).toBe(contents[0]);
		expect(decisions.every((decision) => decision.context === "" && decision.decision === "")).toBe(true);
	});

	// The public create lock waits up to 30 seconds before refusing the command.
	it("refuses a CLI create when the create lock remains occupied", async () => {
		let release!: () => void;
		let entered!: () => void;
		const ready = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const held = core.withCreateLock(async () => {
			entered();
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		});
		await ready;
		try {
			const result = await $`bun ${cli} decision create "Blocked"`.cwd(directory).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain(CREATE_LOCK_ERROR_MESSAGE);
			expect(await readdir(core.fs.decisionsDir)).toHaveLength(0);
		} finally {
			release();
			await held;
		}
	}, 40_000);
});
