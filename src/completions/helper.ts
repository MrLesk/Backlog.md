import type { Command } from "commander";
import {
	extractCommandStructure,
	getExpectedArguments,
	getOptionFlags,
	getSubcommandNames,
	getTopLevelCommands,
} from "./command-structure.ts";
import { getAssignees, getDocumentIds, getLabels, getPriorities, getStatuses, getTaskIds } from "./data-providers.ts";

export interface CompletionContext {
	words: string[];
	partial: string;
	command: string | null;
	subcommand: string | null;
	lastFlag: string | null;
	argPosition: number;
}

/**
 * Parse the command line to determine completion context
 */
export function parseCompletionContext(line: string, point: number): CompletionContext {
	// Extract the portion up to the cursor
	const textBeforeCursor = line.slice(0, point);

	// Split into words, handling quotes
	const words = textBeforeCursor.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

	// Remove "backlog" from the start
	const cleanWords = words.slice(1);

	// Determine if we're completing a partial word or starting a new one
	const endsWithSpace = textBeforeCursor.endsWith(" ");
	const partial = endsWithSpace ? "" : cleanWords[cleanWords.length - 1] || "";

	// Remove partial from words if not completing a new word
	const completedWords = endsWithSpace ? cleanWords : cleanWords.slice(0, -1);

	// Identify command, subcommand, last flag, and argument position
	let command: string | null = null;
	let subcommand: string | null = null;
	let lastFlag: string | null = null;
	let argPosition = 0;

	for (let i = 0; i < completedWords.length; i++) {
		const word = completedWords[i];
		if (!word) {
			continue;
		}
		if (word.startsWith("-")) {
			lastFlag = word;
		} else if (!command) {
			command = word;
		} else if (!subcommand) {
			subcommand = word;
		} else {
			// Count positional arguments
			const prevWord = completedWords[i - 1];
			if (!prevWord || !prevWord.startsWith("-")) {
				argPosition++;
			}
		}
	}

	return {
		words: completedWords,
		partial,
		command,
		subcommand,
		lastFlag,
		argPosition,
	};
}

/**
 * Filter completions by partial match
 */
function filterCompletions(completions: string[], partial: string): string[] {
	if (!partial) {
		return completions;
	}
	return completions.filter((c) => c.toLowerCase().startsWith(partial.toLowerCase()));
}

/**
 * Get completions based on argument name pattern
 */
async function getArgumentCompletions(argumentName: string): Promise<string[]> {
	const lowerName = argumentName.toLowerCase();

	// Match common patterns
	if (lowerName.includes("taskid") || lowerName === "id") {
		return await getTaskIds();
	}
	if (lowerName.includes("docid") || lowerName.includes("documentid")) {
		return await getDocumentIds();
	}
	if (lowerName.includes("title") || lowerName.includes("name")) {
		return []; // Free-form text, no completions
	}

	return [];
}

/**
 * Get completions for flag values based on flag name
 */
async function getFlagValueCompletions(flagName: string): Promise<string[]> {
	const cleanFlag = flagName.replace(/^-+/, "");

	switch (cleanFlag) {
		case "status":
			return await getStatuses();
		case "priority":
			return getPriorities();
		case "labels":
		case "label":
			return await getLabels();
		case "assignee":
			return await getAssignees();
		case "shell":
			return ["bash", "zsh", "fish"];
		default:
			return [];
	}
}

/**
 * Generate completions based on context
 */
export async function getCompletions(program: Command, line: string, point: number): Promise<string[]> {
	const context = parseCompletionContext(line, point);
	const cmdInfo = extractCommandStructure(program);

	// If completing a flag value
	if (context.lastFlag) {
		const flagCompletions = await getFlagValueCompletions(context.lastFlag);
		return filterCompletions(flagCompletions, context.partial);
	}

	// No command yet - complete top-level commands
	if (!context.command) {
		return filterCompletions(getTopLevelCommands(cmdInfo), context.partial);
	}

	// Command but no subcommand - complete subcommands or flags
	if (!context.subcommand) {
		const subcommands = getSubcommandNames(cmdInfo, context.command);
		const flags = getOptionFlags(cmdInfo, context.command);
		return filterCompletions([...subcommands, ...flags], context.partial);
	}

	// We have command and subcommand - check what arguments are expected
	const expectedArgs = getExpectedArguments(cmdInfo, context.command, context.subcommand);

	// If we're at a position where an argument is expected
	if (expectedArgs.length > context.argPosition) {
		const expectedArg = expectedArgs[context.argPosition];
		if (expectedArg) {
			const argCompletions = await getArgumentCompletions(expectedArg.name);

			// Also include flags
			const flags = getOptionFlags(cmdInfo, context.command, context.subcommand);
			return filterCompletions([...argCompletions, ...flags], context.partial);
		}
	}

	// No more positional arguments expected, just show flags
	const flags = getOptionFlags(cmdInfo, context.command, context.subcommand);
	return filterCompletions(flags, context.partial);
}
