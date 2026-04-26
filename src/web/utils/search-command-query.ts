import type { SearchPriorityFilter, SearchResultType } from "../../types/index.ts";

export interface ParsedSearchCommandQuery {
	query: string;
	status?: string | string[];
	priority?: SearchPriorityFilter | SearchPriorityFilter[];
	labels?: string[];
	assignee?: string | string[];
	types?: SearchResultType[];
	modifiedFiles?: string[];
}

interface Token {
	raw: string;
	value: string;
	malformed: boolean;
}

const PRIORITIES: SearchPriorityFilter[] = ["high", "medium", "low"];
const RESULT_TYPES: SearchResultType[] = ["task", "document", "decision"];

export function parseSearchCommandQuery(input: string): ParsedSearchCommandQuery {
	const result: ParsedSearchCommandQuery = { query: "" };
	const queryParts: string[] = [];

	for (const token of tokenize(input)) {
		if (!applyToken(token, result)) {
			queryParts.push(token.raw);
		}
	}

	result.query = queryParts.join(" ").trim();
	return result;
}

function applyToken(token: Token, result: ParsedSearchCommandQuery): boolean {
	if (token.malformed) {
		return false;
	}

	const colonIndex = token.value.indexOf(":");
	if (colonIndex <= 0) {
		return false;
	}

	const field = token.value.slice(0, colonIndex).toLowerCase();
	const value = token.value.slice(colonIndex + 1).trim();
	if (!value) {
		return false;
	}

	switch (field) {
		case "status":
			result.status = appendFilterValue(result.status, value);
			return true;
		case "priority": {
			const priority = value.toLowerCase();
			if (!isSearchPriority(priority)) {
				return false;
			}
			result.priority = appendFilterValue(result.priority, priority);
			return true;
		}
		case "label":
		case "labels":
			result.labels = [...(result.labels ?? []), value];
			return true;
		case "assignee":
			result.assignee = appendFilterValue(result.assignee, value);
			return true;
		case "type":
		case "types": {
			const type = value.toLowerCase();
			if (!isSearchResultType(type)) {
				return false;
			}
			result.types = [...(result.types ?? []), type];
			return true;
		}
		case "modifiedfile":
		case "modifiedfiles":
			result.modifiedFiles = [...(result.modifiedFiles ?? []), value];
			return true;
		default:
			return false;
	}
}

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;

	while (index < input.length) {
		while (index < input.length && /\s/.test(input[index] ?? "")) {
			index += 1;
		}

		if (index >= input.length) {
			break;
		}

		const start = index;
		let value = "";
		let malformed = false;

		while (index < input.length && !/\s/.test(input[index] ?? "")) {
			const char = input[index];
			if (char === '"') {
				index += 1;
				const quotedStart = index;
				while (index < input.length && input[index] !== '"') {
					index += 1;
				}

				if (index >= input.length) {
					malformed = true;
					value += input.slice(quotedStart);
					break;
				}

				value += input.slice(quotedStart, index);
				index += 1;
				continue;
			}

			value += char;
			index += 1;
		}

		if (malformed) {
			index = input.length;
		}

		tokens.push({
			raw: input.slice(start, index),
			value,
			malformed,
		});
	}

	return tokens;
}

function appendFilterValue<T extends string>(current: T | T[] | undefined, value: T): T | T[] {
	if (!current) {
		return value;
	}
	if (Array.isArray(current)) {
		return [...current, value];
	}
	return [current, value];
}

function isSearchPriority(value: string): value is SearchPriorityFilter {
	return PRIORITIES.includes(value as SearchPriorityFilter);
}

function isSearchResultType(value: string): value is SearchResultType {
	return RESULT_TYPES.includes(value as SearchResultType);
}
