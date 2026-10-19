import { isDeepStrictEqual } from "node:util";
import matter from "gray-matter";

/**
 * The only place in the codebase that talks to gray-matter.
 *
 * gray-matter keeps a module-level cache of parse results keyed by the input string and hands the
 * same `data` object back to every later caller, so one caller mutating its result silently changes
 * what the next parse of identical content returns, and a malformed file only throws on its first
 * parse. Passing an options object skips the cache entirely (gray-matter 4.x only reads and writes
 * the cache when `options` is falsy), so every call here passes one.
 */
export function parseFrontmatter(
	content: string,
	dateFields: readonly string[] = [],
): { data: Record<string, unknown>; content: string } {
	const starts: number[] = [];
	const dateScalars = new Map<Date, string>();
	const file = matter(content, {
		language: "yaml",
		...(dateFields.length > 0 && {
			listener(event: string, state: { position: number; input: string; kind: string; result: unknown }) {
				if (event === "open") {
					starts.push(state.position);
				} else {
					const start = starts.pop() ?? state.position;
					if (state.kind === "scalar" && state.result instanceof Date && !dateScalars.has(state.result)) {
						// Keep the innermost scalar; wrapper nodes can include preceding comments.
						// YAML has validated the scalar. Keep its written date/time, excluding tags or anchors.
						dateScalars.set(
							state.result,
							state.input
								.slice(start, state.position)
								.trim()
								.replace(/^(?:[!&]\S+\s+)*/, ""),
						);
					}
				}
			},
		}),
	});
	// Only record-owned fields opt in: opaque metadata keeps the YAML engine's normal meaning.
	// In particular, UTC midnight is a timestamp when its source includes a time, not a date-only value.
	for (const key of dateFields) {
		const value = file.data[key];
		if (value instanceof Date && dateScalars.has(value)) file.data[key] = dateScalars.get(value);
	}
	return { data: file.data, content: file.content };
}

export class FrontmatterReferenceError extends Error {
	constructor(id: unknown, reason: string, options?: ErrorOptions) {
		super(`Cannot save ${id}: ${reason}. Edit the reference or its anchor in the file, then try again.`, options);
	}
}

/**
 * Serialize owned fields above a body. When original source is supplied, keep unknown entries as
 * source text. Undefined owned fields are omitted, rather than recovered as unknown metadata.
 */
export function stringifyFrontmatter(content: string, data: Record<string, unknown>, originalContent?: string): string {
	if (originalContent === undefined) return matter.stringify(content, data, {});
	const ownedData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
	const unknown = preserveUnknownFrontmatter(originalContent, new Set(Object.keys(data)));
	// Passing a body object prevents gray-matter from interpreting a leading --- block as metadata.
	const serialized = matter.stringify({ content }, ownedData, {});
	if (!unknown.text) return serialized;
	const preserved = serialized.replace(
		/^(---\n)([\s\S]*?)\n---\n/,
		(_match, opening, fields) => `${opening}${fields.replace(/^/gm, unknown.indent)}\n${unknown.text}---\n`,
	);
	let actual: Record<string, unknown>;
	try {
		actual = parseFrontmatter(preprocessFrontmatter(preserved)).data;
	} catch (error) {
		if (
			error instanceof Error &&
			"reason" in error &&
			typeof error.reason === "string" &&
			error.reason.startsWith("unidentified alias ")
		) {
			throw new FrontmatterReferenceError(data.id, "the update would break a YAML reference in preserved frontmatter", {
				cause: error,
			});
		}
		throw error;
	}
	const intended = parseFrontmatter(preprocessFrontmatter(serialized)).data;
	for (const key of Object.keys(data)) {
		if (Object.hasOwn(actual, key) !== Object.hasOwn(intended, key) || !isDeepStrictEqual(actual[key], intended[key])) {
			throw new FrontmatterReferenceError(
				data.id,
				`a preserved YAML reference prevents applying the requested change to "${key}"`,
			);
		}
	}
	return preserved;
}

