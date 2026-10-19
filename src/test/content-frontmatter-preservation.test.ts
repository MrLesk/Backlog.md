import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { FileSystem } from "../file-system/operations.ts";
import { parseDecision, parseDocument, parseMarkdown } from "../markdown/parser.ts";
import { serializeDocument } from "../markdown/serializer.ts";
import { McpServer } from "../mcp/server.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { BacklogServer } from "../server/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
const METADATA = [
	"# external owner",
	"owner: team",
	"depends_on: [example] # external dependency",
	"task: TASK-1",
	"reviewed: 2026-02-01",
	"ratio: 1.10",
	"code: 007",
	"assignee: [@alex]",
	"due_date: 2026-02-01",
	"'owner: team': platform",
	"approval:",
	"  # Keep this comment and the nested spelling.",
	"  version: 1.10",
	"  checks: [one, 'two']",
	"  note: |",
	"    title: text inside a value",
	"    ---",
	"external: &external {ratio: 1.10}",
	"external_copy: *external",
	"",
].join("\n");
const PREFIX_BODY = "---\nbody_key: stays in the body\n---\n\nFollowing text";

let root: string;
let filesystem: FileSystem;
let server: BacklogServer | undefined;
let mcp: McpServer | undefined;

async function writeDocument(metadata = METADATA): Promise<string> {
	const path = join(filesystem.docsDir, "doc-1 - Original.md");
	await Bun.write(
		path,
		`---\nid: doc-1\ntitle: Original\ntype: guide\ncreated_date: 2026-01-01\ntags: [old]\n${metadata}---\nOld body\n`,
	);
	return path;
}

async function startServer(): Promise<number> {
	server = new BacklogServer(root);
	await server.start(0, false);
	const port = server.getPort();
	if (!port) throw new Error("Test server did not get a port");
	return port;
}

