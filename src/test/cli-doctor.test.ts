import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { serializeDecision, serializeDocument, serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const cliPath = getTestCliPath();
let testDir: string;
let core: Core;

function makeTask(id: string, title: string): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies: [],
		rawContent: `## Description\n\n${title} content with TASK-1 reference.`,
	};
}

async function removeDuplicateTasks(): Promise<void> {
	await unlink(join(core.filesystem.tasksDir, "task-01 - Beta.md"));
	await unlink(join(core.filesystem.completedDir, "task-001 - Gamma.md"));
}

async function writeDocument(relativePath: string, id: string, title: string): Promise<void> {
	const filePath = join(core.filesystem.docsDir, ...relativePath.split("/"));
	await mkdir(join(filePath, ".."), { recursive: true });
	await Bun.write(
		filePath,
		serializeDocument({ id, title, type: "other", createdDate: "2026-01-01 00:00", rawContent: title }),
	);
}

async function writeDecision(filename: string, id: string, title: string): Promise<void> {
	await mkdir(core.filesystem.decisionsDir, { recursive: true });
	await Bun.write(
		join(core.filesystem.decisionsDir, filename),
		serializeDecision({
			id,
			title,
			date: "2026-01-01 00:00",
			status: "proposed",
			context: "",
			decision: "",
			consequences: "",
			rawContent: "",
		}),
	);
}

async function writeDuplicateTasks(): Promise<void> {
	await Bun.write(join(core.filesystem.tasksDir, "task-1 - Alpha.md"), serializeTask(makeTask("TASK-1", "Alpha")));
	await Bun.write(join(core.filesystem.tasksDir, "task-01 - Beta.md"), serializeTask(makeTask("TASK-01", "Beta")));
	await Bun.write(
		join(core.filesystem.completedDir, "task-001 - Gamma.md"),
		serializeTask(makeTask("TASK-001", "Gamma")),
	);
}

beforeEach(async () => {
	testDir = createUniqueTestDir("cli-doctor");
	await mkdir(testDir, { recursive: true });
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "CLI doctor",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});
	await writeDuplicateTasks();
});

afterEach(async () => {
	core.disposeSearchService();
	core.disposeContentStore();
	await safeCleanup(testDir);
});

describe("backlog doctor", () => {
	it("prints a path-qualified human repair preview without agent instructions", async () => {
		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Repair preview (no files changed)");
		expect(output).toContain("backlog/tasks/task-01 - Beta.md");
		expect(output).toContain("backlog/completed/task-001 - Gamma.md");
		expect(output).toContain("References requiring human review");
		expect(output.toLowerCase()).not.toContain("copy repair instructions");
		expect(output.toLowerCase()).not.toContain("agent");
	});

	it("repairs all duplicates noninteractively only with explicit --fix --yes", async () => {
		const result = await $`bun ${cliPath} doctor --fix --yes`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(0);
		expect(output).toContain("Repaired 2 duplicate task files");
		expect(output).toContain("Verification passed");
		expect((await core.previewDuplicateTaskIdRepair()).groups).toEqual([]);
	});

	it("requires --fix when --yes is supplied", async () => {
		const result = await $`bun ${cliPath} doctor --yes`.cwd(testDir).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("--yes can only be used together with --fix");
	});

	it("reports cross-branch collisions as diagnostic-only", async () => {
		await $`bun ${cliPath} doctor --fix --yes`.cwd(testDir).quiet();
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		config.checkActiveBranches = true;
		config.activeBranchDays = 30;
		config.remoteOperations = false;
		await core.filesystem.saveConfig(config);
		await $`git init -b main`.cwd(testDir).quiet();
		const alphaPath = join(core.filesystem.tasksDir, "task-20 - Branch Alpha.md");
		await Bun.write(alphaPath, serializeTask(makeTask("TASK-20", "Branch Alpha")));
		await $`git add .`.cwd(testDir).quiet();
		await $`git commit -m "main task"`.cwd(testDir).quiet();
		await $`git switch -c feature`.cwd(testDir).quiet();
		await unlink(alphaPath);
		await Bun.write(
			join(core.filesystem.tasksDir, "task-20 - Branch Beta.md"),
			serializeTask(makeTask("TASK-20", "Branch Beta")),
		);
		await $`git add -A`.cwd(testDir).quiet();
		await $`git commit -m "feature task"`.cwd(testDir).quiet();
		await $`git switch main`.cwd(testDir).quiet();

		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Possible cross-branch ID collisions (diagnostic only)");
		expect(output).toContain("feature:backlog/tasks/task-20 - Branch Beta.md");
		expect(output).toContain("will not edit another branch");
	});

	it.skipIf(process.platform === "win32")(
		"reports an incomplete reference scan instead of claiming no references",
		async () => {
			const docsDir = join(core.filesystem.backlogDir, "docs");
			const unreadablePath = join(docsDir, "unreadable.md");
			await mkdir(docsDir, { recursive: true });
			await Bun.write(unreadablePath, "See TASK-1");
			await chmod(unreadablePath, 0o000);

			const result = await (async () => {
				try {
					return await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
				} finally {
					await chmod(unreadablePath, 0o600);
				}
			})();

			const output = `${result.stdout}${result.stderr}`;
			expect(result.exitCode).toBe(1);
			expect(output).toContain("Reference scan incomplete; repair is blocked");
			expect(output).toContain("Reference scan could not read backlog/docs/unreadable.md");
			expect(output).not.toContain("No textual references");
			expect(output).toContain("Resolve the blocked reasons above");
			expect(output).not.toContain("backlog doctor --fix");
		},
	);
});

