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

/** Blessed reads `{...}` as style tags, so a stored title's braces must render as characters. */
function escapeBlessedTags(text: string): string {
	return text.replace(/[{}]/g, (brace) => (brace === "{" ? "{open}" : "{close}"));
}

/**
 * The same node label, colored for the terminal. Unresolved identities are called out, finished
 * work recedes, and the wording itself stays the one every surface uses.
 */
export function formatDependencyNodeTuiLabel(node: DependencyGraphNode): string {
	const label = escapeBlessedTags(formatDependencyNodeLabel(node));
	if (node.state !== "resolved") return `{yellow-fg}${label}{/}`;
	if (node.completed) return `{gray-fg}${label}{/}`;
	return label;
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

type TreeFrame = { children: DependencyTreeNode[]; position: number; prefix: string };

function appendTreeEntries(
	children: DependencyTreeNode[],
	entries: DependencyGraphEntry[],
	formatLabel: (node: DependencyGraphNode) => string,
): void {
	// Depth-first with an explicit stack, so a pathological dependency chain cannot exhaust the call
	// stack. Each level still extends the parent prefix by one fixed segment, which is the same
	// per-line indentation the rendered output itself carries.
	const stack: TreeFrame[] = [{ children, position: 0, prefix: "" }];
	while (stack.length > 0) {
		const frame = stack[stack.length - 1];
		const child = frame?.children[frame.position];
		if (!frame || !child) {
			stack.pop();
			continue;
		}
		frame.position += 1;
		const last = frame.position === frame.children.length;
		const suffix = child.repeat ? REPEAT_SUFFIXES[child.repeat] : "";
		entries.push({
			text: `${frame.prefix}${last ? "└─ " : "├─ "}${formatLabel(child.node)}${suffix}`,
			node: child.node,
		});
		if (child.children.length > 0) {
			stack.push({ children: child.children, position: 0, prefix: `${frame.prefix}${last ? "   " : "│  "}` });
		}
	}
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
	appendTreeEntries(buildDependencyTree(graph, direction), entries, options.formatLabel ?? formatDependencyNodeLabel);
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
