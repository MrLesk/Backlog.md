import { describe, expect, it } from "bun:test";
import { resolveWikiPath } from "../web/components/WikiDetail.tsx";

describe("resolveWikiPath", () => {
	it("resolves parent-directory traversal from a nested wiki page to another wiki page", () => {
		const result = resolveWikiPath("concepts/keyvault.md", "../developer-notes/security-gotchas");
		expect(result).toBe("wiki/developer-notes/security-gotchas");
	});

	it("resolves sibling reference with ./ inside wiki", () => {
		const result = resolveWikiPath("concepts/keyvault.md", "./related-topic");
		expect(result).toBe("wiki/concepts/related-topic");
	});

	it("returns wiki-subdir-relative path as-is when no relative segments", () => {
		const result = resolveWikiPath("concepts/keyvault.md", "developer-notes/security-gotchas");
		expect(result).toBe("developer-notes/security-gotchas");
	});

	it("resolves traversal from wiki root to sibling project directory", () => {
		const result = resolveWikiPath("backlog-md-user-guide-zh.md", "../wiki_output/reports/feature-opportunities");
		expect(result).toBe("wiki_output/reports/feature-opportunities");
	});

	it("returns null when traversal escapes project root (three levels up)", () => {
		const result = resolveWikiPath("concepts/keyvault.md", "../../../etc/passwd");
		expect(result).toBeNull();
	});

	it("returns null when traversal from wiki root escapes project root", () => {
		const result = resolveWikiPath("index.md", "../../outside");
		expect(result).toBeNull();
	});

	it("rejects absolute paths", () => {
		const result = resolveWikiPath("concepts/keyvault.md", "/absolute/path");
		expect(result).toBeNull();
	});

	it("handles multiple parent-directory segments within project", () => {
		const result = resolveWikiPath("a/b/c/page.md", "../../d/e");
		expect(result).toBe("wiki/a/d/e");
	});

	it("resolves path from a report sub-page to a sibling report inside wiki", () => {
		const result = resolveWikiPath("wiki_output/reports/backlog-md-user-guide-zh.md", "./feature-opportunities");
		expect(result).toBe("wiki/wiki_output/reports/feature-opportunities");
	});

	it("correctly normalizes mixed relative segments", () => {
		const result = resolveWikiPath(
			"wiki_output/reports/backlog-md-user-guide-zh.md",
			"../wiki_output/reports/feature-opportunities",
		);
		expect(result).toBe("wiki/wiki_output/wiki_output/reports/feature-opportunities");
	});
});
