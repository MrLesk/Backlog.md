import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Decision } from "../types/index.ts";
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

	async function update(content: string): Promise<Decision> {
		const response = await fetch(`${url}/decision-1`, {
			method: "PUT",
			headers: { "Content-Type": "text/markdown" },
			body: content,
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
		const content = `## Context\n\n${sections.context}\n\n## Decision\n\n${sections.decision}\n\n## Consequences\n\n${sections.consequences}\n\n## Alternatives\n\n${sections.alternatives}\n`;
		const updated = await update(content.replace(/\n/g, newline));
		for (const field of ["context", "decision", "consequences", "alternatives"] as const) {
			expect(updated[field]).toBe(sections[field]);
			expect(await Bun.file(decisionPath).text()).toContain(sections[field]);
		}
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
			content: "## Context\n\n## Alternatives",
			expected: { context: "", decision: "Keep decision", consequences: "Keep consequences" },
			alternatives: undefined,
			cleared: ["Original context", "Original alternatives"],
		},
		{
			content: "## Decision\n\n## Consequences",
			expected: { context: "Original context", decision: "", consequences: "" },
			alternatives: "Original alternatives",
			cleared: ["Keep decision", "Keep consequences"],
		},
	])("clears explicit empty sections and retains omitted sections: $content", async (testCase) => {
		await update(
			"## Context\n\nOriginal context\n\n## Decision\n\nKeep decision\n\n## Consequences\n\nKeep consequences\n\n## Alternatives\n\nOriginal alternatives\n",
		);
		const updated = await update(testCase.content);
		expect(updated).toMatchObject(testCase.expected);
		expect(updated.alternatives).toBe(testCase.alternatives);
		const persisted = await Bun.file(decisionPath).text();
		for (const cleared of testCase.cleared) {
			expect(persisted).not.toContain(cleared);
		}
	});
});
