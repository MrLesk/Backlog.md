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
	 * Flags of the running command whose next argument is their value, even when it reads `--skip` or
	 * `--`. Not handled: Commander takes parent flags such as `--plain` of `task` out of the arguments
	 * wherever they appear, so in `--search --plain --skip` the search value `--skip` is rebuilt wrongly.
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

/** The help output sentence for the footer of a cut list. */
export const LIST_WINDOW_OUTPUT_HELP =
	"Output cut by --max-count or --skip ends with the shown range, the total, and the command for the next items";

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

/** The command's full name, such as `backlog task list`. */
function commandName(command: Command): string {
	const names: string[] = [];
	for (let current: Command | null = command; current; current = current.parent) {
		names.unshift(current.name());
	}
	return names.join(" ");
}

/** Reads the window options of the running command, or reports why they are invalid and returns null. */
export function parseListWindow(
	options: ListWindowOptions,
	command: Command,
	commandArgs: readonly string[],
): ListWindow | null {
	const helpCommand = `${commandName(command)} --help`;
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
		valueFlags: new Set(
			command.options
				.filter((option) => option.required)
				.flatMap((option) => [option.long, option.short].filter((flag): flag is string => flag !== undefined)),
		),
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

/**
 * Which `milestone list` sections one window prints. A section prints in every window that lists its
 * milestones. A section that lists none prints once, where it falls: Active in the first window and
 * Completed in the last. An empty list has a single window, which prints both.
 */
export function milestoneSectionsInWindow(
	page: ListPage<{ isCompleted: boolean }>,
	activeCount: number,
	listsCompleted: boolean,
): { active: boolean; completed: boolean } {
	const firstWindow = page.skip === 0 || page.total === 0;
	return {
		active: page.items.some((item) => !item.isCompleted) || (activeCount === 0 && firstWindow),
		completed: page.items.some((item) => item.isCompleted) || (!listsCompleted && page.nextSkip === null),
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
