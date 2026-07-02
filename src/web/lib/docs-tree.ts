import type { Document } from "../../types";

/**
 * Represents a folder node in the docs tree structure.
 * Each node contains docs directly in this folder and nested subfolders.
 */
export interface DocsTreeNode {
	/** Folder name (e.g., "guides") */
	name: string;
	/** Full folder path (e.g., "guides/auth") */
	path: string;
	/** Docs directly in this folder */
	docs: Document[];
	/** Nested subfolders */
	children: DocsTreeNode[];
}

/**
 * Result of building the docs tree structure.
 * Contains the hierarchical tree and any docs without folder paths.
 */
export interface DocsTreeResult {
	/** Top-level folder nodes */
	tree: DocsTreeNode[];
	/** Docs without folder path */
	ungroupedDocs: Document[];
}

/**
 * Builds a hierarchical tree structure from a flat list of documents.
 *
 * - Documents with a `path` field are organized into nested folders
 * - Documents without a `path` field are returned as ungrouped
 * - Folders and documents are sorted alphabetically
 * - Empty folders (no docs and no children) are removed
 *
 * @param docs - Array of documents to organize
 * @returns Tree structure and ungrouped documents
 */
export function buildDocsTree(docs: Document[]): DocsTreeResult {
	// Separate docs with path vs without path
	const groupedDocs: Document[] = [];
	const ungroupedDocs: Document[] = [];

	for (const doc of docs) {
		// Check if doc has a valid folder path
		if (!doc.path || doc.path === "") {
			ungroupedDocs.push(doc);
		} else {
			// Check if path contains a folder (has a slash)
			const pathParts = doc.path.split("/");
			if (pathParts.length === 1) {
				// No folder, just filename - treat as ungrouped
				ungroupedDocs.push(doc);
			} else {
				// Has folder path
				groupedDocs.push(doc);
			}
		}
	}

	// Build tree from grouped docs
	const tree = buildTreeFromDocs(groupedDocs);

	// Sort ungrouped docs alphabetically by title
	ungroupedDocs.sort((a, b) => a.title.localeCompare(b.title));

	return { tree, ungroupedDocs };
}

/**
 * Builds a nested tree structure from documents with paths.
 */
function buildTreeFromDocs(docs: Document[]): DocsTreeNode[] {
	const root: Map<string, DocsTreeNode> = new Map();

	for (const doc of docs) {
		const pathParts = doc.path!.split("/");
		const folderPathParts = pathParts.slice(0, -1);

		let parentMap = root;
		let parentNode: DocsTreeNode | null = null;

		for (let i = 0; i < folderPathParts.length; i++) {
			const folderName = folderPathParts[i]!;
			const folderPath = folderPathParts.slice(0, i + 1).join("/");

			const existingNode = parentMap.get(folderPath);
			let node: DocsTreeNode;

			if (existingNode) {
				node = existingNode;
			} else {
				node = {
					name: folderName,
					path: folderPath,
					docs: [],
					children: [],
				};
				parentMap.set(folderPath, node);

				if (parentNode) {
					parentNode.children.push(node);
				}
			}

			if (i === folderPathParts.length - 1) {
				node.docs.push(doc);
			}

			parentNode = node;
			parentMap = new Map(node.children.map((child) => [child.path, child]));
		}
	}

	// Convert map to array and sort
	const treeArray = Array.from(root.values());
	return sortAndCleanTree(treeArray);
}

/**
 * Sorts folders and docs alphabetically, and removes empty folders.
 */
function sortAndCleanTree(nodes: DocsTreeNode[]): DocsTreeNode[] {
	const cleanedNodes: DocsTreeNode[] = [];

	for (const node of nodes) {
		const cleanedChildren = sortAndCleanTree(node.children);

		node.docs.sort((a, b) => a.title.localeCompare(b.title));
		cleanedChildren.sort((a, b) => a.name.localeCompare(b.name));
		node.children = cleanedChildren;

		if (node.docs.length > 0 || node.children.length > 0) {
			cleanedNodes.push(node);
		}
	}

	cleanedNodes.sort((a, b) => a.name.localeCompare(b.name));

	return cleanedNodes;
}