describe("document and decision unknown frontmatter", () => {
	beforeEach(async () => {
		root = createUniqueTestDir("content-frontmatter");
		filesystem = new FileSystem(root);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Frontmatter preservation",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			filesystemOnly: true,
			remoteOperations: false,
			autoCommit: false,
		});
	});

	afterEach(async () => {
		await server?.stop();
		server = undefined;
		await mcp?.stop();
		mcp = undefined;
		await safeCleanup(root);
	});

	it("keeps the #1091 metadata through CLI content edits, moves and later tag clears", async () => {
		const originalPath = await writeDocument();
		await $`bun ${CLI_PATH} doc update doc-1 --content x`.cwd(root).quiet();
		const first = await Bun.file(originalPath).text();
		expect(first).toContain(METADATA);
		expect(parseDocument(first).rawContent).toBe("x");

		await $`bun ${CLI_PATH} doc update doc-1 --title Renamed --type specification --tags new --path guides`
			.cwd(root)
			.quiet();
		const movedPath = join(filesystem.docsDir, "guides/doc-1 - Renamed.md");
		expect(await Bun.file(originalPath).exists()).toBe(false);
		const moved = await Bun.file(movedPath).text();
		expect(moved).toContain(METADATA);
		expect(parseDocument(moved)).toMatchObject({
			title: "Renamed",
			type: "specification",
			tags: ["new"],
			rawContent: "x",
		});

		await $`bun ${CLI_PATH} doc update doc-1 --tags ${""}`.cwd(root).quiet();
		const repeated = await Bun.file(movedPath).text();
		expect(repeated).toContain(METADATA);
		expect(repeated.match(/^# external owner$/gm)).toHaveLength(1);
		expect(parseMarkdown(repeated).frontmatter).not.toHaveProperty("tags");
		expect(parseDocument(repeated).updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
	});

	it("keeps raw metadata through document HTTP saves without adding response fields", async () => {
		await writeDocument();
		const port = await startServer();
		for (const content of ["First body", "Second body"]) {
			const response = await fetch(`http://127.0.0.1:${port}/api/docs/doc-1`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "HTTP", content, type: "readme", path: "http", tags: [] }),
			});
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).not.toHaveProperty("depends_on");
			expect(body).not.toHaveProperty("customFields");
			const stored = await Bun.file(join(filesystem.docsDir, "http/doc-1 - HTTP.md")).text();
			expect(stored).toContain(METADATA);
			expect(parseDocument(stored)).toMatchObject({ title: "HTTP", type: "readme", rawContent: content });
			expect(parseMarkdown(stored).frontmatter).not.toHaveProperty("tags");
			const metadata = parseMarkdown(stored).frontmatter;
			expect(metadata.external_copy).toEqual(metadata.external);
		}
	});

	it("keeps metadata and a body starting with --- through repeated document MCP saves", async () => {
		await writeDocument();
		mcp = new McpServer(root, "Test instructions");
		const config = await mcp.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		registerDocumentTools(mcp, config);
		for (const title of ["MCP", "MCP again"]) {
			const result = await mcp.testInterface.callTool({
				params: {
					name: "document_update",
					arguments: { id: "doc-1", title, content: PREFIX_BODY, type: "other", path: "mcp", tags: [] },
				},
			});
			expect(result.isError).not.toBe(true);
			const stored = await Bun.file(join(filesystem.docsDir, `mcp/doc-1 - ${title.replaceAll(" ", "-")}.md`)).text();
			expect(stored).toContain(METADATA);
			expect(parseDocument(stored).rawContent).toBe(PREFIX_BODY);
			expect(parseMarkdown(stored).frontmatter).not.toHaveProperty("body_key");
		}
	});

	it("keeps decision metadata through HTTP full saves, renames and CLI status edits", async () => {
		const originalPath = join(filesystem.decisionsDir, "decision-1 - Original.md");
		await Bun.write(
			originalPath,
			`---\nid: decision-1\ntitle: Original\ndate: 2026-01-01\nstatus: proposed\n${METADATA}---\n## Context\n\nOld context\n\n## Decision\n\nOld decision\n\n## Consequences\n\nOld consequences\n`,
		);
		const port = await startServer();
		const movedPath = join(filesystem.decisionsDir, "decision-1 - Renamed.md");
		for (const context of ["First context", "Second context"]) {
			const response = await fetch(`http://127.0.0.1:${port}/api/decisions/decision-1`, {
				method: "PUT",
				body: `---\ntitle: Renamed\ndate: '2026-02-03'\nstatus: accepted\n---\n## Context\n\n${context}\n\n## Decision\n\nNew decision\n\n## Consequences\n\nNew consequences`,
			});
			expect(response.status).toBe(200);
			const stored = await Bun.file(movedPath).text();
			expect(stored).toContain(METADATA);
			expect(parseDecision(stored)).toMatchObject({
				title: "Renamed",
				date: "2026-02-03",
				status: "accepted",
				context,
				decision: "New decision",
				consequences: "New consequences",
			});
		}
		expect(await Bun.file(originalPath).exists()).toBe(false);
		const beforeStatus = await Bun.file(movedPath).text();
		await $`bun ${CLI_PATH} decision edit decision-1 -s superseded`.cwd(root).quiet();
		expect(await Bun.file(movedPath).text()).toBe(beforeStatus.replace("status: accepted", "status: superseded"));
	});

	it("keeps explicit null entries before an owned title and at the end across repeated saves", async () => {
		const filename = "doc-1 - Original.md";
		const source = "---\nid: doc-1\n? external\ntitle: Original\n? trailing\n---\nBody\n";
		await Bun.write(join(filesystem.docsDir, filename), source);
		const result = await filesystem.saveDocument({ ...parseDocument(source), path: filename, title: "Changed" });
		const savedPath = join(filesystem.docsDir, result.relativePath);
		const first = await Bun.file(savedPath).text();
		expect(first).toContain("? external\n? trailing\n");
		expect(first.match(/^title:/gm)).toHaveLength(1);
		expect(parseMarkdown(first).frontmatter).toMatchObject({ external: null, trailing: null, title: "Changed" });
		await filesystem.saveDocument({ ...parseDocument(first), path: result.relativePath });
		expect(await Bun.file(savedPath).text()).toBe(first);
	});

	it("refuses reference-breaking document CLI, HTTP and MCP saves before a rename or move", async () => {
		const originalPath = await writeDocument("owner: *title\n");
		const source = (await Bun.file(originalPath).text()).replace("title: Original", "title: &title Original");
		await Bun.write(originalPath, source);
		const originalBytes = await Bun.file(originalPath).bytes();
		const refusal = "Cannot save doc-1: the update would break a YAML reference in preserved frontmatter.";
		const unchanged = async () => {
			expect(await Bun.file(originalPath).bytes()).toEqual(originalBytes);
			expect(await readdir(filesystem.docsDir, { recursive: true })).toEqual(["doc-1 - Original.md"]);
		};
		const cli = await $`bun ${CLI_PATH} doc update doc-1 --title Changed --path moved --content Changed`
			.cwd(root)
			.quiet()
			.nothrow();
		expect(cli.exitCode).not.toBe(0);
		expect(cli.stderr.toString()).toContain(refusal);
		await unchanged();

		const port = await startServer();
		const response = await fetch(`http://127.0.0.1:${port}/api/docs/doc-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Changed", path: "moved", content: "Changed" }),
		});
		expect(response.status).toBe(400);
		expect((await response.json()).error).toContain(refusal);
		await unchanged();

		mcp = new McpServer(root, "Test instructions");
		const config = await mcp.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		registerDocumentTools(mcp, config);
		const result = await mcp.testInterface.callTool({
			params: {
				name: "document_update",
				arguments: {
					id: "doc-1",
					title: "Changed",
					path: "moved",
					content: "Changed",
				},
			},
		});
		expect(result.isError).toBe(true);
		expect(JSON.stringify(result.content)).toContain(refusal);
		await unchanged();
	});

	it("refuses a reference-breaking decision full save while status-only edits preserve the reference", async () => {
		const filename = "decision-1 - Original.md";
		const originalPath = join(filesystem.decisionsDir, filename);
		const source =
			"---\nid: decision-1\ntitle: &title Original\ndate: 2026-01-01\nstatus: proposed\nowner: *title\n---\n## Context\n\nBody\n";
		await Bun.write(originalPath, source);
		const originalBytes = await Bun.file(originalPath).bytes();
		const port = await startServer();
		const response = await fetch(`http://127.0.0.1:${port}/api/decisions/decision-1`, {
			method: "PUT",
			body: "---\ntitle: Changed\n---\n## Context\n\nChanged\n",
		});
		expect(response.status).toBe(400);
		expect((await response.json()).error).toContain("Cannot save decision-1: the update would break a YAML reference");
		expect(await Bun.file(originalPath).bytes()).toEqual(originalBytes);
		expect(await readdir(filesystem.decisionsDir)).toEqual([filename]);
		await $`bun ${CLI_PATH} decision edit decision-1 -s accepted`.cwd(root).quiet();
		expect(await Bun.file(originalPath).text()).toBe(source.replace("status: proposed", "status: accepted"));
	});

	it("refuses a preserved merge that would restore cleared document tags", async () => {
		const originalPath = join(filesystem.docsDir, "doc-1 - Original.md");
		const source = "---\nid: doc-1\ntitle: Original\ndefaults: &d {tags: [old]}\n<<: *d\n---\nBody\n";
		await Bun.write(originalPath, source);
		expect(parseDocument(source).tags).toEqual(["old"]);
		const originalBytes = await Bun.file(originalPath).bytes();
		const result = await $`bun ${CLI_PATH} doc update doc-1 --title Changed --path moved --tags ${""}`
			.cwd(root)
			.quiet()
			.nothrow();
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toString()).toContain(
			'a preserved YAML reference prevents applying the requested change to "tags"',
		);
		expect(await Bun.file(originalPath).bytes()).toEqual(originalBytes);
		expect(await readdir(filesystem.docsDir, { recursive: true })).toEqual(["doc-1 - Original.md"]);
	});

	it("keeps raw entries with CRLF and interleaved owned keys, and clears optional owned fields", () => {
		const source =
			"---\nid: doc-1\nratio: 1.10 # ratio\ntags: [old]\ncode: 007\ntitle: Original\nupdated_date: 2026-01-01\nreviewed: 2026-02-01\n---\nBody\n".replaceAll(
				"\n",
				"\r\n",
			);
		const saved = serializeDocument({ ...parseDocument(source), tags: [], updatedDate: undefined }, source);
		expect(saved).toContain("ratio: 1.10 # ratio\r\ncode: 007\r\nreviewed: 2026-02-01\r\n");
		expect(parseMarkdown(saved).frontmatter).not.toHaveProperty("tags");
		expect(parseMarkdown(saved).frontmatter).not.toHaveProperty("updated_date");
		expect(serializeDocument(parseDocument(saved), saved)).toBe(saved);
	});

	it("keeps a quoted # line inside an unknown value before a regenerated owned entry", () => {
		const source =
			'---\nid: doc-1\nnote: "first\n# still the quoted value"\n# title annotation\ntitle: Original\n---\nBody\n';
		const saved = serializeDocument({ ...parseDocument(source), title: "Changed", rawContent: "Changed body" }, source);
		expect(saved).toContain('note: "first\n# still the quoted value"\n');
		expect(parseMarkdown(saved).frontmatter).toMatchObject({
			note: "first # still the quoted value",
			title: "Changed",
		});
		expect(serializeDocument(parseDocument(saved), saved)).toBe(saved);
	});

	it("retains explicit unknown keys and the indentation of an existing root mapping", () => {
		const unknown = "  ? 'owner: team'\n  :\n    code: 007\n    note: |2\n      Keep these spaces\n  ratio: 1.10\n";
		const source = `---\n  id: doc-1\n  title: Original\n${unknown}---\nBody\n`;
		const saved = serializeDocument({ ...parseDocument(source), title: "Changed" }, source);
		expect(saved).toContain(unknown);
		expect(parseMarkdown(saved).frontmatter).toMatchObject({
			title: "Changed",
			"owner: team": { code: 7, note: "Keep these spaces\n" },
			ratio: 1.1,
		});
		expect(serializeDocument(parseDocument(saved), saved)).toBe(saved);
	});

	it("keeps flow-style root entries as raw values and never treats the supplied body as frontmatter", () => {
		const source =
			"---\n{id: doc-1, title: Original, external, code: 007, nested: {ratio: 1.10}, values: [a, b]}\n---\nBody";
		const saved = serializeDocument({ ...parseDocument(source), rawContent: PREFIX_BODY }, source);
		expect(saved).toContain("code: 007\nnested: {ratio: 1.10}\nvalues: [a, b]\n");
		expect(parseDocument(saved).rawContent).toBe(PREFIX_BODY);
		expect(parseMarkdown(saved).frontmatter).not.toHaveProperty("body_key");
		expect(parseMarkdown(saved).frontmatter.external).toBeNull();
	});
});
