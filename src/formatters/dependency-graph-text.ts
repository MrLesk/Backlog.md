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

function appendTreeLines(
	children: DependencyTreeNode[],
	prefix: string,
	lines: string[],
	formatLabel: (node: DependencyGraphNode) => string,
): void {
	children.forEach((child, position) => {
		const last = position === children.length - 1;
		const suffix = child.repeat ? REPEAT_SUFFIXES[child.repeat] : "";
		lines.push(`${prefix}${last ? "└─ " : "├─ "}${formatLabel(child.node)}${suffix}`);
		appendTreeLines(child.children, `${prefix}${last ? "   " : "│  "}`, lines, formatLabel);
	});
}

/** One direction of the graph as text, or no lines at all when nothing was reached that way. */
export function formatDependencyGraphSection(
	graph: DependencyGraph,
	direction: DependencyDirection,
	options: DependencyGraphTextOptions = {},
): string[] {
	const reached = nodesInDirection(graph, direction);
	if (reached.length === 0) return [];

	const direct = reached.filter((node) => depthInDirection(node, direction) === 1).length;
	const lines = [`${DIRECTION_HEADINGS[direction]} (${direct} direct, ${reached.length} total):`];
	appendTreeLines(buildDependencyTree(graph, direction), "", lines, options.formatLabel ?? formatDependencyNodeLabel);
	return lines;
}

/** Both directions as text, each kept separate, or no lines at all for an isolated task. */
export function formatDependencyGraphLines(graph: DependencyGraph, options: DependencyGraphTextOptions = {}): string[] {
	const sections = [
		formatDependencyGraphSection(graph, "dependencies", options),
		formatDependencyGraphSection(graph, "dependents", options),
	].filter((section) => section.length > 0);

	return sections.flatMap((section, position) => (position === 0 ? section : ["", ...section]));
}
