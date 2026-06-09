import { describe, expect, it } from "bun:test";
import type { Document } from "../../types";
import { buildDocsTree } from "./docs-tree";

const makeDoc = (overrides: Partial<Document>): Document => ({
	id: "doc-1",
	title: "Test Doc",
	type: "other",
	createdDate: "2024-01-01",
	rawContent: "",
	...overrides,
});

describe("buildDocsTree", () => {
	it("organizes single-level folder structure", () => {
		const docs = [
			makeDoc({ id: "doc-1", title: "API Guide", path: "guides/api.md" }),
			makeDoc({ id: "doc-2", title: "Setup Guide", path: "guides/setup.md" }),
		];

		const result = buildDocsTree(docs);

		expect(result.tree).toHaveLength(1);
		expect(result.tree[0]?.name).toBe("guides");
		expect(result.tree[0]?.path).toBe("guides");
		expect(result.tree[0]?.docs).toHaveLength(2);
		expect(result.tree[0]?.docs.map((d) => d.title)).toEqual(["API Guide", "Setup Guide"]);
		expect(result.tree[0]?.children).toHaveLength(0);
		expect(result.ungroupedDocs).toHaveLength(0);
	});

	it("builds multi-level folder hierarchy", () => {
		const docs = [
			makeDoc({ id: "doc-1", title: "Basic Auth", path: "guides/auth/basic.md" }),
			makeDoc({ id: "doc-2", title: "OAuth", path: "guides/auth/oauth.md" }),
			makeDoc({ id: "doc-3", title: "Main Guide", path: "guides/main.md" }),
		];

		const result = buildDocsTree(docs);

		expect(result.tree).toHaveLength(1);
		const guidesNode = result.tree[0];
		expect(guidesNode?.name).toBe("guides");
		expect(guidesNode?.docs).toHaveLength(1);
		expect(guidesNode?.docs[0]?.title).toBe("Main Guide");
		expect(guidesNode?.children).toHaveLength(1);

		const authNode = guidesNode?.children[0];
		expect(authNode?.name).toBe("auth");
		expect(authNode?.path).toBe("guides/auth");
		expect(authNode?.docs).toHaveLength(2);
		expect(authNode?.docs.map((d) => d.title)).toEqual(["Basic Auth", "OAuth"]);
		expect(authNode?.children).toHaveLength(0);
	});

	it("returns docs without path in ungroupedDocs", () => {
		const docs = [
			makeDoc({ id: "doc-1", title: "Root Doc 1" }),
			makeDoc({ id: "doc-2", title: "Root Doc 2", path: "" }),
			makeDoc({ id: "doc-3", title: "Root Doc 3", path: "filename.md" }), // No folder, just filename
		];

		const result = buildDocsTree(docs);

		expect(result.tree).toHaveLength(0);
		expect(result.ungroupedDocs).toHaveLength(3);
		expect(result.ungroupedDocs.map((d) => d.title)).toEqual(["Root Doc 1", "Root Doc 2", "Root Doc 3"]);
	});

	it("handles mixed folder and root docs", () => {
		const docs = [
			makeDoc({ id: "doc-1", title: "API Guide", path: "guides/api.md" }),
			makeDoc({ id: "doc-2", title: "Root Doc" }),
			makeDoc({ id: "doc-3", title: "Setup Guide", path: "guides/setup.md" }),
		];

		const result = buildDocsTree(docs);

		expect(result.tree).toHaveLength(1);
		expect(result.tree[0]?.name).toBe("guides");
		expect(result.tree[0]?.docs).toHaveLength(2);
		expect(result.ungroupedDocs).toHaveLength(1);
		expect(result.ungroupedDocs[0]?.title).toBe("Root Doc");
	});

	it("hides empty folders (no docs and no children)", () => {
		const docs = [
			makeDoc({ id: "doc-1", title: "API Guide", path: "guides/api.md" }),
			// Note: "guides/empty" folder would be created if there was a doc there,
			// but since there's no doc, it shouldn't appear in the tree
		];

		const result = buildDocsTree(docs);

		expect(result.tree).toHaveLength(1);
		expect(result.tree[0]?.name).toBe("guides");
		expect(result.tree[0]?.children).toHaveLength(0);
	});

	it("sorts folders and docs alphabetically", () => {
		const docs = [
			makeDoc({ id: "doc-1", title: "Zeta Guide", path: "guides/zeta.md" }),
			makeDoc({ id: "doc-2", title: "Alpha Guide", path: "guides/alpha.md" }),
			makeDoc({ id: "doc-3", title: "Beta Doc", path: "beta/beta.md" }),
			makeDoc({ id: "doc-4", title: "Alpha Doc", path: "alpha/alpha.md" }),
			makeDoc({ id: "doc-5", title: "Z Root" }),
			makeDoc({ id: "doc-6", title: "A Root" }),
		];

		const result = buildDocsTree(docs);

		// Folders should be sorted alphabetically
		expect(result.tree).toHaveLength(3);
		expect(result.tree[0]?.name).toBe("alpha");
		expect(result.tree[1]?.name).toBe("beta");
		expect(result.tree[2]?.name).toBe("guides");

		// Docs within folders should be sorted alphabetically
		const guidesDocs = result.tree[2]?.docs;
		expect(guidesDocs?.map((d) => d.title)).toEqual(["Alpha Guide", "Zeta Guide"]);

		// Ungrouped docs should be sorted alphabetically
		expect(result.ungroupedDocs.map((d) => d.title)).toEqual(["A Root", "Z Root"]);
	});

	it("handles deeply nested paths (5+ levels)", () => {
		const docs = [makeDoc({ id: "doc-1", title: "Deep Doc", path: "a/b/c/d/e/file.md" })];

		const result = buildDocsTree(docs);

		expect(result.tree).toHaveLength(1);
		expect(result.tree[0]?.name).toBe("a");
		expect(result.tree[0]?.path).toBe("a");
		expect(result.tree[0]?.docs).toHaveLength(0);
		expect(result.tree[0]?.children).toHaveLength(1);

		const bNode = result.tree[0]?.children[0];
		expect(bNode?.name).toBe("b");
		expect(bNode?.path).toBe("a/b");
		expect(bNode?.docs).toHaveLength(0);
		expect(bNode?.children).toHaveLength(1);

		const cNode = bNode?.children[0];
		expect(cNode?.name).toBe("c");
		expect(cNode?.path).toBe("a/b/c");
		expect(cNode?.docs).toHaveLength(0);
		expect(cNode?.children).toHaveLength(1);

		const dNode = cNode?.children[0];
		expect(dNode?.name).toBe("d");
		expect(dNode?.path).toBe("a/b/c/d");
		expect(dNode?.docs).toHaveLength(0);
		expect(dNode?.children).toHaveLength(1);

		const eNode = dNode?.children[0];
		expect(eNode?.name).toBe("e");
		expect(eNode?.path).toBe("a/b/c/d/e");
		expect(eNode?.docs).toHaveLength(1);
		expect(eNode?.docs[0]?.title).toBe("Deep Doc");
		expect(eNode?.children).toHaveLength(0);
	});

	it("handles malformed paths with double slashes gracefully", () => {
		const docs = [makeDoc({ id: "doc-1", title: "Malformed Doc", path: "guides//api.md" })];

		const result = buildDocsTree(docs);

		// Should not crash - creates empty folder node for double slash
		expect(result.tree).toHaveLength(1);
		expect(result.tree[0]?.name).toBe("guides");
		expect(result.tree[0]?.children).toHaveLength(1);

		const emptyNode = result.tree[0]?.children[0];
		expect(emptyNode?.name).toBe("");
		expect(emptyNode?.path).toBe("guides/");
		expect(emptyNode?.docs).toHaveLength(1);
		expect(emptyNode?.docs[0]?.title).toBe("Malformed Doc");
	});
});
