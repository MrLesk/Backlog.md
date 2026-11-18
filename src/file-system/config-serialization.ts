import { isDeepStrictEqual } from "node:util";
import { type Document, isCollection, isMap, isNode, isScalar, parseDocument, visit } from "yaml";
import type { BacklogConfig } from "../types/index.ts";

function commentsIn(value: unknown): string {
	if (!isNode(value)) return "";
	const comments: string[] = [];
	visit(value, {
		Node(_key, node) {
			if (node.commentBefore) comments.push(node.commentBefore);
			if (node.comment) comments.push(node.comment);
		},
	});
	return comments.join("\n");
}

/** The previous writer put editor commands in double quotes without escaping their backslashes. */
export function normalizeLegacyEditorConfig(content: string): string {
	const document = parseDocument(content, { uniqueKeys: false });
	if (!isMap(document.contents)) return content;
	let normalized = content;
	for (const pair of [...document.contents.items].reverse()) {
		if (!isScalar(pair.key) || pair.key.value !== "default_editor" || !isScalar(pair.value)) continue;
		if (pair.value.type !== "QUOTE_DOUBLE" || !pair.value.range) continue;
		const [start, end] = pair.value.range;
		const raw = content.slice(start, end);
		if (!raw.endsWith('"')) continue;
		const literal = raw.slice(1, -1).replaceAll("'", "''");
		normalized = `${normalized.slice(0, start)}'${literal}'${normalized.slice(end)}`;
	}
	return normalized;
}

/** Update Backlog-owned values in the user's YAML document, preserving custom entries and comments. */
export function serializeConfig(config: BacklogConfig, original: string | undefined, path: string): string {
	const values: Record<string, unknown> = {
		project_name: config.projectName,
		default_assignee: config.defaultAssignee?.length ? config.defaultAssignee : undefined,
		default_reporter: config.defaultReporter || undefined,
		default_status: config.defaultStatus || undefined,
		statuses: config.statuses,
		labels: config.labels,
		// Core migrates this retired setting into milestone files before saving config.
		milestones: undefined,
		types: config.types?.length ? config.types : undefined,
		priorities: config.priorities?.length ? config.priorities : undefined,
		projects: config.projects?.length ? config.projects : undefined,
		definition_of_done: config.definitionOfDone,
		date_format: config.dateFormat,
		max_column_width: config.maxColumnWidth || undefined,
		default_editor: config.defaultEditor || undefined,
		auto_open_browser: config.autoOpenBrowser,
		hide_empty_columns: config.hideEmptyColumns,
		default_port: config.defaultPort || undefined,
		browser_hostname: config.browserHostname,
		remote_operations: config.remoteOperations,
		auto_commit: config.autoCommit,
		filesystem_only: config.filesystemOnly,
		zero_padded_ids: config.zeroPaddedIds,
		bypass_git_hooks: config.bypassGitHooks,
		check_active_branches: config.checkActiveBranches,
		active_branch_days: config.activeBranchDays,
		onStatusChange: config.onStatusChange || undefined,
		task_prefix: config.prefixes?.task || undefined,
		backlog_directory: config.backlogDirectory || undefined,
	};
	try {
		const document: Document = parseDocument(normalizeLegacyEditorConfig(original ?? ""), { uniqueKeys: false });
		if (document.errors.length) throw document.errors[0];
		if (!document.contents) document.contents = document.createNode({});
		if (!isMap(document.contents)) throw new Error("Expected a YAML mapping of settings.");
		const mapping = document.contents;
		const configKeyAliases: Record<string, string> = {
			filesystemOnly: "filesystem_only",
			on_status_change: "onStatusChange",
			backlogDirectory: "backlog_directory",
		};
		for (const pair of mapping.items) {
			if (isScalar(pair.key) && typeof pair.key.value === "string" && Object.hasOwn(configKeyAliases, pair.key.value)) {
				pair.key.value = configKeyAliases[pair.key.value];
			}
		}
		const previous = document.toJS() as Record<string, unknown>;
		for (const [key, value] of Object.entries(values)) {
			const pairs = mapping.items.filter((pair) => isScalar(pair.key) && pair.key.value === key);
			const pair = pairs.at(-1);
			let hasAlias = false;
			if (isNode(pair?.value))
				visit(pair.value, {
					Alias() {
						hasAlias = true;
					},
				});
			if (value === undefined) {
				for (const removed of pairs) {
					const comments = [commentsIn(removed.key), commentsIn(removed.value)].filter(Boolean).join("\n");
					if (comments) document.comment = [document.comment, comments].filter(Boolean).join("\n");
				}
				mapping.items = mapping.items.filter((item) => !pairs.includes(item));
			} else if (!pair) {
				document.set(key, document.createNode(value, { flow: Array.isArray(value) }));
			} else if (hasAlias || !isDeepStrictEqual(previous[key], value)) {
				if (isScalar(pair.value) && !Array.isArray(value)) {
					pair.value.value = value;
				} else {
					const replacement = document.createNode(value, { flow: Array.isArray(value) });
					const comments = commentsIn(pair.value);
					if (comments) replacement.commentBefore = comments;
					if (
						(isScalar(pair.value) || isCollection(pair.value)) &&
						(isScalar(replacement) || isCollection(replacement))
					) {
						replacement.anchor = pair.value.anchor;
					}
					pair.value = replacement;
				}
			}
			const editor = key === "default_editor" ? mapping.get(key, true) : undefined;
			if (isScalar(editor)) editor.type = "QUOTE_SINGLE";
		}
		// An owned anchor must neither disappear nor change a custom value through an alias.
		const next = document.toJS() as Record<string, unknown>;
		for (const [key, value] of Object.entries(previous)) {
			if (!Object.hasOwn(values, key) && !isDeepStrictEqual(value, next[key])) {
				throw new Error(`The change would alter preserved setting "${key}" through a YAML reference.`);
			}
		}
		return document.toString({
			defaultStringType: "QUOTE_DOUBLE",
			defaultKeyType: "PLAIN",
			doubleQuotedAsJSON: true,
			flowCollectionPadding: false,
			lineWidth: 0,
		});
	} catch (error) {
		throw new Error(`Cannot save config ${path}: ${(error as Error).message}`, { cause: error });
	}
}
