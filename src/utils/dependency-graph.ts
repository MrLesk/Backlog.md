import type { Task } from "../types/index.ts";
import { canonicalTaskId } from "./task-id.ts";
import { createTaskRecordIndex } from "./task-record-index.ts";
import { compareTaskIds } from "./task-sorting.ts";

/** Which way a traversal walks the dependency edges away from the selected task. */
export type DependencyDirection = "dependencies" | "dependents";

/** How an identity named by the graph resolved inside the visible corpus. */
export type DependencyNodeState =
	/** Exactly one visible record claims the identity. */
	| "resolved"
	/** More than one record claims the identity, so no record may be chosen. */
	| "ambiguous"
	/** No visible record claims the identity. */
	| "missing";

export interface DependencyGraphNode {
	/** The record's own ID spelling when resolved, otherwise the reference as it was recorded. */
	id: string;
	title: string | null;
	status: string | null;
	state: DependencyNodeState;
	/** The record is in the completed corpus or holds the terminal status. Never true when unresolved. */
	completed: boolean;
	/** Hops along dependency edges from the root: 0 root, 1 direct, higher transitive, null unreachable. */
	dependencyDepth: number | null;
	/** Hops against dependency edges from the root: 0 root, 1 direct, higher transitive, null unreachable. */
	dependentDepth: number | null;
}

/** A directed edge. `from` declares the dependency, `to` is depended on, so `to` blocks `from`. */
export interface DependencyGraphEdge {
	from: string;
	to: string;
}

/**
 * The dependency context around one selected task: everything it transitively depends on and
 * everything that transitively depends on it, resolved once against a single visible corpus.
 */
export interface DependencyGraph {
	rootId: string;
	/** Every reached identity exactly once, root first, then ordered by task ID. */
	nodes: DependencyGraphNode[];
	/** Every reached edge exactly once, ordered by `from` then `to`. */
	edges: DependencyGraphEdge[];
}

type GraphEntry = { key: string; node: DependencyGraphNode };

/** The hop distance from the root in one direction, or null when the node is not reachable that way. */
export function depthInDirection(node: DependencyGraphNode, direction: DependencyDirection): number | null {
	return direction === "dependencies" ? node.dependencyDepth : node.dependentDepth;
}

/** The reached nodes in one direction, excluding the root, in graph order. */
export function nodesInDirection(graph: DependencyGraph, direction: DependencyDirection): DependencyGraphNode[] {
	return graph.nodes.filter((node) => {
		const depth = depthInDirection(node, direction);
		return depth !== null && depth > 0;
	});
}

/**
 * Resolve the complete dependency context around one task, on demand.
 *
 * The caller supplies the corpus, which is what keeps graph resolution inside the same visibility
 * the surface already uses for task detail: the CLI and TUI pass the current checkout plus the
 * completed records, the browser passes its configured cross-branch corpus. Archived records are
 * not part of any of those corpora, so an archived ID resolves as missing instead of being
 * resurrected after archiving released its identity.
 *
 * Both traversals are breadth-first over canonical identities, so every reached identity becomes
 * exactly one node carrying its shortest distance from the root, and chains, branches, diamonds,
 * and cycles all terminate without duplicating a node or repeating a subtree. Identities that no
 * visible record claims, and identities that more than one record claims, become explicit
 * unresolved nodes: they are reported, never guessed at, and never traversed through, so a
 * relationship behind one is never presented as resolved.
 */
