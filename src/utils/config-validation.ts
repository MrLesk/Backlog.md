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
const RECOGNIZED_CONFIG_KEYS = new Set([
	"project_name",
	"default_assignee",
	"default_reporter",
	"default_status",
	...ARRAY_CONFIG_KEYS,
	"definition_of_done",
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

export const INVALID_EXPLICIT_CONFIG_ERROR = "Invalid backlog configuration syntax";

function stripTrailingYamlComment(value: string): string {
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
		const value = line.slice(colonIndex + 1).trim();
		if (!RECOGNIZED_CONFIG_KEYS.has(key)) continue;
		const listValue = ARRAY_CONFIG_KEYS.has(key) ? stripTrailingYamlComment(value) : value;
		if (ARRAY_CONFIG_KEYS.has(key) && !(listValue.startsWith("[") && listValue.endsWith("]"))) {
			const nextContentLine = lines
				.slice(index + 1)
				.find((candidate) => candidate.trim().length > 0 && !candidate.trim().startsWith("#"));
			const isBlockList = listValue === "" && /^\s+-\s+/.test(nextContentLine ?? "");
			if (!isBlockList) return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if (key === "definition_of_done" && value.startsWith("[") && !value.endsWith("]")) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if (key === "definition_of_done" && config.definitionOfDone === undefined) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if ((key === "project_name" || key === "date_format") && !value.replace(/['"]/g, "").trim()) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if (BOOLEAN_CONFIG_KEYS.has(key) && !/^(?:true|false)$/i.test(value)) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
		if (key === "auto_commit_mode" && !normalizeAutoCommitMode(value.replace(/["']/g, ""))) {
			return AUTO_COMMIT_MODE_CONFIG_ERROR;
		}
		if (INTEGER_CONFIG_KEYS.has(key)) {
			const number = Number(value);
			if (!/^\d+$/.test(value) || !Number.isSafeInteger(number)) return INVALID_EXPLICIT_CONFIG_ERROR;
			if (key === "max_column_width" && number < 1) return INVALID_EXPLICIT_CONFIG_ERROR;
			if (key === "default_port" && (number < 1 || number > 65_535)) {
				return INVALID_EXPLICIT_CONFIG_ERROR;
			}
		}
		if (key === "task_prefix" && !/^[a-zA-Z]+$/.test(value.replace(/['"]/g, ""))) {
			return INVALID_EXPLICIT_CONFIG_ERROR;
		}
	}
	return null;
}
