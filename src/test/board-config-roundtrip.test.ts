import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import type { BacklogConfig } from "../types/index.ts";

let scratchRoots: string[] = [];

afterEach(() => {
	for (const root of scratchRoots) {
		try {
			rmSync(root, { recursive: true, force: true });
		} catch {}
	}
	scratchRoots = [];
});

const scratchProject = (): string => {
	const root = mkdtempSync(join(tmpdir(), "backlog-board-config-test-"));
	scratchRoots.push(root);
	return root;
};

const baseConfig = (overrides: Partial<BacklogConfig> = {}): BacklogConfig => ({
	projectName: "Test Project",
	statuses: ["To Do", "In Progress", "Done"],
	labels: ["bug", "feature"],
	dateFormat: "yyyy-mm-dd",
	...overrides,
});

/**
 * Save the config on one FileSystem instance, then reload through a SECOND
 * FileSystem instance pointed at the same project root. The second
 * instance has an empty in-memory cache, so loadConfig is guaranteed to
 * reparse from disk — that's what we need to actually exercise the
 * parser/serializer round-trip rather than the post-save cache.
 *
 * The brief retry loop absorbs Windows filesystem-flush latency that
 * occasionally leaves the file unreadable for a few milliseconds after
 * Bun.write returns.
 */
const writeAndLoad = async (project: string, config: BacklogConfig): Promise<BacklogConfig> => {
	const writer = new FileSystem(project);
	await writer.ensureBacklogStructure();
	await writer.saveConfig(config);
	let loaded: BacklogConfig | null = null;
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const reader = new FileSystem(project);
		loaded = await reader.loadConfig();
		if (loaded !== null) break;
		await new Promise((r) => setTimeout(r, 25));
	}
	expect(loaded).not.toBeNull();
	return loaded as BacklogConfig;
};

describe("BacklogConfig board: round-trip", () => {
	it("preserves an absent board: block (no key added by save)", async () => {
		const loaded = await writeAndLoad(scratchProject(), baseConfig());
		expect(loaded.board).toBeUndefined();
	});

	it("collapses { board: {} } to undefined — semantically identical to no overrides", async () => {
		// A `board:` section with no `columns` field is the same as no
		// section at all per the parser/serializer contract — both mean
		// "use defaults". The round-trip should normalize them.
		const loaded = await writeAndLoad(scratchProject(), baseConfig({ board: {} }));
		expect(loaded.board).toBeUndefined();
	});

	it("preserves an explicit empty columns array as { columns: [] } (hide all)", async () => {
		// Distinct from { board: {} }: this represents the user's explicit
		// intent to hide every column. Must survive disk round-trip so the
		// resolver/consumer can render an empty board.
		const loaded = await writeAndLoad(scratchProject(), baseConfig({ board: { columns: [] } }));
		expect(loaded.board).toBeDefined();
		expect(loaded.board?.columns).toEqual([]);
	});

	it("round-trips a single column with default color (no color field)", async () => {
		const loaded = await writeAndLoad(
			scratchProject(),
			baseConfig({ board: { columns: [{ status: "To Do" }] } }),
		);
		expect(loaded.board?.columns).toEqual([{ status: "To Do" }]);
	});

	it("round-trips a subset of statuses in custom order", async () => {
		const loaded = await writeAndLoad(
			scratchProject(),
			baseConfig({
				board: {
					columns: [{ status: "Done" }, { status: "To Do" }],
				},
			}),
		);
		expect(loaded.board?.columns).toEqual([{ status: "Done" }, { status: "To Do" }]);
	});

	it("round-trips columns with custom colors", async () => {
		const loaded = await writeAndLoad(
			scratchProject(),
			baseConfig({
				board: {
					columns: [
						{ status: "To Do", color: "#cccccc" },
						{ status: "In Progress", color: "rgb(0, 120, 255)" },
						{ status: "Done", color: "green" },
					],
				},
			}),
		);
		expect(loaded.board?.columns).toEqual([
			{ status: "To Do", color: "#cccccc" },
			{ status: "In Progress", color: "rgb(0, 120, 255)" },
			{ status: "Done", color: "green" },
		]);
	});

	it("preserves unrelated fields when board: is present", async () => {
		const loaded = await writeAndLoad(
			scratchProject(),
			baseConfig({
				defaultAssignee: "alice",
				defaultStatus: "To Do",
				autoCommit: true,
				maxColumnWidth: 30,
				labels: ["bug", "feature", "chore"],
				board: {
					columns: [
						{ status: "To Do" },
						{ status: "Done", color: "#0f0" },
					],
				},
			}),
		);
		expect(loaded.projectName).toBe("Test Project");
		expect(loaded.defaultAssignee).toBe("alice");
		expect(loaded.defaultStatus).toBe("To Do");
		expect(loaded.autoCommit).toBe(true);
		expect(loaded.maxColumnWidth).toBe(30);
		expect(loaded.labels).toEqual(["bug", "feature", "chore"]);
		expect(loaded.statuses).toEqual(["To Do", "In Progress", "Done"]);
		expect(loaded.board?.columns).toEqual([
			{ status: "To Do" },
			{ status: "Done", color: "#0f0" },
		]);
	});

	it("ignores invalid column entries (non-object, missing status, empty status)", async () => {
		// The parser is defensive — malformed columns from a hand edit
		// should be skipped silently rather than crashing config load.
		const fs = new FileSystem(scratchProject());
		await fs.ensureBacklogStructure();
		await fs.saveConfig(baseConfig());
		const hand = [
			'project_name: "Test"',
			'statuses: ["To Do", "In Progress", "Done"]',
			"labels: []",
			"date_format: yyyy-mm-dd",
			"board:",
			"  columns:",
			'    - status: "To Do"',
			'    - status: ""', // empty
			"    - foo: bar", // missing status
			'    - status: "Done"',
			'      color: "#abc"',
		].join("\n");
		await Bun.write(join(fs.backlogDir, "config.yml"), hand);
		// FileSystem caches config — use a fresh instance to read what's on disk.
		const fresh = new FileSystem(fs.rootDir);
		const loaded = await fresh.loadConfig();
		expect(loaded?.board?.columns).toEqual([{ status: "To Do" }, { status: "Done", color: "#abc" }]);
	});

	it("hide-all end-to-end: save → load → resolveBoardColumns returns []", async () => {
		// Settings UI's "uncheck every row" emits { columns: [] }. That
		// state must survive disk and resolve to an empty column list (not
		// silently re-expand to the default board).
		const { resolveBoardColumns } = await import("../utils/resolve-board-config.ts");
		const loaded = await writeAndLoad(scratchProject(), baseConfig({ board: { columns: [] } }));
		expect(loaded.board?.columns).toEqual([]);
		expect(resolveBoardColumns(loaded)).toEqual([]);
	});

	it("survives a config save → load → save cycle without value drift", async () => {
		const project = scratchProject();
		const original = baseConfig({
			board: {
				columns: [
					{ status: "To Do", color: "#cccccc" },
					{ status: "Done", color: "green" },
				],
			},
		});
		const first = await writeAndLoad(project, original);
		// Save again from what we loaded; reload; assert identical.
		const fs = new FileSystem(project);
		await fs.saveConfig(first);
		const second = await fs.loadConfig();
		expect(second?.board?.columns).toEqual(first.board?.columns);
	});
});