export function buildDependencyGraph(
	root: Task,
	options: { tasks: Task[]; completedTasks?: Task[]; statuses?: readonly string[] },
): DependencyGraph {
	const index = createTaskRecordIndex(options);
	const rootKey = canonicalTaskId(root.id);
	const entries = new Map<string, GraphEntry>();
	const edges = new Map<string, { fromKey: string; toKey: string }>();

	const rootRecord = index.lookup(rootKey);
	entries.set(rootKey, {
		key: rootKey,
		node: {
			id: root.id,
			title: root.title,
			status: root.status,
			state: "resolved",
			completed: index.isFinished(
				rootRecord !== undefined && rootRecord !== "ambiguous" ? rootRecord : { task: root, completedRecord: false },
			),
			dependencyDepth: 0,
			dependentDepth: 0,
		},
	});

	const ensureEntry = (key: string, reference: string): GraphEntry => {
		const existing = entries.get(key);
		if (existing) return existing;

		const record = index.lookup(key);
		const base = { dependencyDepth: null, dependentDepth: null, completed: false } as const;
		let node: DependencyGraphNode;
		if (record === undefined) {
			node = { id: reference.trim() || key, title: null, status: null, state: "missing", ...base };
		} else if (record === "ambiguous") {
			node = { id: key, title: null, status: null, state: "ambiguous", ...base };
		} else {
			node = {
				id: record.task.id,
				title: record.task.title,
				status: record.task.status,
				state: "resolved",
				completed: index.isFinished(record),
				dependencyDepth: null,
				dependentDepth: null,
			};
		}
		const entry: GraphEntry = { key, node };
		entries.set(key, entry);
		return entry;
	};

	const addEdge = (fromKey: string, toKey: string) => {
		edges.set(`${fromKey} -> ${toKey}`, { fromKey, toKey });
	};

	// The declared dependencies of an identity. The root is answered from the caller's record so the
	// graph still resolves for a task that is not part of the supplied corpus.
	const dependenciesOf = (key: string): string[] => {
		if (key === rootKey) return root.dependencies ?? [];
		const record = index.lookup(key);
		return record !== undefined && record !== "ambiguous" ? (record.task.dependencies ?? []) : [];
	};

	// Who declares a dependency on an identity. Built in one pass so the reverse traversal stays
	// linear no matter how wide the corpus is.
	const declarers = new Map<string, Set<string>>();
	for (const record of index.records) {
		const fromKey = canonicalTaskId(record.task.id);
		for (const dependency of record.task.dependencies ?? []) {
			const toKey = canonicalTaskId(dependency);
			const existing = declarers.get(toKey);
			if (existing) existing.add(fromKey);
			else declarers.set(toKey, new Set([fromKey]));
		}
	}

	const traverse = (
		direction: DependencyDirection,
		neighbours: (key: string) => Array<{ key: string; reference: string }>,
	) => {
		const queue: Array<{ key: string; depth: number }> = [{ key: rootKey, depth: 0 }];
		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) break;
			const entry = entries.get(current.key);
			// Unresolved identities are never walked through: their edges cannot be attributed.
			if (entry?.node.state !== "resolved") continue;

			for (const neighbour of neighbours(current.key)) {
				const next = ensureEntry(neighbour.key, neighbour.reference);
				if (direction === "dependencies") addEdge(current.key, neighbour.key);
				else addEdge(neighbour.key, current.key);

				if (depthInDirection(next.node, direction) !== null) continue;
				if (direction === "dependencies") next.node.dependencyDepth = current.depth + 1;
				else next.node.dependentDepth = current.depth + 1;
				queue.push({ key: neighbour.key, depth: current.depth + 1 });
			}
		}
	};

	traverse("dependencies", (key) =>
		dependenciesOf(key).map((reference) => ({ key: canonicalTaskId(reference), reference })),
	);
	traverse("dependents", (key) =>
		[...(declarers.get(key) ?? [])].sort(compareTaskIds).map((declarer) => ({ key: declarer, reference: declarer })),
	);

	const rootEntry = entries.get(rootKey);
	const ordered = [...entries.values()]
		.filter((entry) => entry.key !== rootKey)
		.sort((a, b) => compareTaskIds(a.node.id, b.node.id));
	const orderedEntries = rootEntry ? [rootEntry, ...ordered] : ordered;
	const idByKey = new Map(orderedEntries.map((entry) => [entry.key, entry.node.id]));

	return {
		rootId: root.id,
		nodes: orderedEntries.map((entry) => entry.node),
		edges: [...edges.values()]
			.map((edge) => ({ from: idByKey.get(edge.fromKey) ?? edge.fromKey, to: idByKey.get(edge.toKey) ?? edge.toKey }))
			.sort((a, b) => compareTaskIds(a.from, b.from) || compareTaskIds(a.to, b.to)),
	};
}

export interface DependencyTreeNode {
	node: DependencyGraphNode;
	children: DependencyTreeNode[];
	/**
	 * Set when this occurrence is deliberately not expanded: `"cycle"` when it points back at an
	 * ancestor of this branch, `"repeat"` when the same node was already expanded elsewhere.
	 */
	repeat: "cycle" | "repeat" | null;
}

/**
 * Arrange one direction of the graph as a tree for display.
 *
 * Every node is expanded at most once across the whole tree, so a diamond or a cycle costs one
 * extra line instead of a duplicated subtree and the output stays linear in nodes plus edges.
 */
export function buildDependencyTree(graph: DependencyGraph, direction: DependencyDirection): DependencyTreeNode[] {
	const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
	const children = new Map<string, string[]>();
	for (const edge of graph.edges) {
		const parent = direction === "dependencies" ? edge.from : edge.to;
		const child = direction === "dependencies" ? edge.to : edge.from;
		const existing = children.get(parent);
		if (existing) existing.push(child);
		else children.set(parent, [child]);
	}
	for (const list of children.values()) list.sort(compareTaskIds);

	const expanded = new Set<string>([graph.rootId]);
	const branch = new Set<string>([graph.rootId]);

	const expand = (id: string): DependencyTreeNode[] => {
		const result: DependencyTreeNode[] = [];
		for (const childId of children.get(id) ?? []) {
			const node = nodesById.get(childId);
			if (!node) continue;
			if (branch.has(childId)) {
				result.push({ node, children: [], repeat: "cycle" });
				continue;
			}
			if (expanded.has(childId)) {
				result.push({ node, children: [], repeat: "repeat" });
				continue;
			}
			expanded.add(childId);
			// An unresolved identity is reported, never traversed through. The reverse traversal can
			// contribute edges leaving an ambiguous identity to the shared edge set, so the tree must
			// refuse to follow them rather than trust the traversals to have kept them out.
			if (node.state !== "resolved") {
				result.push({ node, children: [], repeat: null });
				continue;
			}
			branch.add(childId);
			result.push({ node, children: expand(childId), repeat: null });
			branch.delete(childId);
		}
		return result;
	};

	return expand(graph.rootId);
}
