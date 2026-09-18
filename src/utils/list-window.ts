import type { Command } from "commander";
import type { HelpField } from "../commands/help-schema.ts";

/**
 * Paging for CLI lists, named after options agents already know: `git log --max-count --skip`
 * and `grep --count`. A window is applied to a list that is already filtered and sorted, so
 * consecutive windows of an unchanged backlog neither overlap nor leave items out.
 */
export type ListWindowOptions = {
	maxCount?: string;
	skip?: string;
	count?: boolean;
	json?: boolean;
};

export type ListWindow = {
	skip: number;
	maxCount?: number;
	/** Print only the number of items the window holds. */
	count: boolean;
	/** Any window option was given, so the command prints text instead of opening an interactive view. */
	forcesText: boolean;
	/** The typed arguments, repeated with a new `--skip` in the command for the following items. */
	commandArgs: readonly string[];
	/**
	 * Flags of the running command and its parents whose next argument is their value, even when it
	 * reads `--skip` or `--`. Not handled: a parent flag, such as `--plain` of `task`, typed between a
	 * value flag and its value.
	 */
	valueFlags: ReadonlySet<string>;
};

export type ListPage<T> = {
	items: T[];
	skip: number;
	total: number;
	/** The `--skip` value that prints the following items, or null when none follow. */
	nextSkip: number | null;
	/** True when the window leaves out any item of the list. */
	cut: boolean;
};

export const LIST_WINDOW_HELP_FIELDS: HelpField[] = [
	{
		name: "max-count",
		type: "Positive integer",
		description: "Print at most this many items after filtering and sorting; cut output ends with the next command",
	},
	{ name: "skip", type: "Non-negative integer", description: "Leave out this many items after filtering and sorting" },
	{ name: "count", type: "Boolean", description: "Print only the number of items the command would list" },
];

export function addListWindowOptions(command: Command): Command {
	return command
		.option("--max-count <n>", "print at most n items after filtering and sorting")
		.option("--skip <n>", "leave out the first n items after filtering and sorting")
		.option("--count", "print only the number of items");
}

function reportInvalidOption(message: string, helpCommand: string | undefined): null {
	const helpHint = helpCommand ? ` Try '${helpCommand}' for options.` : "";
	console.error(`${message}${helpHint}`);
	process.exitCode = 1;
	return null;
}

/** Reads a positive integer option such as `--limit` or `--max-count`, or reports why it is invalid. */
export function parsePositiveIntegerOption(value: unknown, optionName: string, helpCommand?: string): number | null {
	const rawValue = String(value).trim();
	if (!/^[1-9]\d*$/.test(rawValue)) {
		return reportInvalidOption(`${optionName} must be a positive integer (1 or greater).`, helpCommand);
	}
	return Number.parseInt(rawValue, 10);
}

/** The command's full name, such as `backlog task list`, and the flags it reads a value after. */
function describeCommand(command: Command): { name: string; valueFlags: Set<string> } {
	const names: string[] = [];
	const valueFlags = new Set<string>();
	for (let current: Command | null = command; current; current = current.parent) {
		names.unshift(current.name());
		const flags = current.options.filter((option) => option.required).flatMap((option) => [option.long, option.short]);
		for (const flag of flags) {
			if (flag) valueFlags.add(flag);
		}
	}
	return { name: names.join(" "), valueFlags };
}

/** Reads the window options of the running command, or reports why they are invalid and returns null. */
export function parseListWindow(
	options: ListWindowOptions,
	command: Command,
	commandArgs: readonly string[],
): ListWindow | null {
	const { name, valueFlags } = describeCommand(command);
	const helpCommand = `${name} --help`;
	if (options.count && options.json) {
		return reportInvalidOption("--count cannot be combined with --json.", helpCommand);
	}
	let maxCount: number | undefined;
	if (options.maxCount !== undefined) {
		const parsed = parsePositiveIntegerOption(options.maxCount, "--max-count", helpCommand);
		if (parsed === null) return null;
		maxCount = parsed;
	}
	const skip = options.skip === undefined ? undefined : String(options.skip).trim();
	if (skip !== undefined && !/^\d+$/.test(skip)) {
		return reportInvalidOption("--skip must be a non-negative integer (0 or greater).", helpCommand);
	}
	return {
		skip: skip === undefined ? 0 : Number(skip),
		maxCount,
		count: Boolean(options.count),
		forcesText: Boolean(options.count) || maxCount !== undefined || skip !== undefined,
		commandArgs,
		valueFlags,
	};
}

export function selectListWindow<T>(items: readonly T[], window: ListWindow): ListPage<T> {
	const total = items.length;
	const end = window.maxCount === undefined ? total : Math.min(total, window.skip + window.maxCount);
	const selected = items.slice(window.skip, end);
	return {
		items: selected,
		skip: window.skip,
		total,
		nextSkip: end < total ? end : null,
		cut: selected.length < total,
	};
}

function quoteShellArgument(argument: string): string {
	return /^[\w@+:,./-]+$/.test(argument) ? argument : `'${argument.replaceAll("'", "'\\''")}'`;
}

/**
 * The typed command with its `--skip` value replaced, so running it prints the following items.
 * Option values stay as typed, and the new `--skip` goes before a `--` that ends the options.
 */
export function nextPageCommand(window: ListWindow, nextSkip: number): string {
	const args = window.commandArgs;
	const kept: string[] = [];
	let afterSeparator: readonly string[] = [];
	for (let index = 0; index < args.length; index++) {
		const argument = args[index] ?? "";
		if (argument === "--") {
			afterSeparator = args.slice(index);
			break;
		}
		if (argument === "--skip") {
			index++;
			continue;
		}
		if (argument.startsWith("--skip=")) continue;
		kept.push(argument);
		if (window.valueFlags.has(argument) && index + 1 < args.length) {
			index++;
			kept.push(args[index] ?? "");
		}
	}
	return ["backlog", ...kept, "--skip", String(nextSkip), ...afterSeparator].map(quoteShellArgument).join(" ");
}

/** Names the printed range, the total, and the command for the following items; null for a complete list. */
export function formatListWindowFooter(page: ListPage<unknown>, window: ListWindow): string | null {
	if (!page.cut) return null;
	const shown = page.items.length;
	const range = shown > 0 ? `${page.skip + 1}-${page.skip + shown}` : "0";
	const summary = `Showing ${range} of ${page.total} items.`;
	return page.nextSkip === null ? summary : `${summary} Next: ${nextPageCommand(window, page.nextSkip)}`;
}

/**
 * Prints one window of a list as text: `--count` prints only its size, and a cut list ends with the
 * footer. `printItems` also runs for an empty list so the command can say that nothing matched.
 */
export function printListWindow<T>(
	items: readonly T[],
	window: ListWindow,
	printItems: (items: T[], page: ListPage<T>) => void,
): void {
	const page = selectListWindow(items, window);
	if (window.count) {
		// A string, because Bun colors a logged number when color is forced.
		console.log(String(page.items.length));
		return;
	}
	if (page.items.length > 0 || page.total === 0) {
		printItems(page.items, page);
	}
	const footer = formatListWindowFooter(page, window);
	if (footer) console.log(footer);
}
