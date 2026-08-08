/*
 * Lightweight wrapper around the `blessed` terminal UI library.
 *
 * With Bun's `--compile` the dependency is bundled, so we import it
 * directly and only fall back to plain text when not running in a TTY.
 */

import { stdin as input, stdout as output } from "node:process";
import type { ProgramInterface, ScreenInterface, ScreenOptions } from "neo-neo-bblessed";
import { screen as blessedScreen, box, program as createProgram } from "neo-neo-bblessed";

type ErrorConstructor = new () => unknown;

function constructError(value: unknown): Error | undefined {
	if (typeof value !== "function") {
		return undefined;
	}

	try {
		const candidate = new (value as ErrorConstructor)();
		return candidate instanceof Error ? candidate : undefined;
	} catch {
		return undefined;
	}
}

function normalizeToError(value: unknown): Error {
	if (value instanceof Error) {
		return value;
	}

	const constructed = constructError(value);
	if (constructed) {
		return constructed;
	}

	return new Error(String(value ?? "Unknown screen error"));
}

/**
 * Add pageup/pagedown/home/end scroll keybindings to a scrollable widget.
 * Blessed's built-in `keys: true` / `vi: true` only handle arrow keys and
 * Ctrl+D/U — this fills in the standard terminal navigation keys.
 */
export function addScrollKeys(
	widget: { height?: number | string; key: (keys: string[], fn: () => boolean | undefined) => void },
	screen: ScreenInterface,
): void {
	const scrollable = widget as unknown as {
		scroll?: (offset: number) => void;
		setScroll?: (offset: number) => void;
		setScrollPerc?: (perc: number) => void;
	};

	const pageAmount = () => {
		const height = typeof widget.height === "number" ? widget.height : 0;
		return height > 0 ? Math.max(1, height - 3) : 0;
	};

	widget.key(["pageup"], () => {
		const delta = pageAmount();
		if (delta > 0) {
			scrollable.scroll?.(-delta);
			screen.render();
		}
		return false;
	});
	widget.key(["pagedown"], () => {
		const delta = pageAmount();
		if (delta > 0) {
			scrollable.scroll?.(delta);
			screen.render();
		}
		return false;
	});
	widget.key(["home"], () => {
		scrollable.setScroll?.(0);
		screen.render();
		return false;
	});
	widget.key(["end"], () => {
		scrollable.setScrollPerc?.(100);
		screen.render();
		return false;
	});
}

/** Remove C0 controls, DEL, and C1 controls so they can never reach the terminal title. */
function stripControlCharacters(value: string): string {
	return Array.from(value)
		.filter((character) => {
			const code = character.codePointAt(0) ?? 0;
			return code > 0x1f && code !== 0x7f && !(code >= 0x80 && code <= 0x9f);
		})
		.join("");
}

/**
 * Terminal/window title for a TUI surface, so parallel terminals can be told apart.
 * Uses the configured project name when it identifies the project, and falls back to a
 * generic "Backlog <view>" title for a blank name or the "Untitled Project" placeholder.
 *
 * The title is emitted as `ESC ] 0 ; <title> BEL`, so the composed string is stripped of
 * control characters: both the project name and the view (search queries, task titles)
 * come from repository files that a clone can control, and an embedded BEL or ESC would
 * otherwise close the title sequence and inject arbitrary escape codes into the terminal.
 */
export function formatTuiTitle(view: string, projectName?: string): string {
	const name = stripControlCharacters(projectName ?? "").trim();
	const usableName = name && name.toLowerCase() !== "untitled project" ? name : "";
	return stripControlCharacters(usableName ? `${usableName} - ${view}` : `Backlog ${view}`);
}

/** Push the current terminal window title onto the terminal's title stack. */
const PUSH_WINDOW_TITLE = "\x1b[22;2t";
/** Pop the terminal window title the matching push saved. */
const POP_WINDOW_TITLE = "\x1b[23;2t";

export function createScreen(options: Partial<ScreenOptions> = {}): ScreenInterface {
	const program: ProgramInterface = createProgram({ tput: false });

	// Renaming the terminal window must not outlive the session, so save the title the
	// user had before blessed overwrites it and put it back during teardown. Terminals
	// without a title stack ignore the push and pop, so teardown clears the title first
	// and they fall back to their own default instead of keeping a stale view name.
	const managesWindowTitle = typeof options.title === "string" && options.title.length > 0;
	if (managesWindowTitle) {
		program.write(PUSH_WINDOW_TITLE);
	}

	const screen = blessedScreen({ smartCSR: true, program, fullUnicode: true, ...options });

	if (managesWindowTitle) {
		// blessed routes its exit, SIGINT/SIGTERM/SIGQUIT, and uncaughtException teardown
		// through screen.destroy(), so this covers every path that already ends a session.
		// It emits "destroy" twice per screen, and one push must not be popped twice.
		let restoredWindowTitle = false;
		screen.on("destroy", () => {
			if (restoredWindowTitle) {
				return;
			}
			restoredWindowTitle = true;
			program.setTitle("");
			// screen.destroy() can run from process exit, where a deferred flush never happens.
			program.flush?.();
			program.write(POP_WINDOW_TITLE);
		});
	}

	if (process.env.DEBUG) {
		const tputColors = (screen as unknown as { tput?: { colors?: number } }).tput?.colors;
		console.error(`[TUI debug] tput.colors=${tputColors}, TERM=${process.env.TERM}`);
	}

	// Windows runners occasionally surface file system watcher errors as plain objects
	// (rather than Error instances). Blessed rethrows unhandled "error" events by
	// constructing the first argument, which explodes when it is a string. Attach a
	// defensive handler so these platform-specific events don't crash tests.
	screen.on("error", (err) => {
		const normalizedError = normalizeToError(err);
		if (process.env.DEBUG) {
			console.warn("TUI screen error", normalizedError);
		}
		throw normalizedError;
	});

	return screen;
}

// Ask the user for a single line of input.  Falls back to readline.
export async function promptText(message: string, defaultValue = ""): Promise<string> {
	// Always use readline for simple text input to avoid blessed rendering quirks
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input, output });
	const answer = (await rl.question(`${message} `)).trim();
	rl.close();
	return answer || defaultValue;
}

// Display long content in a scrollable viewer.
export async function scrollableViewer(content: string): Promise<void> {
	if (output.isTTY === false) {
		console.log(content);
		return;
	}

	return new Promise<void>((resolve) => {
		const screen = createScreen({
			style: {},
		});

		const viewer = box({
			parent: screen,
			content,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			mouse: true,
			width: "100%",
			height: "100%",
			padding: { left: 1, right: 1 },
			wrap: true,
			scrollbar: { ch: " ", inverse: true },
			style: { scrollbar: { bg: "gray" } },
		});

		addScrollKeys(viewer, screen);

		screen.key(["escape", "q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		viewer.focus();
		screen.render();
	});
}
