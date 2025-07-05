import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BacklogConfig } from "../types/index.ts";
import { isEditorAvailable, openInEditor, resolveEditor } from "../utils/editor.ts";

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
		it("should prioritize config defaultEditor over environment variable", () => {
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
		it("should detect available editors", () => {
			// Test with a command that should exist on the current platform
			const testEditor = process.platform === "win32" ? "notepad" : "ls";
			const available = isEditorAvailable(testEditor);
			// We can't guarantee any specific editor exists, so just verify the function works
			expect(typeof available).toBe("boolean");
		});

		it("should return false for non-existent editors", () => {
			const available = isEditorAvailable("definitely-not-a-real-editor-command");
			expect(available).toBe(false);
		});

		it("should handle editor commands with arguments", () => {
			const editor = process.platform === "win32" ? "notepad.exe" : "echo test";
			const available = isEditorAvailable(editor);
			expect(available).toBe(true);
		});
	});

	describe("openInEditor", () => {
		const testDir = join(process.cwd(), "test-editor");
		const testFile = join(testDir, "test.txt");

		beforeEach(async () => {
			await mkdir(testDir, { recursive: true });
			await writeFile(testFile, "Test content");
		});

		afterEach(async () => {
			await rm(testDir, { recursive: true, force: true }).catch(() => {});
		});

		it("should open file with echo command for testing", () => {
			// Use echo as a safe test command that exists on all platforms
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
				defaultEditor: "echo",
			};

			const success = openInEditor(testFile, config);
			expect(success).toBe(true);
		});

		it("should handle editor command failure gracefully", () => {
			const config: BacklogConfig = {
				projectName: "Test",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
				defaultEditor: "definitely-not-a-real-editor",
			};

			const success = openInEditor(testFile, config);
			expect(success).toBe(false);
		});
	});
});
