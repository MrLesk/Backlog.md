import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { stripDecisionSectionMarkers } from "../markdown/structured-sections.ts";
import { BacklogServer } from "../server/index.ts";
import type { Decision, DecisionUpdateInput } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("decision section round trips", () => {
	let directory: string;
	let decisionPath: string;
	let server: BacklogServer;
	let url: string;

	beforeEach(async () => {
		directory = createUniqueTestDir("decision-sections");
		const filesystem = new FileSystem(directory);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Decision sections",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			dateFormat: "yyyy-mm-dd",
			remoteOperations: false,
			autoCommit: false,
		});
		decisionPath = join(filesystem.decisionsDir, "decision-1 - Example.md");
		await Bun.write(
			decisionPath,
			'---\nid: decision-1\ntitle: Example\nstatus: proposed\ndate: "2026-09-01"\n---\n\n## Context\n\n## Decision\n\n## Consequences\n\n',
		);
		server = new BacklogServer(directory);
		await server.start(0, false);
		url = `http://127.0.0.1:${server.getPort()}/api/decisions`;
	});

	afterEach(async () => {
		await server?.stop();
		await safeCleanup(directory);
	});

	async function update(content: DecisionUpdateInput): Promise<Decision> {
		const response = await fetch(`${url}/decision-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(content),
		});
		expect(response.status).toBe(200);
		const read = await fetch(`${url}/decision-1`);
		expect(read.status).toBe(200);
		return read.json();
	}

	it.each(["\n", "\r\n"])("preserves nested headings and inline hashes with %j line endings", async (newline) => {
		const sections = {
			context: "Before\n\n### Detail\n\nContext tail",
			decision: "Keep inline##text and the literal ## marker here.\n\n#### Choice\n\nDecision tail",
			consequences: "### Consequences detail\n\nConsequences tail",
			alternatives: "Before\n\n##### Alternative\n\nAlternatives tail",
		};

		const updated = await update(
			Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.replace(/\n/g, newline)])),
		);
		for (const field of ["context", "decision", "consequences", "alternatives"] as const) {
			expect(updated[field]).toBe(sections[field]);
			expect(await Bun.file(decisionPath).text()).toContain(sections[field]);
		}
	});

	it.each(["```", "~~~"])("keeps marked sections separate after an unfinished %s fence", async (fence) => {
		const original = await update({
			context: `${fence}text\nExample`,
			decision: "Keep decision",
			consequences: "Keep consequences",
		});
		expect(original.decision).toBe("Keep decision");
		expect(original.consequences).toBe("Keep consequences");
		const updated = await update({ decision: "New decision" });
		expect(updated.context).toBe(`${fence}text\nExample`);
		expect(updated.decision).toBe("New decision");
		expect(updated.consequences).toBe("Keep consequences");
	});

	it("reads empty sections without swallowing the next heading", async () => {
		const response = await fetch(url);
		expect(response.status).toBe(200);
		const decisions = (await response.json()) as Decision[];
		expect(decisions).toHaveLength(1);
		expect(decisions[0]).toMatchObject({ context: "", decision: "", consequences: "" });
	});

	it.each([
		{
			content: { context: "", alternatives: "" },
			expected: { context: "", decision: "Keep decision", consequences: "Keep consequences" },
			alternatives: "",
			cleared: ["Original context", "Original alternatives"],
		},
		{
			content: { decision: "", consequences: "" },
			expected: { context: "Original context", decision: "", consequences: "" },
			alternatives: "Original alternatives",
			cleared: ["Keep decision", "Keep consequences"],
		},
	])("clears explicit empty sections and retains omitted sections: $content", async (testCase) => {
		await update({
			context: "Original context",
			decision: "Keep decision",
			consequences: "Keep consequences",
			alternatives: "Original alternatives",
		});
		const updated = await update(testCase.content);
		expect(updated).toMatchObject(testCase.expected);
		expect(updated.alternatives).toBe(testCase.alternatives);
		const persisted = await Bun.file(decisionPath).text();
		for (const cleared of testCase.cleared) {
			expect(persisted).not.toContain(cleared);
		}
	});
	it.each(["\n", "\r\n"])(
		"preserves all unmanaged source while migrating and replacing sections (%j)",
		async (newline) => {
			const original = [
				"---",
				"id: decision-1",
				"title: Example",
				"status: proposed",
				"owner: someone",
				"---",
				"",
				"Preamble",
				"",
				"## References",
				"",
				"Before",
				"",
				"## Context",
				"",
				"Old context",
				"",
				"```md",
				"## Revisit trigger",
				"Inside code",
				"```",
				"",
				"## Revisit trigger",
				"",
				"Review after six months.",
				"",
				"## Decision",
				"",
				"Keep decision",
				"",
				"### Detail",
				"",
				"Keep nested text",
				"",
				"## Other",
				"",
				"After",
				"",
			].join(newline);
			await Bun.write(decisionPath, original);
			const first = await update({ status: "accepted" });
			expect(first.context).toContain("## Revisit trigger\nInside code");
			const migrated = await Bun.file(decisionPath).text();
			expect(migrated.replace(/^<!-- SECTION:[A-Z_]+:(?:BEGIN|END) -->\r?\n/gm, "")).toBe(
				original.replace("status: proposed", "status: accepted"),
			);
			expect(migrated).toContain("<!-- SECTION:CONTEXT:BEGIN -->");
			await update({ context: "Replacement" });
			const saved = await Bun.file(decisionPath).text();
			for (const outside of [
				"Preamble",
				`## References${newline}${newline}Before`,
				`## Revisit trigger${newline}${newline}Review after six months.`,
				`## Other${newline}${newline}After`,
			])
				expect(saved).toContain(outside);
			expect((await update({ consequences: "New consequences" })).decision).toBe(
				"Keep decision\n\n### Detail\n\nKeep nested text",
			);
			if (newline === "\r\n") expect(saved.replace(/\r\n/g, "")).not.toContain("\n");
		},
	);

	it.each([
		"text",
		"[]",
		"null",
		'{"unknown":"field"}',
		'{"context":null}',
		'{"title":""}',
		'{"context":"<!-- SECTION:CONTEXT:END -->"}',
		'{"context":"<!-- SECTION:DESCRIPTION:BEGIN -->"}',
	])("rejects invalid input without writing: %s", async (body) => {
		const original = await Bun.file(decisionPath).text();
		const response = await fetch(`${url}/decision-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body,
		});
		expect(response.status).toBe(400);
		expect(typeof (await response.json()).error).toBe("string");
		expect(await Bun.file(decisionPath).text()).toBe(original);
	});

	it.each(
		['"title": Example', "'title': Example", "title: |-\n  Example\n\n  title"].flatMap((entry) =>
			["\n", "\r\n"].map((newline) => ({ entry, newline })),
		),
	)("still updates $entry with $newline without changing unmanaged source", async ({ entry, newline }) => {
		const original = (await Bun.file(decisionPath).text())
			.replace("title: Example", `${entry}\nowner: team # keep this`)
			.replace("\n\n## Context", "\n\nPreamble\n\n## Context")
			.replace(/\n/g, newline);
		await Bun.write(decisionPath, original);
		const updated = await update({ title: "Changed" });
		expect(updated.title).toBe("Changed");
		const saved = await Bun.file(join(directory, "backlog", "decisions", "decision-1 - Changed.md")).text();
		expect(saved).toContain("owner: team # keep this");
		expect(stripDecisionSectionMarkers(saved).split(`${newline}---${newline}`)[1]).toBe(
			original.split(`${newline}---${newline}`)[1],
		);
		expect(saved).not.toContain("\r\r");
		if (newline === "\r\n") expect(saved.replace(/\r\n/g, "")).not.toContain("\n");
		expect(await Bun.file(decisionPath).exists()).toBe(false);
	});

	it("refuses duplicate known headings instead of selecting one", async () => {
		const original = `${await Bun.file(decisionPath).text()}\n## Context\n\nSecond context\n`;
		await Bun.write(decisionPath, original);
		const response = await fetch(`${url}/decision-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ context: "Changed" }),
		});
		expect(response.status).toBe(409);
		expect((await response.json()).error).toContain("Context");
		expect(await Bun.file(decisionPath).text()).toBe(original);
	});

	it("reports missing and ambiguous identities without writing", async () => {
		const request = {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ context: "Changed" }),
		};
		expect((await fetch(`${url}/decision-9`, request)).status).toBe(404);
		const original = await Bun.file(decisionPath).text();
		await Bun.write(join(directory, "backlog", "decisions", "decision-001 - Duplicate.md"), original);
		expect((await fetch(`${url}/decision-1`, request)).status).toBe(409);
		expect(await Bun.file(decisionPath).text()).toBe(original);
	});
});
