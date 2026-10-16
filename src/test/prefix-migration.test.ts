import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir, readlink, symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
import { migrateDraftPrefixes, needsDraftPrefixMigration } from "../core/prefix-migration.ts";
import { FileSystem } from "../file-system/operations.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, isWindows, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const itIfSymlinks = isWindows() ? it.skip : it;

describe("Draft Prefix Migration", () => {
	let filesystem: FileSystem;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-prefix-migration");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("needsDraftPrefixMigration", () => {
		it("should return false when config is null", () => {
			expect(needsDraftPrefixMigration(null)).toBe(false);
		});

		it("should return true when prefixes section is missing", () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
			};
			expect(needsDraftPrefixMigration(config)).toBe(true);
		});

		it("should return false when prefixes section exists", () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				prefixes: {
					task: "task",
				},
			};
			expect(needsDraftPrefixMigration(config)).toBe(false);
		});
	});

	describe("migrateDraftPrefixes", () => {
		it("should add prefixes section to config when drafts folder is empty", async () => {
			// Create initial config without prefixes
			const initialConfig: BacklogConfig = {
				projectName: "Test Project",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
			};
			await filesystem.saveConfig(initialConfig);

			// Run migration
			await migrateDraftPrefixes(filesystem);

			// Verify config has prefixes section
			const config = await filesystem.loadConfig();
			expect(config?.prefixes).toBeDefined();
			expect(config?.prefixes?.task).toBe("task");
		});

		it("should rename task-*.md files in drafts folder to draft-*.md", async () => {
			// Create initial config without prefixes
			const initialConfig: BacklogConfig = {
				projectName: "Test Project",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
			};
			await filesystem.saveConfig(initialConfig);

			// Create task-*.md file in drafts folder (old format)
			const draftsDir = await filesystem.getDraftsDir();
			const oldTask: Task = {
				id: "task-1",
				title: "Old Draft",
				status: "Draft",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
				description: "This is an old draft with task- prefix",
			};
			const content = serializeTask(oldTask);
			await Bun.write(join(draftsDir, "task-1 - Old Draft.md"), content);

			// Run migration
			await migrateDraftPrefixes(filesystem);

			// Verify old file is gone
			const files = await readdir(draftsDir);
			expect(files.some((f) => f.startsWith("task-1"))).toBe(false);

			// Verify new draft file exists
			expect(files.some((f) => f.startsWith("draft-1"))).toBe(true);

			// Verify draft can be loaded with draft- ID
			const migratedDraft = await filesystem.loadDraft("draft-1");
			expect(migratedDraft?.title).toBe("Old Draft");
			expect(migratedDraft?.id).toBe("DRAFT-1"); // IDs normalized to uppercase
		});

		it("should update IDs inside migrated files", async () => {
			// Create initial config without prefixes
			const initialConfig: BacklogConfig = {
				projectName: "Test Project",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
			};
			await filesystem.saveConfig(initialConfig);

			// Create task-*.md file in drafts folder
			const draftsDir = await filesystem.getDraftsDir();
			const oldTask: Task = {
				id: "task-5",
				title: "Draft with Task ID",
				status: "Draft",
				assignee: ["@developer"],
				createdDate: "2025-01-01",
				labels: ["feature"],
				dependencies: [],
				description: "Test draft",
			};
			const content = serializeTask(oldTask);
			await Bun.write(join(draftsDir, "task-5 - Draft with Task ID.md"), content);

			// Run migration
			await migrateDraftPrefixes(filesystem);

			// Verify ID was updated
			const migratedDraft = await filesystem.loadDraft("draft-1");
			expect(migratedDraft?.id).toBe("DRAFT-1"); // IDs normalized to uppercase
			expect(migratedDraft?.assignee).toEqual(["@developer"]);
			expect(migratedDraft?.labels).toEqual(["feature"]);
		});

		it("should handle multiple task-*.md files", async () => {
			// Create initial config without prefixes
			const initialConfig: BacklogConfig = {
				projectName: "Test Project",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
			};
			await filesystem.saveConfig(initialConfig);

			// Create multiple task-*.md files
			const draftsDir = await filesystem.getDraftsDir();
			const tasks = [
				{ id: "task-1", title: "First Draft" },
				{ id: "task-2", title: "Second Draft" },
				{ id: "task-3", title: "Third Draft" },
			];

			for (const t of tasks) {
				const task: Task = {
					...t,
					status: "Draft",
					assignee: [],
					createdDate: "2025-01-01",
					labels: [],
					dependencies: [],
				};
				const content = serializeTask(task);
				await Bun.write(join(draftsDir, `${t.id} - ${t.title}.md`), content);
			}

			// Run migration
			await migrateDraftPrefixes(filesystem);

			// Verify all files were migrated
			const files = await readdir(draftsDir);
			expect(files.filter((f) => f.startsWith("task-")).length).toBe(0);
			expect(files.filter((f) => f.startsWith("draft-")).length).toBe(3);

			// Verify drafts can be loaded
			const drafts = await filesystem.listDrafts();
			expect(drafts.length).toBe(3);
		});

		it("should be idempotent - running twice has same result", async () => {
			// Create initial config without prefixes
			const initialConfig: BacklogConfig = {
				projectName: "Test Project",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
			};
			await filesystem.saveConfig(initialConfig);

			// Create task-*.md file
			const draftsDir = await filesystem.getDraftsDir();
			const oldTask: Task = {
				id: "task-1",
				title: "Draft",
				status: "Draft",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
			};
			const content = serializeTask(oldTask);
			await Bun.write(join(draftsDir, "task-1 - Draft.md"), content);

			// Run migration first time
			await migrateDraftPrefixes(filesystem);

			// Get state after first migration
			const filesAfterFirst = await readdir(draftsDir);
			const configAfterFirst = await filesystem.loadConfig();

			// Run migration second time
			await migrateDraftPrefixes(filesystem);

			// Verify state is the same
			const filesAfterSecond = await readdir(draftsDir);
			const configAfterSecond = await filesystem.loadConfig();

			expect(filesAfterSecond).toEqual(filesAfterFirst);
			expect(configAfterSecond?.prefixes).toEqual(configAfterFirst?.prefixes);
		});

		it("should not affect existing draft-*.md files", async () => {
			// Create initial config without prefixes
			const initialConfig: BacklogConfig = {
				projectName: "Test Project",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
			};
			await filesystem.saveConfig(initialConfig);

			// Create an existing draft-*.md file (correct format)
			const existingDraft: Task = {
				id: "draft-1",
				title: "Existing Draft",
				status: "Draft",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
			};
			await filesystem.saveDraft(existingDraft);

			// Create a task-*.md file (old format)
			const draftsDir = await filesystem.getDraftsDir();
			const oldTask: Task = {
				id: "task-5",
				title: "Old Format Draft",
				status: "Draft",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
			};
			const content = serializeTask(oldTask);
			await Bun.write(join(draftsDir, "task-5 - Old Format Draft.md"), content);

			// Run migration
			await migrateDraftPrefixes(filesystem);

			// Verify existing draft is unchanged
			const existingLoaded = await filesystem.loadDraft("draft-1");
			expect(existingLoaded?.title).toBe("Existing Draft");

			// Verify new draft was created with next available ID
			const drafts = await filesystem.listDrafts();
			expect(drafts.length).toBe(2);
			expect(drafts.map((d) => d.id).sort()).toEqual(["DRAFT-1", "DRAFT-2"]);
		});

		itIfSymlinks(
			"leaves a file it cannot convert in place and records the prefixes only once every file is converted",
			async () => {
				await filesystem.saveConfig({
					projectName: "Test Project",
					statuses: ["To Do", "In Progress", "Done"],
					labels: [],
					milestones: [],
					dateFormat: "YYYY-MM-DD",
				});
				const draftsDir = await filesystem.getDraftsDir();
				const legacyDraft = (id: string, title: string): string =>
					serializeTask({
						id,
						title,
						status: "Draft",
						assignee: [],
						createdDate: new Date().toISOString().slice(0, 10),
						labels: [],
						dependencies: [],
					});
				const beta = legacyDraft("task-2", "Beta");
				await Bun.write(join(draftsDir, "task-1 - Alpha.md"), legacyDraft("task-1", "Alpha"));
				await Bun.write(join(draftsDir, "task-2 - Beta.md"), beta);
				// Whichever number Beta is given, the path of its draft file is taken by a link whose target
				// is missing. No draft listing returns such a link, so its number is handed out.
				const missingTarget = join(TEST_DIR, "never-created.md");
				const blockers = ["draft-1 - Beta.md", "draft-2 - Beta.md"];
				for (const blocker of blockers) {
					await symlink(missingTarget, join(draftsDir, blocker));
				}

				await expect(migrateDraftPrefixes(filesystem)).rejects.toThrow(
					/task-2 - Beta\.md: Cannot write .*another file already exists at that path and was left unchanged/,
				);

				const afterFirstRun = await readdir(draftsDir);
				expect(afterFirstRun.filter((name) => /^draft-\d+ - Alpha\.md$/.test(name))).toHaveLength(1);
				expect(afterFirstRun).not.toContain("task-1 - Alpha.md");
				expect(await Bun.file(join(draftsDir, "task-2 - Beta.md")).text()).toBe(beta);
				for (const blocker of blockers) {
					expect(await readlink(join(draftsDir, blocker))).toBe(missingTarget);
				}
				expect(await Bun.file(missingTarget).exists()).toBe(false);
				expect((await new FileSystem(TEST_DIR).loadConfig())?.prefixes).toBeUndefined();

				// With the obstacle gone, the next run converts the remaining file and finishes.
				for (const blocker of blockers) {
					await unlink(join(draftsDir, blocker));
				}
				await migrateDraftPrefixes(filesystem);

				const afterSecondRun = await readdir(draftsDir);
				expect(afterSecondRun.filter((name) => name.startsWith("task-"))).toEqual([]);
				expect(afterSecondRun.filter((name) => /^draft-\d+ - (Alpha|Beta)\.md$/.test(name))).toHaveLength(2);
				expect((await new FileSystem(TEST_DIR).loadConfig())?.prefixes).toEqual({ task: "task" });
			},
		);
	});
});
