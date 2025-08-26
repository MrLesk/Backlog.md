import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BacklogConfig } from "../types/index.ts";
import { isEditorAvailable, openInEditor, resolveEditor } from "../utils/editor.ts";
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

	describe("resolveEditor", () => {
		it("should prioritize EDITOR environment variable over config defaultEditor", () => {
			process.env.EDITOR = "vim";
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
				defaultEditor: "code",
			};

			const editor = resolveEditor(config);
			expect(editor).toBe("vim");
		});

		it("should use config defaultEditor when EDITOR environment variable is not set", () => {
			delete process.env.EDITOR;
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
				defaultEditor: "code",
			};

			const editor = resolveEditor(config);
			expect(editor).toBe("code");
		});

		it("should use EDITOR environment variable when config has no defaultEditor", () => {
			process.env.EDITOR = "vim";
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
			};

			const editor = resolveEditor(config);
			expect(editor).toBe("vim");
		});

		it("should use platform default when neither config nor env var is set", () => {
			delete process.env.EDITOR;
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
			};

			const editor = resolveEditor(config);
			// Should return a platform-specific default
			expect(editor).toBeTruthy();
			expect(typeof editor).toBe("string");
		});

		it("should return platform default when config is null", () => {
			delete process.env.EDITOR;
			const editor = resolveEditor(null);
			expect(editor).toBeTruthy();
			expect(typeof editor).toBe("string");
		});
	});

	describe("isEditorAvailable", () => {
		it("should detect available editors", async () => {
			// Test with a command that should exist on the current platform
			const testEditor = process.platform === "win32" ? "notepad" : "ls";
			const available = await isEditorAvailable(testEditor);
			// We can't guarantee any specific editor exists, so just verify the function works
			expect(typeof available).toBe("boolean");
		});

		it("should return false for non-existent editors", async () => {
			const available = await isEditorAvailable("definitely-not-a-real-editor-command");
			expect(available).toBe(false);
		});

		it("should handle editor commands with arguments", async () => {
			const editor = process.platform === "win32" ? "notepad.exe" : "echo test";
			const available = await isEditorAvailable(editor);
			expect(available).toBe(true);
		});
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
			try {
				await safeCleanup(TEST_DIR);
			} catch {
				// Ignore cleanup errors
			}
		});

		it("should open file with echo command for testing", async () => {
			// Use echo as a safe test command that exists on all platforms
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
	});
});
