export type ReadOutputMode = "json" | "plain" | "interactive";

export type ReadOutputOptions = {
	json?: boolean;
	plain?: boolean;
};

export function resolveReadOutputMode(
	options: ReadOutputOptions,
	hasInteractiveTTY: boolean,
	plainFlagInArgv = false,
): ReadOutputMode {
	const plain = Boolean(options.plain || plainFlagInArgv);
	if (options.json && plain) {
		throw new Error("--json cannot be combined with --plain.");
	}
	if (options.json) return "json";
	if (plain || !hasInteractiveTTY) return "plain";
	return "interactive";
}