function preserveUnknownFrontmatter(content: string, ownedKeys: Set<string>): { text: string; indent: string } {
	// Extract without parsing first: existing Markdown accepts @assignee values after preprocessing.
	const raw = matter(content, { engines: { yaml: () => ({}) } }).matter;
	if (!raw) return { text: "", indent: "" };
	const lines = raw.split(/(?<=\n)/);
	const starts: number[] = [];
	let offset = 0;
	for (const line of lines) {
		starts.push(offset);
		offset += line.length;
	}
	type Node = { start: number; end: number; contentEnd: number; line: number; children: Node[]; result?: unknown };
	const stack: Node[] = [];
	const mappings: Node[] = [];
	// The existing YAML engine reports node boundaries. Locate its actual root mapping by object
	// identity, since a flow mapping has an extra parser wrapper. Keep source, never parsed values.
	const parsed = matter(`---${preprocessFrontmatter(raw)}\n---`, {
		language: "yaml",
		listener(
			event: string,
			state: { position: number; line: number; lineStart: number; kind: string; result: unknown },
		) {
			const position = (starts[state.line] ?? raw.length) + state.position - state.lineStart;
			if (event === "open") {
				stack.push({ start: position, end: position, contentEnd: position, line: state.line, children: [] });
			} else {
				const node = stack.pop();
				if (!node) return;
				node.end = position;
				// Block collections consume following separator comments; their final child still
				// identifies the value content. Keep the full source end separately for copying.
				node.contentEnd = node.children.at(-1)?.contentEnd ?? position;
				node.result = state.result;
				stack.at(-1)?.children.push(node);
				if (state.kind === "mapping") mappings.push(node);
			}
		},
	});
	const mapping = mappings.find((node) => node.result === parsed.data);
	if (!mapping) return { text: "", indent: "" };
	const flowMapping = raw[mapping.start] === "{";
	const indent = flowMapping ? "" : (lines[mapping.line]?.match(/^[ \t]*/)?.[0] ?? "");
	const entries: { key: string; start: number; end: number; contentEnd: number; omitted: boolean }[] = [];
	for (let index = 0; index < mapping.children.length; ) {
		const key = mapping.children[index];
		const value = mapping.children[index + 1];
		if (!key) break;
		// Explicit null entries have no value node. Only a colon between these parser nodes
		// introduces a value; comments in that gap cannot supply the separator.
		const separator = raw
			.slice(key.end, value?.start ?? mapping.end)
			.replace(/#[^\r\n]*/g, "")
			.trimStart();
		const hasValue = separator.startsWith(":");
		let firstLine = key.line;
		// Only comments after the preceding parsed value can introduce the following entry.
		// Deeper comments and # lines inside multiline scalars stay within that value's span.
		if (!flowMapping) {
			const previousEnd = entries.at(-1)?.contentEnd ?? 0;
			while (
				firstLine > 0 &&
				(starts[firstLine - 1] ?? 0) >= previousEnd &&
				lines[firstLine - 1]?.startsWith(`${indent}#`)
			) {
				firstLine--;
			}
		}
		entries.push({
			key: String(key.result),
			start: flowMapping ? key.start : (starts[firstLine] ?? key.start),
			end: hasValue && value ? value.end : key.end,
			contentEnd: hasValue && value ? value.contentEnd : key.contentEnd,
			omitted: !hasValue,
		});
		index += hasValue ? 2 : 1;
	}
	const text = entries
		.map((entry, index) => {
			if (ownedKeys.has(entry.key)) return "";
			const end = flowMapping ? entry.end : (entries[index + 1]?.start ?? raw.length);
			const source = `${flowMapping && entry.omitted ? "? " : ""}${raw.slice(entry.start, end)}`;
			return source.endsWith("\n") ? source : `${source}\n`;
		})
		.join("");
	return { text, indent };
}

function normalizeFlowList(prefix: string, rawValue: string): string | null {
	// Handle inline lists like assignee: [@user, "someone"]
	const match = rawValue.match(/^\[(.*)\]\s*(#.*)?$/);
	if (!match) return null;

	const listBody = match[1] ?? "";
	const comment = match[2];
	const items = listBody
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	const normalizedItems = items.map((entry) => {
		if (entry.startsWith("'") || entry.startsWith('"')) {
			return entry;
		}
		if (entry.startsWith("@")) {
			const escaped = entry.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
			return `"${escaped}"`;
		}
		return entry;
	});

	const trailingComment = comment ? ` ${comment}` : "";
	return `${prefix}[${normalizedItems.join(", ")}]${trailingComment}`;
}

export function preprocessFrontmatter(frontmatter: string): string {
	return frontmatter
		.split(/\r?\n/) // Handle both Windows (\r\n) and Unix (\n) line endings
		.map((line) => {
			// The key spelling matters: an unquoted timestamp left for YAML to resolve comes back as a
			// Date with its written offset already discarded, so a due date read under a quoted key
			// would land on a different day than the same value read under a bare one.
			const dueDateMatch = line.match(/^(\s*(?:due_date|"due_date"|'due_date')\s*:\s*)(.*)$/);
			if (dueDateMatch) {
				const prefix = dueDateMatch[1] ?? "";
				const raw = dueDateMatch[2] ?? "";
				const scalarMatch = raw.match(/^(.*?)(\s+#.*)?$/);
				const value = (scalarMatch?.[1] ?? raw).trim();
				const comment = scalarMatch?.[2] ?? "";
				const isYamlNull = /^(?:null|~)$/i.test(value);
				if (value && !isYamlNull && !value.startsWith("'") && !value.startsWith('"')) {
					return `${prefix}"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"${comment}`;
				}
			}

			// Handle both assignee and reporter fields that start with @
			const match = line.match(/^(\s*(?:assignee|reporter):\s*)(.*)$/);
			if (!match) return line;

			const prefix = match[1] ?? "";
			const raw = match[2] ?? "";
			const value = raw.trim();

			const normalizedFlowList = normalizeFlowList(prefix, value);
			if (normalizedFlowList !== null) {
				return normalizedFlowList;
			}

			if (
				value &&
				!value.startsWith("[") &&
				!value.startsWith("'") &&
				!value.startsWith('"') &&
				!value.startsWith("-")
			) {
				return `${prefix}"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
			}
			return line;
		})
		.join("\n"); // Always join with \n for consistent YAML parsing
}
