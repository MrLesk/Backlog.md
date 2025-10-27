import type { Argument, Command, Option } from "commander";

export interface CommandInfo {
	name: string;
	aliases: string[];
	arguments: ArgumentInfo[];
	subcommands: CommandInfo[];
	options: OptionInfo[];
}

export interface ArgumentInfo {
	name: string;
	required: boolean;
	variadic: boolean;
}

export interface OptionInfo {
	flags: string;
	long?: string;
	short?: string;
	description: string;
}

/**
 * Extract command structure from a Commander.js program
 */
export function extractCommandStructure(program: Command): CommandInfo {
	return {
		name: program.name(),
		aliases: program.aliases(),
		arguments: extractArguments(program),
		subcommands: program.commands.map((cmd) => extractCommandInfo(cmd)),
		options: program.options.map((opt) => extractOptionInfo(opt)),
	};
}

/**
 * Extract info from a single command
 */
function extractCommandInfo(command: Command): CommandInfo {
	return {
		name: command.name(),
		aliases: command.aliases(),
		arguments: extractArguments(command),
		subcommands: command.commands.map((cmd) => extractCommandInfo(cmd)),
		options: command.options.map((opt) => extractOptionInfo(opt)),
	};
}

/**
 * Extract arguments from a command
 */
function extractArguments(command: Command): ArgumentInfo[] {
	// Commander.js v14 has registeredArguments or processedArgs
	type CommandWithArgs = Command & {
		registeredArguments?: Argument[];
		args?: Argument[];
	};

	const commandWithArgs = command as CommandWithArgs;
	const args = commandWithArgs.registeredArguments || commandWithArgs.args || [];

	return args.map((arg: Argument) => ({
		name: arg.name(),
		required: arg.required,
		variadic: arg.variadic,
	}));
}

/**
 * Extract info from an option
 */
function extractOptionInfo(option: Option): OptionInfo {
	return {
		flags: option.flags,
		long: option.long,
		short: option.short,
		description: option.description || "",
	};
}

/**
 * Find a command by name (including aliases)
 */
export function findCommand(info: CommandInfo, commandName: string): CommandInfo | null {
	return info.subcommands.find((cmd) => cmd.name === commandName || cmd.aliases.includes(commandName)) || null;
}

/**
 * Find a subcommand within a command
 */
export function findSubcommand(info: CommandInfo, commandName: string, subcommandName: string): CommandInfo | null {
	const command = findCommand(info, commandName);
	if (!command) {
		return null;
	}

	return command.subcommands.find((sub) => sub.name === subcommandName || sub.aliases.includes(subcommandName)) || null;
}

/**
 * Get all top-level command names (including aliases)
 */
export function getTopLevelCommands(info: CommandInfo): string[] {
	const names: string[] = [];
	for (const cmd of info.subcommands) {
		names.push(cmd.name, ...cmd.aliases);
	}
	return names;
}

/**
 * Get all subcommand names for a command (including aliases)
 */
export function getSubcommandNames(info: CommandInfo, commandName: string): string[] {
	const command = findCommand(info, commandName);
	if (!command) {
		return [];
	}

	const names: string[] = [];
	for (const sub of command.subcommands) {
		names.push(sub.name, ...sub.aliases);
	}
	return names;
}

/**
 * Get all option flags for a specific command/subcommand
 */
export function getOptionFlags(info: CommandInfo, commandName?: string, subcommandName?: string): string[] {
	let targetCommand = info;

	if (commandName) {
		const cmd = findCommand(info, commandName);
		if (!cmd) {
			return [];
		}
		targetCommand = cmd;
	}

	if (subcommandName) {
		const sub = findCommand(targetCommand, subcommandName);
		if (!sub) {
			return [];
		}
		targetCommand = sub;
	}

	const flags: string[] = [];
	for (const opt of targetCommand.options) {
		if (opt.long) {
			flags.push(opt.long);
		}
		if (opt.short) {
			flags.push(opt.short);
		}
	}
	return flags;
}

/**
 * Get expected arguments for a command/subcommand
 */
export function getExpectedArguments(info: CommandInfo, commandName?: string, subcommandName?: string): ArgumentInfo[] {
	let targetCommand = info;

	if (commandName) {
		const cmd = findCommand(info, commandName);
		if (!cmd) {
			return [];
		}
		targetCommand = cmd;
	}

	if (subcommandName) {
		const sub = findCommand(targetCommand, subcommandName);
		if (!sub) {
			return [];
		}
		targetCommand = sub;
	}

	return targetCommand.arguments;
}
