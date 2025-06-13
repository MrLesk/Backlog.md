import { describe, expect, test } from "bun:test";
import {
	CODE_PATH_PATTERNS,
	extractCodePaths,
	isCodePath,
	styleCodePath,
	transformCodePaths,
	transformCodePathsPlain,
} from "../ui/code-path.ts";

describe("Code path utilities", () => {
	describe("CODE_PATH_PATTERNS", () => {
		test("should match backticked file paths", () => {
			const testCases = [
				"`src/cli.ts`",
				"`package.json`",
				"`/Users/name/project/file.ts`",
				"`./relative/path.js`",
				"`../parent/file.md`",
				"`C:\\Windows\\file.exe`",
			];

			for (const testCase of testCases) {
				// Reset regex for each test case
				CODE_PATH_PATTERNS.BACKTICKED_PATH.lastIndex = 0;
				expect(CODE_PATH_PATTERNS.BACKTICKED_PATH.test(testCase)).toBe(true);
			}
		});

		test("should not match non-path backticks", () => {
			const testCases = ["`just code`", "`function name`", "`variable`", "`123`"];

			for (const testCase of testCases) {
				// Reset regex lastIndex
				CODE_PATH_PATTERNS.BACKTICKED_PATH.lastIndex = 0;
				const match = testCase.match(CODE_PATH_PATTERNS.BACKTICKED_PATH);
				if (match) {
					const content = match[0].slice(1, -1);
					expect(isCodePath(content)).toBe(false);
				}
			}
		});
	});

	describe("isCodePath", () => {
		test("should detect file paths with extensions", () => {
			expect(isCodePath("src/cli.ts")).toBe(true);
			expect(isCodePath("package.json")).toBe(true);
			expect(isCodePath("file.md")).toBe(true);
			expect(isCodePath("/full/path/file.js")).toBe(true);
		});

		test("should detect paths with separators", () => {
			expect(isCodePath("src/utils")).toBe(true);
			expect(isCodePath("folder/subfolder")).toBe(true);
			expect(isCodePath("/absolute/path")).toBe(true);
			expect(isCodePath("C:\\Windows\\path")).toBe(true);
		});

		test("should not detect non-paths", () => {
			expect(isCodePath("just text")).toBe(false);
			expect(isCodePath("function")).toBe(false);
			expect(isCodePath("variable")).toBe(false);
			expect(isCodePath("123")).toBe(false);
		});
	});

	describe("extractCodePaths", () => {
		test("should extract file paths from text", () => {
			const text = "Check `src/cli.ts` and `package.json` for details.";
			const result = extractCodePaths(text);
			expect(result).toEqual(["src/cli.ts", "package.json"]);
		});

		test("should ignore non-path backticks", () => {
			const text = "Use `function` to call `src/cli.ts` method.";
			const result = extractCodePaths(text);
			expect(result).toEqual(["src/cli.ts"]);
		});

		test("should handle empty or no matches", () => {
			expect(extractCodePaths("No paths here")).toEqual([]);
			expect(extractCodePaths("Only `variables` here")).toEqual([]);
			expect(extractCodePaths("")).toEqual([]);
		});

		test("should handle complex paths", () => {
			const text = "Files: `/absolute/path/file.ts`, `./relative/file.js`, `../parent/file.md`";
			const result = extractCodePaths(text);
			expect(result).toEqual(["/absolute/path/file.ts", "./relative/file.js", "../parent/file.md"]);
		});
	});

	describe("styleCodePath", () => {
		test("should wrap path in gray styling tags", () => {
			const result = styleCodePath("src/cli.ts");
			expect(result).toBe("{gray-fg}`src/cli.ts`{/gray-fg}");
		});

		test("should handle paths with special characters", () => {
			const result = styleCodePath("/path/with-dashes_and.underscores.ts");
			expect(result).toBe("{gray-fg}`/path/with-dashes_and.underscores.ts`{/gray-fg}");
		});
	});

	describe("transformCodePaths", () => {
		test("should style isolated code paths", () => {
			const text = "Check this file: `src/cli.ts`";
			const result = transformCodePaths(text);
			expect(result).toBe("Check this file:\n{gray-fg}`src/cli.ts`{/gray-fg}");
		});

		test("should extract and separate multiple paths in prose", () => {
			const text = "Modify `src/cli.ts` and `src/ui/board.ts` to implement the feature.";
			const result = transformCodePaths(text);
			expect(result).toBe(
				"Modify and to implement the feature.\n{gray-fg}`src/cli.ts`{/gray-fg}\n{gray-fg}`src/ui/board.ts`{/gray-fg}",
			);
		});

		test("should preserve line breaks", () => {
			const text = "First line with `file1.ts`\nSecond line with `file2.js`";
			const result = transformCodePaths(text);
			expect(result).toContain("First line with\n{gray-fg}`file1.ts`{/gray-fg}");
			expect(result).toContain("Second line with\n{gray-fg}`file2.js`{/gray-fg}");
		});

		test("should handle text without code paths", () => {
			const text = "This is just regular text with `variables` and `functions`.";
			const result = transformCodePaths(text);
			expect(result).toBe(text);
		});

		test("should handle empty input", () => {
			expect(transformCodePaths("")).toBe("");
			// biome-ignore lint/suspicious/noExplicitAny: testing null/undefined inputs
			expect(transformCodePaths(null as any)).toBe(null);
			// biome-ignore lint/suspicious/noExplicitAny: testing null/undefined inputs
			expect(transformCodePaths(undefined as any)).toBe(undefined);
		});

		test("should handle only a path on a line", () => {
			const text = "`src/cli.ts`";
			const result = transformCodePaths(text);
			expect(result).toBe("{gray-fg}`src/cli.ts`{/gray-fg}");
		});
	});

	describe("transformCodePathsPlain", () => {
		test("should preserve code paths in plain text", () => {
			const text = "Check `src/cli.ts` and `package.json` files.";
			const result = transformCodePathsPlain(text);
			expect(result).toBe("Check `src/cli.ts` and `package.json` files.");
		});

		test("should ignore non-path backticks", () => {
			const text = "Use `function` to call `src/cli.ts` method.";
			const result = transformCodePathsPlain(text);
			expect(result).toBe("Use `function` to call `src/cli.ts` method.");
		});

		test("should handle empty input", () => {
			expect(transformCodePathsPlain("")).toBe("");
			// biome-ignore lint/suspicious/noExplicitAny: testing null/undefined inputs
			expect(transformCodePathsPlain(null as any)).toBe(null);
			// biome-ignore lint/suspicious/noExplicitAny: testing null/undefined inputs
			expect(transformCodePathsPlain(undefined as any)).toBe(undefined);
		});
	});

	describe("comprehensive path detection", () => {
		test("should capture 100% of code paths in test fixture", () => {
			const testFixture = `
Implementation details:
- Update \`src/cli.ts\` to add new command
- Modify \`src/ui/task-viewer.ts\` for display
- Check \`package.json\` for dependencies
- Test with \`/absolute/path/test.js\`
- Relative paths: \`./src/utils.ts\` and \`../config/settings.json\`

Also review the \`README.md\` file and \`biome.json\` configuration.
Windows paths like \`C:\\Users\\name\\file.txt\` should work too.
			`.trim();

			const extractedPaths = extractCodePaths(testFixture);

			// Verify we captured all expected paths
			const expectedPaths = [
				"src/cli.ts",
				"src/ui/task-viewer.ts",
				"package.json",
				"/absolute/path/test.js",
				"./src/utils.ts",
				"../config/settings.json",
				"README.md",
				"biome.json",
				"C:\\Users\\name\\file.txt",
			];

			expect(extractedPaths).toEqual(expectedPaths);
			expect(extractedPaths.length).toBe(9);
		});
	});
});
