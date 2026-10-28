import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { initializeTestProject } from "./test-utils.ts";

const cliPath = getTestCliPath();
describe("decision supersession", () => {
	let root: string;
	let core: Core;
	let file: string;
	let server: BacklogServer | undefined;
	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "decision-supersession-"));
		core = new Core(root);
		await initializeTestProject(core, "Supersession");
		await core.createDecisionFromInput({ title: "Original", status: "accepted" });
		await core.createDecisionFromInput({ title: "Replacement" });
		file = join(core.fs.decisionsDir, "decision-1 - Original.md");
		const original = await readFile(file, "utf8");
		await Bun.write(
			file,
			original.replace(
				"status: accepted",
				"status: accepted\nowner: team # preserve source\nupdated_date: '2000-01-01T00:00:00Z'",
			),
		);
	});
	afterEach(async () => {
		await server?.stop();
		server = undefined;
		await rm(root, { recursive: true, force: true });
	});
	function cli(...args: string[]) {
		return $`bun ${cliPath} decision ${args}`.cwd(root).quiet().nothrow();
	}

	it("sets a canonical link without changing status, lists it, and preserves it through later HTTP edits", async () => {
		const original = await readFile(file, "utf8");
		const result = await cli("edit", "1", "--superseded-by", "DECISION-0002");
		expect(result.exitCode).toBe(0);
		const linked = await readFile(file, "utf8");
		expect(linked).toContain("superseded_by: decision-2");
		expect(linked).toContain("owner: team # preserve source");
		expect(linked.split("\n---\n")[1]).toBe(original.split("\n---\n")[1]);
		expect((await core.getDecision("1"))?.status).toBe("accepted");
		const listing = await cli("list", "--plain");
		expect(listing.stdout.toString()).toContain("decision-1 - Original (accepted) [superseded by decision-2]");
		const json = JSON.parse((await cli("list", "--json")).stdout.toString());
		expect(json.decisions.find((decision: { id: string }) => decision.id === "decision-1").supersededBy).toBe(
			"decision-2",
		);
		server = new BacklogServer(root);
		await server.start(0, false);
		const response = await fetch(`http://127.0.0.1:${server.getPort()}/api/decisions/1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ context: "Later context" }),
		});
		expect(response.status).toBe(200);
		const updated = await (await fetch(`http://127.0.0.1:${server.getPort()}/api/decisions/1`)).json();
		expect(updated).toMatchObject({ supersededBy: "decision-2", context: "Later context", status: "accepted" });
		expect(updated.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
		expect(updated.updatedDate).not.toBe("2000-01-01T00:00:00Z");
		expect(await readFile(file, "utf8")).toContain("owner: team # preserve source");
	});

	it("sets status and link together, then clears the link with an empty value", async () => {
		expect((await cli("edit", "1", "-s", "superseded", "--superseded-by", "2")).exitCode).toBe(0);
		expect((await core.getDecision("1"))?.status).toBe("superseded");
		expect((await cli("edit", "1", "--superseded-by", "")).exitCode).toBe(0);
		expect(await readFile(file, "utf8")).not.toContain("superseded_by:");
		expect((await core.getDecision("1"))?.status).toBe("superseded");
	});

	it("keeps header comments and all other source when setting and clearing a link", async () => {
		const original = (await readFile(file, "utf8")).replace("---\n", "---\n# Keep this decision header note\n\n");
		await Bun.write(file, original);
		const withoutChangedMetadata = (source: string) =>
			source.replace(/^(?:updated_date|superseded_by):[^\r\n]*\r?\n/gm, "");
		expect((await cli("edit", "1", "--superseded-by", "2")).exitCode).toBe(0);
		const linked = await readFile(file, "utf8");
		expect(withoutChangedMetadata(linked)).toBe(withoutChangedMetadata(original));
		// Simulate a later edit so timestamp replacement is exercised even within the same minute.
		await Bun.write(file, linked.replace(/^updated_date:.*$/m, "updated_date: '1999-01-01T00:00:00Z'"));
		expect((await cli("edit", "1", "--superseded-by", "")).exitCode).toBe(0);
		expect(withoutChangedMetadata(await readFile(file, "utf8"))).toBe(withoutChangedMetadata(original));
	});

	it.each(["missing", "self", "ambiguous"])("refuses a %s replacement without changing any decision", async (kind) => {
		if (kind === "ambiguous")
			await Bun.write(
				join(core.fs.decisionsDir, "decision-002 - Duplicate.md"),
				"---\nid: decision-2\ntitle: Duplicate\nstatus: proposed\n---\n",
			);
		const before = await Promise.all(
			(await readdir(core.fs.decisionsDir))
				.sort()
				.map(async (name) => [name, await readFile(join(core.fs.decisionsDir, name), "utf8")]),
		);
		const result = await cli(
			"edit",
			"1",
			"--superseded-by",
			kind === "self" ? "DECISION-001" : kind === "missing" ? "999" : "2",
		);
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain(
			kind === "self" ? "itself" : kind === "missing" ? "not found" : "ambiguous",
		);
		expect(
			await Promise.all(
				(await readdir(core.fs.decisionsDir))
					.sort()
					.map(async (name) => [name, await readFile(join(core.fs.decisionsDir, name), "utf8")]),
			),
		).toEqual(before);
	});

	it("dates changes and migration, but keeps a no-op byte-for-byte", async () => {
		const before = await readFile(file, "utf8");
		await core.updateDecisionFromInput("1", { status: "accepted" });
		expect(await readFile(file, "utf8")).toBe(before);
		await core.updateDecisionFromInput("1", { status: "superseded" });
		const changed = await core.getDecision("1");
		expect(changed?.updatedDate).not.toBe("2000-01-01T00:00:00Z");
		expect(changed?.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
		await Bun.write(file, "---\nid: decision-1\ntitle: Original\nstatus: accepted\n---\n\n## Context\n\nLegacy\n");
		await core.updateDecisionFromInput("1", {});
		expect((await core.getDecision("1"))?.updatedDate).toBeDefined();
	});

	it("documents setting and clearing the link in shipped help and instructions", async () => {
		const help = (await cli("edit", "--help")).stdout.toString();
		expect(help).toContain("--superseded-by <id>");
		expect(help).toContain("empty value to clear");
		const instructions = await $`bun ${cliPath} instructions overview`.cwd(root).quiet();
		expect(instructions.stdout.toString()).toContain("--superseded-by");
	});
});
