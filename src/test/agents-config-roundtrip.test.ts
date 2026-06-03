import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import type { AgentConfig, BacklogConfig } from "../types/index.ts";

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
	const root = mkdtempSync(join(tmpdir(), "backlog-agents-config-test-"));
	scratchRoots.push(root);
	return root;
};

const baseConfig = (overrides: Partial<BacklogConfig> = {}): BacklogConfig => ({
	projectName: "Test Project",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	dateFormat: "yyyy-mm-dd",
	...overrides,
});

/**
 * Save on one FileSystem instance, reload through a SECOND instance pointed
 * at the same root so loadConfig reparses from disk (empty cache) rather than
 * returning the post-save cached object. The retry loop absorbs Windows
 * filesystem-flush latency under parallel fs-heavy suites.
 */
const writeAndLoad = async (project: string, config: BacklogConfig): Promise<BacklogConfig> => {
	const writer = new FileSystem(project);
	await writer.ensureBacklogStructure();
	await writer.saveConfig(config);
	const expectsAgents = config.agents !== undefined && config.agents.length > 0;
	let loaded: BacklogConfig | null = null;
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const reader = new FileSystem(project);
		loaded = await reader.loadConfig();
		if (loaded !== null && (!expectsAgents || loaded.agents !== undefined)) {
			break;
		}
		await new Promise((r) => setTimeout(r, 50));
	}
	expect(loaded).not.toBeNull();
	return loaded as BacklogConfig;
};

describe("BacklogConfig agents: model/effort round-trip", () => {
	it("round-trips alias + binary with no model/effort (fields omitted)", async () => {
		const agents: AgentConfig[] = [{ alias: "Coder", binary: "claude" }];
		const loaded = await writeAndLoad(scratchProject(), baseConfig({ agents }));
		expect(loaded.agents).toEqual([{ alias: "Coder", binary: "claude" }]);
	});

	it("round-trips model on its own", async () => {
		const agents: AgentConfig[] = [{ alias: "Coder", binary: "claude", model: "sonnet" }];
		const loaded = await writeAndLoad(scratchProject(), baseConfig({ agents }));
		expect(loaded.agents).toEqual([{ alias: "Coder", binary: "claude", model: "sonnet" }]);
	});

	it("round-trips effort on its own", async () => {
		const agents: AgentConfig[] = [{ alias: "Reviewer", binary: "claude", effort: "medium" }];
		const loaded = await writeAndLoad(scratchProject(), baseConfig({ agents }));
		expect(loaded.agents).toEqual([{ alias: "Reviewer", binary: "claude", effort: "medium" }]);
	});

	it("round-trips model + effort together across multiple agents", async () => {
		const agents: AgentConfig[] = [
			{ alias: "Coder", binary: "claude", model: "sonnet", effort: "high" },
			{ alias: "Reviewer", binary: "claude", model: "sonnet", effort: "medium" },
			{ alias: "Godex", binary: "codex" },
		];
		const loaded = await writeAndLoad(scratchProject(), baseConfig({ agents }));
		expect(loaded.agents).toEqual(agents);
	});

	it("drops empty/whitespace model and effort on save", async () => {
		const fs = new FileSystem(scratchProject());
		await fs.ensureBacklogStructure();
		await fs.saveConfig(baseConfig({ agents: [{ alias: "Coder", binary: "claude", model: "  ", effort: "" }] }));
		const fresh = new FileSystem(fs.rootDir);
		const loaded = await fresh.loadConfig();
		expect(loaded?.agents).toEqual([{ alias: "Coder", binary: "claude" }]);
	});

	it("ignores non-string model/effort from a hand edit", async () => {
		const fs = new FileSystem(scratchProject());
		await fs.ensureBacklogStructure();
		await fs.saveConfig(baseConfig());
		const hand = [
			'project_name: "Test"',
			'statuses: ["To Do", "In Progress", "Done"]',
			"labels: []",
			"date_format: yyyy-mm-dd",
			"agents:",
			"  - alias: Coder",
			"    binary: claude",
			"    model: 42",
			"    effort: true",
		].join("\n");
		await Bun.write(join(fs.backlogDir, "config.yml"), hand);
		const fresh = new FileSystem(fs.rootDir);
		const loaded = await fresh.loadConfig();
		expect(loaded?.agents).toEqual([{ alias: "Coder", binary: "claude" }]);
	});

	it("survives a save → load → save cycle without drift", async () => {
		const project = scratchProject();
		const original = baseConfig({
			agents: [{ alias: "Coder", binary: "claude", model: "sonnet", effort: "high" }],
		});
		const first = await writeAndLoad(project, original);
		const fs = new FileSystem(project);
		await fs.saveConfig(first);
		const second = await fs.loadConfig();
		expect(second?.agents).toEqual(first.agents);
	});
});
