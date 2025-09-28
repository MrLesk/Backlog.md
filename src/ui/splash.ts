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

// Removed terminal theme heuristics; keep splash accent simple and consistent

function getWideLogoLines(): string[] {
	// 79 columns wide banner using block characters (fits 80x24)
	return [
		"██████╗  █████╗  █████╗ ██╗  ██╗██╗      █████╗  ██████╗    ███╗   ███╗██████╗ ",
		"██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝██║     ██╔══██╗██╔════╝    ████╗ ████║██╔══██╗",
		"██████╦╝███████║██║  ╚═╝█████═╝ ██║     ██║  ██║██║  ██╗    ██╔████╔██║██║  ██║",
		"██╔══██╗██╔══██║██║  ██╗██╔═██╗ ██║     ██║  ██║██║  ╚██╗   ██║╚██╔╝██║██║  ██║",
		"██████╦╝██║  ██║╚█████╔╝██║ ╚██╗███████╗╚█████╔╝╚██████╔╝██╗██║ ╚═╝ ██║██████╔╝",
		"╚═════╝ ╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝╚══════╝ ╚════╝  ╚═════╝ ╚═╝╚═╝     ╚═╝╚═════╝ ",
	];
}

function getNarrowLogoLines(color: boolean | undefined): string[] {
	// Minimal fallback for very narrow terminals
	return [bold(color, "Backlog.md")];
}

// Terminal hyperlinks (OSC 8). Safely ignored by terminals that don't support them.
function osc8(text: string, url: string, enabled: boolean): string {
	if (!enabled) return text;
	const start = `\u001B]8;;${url}\u0007`;
	const end = "\u001B]8;;\u0007";
	return `${start}${text}${end}`;
}

export async function printSplash(opts: SplashOptions): Promise<void> {
	const { version, initialized, plain, color } = opts;

	const width = Math.max(0, Number(process.stdout.columns || 0));
	// Fixed accent color; no terminal theme detection
	const accent = cyan;

	// Use wide banner only for proper widths; otherwise keep it minimal
	const useWide = !plain && (width === 0 || width >= 80);

	const lines: string[] = [];

	if (useWide) {
		// Add an empty line before the logo for breathing room
		lines.push("");
		lines.push(...getWideLogoLines());
		lines.push("");
		lines.push(`${bold(color, "Backlog.md")} ${dim(color, `v${version}`)}`);
	} else if (!plain && (width === 0 || width >= 20)) {
		// Also add space before the narrow logo variant
		lines.push("");
		lines.push(...getNarrowLogoLines(color));
		lines.push(dim(color, `v${version}`));
	} else {
		lines.push(`${bold(color, "Backlog.md")} v${version}`);
	}

	lines.push("");

	if (!initialized) {
		lines.push(bold(color, "Not initialized"));
		lines.push(`  ${green(color, "backlog init")}  ${dim(color, "Initialize Backlog.md in this repo")}`);
	} else {
		lines.push(bold(color, "Quickstart"));
		lines.push(
			`  ${accent(color, 'backlog task create "Title" -d "Description"')}  ${dim(color, "Create a new task")}`,
		);
		lines.push(`  ${accent(color, "backlog task list --plain")}  ${dim(color, "List tasks (plain text)")}`);
		lines.push(`  ${accent(color, "backlog board")}  ${dim(color, "Open the TUI Kanban board")}`);
		lines.push(`  ${accent(color, "backlog browser")}  ${dim(color, "Start the web UI")}`);
		lines.push(`  ${accent(color, "backlog overview")}  ${dim(color, "Show project statistics")}`);
	}

	lines.push("");
	const linkTarget = "https://backlog.md";
	// Enable hyperlink on TTY regardless of color; respect --plain
	const hyperlinkEnabled = !!process.stdout.isTTY && !plain;
	const clickable = osc8(linkTarget, linkTarget, hyperlinkEnabled);
	lines.push(`${bold(color, "Docs:")} ${clickable}`);
	// Add a trailing blank line for visual spacing
	lines.push("");

	// Print and return; do not start any UI loop
	for (const l of lines) process.stdout.write(`${l}\n`);
}
