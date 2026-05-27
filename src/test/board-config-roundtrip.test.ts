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
 * The retry loop absorbs Windows filesystem-flush latency that can leave
 * the file unreadable or partially-flushed for tens to hundreds of ms
 * after Bun.write returns when the test runs in parallel with other
 * fs-heavy suites.
 */
const writeAndLoad = async (project: string, config: BacklogConfig): Promise<BacklogConfig> => {
	const writer = new FileSystem(project);
	await writer.ensureBacklogStructure();
	await writer.saveConfig(config);
	// Capture the expected configuration's board shape so the retry loop
	// can detect a partially-flushed read (where the file is parseable
	// but missing the board section we just wrote) and retry rather than
	// false-passing on a default-shaped config.
	const expectsBoard = config.board !== undefined;
	let loaded: BacklogConfig | null = null;
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const reader = new FileSystem(project);
		loaded = await reader.loadConfig();
		if (loaded !== null && (!expectsBoard || loaded.board !== undefined || isExplicitlyUndefinedBoard(config))) {
			break;
		}
		await new Promise((r) => setTimeout(r, 50));
	}
	expect(loaded).not.toBeNull();
	return loaded as BacklogConfig;
};

/**
 * Some round-trip cases intentionally save `{ board: {} }` or
 * `{ board: { card: { hide: [] } } }` and expect the reload to return
 * `loaded.board === undefined` (the documented collapse-to-default
 * contract). For those cases we must NOT retry on a missing board, or
 * the retry loop will time out chasing a state that will never appear.
 */
const isExplicitlyUndefinedBoard = (config: BacklogConfig): boolean => {
	if (!config.board) return true;
	const { columns, card } = config.board;
	const noColumns = columns === undefined;
	const noCard = !card?.hide || card.hide.length === 0;
	return noColumns && noCard;
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

	it("round-trips board.card.hide with a non-empty list", async () => {
		const loaded = await writeAndLoad(
			scratchProject(),
			baseConfig({ board: { card: { hide: ["id", "createdDate"] } } }),
		);
		expect(loaded.board?.card?.hide).toEqual(["id", "createdDate"]);
	});

	it("collapses board.card.hide: [] to undefined (equivalent to default)", async () => {
		const loaded = await writeAndLoad(scratchProject(), baseConfig({ board: { card: { hide: [] } } }));
		// Empty hide list is the default state — collapsed to undefined so
		// the round-trip is clean.
		expect(loaded.board).toBeUndefined();
	});

	it("ignores unknown card.hide entries silently on load", async () => {
		const fs = new FileSystem(scratchProject());
		await fs.ensureBacklogStructure();
		await fs.saveConfig(baseConfig());
		const hand = [
			'project_name: "Test"',
			'statuses: ["To Do", "In Progress", "Done"]',
			"labels: []",
			"date_format: yyyy-mm-dd",
			"board:",
			"  card:",
			"    hide:",
			'      - "id"',
			'      - "not_a_real_field"',
			'      - "createdDate"',
			'      - "id"', // duplicate
		].join("\n");
		await Bun.write(join(fs.backlogDir, "config.yml"), hand);
		const fresh = new FileSystem(fs.rootDir);
		const loaded = await fresh.loadConfig();
		expect(loaded?.board?.card?.hide).toEqual(["id", "createdDate"]);
	});

	it("round-trips columns AND card together without dropping either", async () => {
		const loaded = await writeAndLoad(
			scratchProject(),
			baseConfig({
				board: {
					columns: [{ status: "To Do" }, { status: "Done", color: "#0f0" }],
					card: { hide: ["assignee"] },
				},
			}),
		);
		expect(loaded.board?.columns).toEqual([{ status: "To Do" }, { status: "Done", color: "#0f0" }]);
		expect(loaded.board?.card?.hide).toEqual(["assignee"]);
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
