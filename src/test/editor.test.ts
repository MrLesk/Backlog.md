import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BacklogConfig } from "../types/index.ts";
import { openInEditor } from "../utils/editor.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("Editor utilities", () => {
	let originalEditor: string | undefined;

	beforeEach(() => {
		// Save original EDITOR env var
		originalEditor = process.env.EDITOR;
	});

	afterEach(() => {
		// Restore original EDITOR env var
		if (originalEditor !== undefined) {
			process.env.EDITOR = originalEditor;
		} else {
			delete process.env.EDITOR;
		}
	});

	describe("openInEditor", () => {
		let TEST_DIR: string;
		let testFile: string;

		beforeEach(async () => {
			TEST_DIR = createUniqueTestDir("test-editor");
			testFile = join(TEST_DIR, "test.txt");
			await mkdir(TEST_DIR, { recursive: true });
			await writeFile(testFile, "Test content");
		});

		afterEach(async () => {
			await safeCleanup(TEST_DIR);
		});

		it("should open file with echo command for testing", async () => {
			// Use echo as a safe test command that exists on all platforms
			// Clear EDITOR env var so config.defaultEditor is used
			delete process.env.EDITOR;
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
				defaultEditor: "echo",
			};

			const success = await openInEditor(testFile, config);
			expect(success).toBe(true);
		});

		it("should handle editor command failure gracefully", async () => {
			// Clear EDITOR env var so config.defaultEditor is used
			delete process.env.EDITOR;
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
				defaultEditor: "definitely-not-a-real-editor",
			};

			const success = await openInEditor(testFile, config);
			expect(success).toBe(false);
		});

		it("should wait for editor to complete before returning", async () => {
			// Create a simple Node.js script that delays then exits
			// This works cross-platform without needing shell/batch scripts
			// Clear EDITOR env var so config.defaultEditor is used
			delete process.env.EDITOR;
			const scriptPath = join(TEST_DIR, "test-editor.js");
			const scriptContent = `
				setTimeout(() => {
					process.exit(0);
				}, 100);
			`;
			await Bun.write(scriptPath, scriptContent);

			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
				defaultEditor: `node ${scriptPath}`,
			};

			const startTime = Date.now();
			const success = await openInEditor(testFile, config);
			const endTime = Date.now();

			expect(success).toBe(true);
			// Should have waited at least 90ms (allowing some margin)
			expect(endTime - startTime).toBeGreaterThanOrEqual(90);
		});

		it("should handle commands with arguments by splitting on spaces", async () => {
			// Test that editors with flags work correctly (like "nvim -c 'set noshowmode'")
			// Use echo with an argument as a simple test that exits immediately
			// Clear EDITOR env var so config.defaultEditor is used
			delete process.env.EDITOR;
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
				defaultEditor: "echo test-argument",
			};

			const success = await openInEditor(testFile, config);
			expect(success).toBe(true);
		});
	});
});
