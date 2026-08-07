import type { Task } from "../../types/index.ts";
import { canonicalTaskId } from "../../utils/task-id.ts";

/** Canonical task ID -> the ID used in `/tasks/:id` routes. */
export type TaskIdIndex = Map<string, string>;

export function buildTaskIdIndex(tasks: Task[]): TaskIdIndex {
	const index: TaskIdIndex = new Map();
	for (const task of tasks) {
		index.set(canonicalTaskId(task.id), task.id);
	}
	return index;
}

/** Minimal mdast shape: only the fields this transform reads or writes. */
type MarkdownNode = {
	type: string;
	value?: string;
	url?: string;
	children?: MarkdownNode[];
};

const TASK_ID_CANDIDATE = /[A-Za-z]+-\d+(?:\.\d+)*/g;
/** A candidate preceded by one of these is part of a longer identifier or path. */
const PRECEDING_REJECT = /[A-Za-z0-9_\-/.]/;
/** A candidate followed by an identifier character or a file extension is not an ID reference. */
const FOLLOWING_REJECT = /^[A-Za-z0-9_-]|^\.[A-Za-z0-9]/;
/** Text inside these nodes already points somewhere; never rewrite it. */
const SKIPPED_NODES = new Set(["link", "linkReference", "definition"]);

function splitTaskIds(value: string, index: TaskIdIndex): MarkdownNode[] | null {
	let parts: MarkdownNode[] | null = null;
	let cursor = 0;

	TASK_ID_CANDIDATE.lastIndex = 0;
	let match = TASK_ID_CANDIDATE.exec(value);
	while (match) {
		const candidate = match[0];
		const start = match.index;
		const end = start + candidate.length;
		const preceding = start === 0 ? "" : value.charAt(start - 1);
		const taskId = index.get(canonicalTaskId(candidate));

		if (taskId && !PRECEDING_REJECT.test(preceding) && !FOLLOWING_REJECT.test(value.slice(end, end + 2))) {
			parts ??= [];
			if (start > cursor) {
				parts.push({ type: "text", value: value.slice(cursor, start) });
			}
			parts.push({ type: "link", url: `/tasks/${taskId}`, children: [{ type: "text", value: candidate }] });
			cursor = end;
		}

		match = TASK_ID_CANDIDATE.exec(value);
	}

	if (!parts) return null;
	if (cursor < value.length) {
		parts.push({ type: "text", value: value.slice(cursor) });
	}
	return parts;
}

function linkTaskIds(node: MarkdownNode, index: TaskIdIndex): void {
	const children = node.children;
	if (!children) return;

	const rewritten: MarkdownNode[] = [];
	let changed = false;
	for (const child of children) {
		if (child.type === "text" && typeof child.value === "string") {
			const parts = splitTaskIds(child.value, index);
			if (parts) {
				rewritten.push(...parts);
				changed = true;
				continue;
			}
		} else if (!SKIPPED_NODES.has(child.type)) {
			linkTaskIds(child, index);
		}
		rewritten.push(child);
	}

	if (changed) {
		node.children = rewritten;
	}
}

/**
 * Remark plugin that turns known task IDs in markdown text into `/tasks/:id` links.
 * Code fences and inline code hold no text children in mdast, so they are excluded by construction.
 */
export function createTaskIdLinkPlugin(index: TaskIdIndex) {
	return () => (tree: MarkdownNode) => {
		if (index.size > 0) {
			linkTaskIds(tree, index);
		}
	};
}
