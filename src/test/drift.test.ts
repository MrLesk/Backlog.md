import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { checkDrift, formatDriftResults } from "../core/drift.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("drift");
	await mkdir(TEST_DIR, { recursive: true });
	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	core = new Core(TEST_DIR);
	await initializeTestProject(core, "Drift Test Project", true);
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
});

async function createRefFile(name: string, content = "// placeholder"): Promise<void> {
	const filePath = join(TEST_DIR, name);
	const dir = join(filePath, "..");
	await mkdir(dir, { recursive: true });
	await writeFile(filePath, content);
	await $`git add ${name} && git commit -m "add ${name}"`.cwd(TEST_DIR).quiet();
}

async function createTaskWithRefs(taskId: string, title: string, refs: string[], status = "To Do"): Promise<Task> {
	const task: Task = {
		id: taskId,
		title,
		status,
		assignee: [],
		createdDate: "2025-01-01 00:00",
		labels: [],
		dependencies: [],
		references: refs,
	};
	await core.createTask(task);
	return task;
}

describe("Drift detection", () => {
	describe("dead refs", () => {
		it("detects references to deleted files", async () => {
			await createRefFile("src/auth.ts");
			await createTaskWithRefs("task-1", "Add auth", ["src/auth.ts"]);

			// Delete the file
			await $`git rm src/auth.ts && git commit -m "remove auth"`.cwd(TEST_DIR).quiet();

			const summary = await checkDrift(core);
			const deadRefs = summary.results.filter((r) => r.type === "dead-ref");
			expect(deadRefs.length).toBe(1);
			expect(deadRefs[0].taskId).toBe("TASK-1");
			expect(deadRefs[0].ref).toBe("src/auth.ts");
			expect(deadRefs[0].severity).toBe("error");
		});

		it("does not flag existing files", async () => {
			await createRefFile("src/utils.ts");
			await createTaskWithRefs("task-1", "Add utils", ["src/utils.ts"]);

			const summary = await checkDrift(core);
			const deadRefs = summary.results.filter((r) => r.type === "dead-ref");
			expect(deadRefs.length).toBe(0);
		});

		it("handles tasks with no refs", async () => {
			await createTaskWithRefs("task-1", "No refs task", []);

			const summary = await checkDrift(core);
			expect(summary.results.filter((r) => r.type === "dead-ref").length).toBe(0);
		});
	});

	describe("dependency state", () => {
		it("detects completed dependencies", async () => {
			const dep: Task = {
				id: "task-1",
				title: "Dependency task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01 00:00",
				labels: [],
				dependencies: [],
			};
			await core.createTask(dep);

			const dependent: Task = {
				id: "task-2",
				title: "Dependent task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01 00:00",
				labels: [],
				dependencies: ["task-1"],
			};
			await core.createTask(dependent);

			// Complete the dependency
			await core.updateTask({ ...dep, status: "Done" });

			const summary = await checkDrift(core);
			const depResults = summary.results.filter((r) => r.type === "dependency-state");
			expect(depResults.length).toBe(1);
			expect(depResults[0].taskId).toBe("TASK-2");
			expect(depResults[0].dependencyId).toBe("TASK-1");
			expect(depResults[0].severity).toBe("info");
		});

		it("does not flag incomplete dependencies", async () => {
			const dep: Task = {
				id: "task-1",
				title: "Dependency task",
				status: "In Progress",
				assignee: [],
				createdDate: "2025-01-01 00:00",
				labels: [],
				dependencies: [],
			};
			await core.createTask(dep);

			const dependent: Task = {
				id: "task-2",
				title: "Dependent task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01 00:00",
				labels: [],
				dependencies: ["task-1"],
			};
			await core.createTask(dependent);

			const summary = await checkDrift(core);
			expect(summary.results.filter((r) => r.type === "dependency-state").length).toBe(0);
		});
	});

	describe("orphaned tasks", () => {
		it("detects tasks where all refs are deleted", async () => {
			await createRefFile("src/a.ts");
			await createRefFile("src/b.ts");
			await createTaskWithRefs("task-1", "Multi-ref task", ["src/a.ts", "src/b.ts"]);

			// Delete both files
			await $`git rm src/a.ts src/b.ts && git commit -m "remove files"`.cwd(TEST_DIR).quiet();

			const summary = await checkDrift(core);
			const orphaned = summary.results.filter((r) => r.type === "orphaned-task");
			expect(orphaned.length).toBe(1);
			expect(orphaned[0].taskId).toBe("TASK-1");
			expect(orphaned[0].severity).toBe("warning");
		});

		it("does not flag tasks with at least one valid ref", async () => {
			await createRefFile("src/a.ts");
			await createRefFile("src/b.ts");
			await createTaskWithRefs("task-1", "Partial ref task", ["src/a.ts", "src/b.ts"]);

			// Delete only one file
			await $`git rm src/a.ts && git commit -m "remove a"`.cwd(TEST_DIR).quiet();

			const summary = await checkDrift(core);
			const orphaned = summary.results.filter((r) => r.type === "orphaned-task");
			expect(orphaned.length).toBe(0);
		});
	});

	describe("summary", () => {
		it("returns correct counts", async () => {
			await createRefFile("src/exists.ts");
			await createTaskWithRefs("task-1", "Has dead ref", ["src/missing.ts"]);
			await createTaskWithRefs("task-2", "Has valid ref", ["src/exists.ts"]);

			const summary = await checkDrift(core);
			expect(summary.errors).toBeGreaterThanOrEqual(1); // dead ref
			expect(summary.total).toBe(summary.errors + summary.warnings + summary.info);
		});

		it("returns empty results when no drift", async () => {
			await createRefFile("src/valid.ts");
			await createTaskWithRefs("task-1", "Valid task", ["src/valid.ts"]);

			const summary = await checkDrift(core);
			const relevant = summary.results.filter((r) => r.type === "dead-ref" || r.type === "orphaned-task");
			expect(relevant.length).toBe(0);
		});
	});

	describe("formatDriftResults", () => {
		it("shows no drift message when clean", () => {
			const output = formatDriftResults({ total: 0, errors: 0, warnings: 0, info: 0, results: [] });
			expect(output).toContain("No drift detected");
		});

		it("groups results by task", () => {
			const output = formatDriftResults({
				total: 2,
				errors: 2,
				warnings: 0,
				info: 0,
				results: [
					{
						taskId: "task-1",
						taskTitle: "My task",
						type: "dead-ref",
						severity: "error",
						message: 'Referenced file "src/a.ts" no longer exists',
						ref: "src/a.ts",
					},
					{
						taskId: "task-1",
						taskTitle: "My task",
						type: "dead-ref",
						severity: "error",
						message: 'Referenced file "src/b.ts" no longer exists',
						ref: "src/b.ts",
					},
				],
			});
			expect(output).toContain('task-1 "My task"');
			expect(output).toContain("src/a.ts");
			expect(output).toContain("src/b.ts");
			expect(output).toContain("2 error(s)");
		});
	});
});
