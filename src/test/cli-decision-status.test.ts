import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeTestProject, isWindows, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();

// The command under test is spelled here, so renaming it or its flag does not touch the tests
// below, apart from the long flag name in the help test.
const CHANGE_STATUS = ["decision", "edit"];
const STATUS_FLAG = "-s";

// Decision dates come from the run clock; nothing here depends on a particular date.
const TODAY = new Date().toISOString().slice(0, 10);

const REFUSAL = "Cannot change the status of decision-1 without changing other content";

let TEST_DIR: string;
let decisionsDir: string;

function cli(...args: string[]) {
	return $`bun ${CLI_PATH} ${args}`.cwd(TEST_DIR).quiet().nothrow();
}

function changeStatus(decisionId: string, status: string) {
	return cli(...CHANGE_STATUS, decisionId, STATUS_FLAG, status);
}

async function writeDecisionFile(filename: string, content: string | Uint8Array): Promise<string> {
	const filepath = join(decisionsDir, filename);
	await writeFile(filepath, content);
	return filepath;
}

/** Every file in the decisions directory with its exact bytes, to prove a refused command wrote nothing. */
async function snapshotDecisions(directory = decisionsDir): Promise<Record<string, string>> {
	const snapshot: Record<string, string> = {};
	for (const name of (await readdir(directory)).sort()) {
		snapshot[name] = (await readFile(join(directory, name))).toString("hex");
	}
	return snapshot;
}

/** The text of decision-1 with the given lines between `title` and `owner` in its frontmatter. */
function decisionWith(...statusLines: string[]): string {
	return [
		"---",
		"id: decision-1",
		"title: Case",
		...statusLines,
		"owner: platform-team",
		"---",
		"",
		"## Context",
		"",
	].join("\n");
}

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const asWrittenOnWindows = (text: string) => BYTE_ORDER_MARK + text.trimEnd().replaceAll("\n", "\r\n");
const BODY_LOOK_ALIKES = "\nstatus: accepted\n\n---\n\nstatus: accepted\n";

// Each file with its exact text after `decision-1` is set to superseded.
const replacedCases = [
	{
		name: "CRLF line endings, a byte-order mark and no final newline",
		before: asWrittenOnWindows(decisionWith("status: accepted")),
		after: asWrittenOnWindows(decisionWith("status: superseded")),
	},
	{
		name: "a status written over several lines",
		before: decisionWith("status: >-", "  under", "  review"),
		after: decisionWith("status: superseded"),
	},
	{
		name: "space before the status separator",
		before: decisionWith("status : accepted"),
		after: decisionWith("status : superseded"),
	},
	{
		name: "extra spaces after the status separator",
		before: decisionWith("status:   accepted"),
		after: decisionWith("status:   superseded"),
	},
	{
		name: "a comment on the status line, which is replaced with the line",
		before: decisionWith("status: accepted # agreed in review"),
		after: decisionWith("status: superseded"),
	},
	{
		name: "status lines that are not the decision's status",
		before: decisionWith("review:", "  status: pending", "status: accepted") + BODY_LOOK_ALIKES,
		after: decisionWith("review:", "  status: pending", "status: superseded") + BODY_LOOK_ALIKES,
	},
];

// Files whose status cannot be replaced without changing something else.
const refusedCases = [
	{ name: "no status line", content: decisionWith() },
	{ name: "a quoted status key", content: decisionWith('"status": accepted') },
	{
		name: "frontmatter written as one flow mapping",
		content: "---\n{ id: decision-1, title: Case, status: accepted }\n---\n\n## Context\n",
	},
	{
		name: "a status with a blank line inside its value",
		content: decisionWith("status: |-", "  first paragraph", "", "  second paragraph"),
	},
	{
		name: "text that is not valid UTF-8",
		content: Buffer.concat([Buffer.from(decisionWith("status: accepted")), Buffer.from([0xe9, 0x0a])]),
	},
];

