// Simple splash screen renderer for bare `backlog` invocations
// Focus: fast, TUI-friendly, graceful fallback to plain text

type SplashOptions = {
	version: string;
	initialized: boolean;
	plain?: boolean;
	color?: boolean;
};

function colorize(enabled: boolean | undefined, code: string, text: string) {
	if (!enabled) return text;
	return `\x1b[${code}m${text}\x1b[0m`;
}

const bold = (c: boolean | undefined, s: string) => colorize(c, "1", s);
const dim = (c: boolean | undefined, s: string) => colorize(c, "2", s);
const cyan = (c: boolean | undefined, s: string) => colorize(c, "36", s);
const green = (c: boolean | undefined, s: string) => colorize(c, "32", s);
const _magenta = (c: boolean | undefined, s: string) => colorize(c, "35", s);

function getAsciiLogo(color: boolean | undefined): string[] {
	// 71–75 columns wide, ASCII-only characters for broad terminal support
	// Avoid heavy unicode; borders kept simple for compatibility
	const lines = [
		"  ____            _            _                 __  __        ",
		" |  _ \\          | |          | |               |  \\/  |       ",
		" | |_) | __ _  __| | ___   ___| | ___   __ _    | \\  / | ___  ",
		" |  _ < / _` |/ _` |/ _ \\ / __| |/ _ \\/ _` |   | |\\/| |/ _ \\ ",
		" | |_) | (_| | (_| |  __/ \\__ \\ | (_) | (_| |   | |  | | (_) | ",
		" |____/ \\__,_|\\__,_|\\___| |___/_|\\___/ \\__, |   |_|  |_|\\___/  ",
		"                                       __/ |                    ",
		"                                      |___/   Backlog.md        ",
	];
	// Accent the final Backlog.md label
	const out = lines.slice(0, -1);
	out.push(lines[lines.length - 1].replace("Backlog.md", bold(color, cyan(color, "Backlog.md"))));
	return out;
}

export async function printSplash(opts: SplashOptions): Promise<void> {
	const { version, initialized, plain, color } = opts;

	const width = Math.max(0, Number(process.stdout.columns || 0));
	const useWide = !plain && (width === 0 || width >= 60);

	const lines: string[] = [];

	if (useWide) {
		lines.push(...getAsciiLogo(color));
		lines.push("");
		lines.push(`${bold(color, "Backlog.md")} ${dim(color, `v${version}`)}`);
	} else {
		lines.push(`${bold(color, "Backlog.md")} v${version}`);
	}

	lines.push("");

	if (!initialized) {
		lines.push(bold(color, "Not initialized"));
		lines.push(`  ${green(color, "backlog init")}  ${dim(color, "Initialize Backlog.md in this repo")}`);
	} else {
		lines.push(bold(color, "Quickstart"));
		lines.push(`  ${cyan(color, 'backlog task create "Title" -d "Description"')}  ${dim(color, "Create a new task")}`);
		lines.push(`  ${cyan(color, "backlog task list --plain")}  ${dim(color, "List tasks (plain text)")}`);
		lines.push(`  ${cyan(color, "backlog board")}  ${dim(color, "Open the TUI Kanban board")}`);
		lines.push(`  ${cyan(color, "backlog browser")}  ${dim(color, "Start the web UI")}`);
		lines.push(`  ${cyan(color, "backlog overview")}  ${dim(color, "Show project statistics")}`);
	}

	lines.push("");
	lines.push(`${bold(color, "Docs:")} https://backlog.md`);

	// Print and return; do not start any UI loop
	for (const l of lines) process.stdout.write(`${l}\n`);
}
