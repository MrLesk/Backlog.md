import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Command } from "commander";
import { DEFAULT_STATUSES } from "../constants/index.ts";
import { resolveBacklogDirectory } from "../utils/backlog-directory.ts";
import { getPriorityLabels } from "../utils/priority-config.ts";
import { BACKLOG_CWD_ENV } from "../utils/runtime-cwd.ts";

export interface HelpField {
	name: string;
	type: string | (() => string);
	description?: string | (() => string);
}

export interface HelpSchema {
	reads?: string;
	writes?: string;
	required?: HelpField[];
	optional?: HelpField[];
	output?: string;
	examples?: string[];
}

function resolveText(value: string | (() => string) | undefined): string | undefined {
	return typeof value === "function" ? value() : value;
}

function formatField(field: HelpField): string {
	const type = resolveText(field.type) ?? "";
	const description = resolveText(field.description);
	const suffix = description ? ` - ${description}` : "";
	return `  - ${field.name}: ${type}${suffix}`;
}

function formatFields(title: string, fields: HelpField[] | undefined): string[] {
	if (!fields || fields.length === 0) {
		return [title, "  - None"];
	}
	return [title, ...fields.map(formatField)];
}

function renderHelpSchema(schema: HelpSchema): string {
	const lines = ["", "Input schema:", ...formatFields("Required fields:", schema.required)];

	if (schema.optional) {
		lines.push(...formatFields("Optional fields:", schema.optional));
	}
	if (schema.reads) {
		lines.push("Reads:", `  - ${schema.reads}`);
	}
	if (schema.writes) {
		lines.push("Writes:", `  - ${schema.writes}`);
	}
	if (schema.output) {
		lines.push("Output:", `  - ${schema.output}`);
	}
	if (schema.examples && schema.examples.length > 0) {
		lines.push("Examples:", ...schema.examples.map((example) => `  ${renderConfiguredTaskIds(example)}`));
	}

	return `\n${lines.join("\n")}\n`;
}

export function addHelpSchema(command: Command, schema: HelpSchema): Command {
	return command.addHelpText("after", () => renderHelpSchema(schema));
}

function stripYamlScalar(value: string): string {
	return value
		.trim()
		.replace(/^['"]|['"]$/g, "")
		.trim();
}

function parseFlowList(value: string): string[] | null {
	const trimmed = value.trim();
	if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
		return null;
	}

	return trimmed.slice(1, -1).split(",").map(stripYamlScalar).filter(Boolean);
}

function parseArrayFromConfig(content: string, keyName: string): string[] | null {
	const lines = content.split(/\r?\n/);
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]?.trim() ?? "";
		if (!line || line.startsWith("#")) {
			continue;
		}
		const match = line.match(new RegExp(`^${keyName}\\s*:\\s*(.*)$`));
		if (!match) {
			continue;
		}

		const inlineValue = match[1] ?? "";
		const flowList = parseFlowList(inlineValue);
		if (flowList) {
			return flowList;
		}

		const blockValues: string[] = [];
		for (let blockIndex = index + 1; blockIndex < lines.length; blockIndex++) {
			const blockLine = lines[blockIndex] ?? "";
			const trimmedBlockLine = blockLine.trim();
			if (!trimmedBlockLine || trimmedBlockLine.startsWith("#")) {
				continue;
			}
			if (/^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(trimmedBlockLine)) {
				break;
			}
			const itemMatch = trimmedBlockLine.match(/^-\s*(.+)$/);
			if (itemMatch?.[1]) {
				blockValues.push(stripYamlScalar(itemMatch[1]));
			}
		}
		return blockValues.filter(Boolean);
	}

	return null;
}

function parseStatusesFromConfig(content: string): string[] | null {
	return parseArrayFromConfig(content, "statuses");
}

function parsePrioritiesFromConfig(content: string): string[] | null {
	return parseArrayFromConfig(content, "priorities");
}

function parseStringValueFromConfig(content: string, keys: string[]): string | null {
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}
		const key = line.slice(0, colonIndex).trim();
		if (!keys.includes(key)) {
			continue;
		}
		const value = stripYamlScalar(line.slice(colonIndex + 1));
		return value || null;
	}
	return null;
}

function findBacklogConfigPathSync(startDir: string): string | null {
	let current = startDir;
	while (current !== dirname(current)) {
		const resolution = resolveBacklogDirectory(current);
		if (resolution.configPath) {
			return resolution.configPath;
		}
		current = dirname(current);
	}
	return null;
}

function getRuntimeConfigStartDir(): string {
	const override = process.env[BACKLOG_CWD_ENV]?.trim();
	return override ? resolve(override) : process.cwd();
}

function includeDraftStatus(statuses: string[]): string[] {
	const normalizedStatuses = normalizeStatusValues(statuses);
	const hasDraft = normalizedStatuses.some((status) => status.toLowerCase() === "draft");
	return hasDraft ? normalizedStatuses : ["Draft", ...normalizedStatuses];
}

function normalizeStatusValues(statuses: string[]): string[] {
	return statuses.map((status) => status.trim()).filter(Boolean);
}

export function getCliStatusValues(options?: { includeDraft?: boolean }): string[] {
	let configuredStatuses: string[] = [...DEFAULT_STATUSES];
	const configPath = findBacklogConfigPathSync(getRuntimeConfigStartDir());
	if (configPath) {
		try {
			const parsed = parseStatusesFromConfig(readFileSync(configPath, "utf8"));
			if (parsed && parsed.length > 0) {
				configuredStatuses = parsed;
			}
		} catch {
			configuredStatuses = [...DEFAULT_STATUSES];
		}
	}

	const normalizedStatuses = normalizeStatusValues(configuredStatuses);
	return options?.includeDraft ? includeDraftStatus(normalizedStatuses) : normalizedStatuses;
}

export function getCliPriorityValues(): string[] {
	const configPath = findBacklogConfigPathSync(getRuntimeConfigStartDir());
	if (configPath) {
		try {
			const parsed = parsePrioritiesFromConfig(readFileSync(configPath, "utf8"));
			if (parsed && parsed.length > 0) {
				return getPriorityLabels(parsed);
			}
		} catch {
			return getPriorityLabels();
		}
	}
	return getPriorityLabels();
}

export function getCliTaskPrefix(): string {
	const configPath = findBacklogConfigPathSync(getRuntimeConfigStartDir());
	if (configPath) {
		try {
			return parseStringValueFromConfig(readFileSync(configPath, "utf8"), ["task_prefix", "taskPrefix"]) ?? "task";
		} catch {
			return "task";
		}
	}
	return "task";
}

export function taskIdExample(body: string): string {
	return `${getCliTaskPrefix().toUpperCase()}-${body}`;
}

export function renderConfiguredTaskIds(text: string): string {
	return text
		.replace(/\{\{TASK_ID:(\d+(?:\.\d+)*)\}\}/g, (_match, body: string) => taskIdExample(body))
		.replace(/\b(?:BACK|TASK)-(\d+(?:\.\d+)*)\b/g, (_match, body: string) => taskIdExample(body));
}

export function choiceType(values: readonly string[], options?: { multiple?: boolean }): string {
	return `${options?.multiple ? "one or more of" : "one of"}: ${values.join(", ")}`;
}

export function statusType(options?: { includeDraft?: boolean }): string {
	return `one of configured statuses: ${getCliStatusValues(options).join(", ")}`;
}

export function priorityType(): string {
	return `one of configured priorities: ${getCliPriorityValues().join(", ")}`;
}