describe("changing a decision's status from the CLI", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-decision-status");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await initializeTestProject(new Core(TEST_DIR), "Decision Status Test");
		decisionsDir = join(TEST_DIR, "backlog", "decisions");
		await mkdir(decisionsDir, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("marks a replaced decision superseded so it no longer lists as accepted", async () => {
		await cli("decision", "create", "Use Postgres", "-s", "accepted");
		await cli("decision", "create", "Use SQLite instead of Postgres", "-s", "accepted");

		const result = await changeStatus("decision-1", "superseded");
		expect(result.stderr.toString()).toBe("");
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString().trim()).toBe("Updated decision decision-1");

		const list = await cli("decision", "list", "--plain");
		expect(list.stdout.toString().trim().split("\n")).toEqual([
			"decision-1 - Use Postgres (superseded)",
			"decision-2 - Use SQLite instead of Postgres (accepted)",
		]);
	});

	it("changes only the status line of a decision the serializer cannot write back", async () => {
		// An extra frontmatter key, a nested heading and an unrecognised section are all lost when a
		// decision is parsed and serialized again.
		const original = [
			"---",
			"id: decision-1",
			"title: Use Postgres",
			`date: '${TODAY}'`,
			"status: accepted",
			"owner: platform-team",
			"review:",
			"  cadence: yearly",
			"---",
			"",
			"## Context",
			"",
			"We need a primary database.",
			"",
			"### Constraints",
			"",
			"- Managed service only",
			"",
			"## Decision",
			"",
			"Use Postgres.",
			"",
			"## Consequences",
			"",
			"One more service to run.",
			"",
			"## Revisit trigger",
			"",
			"Write volume above what one primary can take.",
			"",
		].join("\n");
		const filepath = await writeDecisionFile("decision-1 - Use-Postgres.md", original);
		const expected = original.replace("status: accepted", "status: superseded");

		const result = await changeStatus("decision-1", "superseded");
		expect(result.exitCode).toBe(0);
		expect((await readFile(filepath)).toString()).toBe(expected);

		// Setting the status it already has changes nothing.
		expect((await changeStatus("decision-1", "superseded")).exitCode).toBe(0);
		expect((await readFile(filepath)).toString()).toBe(expected);
	});

	it.each(replacedCases)("replaces the status line and keeps every other byte: $name", async ({ before, after }) => {
		const filepath = await writeDecisionFile("decision-1 - Case.md", before);

		const result = await changeStatus("decision-1", "superseded");

		expect(result.exitCode).toBe(0);
		expect((await readFile(filepath)).toString()).toBe(after);
		expect((await cli("decision", "list", "--plain")).stdout.toString()).toBe("decision-1 - Case (superseded)\n");
	});

	it("takes a free-form status and the ID forms other decision lookups take", async () => {
		await cli("decision", "create", "Use Postgres", "-s", "accepted");
		const filepath = join(decisionsDir, "decision-1 - Use-Postgres.md");
		const asCreated = await readFile(filepath, "utf8");
		const listed = async () => (await cli("decision", "list", "--plain")).stdout.toString().trim();

		expect((await changeStatus("DECISION-001", "Under Review")).stdout.toString().trim()).toBe(
			"Updated decision decision-1",
		);
		expect(await listed()).toBe("decision-1 - Use Postgres (Under Review)");

		// A status that YAML would read as something else is quoted the way `decision create` quotes it.
		expect((await changeStatus("decision-1", "see #12")).exitCode).toBe(0);
		expect(await readFile(filepath, "utf8")).toBe(asCreated.replace("status: accepted", "status: 'see #12'"));
		expect(await listed()).toBe("decision-1 - Use Postgres (see #12)");

		// A long status is stored over several lines, and still changes back to a one-line status.
		// `--plain` is accepted, as it is on the other decision commands.
		const longStatus = `superseded by decision-2 ${"after the storage migration ".repeat(4)}completed`;
		expect((await changeStatus("decision-1", longStatus)).exitCode).toBe(0);
		expect(await listed()).toBe(`decision-1 - Use Postgres (${longStatus})`);
		expect((await cli(...CHANGE_STATUS, "decision-1", STATUS_FLAG, "accepted", "--plain")).exitCode).toBe(0);
		expect(await readFile(filepath, "utf8")).toBe(asCreated);
	});

	it("exits non-zero and changes no file when the decision does not exist", async () => {
		await cli("decision", "create", "Use Postgres", "-s", "accepted");
		const before = await snapshotDecisions();

		const result = await changeStatus("decision-9", "superseded");

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString().trim()).toBe("Decision decision-9 not found");
		expect(result.stdout.toString()).toBe("");
		expect(await snapshotDecisions()).toEqual(before);
	});

	it("exits non-zero and changes no file when several files claim the decision ID", async () => {
		await writeDecisionFile("decision-2 - Gamma.md", "---\nid: decision-2\ntitle: Gamma\nstatus: accepted\n---\n");
		await writeDecisionFile("decision-002 - Delta.md", "---\nid: decision-002\ntitle: Delta\nstatus: accepted\n---\n");
		const before = await snapshotDecisions();

		const result = await changeStatus("decision-2", "superseded");

		expect(result.exitCode).toBe(1);
		const stderr = result.stderr.toString();
		expect(stderr).toContain("Decision ID decision-2 is ambiguous; 2 files match:");
		expect(stderr).toContain("decision-2 - Gamma.md");
		expect(stderr).toContain("decision-002 - Delta.md");
		expect(await snapshotDecisions()).toEqual(before);
	});

	it("refuses an archived decision until it is restored and keeps its bytes unchanged", async () => {
		const filename = "decision-1 - Case.md";
		const original = asWrittenOnWindows(decisionWith("status: accepted"));
		await writeDecisionFile(filename, original);
		expect((await cli("decision", "archive", "decision-1")).exitCode).toBe(0);
		const archiveDir = join(TEST_DIR, "backlog", "archive", "decisions");
		const archived = await snapshotDecisions(archiveDir);
		const active = await snapshotDecisions();

		const result = await changeStatus("DECISION-001", "superseded");

		expect(result.exitCode).toBe(1);
		expect(result.stdout.toString()).toBe("");
		expect(result.stderr.toString()).toBe(
			"Decision decision-1 is archived. Archived decisions are read-only. Restore it first: backlog decision restore decision-1\n",
		);
		expect(await snapshotDecisions(archiveDir)).toEqual(archived);
		expect(await snapshotDecisions()).toEqual(active);

		expect((await cli("decision", "restore", "decision-1")).exitCode).toBe(0);
		expect((await changeStatus("decision-1", "superseded")).exitCode).toBe(0);
		expect(await readFile(join(decisionsDir, filename), "utf8")).toBe(
			original.replace("status: accepted", "status: superseded"),
		);
	});

	it("refuses an ID claimed by both an active and archived decision without changing either", async () => {
		await writeDecisionFile(
			"decision-2 - Active.md",
			decisionWith("status: accepted").replace("decision-1", "decision-2"),
		);
		const archiveDir = join(TEST_DIR, "backlog", "archive", "decisions");
		await mkdir(archiveDir, { recursive: true });
		await writeFile(
			join(archiveDir, "decision-002 - Archived.md"),
			decisionWith("status: accepted").replace("decision-1", "decision-002"),
		);
		const active = await snapshotDecisions();
		const archived = await snapshotDecisions(archiveDir);

		const result = await changeStatus("decision-2", "superseded");

		expect(result.exitCode).toBe(1);
		expect(result.stdout.toString()).toBe("");
		expect(result.stderr.toString()).toContain("Decision ID decision-2 is ambiguous; 2 files match:");
		expect(result.stderr.toString()).toContain("backlog/decisions/decision-2 - Active.md");
		expect(result.stderr.toString()).toContain("backlog/archive/decisions/decision-002 - Archived.md");
		expect(await snapshotDecisions()).toEqual(active);
		expect(await snapshotDecisions(archiveDir)).toEqual(archived);
	});

	it.each(refusedCases)("refuses a decision with $name and changes no file", async ({ content }) => {
		await writeDecisionFile("decision-1 - Case.md", content);
		const before = await snapshotDecisions();

		const result = await changeStatus("decision-1", "superseded");

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain(REFUSAL);
		expect(result.stdout.toString()).toBe("");
		expect(await snapshotDecisions()).toEqual(before);
	});

	it("requires a status", async () => {
		await cli("decision", "create", "Use Postgres", "-s", "accepted");
		const before = await snapshotDecisions();

		for (const result of [await cli(...CHANGE_STATUS, "decision-1"), await changeStatus("decision-1", "")]) {
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Status is required.");
		}
		expect(await snapshotDecisions()).toEqual(before);
	});

	it.skipIf(isWindows())("writes through a symlinked decision file instead of replacing the link", async () => {
		const target = join(TEST_DIR, "shared-decision.md");
		await writeFile(target, "---\nid: decision-1\ntitle: Shared\nstatus: accepted\n---\n\n## Context\n");
		const link = join(decisionsDir, "decision-1 - Shared.md");
		await symlink(target, link);

		expect((await changeStatus("decision-1", "superseded")).exitCode).toBe(0);

		expect((await lstat(link)).isSymbolicLink()).toBe(true);
		expect(await readFile(target, "utf8")).toBe(
			"---\nid: decision-1\ntitle: Shared\nstatus: superseded\n---\n\n## Context\n",
		);
	});

	it("commits only the decision file when auto-commit is on", async () => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Test project has no config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true });
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m baseline`.cwd(TEST_DIR).quiet();
		await cli("decision", "create", "Use Postgres", "-s", "accepted");
		await writeFile(join(TEST_DIR, "unrelated.txt"), "not part of the decision\n");

		expect((await changeStatus("decision-1", "superseded")).exitCode).toBe(0);

		const commit = await $`git show --name-only --pretty=format:%s`.cwd(TEST_DIR).text();
		expect(commit.trim().split("\n")).toEqual([
			"backlog: Update decision decision-1",
			"backlog/decisions/decision-1 - Use-Postgres.md",
		]);
		expect((await $`git status --porcelain`.cwd(TEST_DIR).text()).trim()).toBe("?? unrelated.txt");
	});

	it("is listed and documented in the decision help", async () => {
		const command = CHANGE_STATUS.join(" ");
		// The usage and the description are checked apart: the columns between them are the argument
		// parser's and move whenever another decision command or option is added.
		const groupHelp = (await cli("decision", "--help")).stdout.toString();
		expect(groupHelp).toContain(`${CHANGE_STATUS[1]} [options] <decisionId>`);
		expect(groupHelp).toContain("change the status of a decision");

		const help = (await cli(...CHANGE_STATUS, "--help")).stdout.toString();
		expect(help).toContain(`Usage: backlog ${command} [options] <decisionId>`);
		expect(help).toContain(`${STATUS_FLAG}, --status <status>`);
		expect(help).toContain("set decision status (free-form)");
		expect(help).toContain("Input schema:");
		expect(help).toContain(
			"Required fields:\n  - decisionId: Decision ID - Decision to update\n  - status: String - New decision status; free-form",
		);
		expect(help).toContain("Optional fields:\n  - plain: Boolean - Use plain text output");
		expect(help).toContain(
			"Writes:\n  - Replaces the status line in the decision's frontmatter; the rest of the file stays as it is",
		);
		expect(help).toContain("Output:\n  - Updated decision ID");
		expect(help).toContain(`Examples:\n  backlog ${command} decision-1 ${STATUS_FLAG} superseded`);
	});
});
