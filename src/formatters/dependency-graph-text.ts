import {
	buildDependencyTree,
	type DependencyDirection,
	type DependencyGraph,
	type DependencyGraphNode,
	type DependencyTreeNode,
	depthInDirection,
	nodesInDirection,
} from "../utils/dependency-graph.ts";

const DIRECTION_HEADINGS: Record<DependencyDirection, string> = {
	dependencies: "Depends on",
	dependents: "Dependents",
};

const UNRESOLVED_LABELS: Record<Exclude<DependencyGraphNode["state"], "resolved">, string> = {
	missing: "unknown task ID",
	ambiguous: "ambiguous task ID",
};

/**
 * One line describing a node.
 *
 * A finished record reads as `completed` rather than as its stored status, because a record can sit
 * in the completed corpus while its status string predates the current configuration. Unresolved
 * identities say so instead of borrowing a title they do not have.
 */
export function formatDependencyNodeLabel(node: DependencyGraphNode): string {
	if (node.state !== "resolved") {
		return `${node.id} - ${UNRESOLVED_LABELS[node.state]}`;
	}
	const state = node.completed ? "completed" : node.status;
	const suffix = state ? ` [${state}]` : "";
	const title = node.title?.trim();
	return title ? `${node.id} - ${title}${suffix}` : `${node.id}${suffix}`;
}

const REPEAT_SUFFIXES: Record<NonNullable<DependencyTreeNode["repeat"]>, string> = {
	cycle: " (cycle)",
	repeat: " (shown above)",
};

export type DependencyGraphTextOptions = {
	/** Decorate a node label, for a surface that can render more than plain characters. */
	formatLabel?: (node: DependencyGraphNode) => string;
};

/** One rendered line of the graph, keeping hold of the node it names for interactive surfaces. */
export type DependencyGraphEntry = {
	text: string;
	/** The node this line names, or null for headings and blank separators. */
	node: DependencyGraphNode | null;
};

function appendTreeEntries(
	children: DependencyTreeNode[],
	prefix: string,
	entries: DependencyGraphEntry[],
	formatLabel: (node: DependencyGraphNode) => string,
): void {
	children.forEach((child, position) => {
		const last = position === children.length - 1;
		const suffix = child.repeat ? REPEAT_SUFFIXES[child.repeat] : "";
		entries.push({ text: `${prefix}${last ? "└─ " : "├─ "}${formatLabel(child.node)}${suffix}`, node: child.node });
		appendTreeEntries(child.children, `${prefix}${last ? "   " : "│  "}`, entries, formatLabel);
	});
}

function formatSectionEntries(
	graph: DependencyGraph,
	direction: DependencyDirection,
	options: DependencyGraphTextOptions,
): DependencyGraphEntry[] {
	const reached = nodesInDirection(graph, direction);
	if (reached.length === 0) return [];

	const direct = reached.filter((node) => depthInDirection(node, direction) === 1).length;
	const entries: DependencyGraphEntry[] = [
		{ text: `${DIRECTION_HEADINGS[direction]} (${direct} direct, ${reached.length} total):`, node: null },
	];
	appendTreeEntries(
		buildDependencyTree(graph, direction),
		"",
		entries,
		options.formatLabel ?? formatDependencyNodeLabel,
	);
	return entries;
}

/** One direction of the graph as text, or no lines at all when nothing was reached that way. */
export function formatDependencyGraphSection(
	graph: DependencyGraph,
	direction: DependencyDirection,
	options: DependencyGraphTextOptions = {},
): string[] {
	return formatSectionEntries(graph, direction, options).map((entry) => entry.text);
}

/** Both directions as entries, each kept separate, or no entries at all for an isolated task. */
export function formatDependencyGraphEntries(
	graph: DependencyGraph,
	options: DependencyGraphTextOptions = {},
): DependencyGraphEntry[] {
	const sections = [
		formatSectionEntries(graph, "dependencies", options),
		formatSectionEntries(graph, "dependents", options),
	].filter((section) => section.length > 0);

	return sections.flatMap((section, position) => (position === 0 ? section : [{ text: "", node: null }, ...section]));
}

/** Both directions as text, each kept separate, or no lines at all for an isolated task. */
export function formatDependencyGraphLines(graph: DependencyGraph, options: DependencyGraphTextOptions = {}): string[] {
	return formatDependencyGraphEntries(graph, options).map((entry) => entry.text);
}
