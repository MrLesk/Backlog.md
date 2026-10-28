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
const sections = {
	context: "First line\nSecond line",
	decision: "Use the shared store",
	consequences: "One source of truth",
	alternatives: "Separate stores",
};
const sectionArgs = Object.entries(sections).flatMap(([key, value]) => [`--${key}`, value]);

describe("decision CLI content and view", () => {
	let root: string;
	let core: Core;
	let server: BacklogServer | undefined;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "decision-cli-content-"));
		core = new Core(root);
		await initializeTestProject(core, "Decision CLI");
	});
	afterEach(async () => {
		await server?.stop();
		server = undefined;
		await rm(root, { recursive: true, force: true });
	});
	function cli(...args: string[]) {
		return $`bun ${cliPath} decision ${args}`.cwd(root).quiet().nothrow();
	}
	async function seed() {
		await core.createDecisionFromInput({ title: "Original", status: "accepted" });
		await core.updateDecisionFromInput("1", sections);
		const file = join(core.fs.decisionsDir, "decision-1 - Original.md");
		await Bun.write(
			file,
			(await readFile(file, "utf8")).replace("status: accepted", "status: accepted\nowner: platform # keep") +
				"\n## Revisit trigger\n\nReview after the next release.\n",
		);
		return file;
	}

	it("creates all sections with real newlines and leaves omitted sections empty", async () => {
		expect((await cli("create", "Choice", ...sectionArgs)).exitCode).toBe(0);
		expect(await core.getDecision("1")).toMatchObject(sections);
		expect((await cli("create", "Partial", "--context", "Only context")).exitCode).toBe(0);
		const partial = await core.getDecision("2");
		expect(partial).toMatchObject({ context: "Only context", decision: "", consequences: "" });
		expect(partial?.alternatives ?? "").toBe("");
	});

	it("replaces and clears named sections while preserving everything else", async () => {
		const file = await seed();
		const before = await readFile(file, "utf8");
		expect((await cli("edit", "1", "--context", "New first\nNew second", "--alternatives", "")).exitCode).toBe(0);
		const updated = await readFile(file, "utf8");
		const withoutTimestamp = (value: string) => value.replace(/^updated_date:.*\n/m, "");
		expect(withoutTimestamp(updated)).toBe(
			withoutTimestamp(before)
				.replace(sections.context, "New first\nNew second")
				.replace(`${sections.alternatives}\n`, ""),
		);
		expect(await core.getDecision("1")).toMatchObject({
			context: "New first\nNew second",
			alternatives: "",
			decision: sections.decision,
			consequences: sections.consequences,
		});
		expect((await cli("edit", "1", "--decision", "literal\\ntext", "--consequences", "")).exitCode).toBe(0);
		expect(await core.getDecision("1")).toMatchObject({ decision: "literal\\ntext", consequences: "" });
	});

	it("retitles the one file and lists the new title", async () => {
		await seed();
		expect((await cli("edit", "DECISION-001", "-t", "Revised title")).exitCode).toBe(0);
		expect(await readdir(core.fs.decisionsDir)).toEqual(["decision-1 - Revised-title.md"]);
		expect((await cli("list", "--plain")).stdout.toString()).toContain("decision-1 - Revised title (accepted)");
	});

	it("views all metadata and unmanaged content in plain text and versioned JSON", async () => {
		await seed();
		await core.createDecisionFromInput({ title: "Replacement" });
		await core.updateDecisionFromInput("1", { supersededBy: "2" });
		const decision = await core.getDecision("1");
		const plain = await cli("view", "1", "--plain");
		expect(plain.exitCode).toBe(0);
		for (const value of [
			"decision-1",
			"Original",
			"accepted",
			decision?.date,
			decision?.updatedDate,
			"decision-2",
			"## Revisit trigger",
			...Object.values(sections),
		]) {
			expect(plain.stdout.toString()).toContain(value ?? "missing date");
		}
		expect(plain.stdout.toString()).not.toContain("<!-- SECTION:");
		const json = await cli("view", "decision-001", "--json");
		expect(json.exitCode).toBe(0);
		expect(JSON.parse(json.stdout.toString())).toEqual({
			schemaVersion: 1,
			kind: "decision-view",
			decision: {
				id: "decision-1",
				title: "Original",
				status: "accepted",
				date: decision?.date,
				updatedAt: decision?.updatedDate,
				supersededBy: "decision-2",
				archived: false,
				content: decision?.rawContent,
			},
		});
		expect((await cli("view", "1", "--plain", "--json")).exitCode).toBe(1);
	});

	it("reads archived decisions but refuses edits until restored", async () => {
		await seed();
		expect((await cli("archive", "1")).exitCode).toBe(0);
		const archived = await core.getDecision("1");
		if (!archived) throw new Error("Archived decision missing");
		const file = core.fs.contentRecordFilePath("decision", archived);
		const before = await readFile(file, "utf8");
		const plain = await cli("view", "1", "--plain");
		expect(plain.exitCode).toBe(0);
		expect(plain.stdout.toString()).toContain("Archived");
		expect(plain.stdout.toString()).toContain("## Revisit trigger");
		expect(JSON.parse((await cli("view", "1", "--json")).stdout.toString()).decision.archived).toBe(true);
		const refused = await cli("edit", "1", "--context", "Changed");
		expect(refused.exitCode).toBe(1);
		expect(refused.stderr.toString()).toContain("backlog decision restore decision-1");
		expect(await readFile(file, "utf8")).toBe(before);
	});

	it.each(["missing", "ambiguous"])("refuses %s identities for view and edit without changing files", async (kind) => {
		const file = await seed();
		if (kind === "ambiguous")
			await Bun.write(join(core.fs.decisionsDir, "decision-001 - Copy.md"), await readFile(file));
		const snapshot = async () =>
			Promise.all(
				(await readdir(core.fs.decisionsDir))
					.sort()
					.map(async (name) => [name, await readFile(join(core.fs.decisionsDir, name), "utf8")]),
			);
		const before = await snapshot();
		for (const args of [
			["view", "--plain"],
			["edit", "--context", "Changed"],
		] as const) {
			const result = await cli(args[0], kind === "missing" ? "999" : "1", ...args.slice(1));
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain(
				kind === "missing" ? "not found" : "Decision ID decision-1 is ambiguous",
			);
			if (kind === "ambiguous") expect(result.stderr.toString()).toContain("Run 'backlog doctor'");
		}
		expect(await snapshot()).toEqual(before);
	});

	it("writes the same file through CLI flags and the JSON update endpoint", async () => {
		const first = await seed();
		await Bun.write(
			join(core.fs.decisionsDir, "decision-2 - Original.md"),
			(await readFile(first, "utf8")).replace("id: decision-1", "id: decision-2"),
		);
		const input = {
			...sections,
			context: "Updated\ncontext",
			alternatives: "",
			title: "New title",
			status: "Under Review",
		};
		expect(
			(await cli("edit", "1", ...Object.entries(input).flatMap(([key, value]) => [`--${key}`, value]))).exitCode,
		).toBe(0);
		server = new BacklogServer(root);
		await server.start(0, false);
		const response = await fetch(`http://127.0.0.1:${server.getPort()}/api/decisions/2`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		});
		expect(response.status).toBe(200);
		const contents = await Promise.all(
			[1, 2].map(async (id) => {
				const decision = await core.getDecision(String(id));
				if (!decision) throw new Error(`Decision ${id} missing`);
				return (await readFile(core.fs.contentRecordFilePath("decision", decision), "utf8"))
					.replace(/^id:.*$/m, "id: ignored")
					.replace(/^updated_date:.*$/m, "updated_date: ignored");
			}),
		);
		expect(contents[0]).toBe(contents[1]);
	});

	it("refuses reserved section markers on creation without creating a record", async () => {
		const refused = await cli("create", "Invalid", "--context", "<!-- SECTION:CONTEXT:END -->\nTail");
		expect(refused.exitCode).toBe(1);
		expect(refused.stderr.toString()).toContain("reserved");
		expect(await readdir(core.fs.decisionsDir)).toEqual([]);
	});

	it("ships section flags, newline guidance, view examples and instructions", async () => {
		expect((await cli("--help")).stdout.toString()).toContain("view");
		for (const command of ["create", "edit"]) {
			const help = (await cli(command, "--help")).stdout.toString();
			for (const field of Object.keys(sections)) {
				expect(help).toContain(`--${field} <text>`);
				expect(help).toContain(`${field}: Markdown`);
			}
			expect(help).toContain("real newlines");
			expect(help).toContain("Examples:");
		}
		const viewHelp = (await cli("view", "--help")).stdout.toString();
		expect(viewHelp).toContain("--json");
		expect(viewHelp).toContain("backlog decision view decision-1 --plain");
		const instructions = await $`bun ${cliPath} instructions overview`.cwd(root).quiet();
		for (const command of ["decision create", "decision edit", "decision view"])
			expect(instructions.stdout.toString()).toContain(command);
		expect(instructions.stdout.toString()).toContain("--context");
	});
});
