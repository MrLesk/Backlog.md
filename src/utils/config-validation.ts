import type { BacklogConfig } from "../types/index.ts";
import { AUTO_COMMIT_MODE_CONFIG_ERROR, normalizeAutoCommitMode } from "./auto-commit-mode.ts";

const BOOLEAN_CONFIG_KEYS = new Set([
	"auto_open_browser",
	"hide_empty_columns",
	"remote_operations",
	"auto_commit",
	"filesystem_only",
	"filesystemOnly",
	"bypass_git_hooks",
	"check_active_branches",
]);
const ARRAY_CONFIG_KEYS = new Set(["statuses", "labels", "types", "priorities"]);
const INTEGER_CONFIG_KEYS = new Set(["max_column_width", "default_port", "zero_padded_ids", "active_branch_days"]);
const SCALAR_CONFIG_KEYS = new Set([
	"project_name",
	"default_assignee",
	"default_reporter",
	"default_status",
	"date_format",
	...INTEGER_CONFIG_KEYS,
	"default_editor",
	"auto_commit_mode",
	...BOOLEAN_CONFIG_KEYS,
	"onStatusChange",
	"on_status_change",
	"task_prefix",
	"backlog_directory",
	"backlogDirectory",
]);
const RECOGNIZED_CONFIG_KEYS = new Set([...SCALAR_CONFIG_KEYS, ...ARRAY_CONFIG_KEYS, "definition_of_done"]);

export const INVALID_EXPLICIT_CONFIG_ERROR = "Invalid backlog configuration syntax";

export function stripTrailingYamlComment(value: string): string {
	let quote: "'" | '"' | undefined;
	let escaped = false;
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (quote === '"' && character === "\\" && !escaped) {
			escaped = true;
			continue;
		}
		if ((character === "'" || character === '"') && !escaped) {
			quote = quote === character ? undefined : (quote ?? character);
		}
		if (character === "#" && quote === undefined && (index === 0 || /\s/.test(value[index - 1] ?? ""))) {
			return value.slice(0, index).trimEnd();
		}
		escaped = false;
	}
	return value;
}

type ParsedConfigScalar = {
	value: string;
	quoted: boolean;
};

/**
 * Parse the intentionally small scalar subset supported by the legacy config
 * reader. Quotes may surround the complete value, but cannot be unmatched or
 * appear inside an unquoted value. Same-quote characters inside a quoted value
 * must use YAML's single-quote doubling or a double-quote backslash escape.
 */
export function parseExplicitConfigScalar(key: string, rawValue: string): ParsedConfigScalar | null | undefined {
	if (!SCALAR_CONFIG_KEYS.has(key)) return undefined;
	const value = stripTrailingYamlComment(rawValue).trim();
	const first = value[0];
	if (first !== "'" && first !== '"') {
		return value.includes("'") || value.includes('"') ? null : { value, quoted: false };
	}
	if (value.length < 2 || value.at(-1) !== first) return null;
	if (first === '"') {
		try {
			const decoded = JSON.parse(value);
			return typeof decoded === "string" ? { value: decoded, quoted: true } : null;
		} catch {
			return null;
		}
	}

	const inner = value.slice(1, -1);
	let decoded = "";
	for (let index = 0; index < inner.length; index += 1) {
		if (inner[index] !== "'") {
			decoded += inner[index];
			continue;
		}
		if (inner[index + 1] !== "'") return null;
		decoded += "'";
		index += 1;
	}
	return { value: decoded, quoted: true };
}

/**
 * Validate recognized scalar/list syntax that the permissive legacy parser may
 * otherwise skip. Unknown keys remain forward-compatible.
 */
export function validateExplicitConfigValues(content: string, config: BacklogConfig): string | null {
	const lines = content.split(/\r?\n/);
	for (const [index, rawLine] of lines.entries()) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) {
			const key = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\b/)?.[1];
			if (key === "auto_commit_mode") return AUTO_COMMIT_MODE_CONFIG_ERROR;
			if (key && RECOGNIZED_CONFIG_KEYS.has(key)) return INVALID_EXPLICIT_CONFIG_ERROR;
			continue;
		}
		const key = line.slice(0, colonIndex).trim();
		const rawValue = line.slice(colonIndex + 1).trim();
		const parsedScalar = parseExplicitConfigScalar(key, rawValue);
		if (!RECOGNIZED_CONFIG_KEYS.has(key)) continue;
		if (parsedScalar === null) {
			return key === "auto_commit_mode" ? AUTO_COMMIT_MODE_CONFIG_ERROR : INVALID_EXPLICIT_CONFIG_ERROR;
		}
		const value = parsedScalar?.value ?? stripTrailingYamlComment(rawValue);
		if (ARRAY_CONFIG_KEYS.has(key) && !(value.startsWith("[") && value.endsWith("]"))) {
			const nextContentLine = lines
				.slice(index + 1)
				.find((candidate) => candidate.trim().length > 0 && !candidate.trim().startsWith("#"));
			const isBlockList = value === "" && /^\s+-\s+/.test(nextContentLine ?? "");
			if (!isBlockList) return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if (key === "definition_of_done" && value.startsWith("[") && !value.endsWith("]")) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if (key === "definition_of_done" && config.definitionOfDone === undefined) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if ((key === "project_name" || key === "date_format") && !value.trim()) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if (BOOLEAN_CONFIG_KEYS.has(key) && (parsedScalar?.quoted || !/^(?:true|false)$/i.test(value))) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if (key === "auto_commit_mode" && !normalizeAutoCommitMode(value)) {
			return AUTO_COMMIT_MODE_CONFIG_ERROR;
		}
		if (INTEGER_CONFIG_KEYS.has(key)) {
			const number = Number(value);
			if (parsedScalar?.quoted || !/^\d+$/.test(value) || !Number.isSafeInteger(number)) {
				return INVALID_EXPLICIT_CONFIG_ERROR;
			}
			if (key === "max_column_width" && number < 1) return INVALID_EXPLICIT_CONFIG_ERROR;
			if (key === "default_port" && (number < 1 || number > 65_535)) {
				return INVALID_EXPLICIT_CONFIG_ERROR;
			}
		}
		if (key === "task_prefix" && !/^[a-zA-Z]+$/.test(value)) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
	}
	return null;
}