describe("CLI collision safety", () => {
	it("diagnoses collisions in plain list and search output", async () => {
		const list = await $`bun ${cliPath} task list --plain`.cwd(testDir).quiet().nothrow();
		const search = await $`bun ${cliPath} search Alpha --plain`.cwd(testDir).quiet().nothrow();
		for (const result of [list, search]) {
			const output = `${result.stdout}${result.stderr}`;
			expect(result.exitCode).toBe(1);
			expect(output).toContain("duplicate task ID");
			expect(output).toContain("backlog doctor");
			expect(output).toContain("backlog/tasks/task-1 - Alpha.md");
		}
	});

	it("blocks ambiguous reads and mutations without changing either file", async () => {
		const alphaPath = join(core.filesystem.tasksDir, "task-1 - Alpha.md");
		const betaPath = join(core.filesystem.tasksDir, "task-01 - Beta.md");
		const alphaBefore = await Bun.file(alphaPath).text();
		const betaBefore = await Bun.file(betaPath).text();
		const view = await $`bun ${cliPath} task view TASK-1 --plain`.cwd(testDir).quiet().nothrow();
		const edit = await $`bun ${cliPath} task edit TASK-1 --title Changed`.cwd(testDir).quiet().nothrow();

		for (const result of [view, edit]) {
			const output = `${result.stdout}${result.stderr}`;
			expect(result.exitCode).toBe(1);
			expect(output).toContain("is ambiguous");
			expect(output).toContain("task-1 - Alpha.md");
			expect(output).toContain("task-01 - Beta.md");
		}
		expect(await Bun.file(alphaPath).text()).toBe(alphaBefore);
		expect(await Bun.file(betaPath).text()).toBe(betaBefore);
	});

	it("blocks board export before a collapsed view can overwrite the destination", async () => {
		const outputPath = join(testDir, "Collision-board.md");
		await Bun.write(outputPath, "sentinel board content");

		const result = await $`bun ${cliPath} board export Collision-board.md --force`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("duplicate task ID");
		expect(output).toContain("backlog/tasks/task-1 - Alpha.md");
		expect(output).toContain("backlog/completed/task-001 - Gamma.md");
		expect(await Bun.file(outputPath).text()).toBe("sentinel board content");
	});
});

describe("document and decision identity", () => {
	beforeEach(async () => {
		await removeDuplicateTasks();
	});

	it("reports a project with no colliding IDs as healthy", async () => {
		await writeDocument("doc-1 - Alpha.md", "doc-1", "Alpha");
		await writeDecision("decision-1 - Alpha.md", "decision-1", "Alpha");

		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(0);
		expect(output).toContain("No duplicate task, document, decision, or draft IDs found.");
	});

	it("reports duplicate and drifted draft identities and contributes to the exit code", async () => {
		await writeDocument("doc-1 - Alpha.md", "doc-1", "Alpha");
		await writeDecision("decision-1 - Alpha.md", "decision-1", "Alpha");

		const draftsDir = await core.filesystem.getDraftsDir();
		await Bun.write(
			join(draftsDir, "draft-1 - Alpha.md"),
			serializeTask({ ...makeTask("DRAFT-1", "Alpha"), status: "Draft" }),
		);
		await Bun.write(
			join(draftsDir, "draft-01 - Beta.md"),
			serializeTask({ ...makeTask("DRAFT-01", "Beta"), status: "Draft" }),
		);
		await Bun.write(join(draftsDir, "draft-2 - Drifted.md"), "---\nid: DRAFT-9\ntitle: Drifted\n---\ndrifted body");

		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Duplicate draft IDs (diagnostic only):");
		expect(output).toContain("draft-01 - Beta.md");
		expect(output).toContain("draft-1 - Alpha.md");
		expect(output).toContain("Drifted draft files (frontmatter id does not match filename):");
		expect(output).toContain("frontmatter declares DRAFT-9, filename declares DRAFT-2");
		expect(output).toContain("Fix the frontmatter id or rename each file so they agree.");
	});

	it("detects duplicate document and decision IDs", async () => {
		await writeDocument("doc-1 - Alpha.md", "doc-1", "Alpha");
		await writeDocument("nested/doc-01 - Beta.md", "doc-01", "Beta");
		await writeDecision("decision-2 - Gamma.md", "decision-2", "Gamma");
		await writeDecision("decision-002 - Delta.md", "decision-002", "Delta");

		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Duplicate document IDs (diagnostic only)");
		expect(output).toContain("backlog/docs/doc-1 - Alpha.md");
		expect(output).toContain("backlog/docs/nested/doc-01 - Beta.md");
		expect(output).toContain("Duplicate decision IDs (diagnostic only)");
		expect(output).toContain("backlog/decisions/decision-2 - Gamma.md");
		expect(output).toContain("backlog/decisions/decision-002 - Delta.md");
	});

	it("surfaces documents and decisions without an id as malformed", async () => {
		await writeDocument("orphan.md", "", "Orphan doc");
		await writeDecision("decision-orphan.md", "", "Orphan decision");

		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("Malformed document files without an id in frontmatter");
		expect(output).toContain("backlog/docs/orphan.md");
		expect(output).toContain("Malformed decision files without an id in frontmatter");
		expect(output).toContain("backlog/decisions/decision-orphan.md");
	});

	it("never reports healthy when a document or decision file cannot be parsed", async () => {
		await writeDocument("doc-1 - Alpha.md", "doc-1", "Alpha");
		// gray-matter rejects an unterminated flow collection, so these files cannot be parsed at all.
		await Bun.write(
			join(core.filesystem.docsDir, "doc-2 - Broken.md"),
			"---\nid: doc-2\ntitle: [unterminated\n---\n\ndoc body\n",
		);
		await Bun.write(
			join(core.filesystem.decisionsDir, "decision-2 - Broken.md"),
			"---\nid: decision-2\ntitle: [unterminated\n---\n\ndecision body\n",
		);

		const result = await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).not.toContain("No duplicate task, document, decision, or draft IDs found.");
		expect(output).toContain("Unreadable document files");
		expect(output).toContain("backlog/docs/doc-2 - Broken.md");
		expect(output).toContain("Unreadable decision files");
		expect(output).toContain("backlog/decisions/decision-2 - Broken.md");
	});

	it.skipIf(process.platform === "win32")("reports a document directory it cannot scan", async () => {
		await writeDocument("doc-1 - Alpha.md", "doc-1", "Alpha");
		// chmod is a no-op for root, so confirm the directory really became unreadable first.
		await chmod(core.filesystem.docsDir, 0o000);
		const reallyLocked = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.docsDir }))
			.then(() => false)
			.catch(() => true);
		if (!reallyLocked) {
			await chmod(core.filesystem.docsDir, 0o755);
			return;
		}

		const result = await (async () => {
			try {
				return await $`bun ${cliPath} doctor`.cwd(testDir).quiet().nothrow();
			} finally {
				await chmod(core.filesystem.docsDir, 0o755);
			}
		})();

		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).not.toContain("No duplicate task, document, decision, or draft IDs found.");
		expect(output).toContain("Unreadable document files or directories");
		expect(output).toContain("backlog/docs");
	});

	it("keeps valid documents readable when a sibling file cannot be parsed", async () => {
		await writeDocument("doc-1 - Alpha.md", "doc-1", "Alpha");
		await Bun.write(
			join(core.filesystem.docsDir, "doc-2 - Broken.md"),
			"---\nid: doc-2\ntitle: [unterminated\n---\n\ndoc body\n",
		);

		const result = await $`bun ${cliPath} doc view doc-1 --plain`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(0);
		expect(output).toContain("Alpha");
		expect(output).not.toContain("not found");
	});

	it("refuses to repair document findings with --fix", async () => {
		await writeDocument("doc-1 - Alpha.md", "doc-1", "Alpha");
		await writeDocument("nested/doc-01 - Beta.md", "doc-01", "Beta");

		const result = await $`bun ${cliPath} doctor --fix --yes`.cwd(testDir).quiet().nothrow();
		const output = `${result.stdout}${result.stderr}`;
		expect(result.exitCode).toBe(1);
		expect(output).toContain("cannot be repaired automatically");
		expect(await Bun.file(join(core.filesystem.docsDir, "doc-1 - Alpha.md")).exists()).toBe(true);
		expect(await Bun.file(join(core.filesystem.docsDir, "nested", "doc-01 - Beta.md")).exists()).toBe(true);
	});

	it("blocks ambiguous document reads and mutations instead of picking a winner", async () => {
		await writeDocument("doc-1 - Alpha.md", "doc-1", "Alpha");
		await writeDocument("nested/doc-01 - Beta.md", "doc-01", "Beta");
		const alphaPath = join(core.filesystem.docsDir, "doc-1 - Alpha.md");
		const alphaBefore = await Bun.file(alphaPath).text();

		const view = await $`bun ${cliPath} doc view doc-1 --plain`.cwd(testDir).quiet().nothrow();
		const update = await $`bun ${cliPath} doc update doc-1 --title Changed`.cwd(testDir).quiet().nothrow();

		for (const result of [view, update]) {
			const output = `${result.stdout}${result.stderr}`;
			expect(result.exitCode).toBe(1);
			expect(output).toContain("Document ID doc-1 is ambiguous");
			expect(output).toContain("doc-1 - Alpha.md");
			expect(output).toContain("nested/doc-01 - Beta.md");
			expect(output).toContain("backlog doctor");
		}
		expect(await Bun.file(alphaPath).text()).toBe(alphaBefore);
	});
});
