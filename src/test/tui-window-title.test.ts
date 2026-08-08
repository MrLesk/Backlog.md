import { describe, expect, it } from "bun:test";
import { createScreen, formatTuiTitle } from "../ui/tui.ts";

function hasControlCharacters(value: string): boolean {
	return Array.from(value).some((character) => {
		const code = character.codePointAt(0) ?? 0;
		return code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
	});
}

/** Collect everything the screen writes to the terminal while `run` executes. */
function captureTerminalWrites(run: (record: () => string, reset: () => void) => void): void {
	const chunks: string[] = [];
	const originalWrite = process.stdout.write;
	process.stdout.write = ((chunk: unknown) => {
		chunks.push(typeof chunk === "string" ? chunk : String(chunk));
		return true;
	}) as typeof process.stdout.write;
	try {
		run(
			() => chunks.join(""),
			() => {
				chunks.length = 0;
			},
		);
	} finally {
		process.stdout.write = originalWrite;
	}
}

/**
 * Run `capture` as if the process were inside tmux. blessed reads `process.env.TMUX` when
 * the program is constructed. Nothing else is faked: `bytesWritten` stays at the value Bun
 * reports, which is what makes blessed defer its own tmux writes, so these titles have to
 * arrive without waiting on that.
 */
function inTmux(capture: () => void): void {
	const originalTmux = process.env.TMUX;
	process.env.TMUX = "/private/tmp/tmux-501/default,1,0";
	try {
		capture();
	} finally {
		if (originalTmux === undefined) {
			delete process.env.TMUX;
		} else {
			process.env.TMUX = originalTmux;
		}
	}
}

describe("TUI window titles", () => {
	it("prefixes the configured project name", () => {
		expect(formatTuiTitle("Board", "Acme Website")).toBe("Acme Website - Board");
		expect(formatTuiTitle("Tasks", "Acme Website")).toBe("Acme Website - Tasks");
		expect(formatTuiTitle("Overview", "Acme Website")).toBe("Acme Website - Overview");
		expect(formatTuiTitle("Task TASK-1 - Fix login", "Acme Website")).toBe("Acme Website - Task TASK-1 - Fix login");
	});

	it("trims surrounding whitespace from the project name", () => {
		expect(formatTuiTitle("Board", "  Acme Website  ")).toBe("Acme Website - Board");
	});

	it("falls back to a generic title when the project name is unusable", () => {
		expect(formatTuiTitle("Board", undefined)).toBe("Backlog Board");
		expect(formatTuiTitle("Board", "")).toBe("Backlog Board");
		expect(formatTuiTitle("Board", "   ")).toBe("Backlog Board");
		expect(formatTuiTitle("Tasks", "Untitled Project")).toBe("Backlog Tasks");
		expect(formatTuiTitle("Overview", "untitled project")).toBe("Backlog Overview");
	});

	it("strips control characters from a crafted project name", () => {
		// The title is written as ESC ] 0 ; <title> BEL, so a BEL or ESC in backlog/config.yml
		// would otherwise end the sequence and inject escape codes into the terminal.
		const crafted = formatTuiTitle("Board", "Acme\u0007\u001b]0;pwned");
		expect(crafted).toBe("Acme]0;pwned - Board");
		expect(hasControlCharacters(crafted)).toBe(false);

		expect(formatTuiTitle("Board", "Acme\nWebsite")).toBe("AcmeWebsite - Board");
		expect(formatTuiTitle("Board", "Acme\u009bWebsite")).toBe("AcmeWebsite - Board");
		expect(formatTuiTitle("Board", "\u0007\u001b\u007f")).toBe("Backlog Board");
	});

	it("strips control characters from caller-supplied view titles", () => {
		const craftedTask = formatTuiTitle("Task TASK-1 - Fix\u0007 login\u001b]0;pwned", "Acme Website");
		expect(craftedTask).toBe("Acme Website - Task TASK-1 - Fix login]0;pwned");
		expect(hasControlCharacters(craftedTask)).toBe(false);

		const craftedSearch = formatTuiTitle("Search: \u001b]0;pwned\u0007", undefined);
		expect(craftedSearch).toBe("Backlog Search: ]0;pwned");
		expect(hasControlCharacters(craftedSearch)).toBe(false);
	});

	it("applies the title to the terminal screen", () => {
		const screen = createScreen({ smartCSR: false, title: formatTuiTitle("Board", "Acme Website") });
		try {
			expect(screen.title).toBe("Acme Website - Board");
		} finally {
			screen.destroy();
		}
	});

	it("saves the previous window title and restores it when the screen is destroyed", () => {
		captureTerminalWrites((record, reset) => {
			const screen = createScreen({ smartCSR: false, title: formatTuiTitle("Board", "Acme Website") });
			// blessed buffers the title write, so drain it before checking the ordering.
			screen.program.flush?.();

			// ESC [ 22 ; 0 t saves the icon and window titles the user already had, the pair
			// OSC 0 goes on to overwrite.
			const opened = record();
			expect(opened).toContain("\x1b[22;0t");
			expect(opened.indexOf("\x1b[22;0t")).toBeLessThan(opened.indexOf("Acme Website - Board"));

			reset();
			screen.destroy();

			// The title is cleared for terminals without a title stack, then popped for the
			// ones that have it, so the pop must come last to win where it is supported.
			const closed = record();
			expect(closed).toContain("\x1b]0;\x07");
			expect(closed).toContain("\x1b[23;0t");
			expect(closed.indexOf("\x1b]0;\x07")).toBeLessThan(closed.indexOf("\x1b[23;0t"));
			// blessed emits "destroy" twice per screen, and one push must not be popped twice.
			expect(closed.split("\x1b[23;0t")).toHaveLength(2);
		});
	});

	it("forwards the title stack controls to the outer terminal inside tmux, without waiting", () => {
		inTmux(() => {
			captureTerminalWrites((record, reset) => {
				const screen = createScreen({ smartCSR: false, title: formatTuiTitle("Board", "Acme Website") });

				// Inside tmux these have to travel through the DCS passthrough, otherwise tmux
				// consumes them and the outer terminal never sees them. They also have to be
				// written synchronously: blessed's own tmux writes wait on a byte counter Bun
				// never moves, and a sequence queued that way is lost when the process exits.
				const opened = record();
				expect(opened).toContain("\x1bPtmux;\x1b\x1b[22;0t\x1b\\");
				// Nothing was flushed or awaited, and blessed's deferred title has not landed.
				expect(opened).not.toContain("Acme Website - Board");

				reset();
				screen.destroy();

				const closed = record();
				expect(closed).toContain("\x1bPtmux;\x1b\x1b]0;\x07\x1b\\");
				expect(closed).toContain("\x1bPtmux;\x1b\x1b[23;0t\x1b\\");
				expect(closed.indexOf("\x1b]0;\x07")).toBeLessThan(closed.indexOf("\x1b[23;0t"));
				// Each sequence needs its own envelope: the DCS escapes one leading ESC only.
				expect(closed).not.toContain("\x1b]0;\x07\x1b[23;0t");
			});
		});
	});

	it("leaves the window title alone for screens that do not set one", () => {
		captureTerminalWrites((record) => {
			const screen = createScreen({ smartCSR: false });
			screen.destroy();

			const written = record();
			expect(written).not.toContain("\x1b[22;0t");
			expect(written).not.toContain("\x1b[23;0t");
		});
	});

	it("keeps the emitted screen title free of injected escape sequences", () => {
		const screen = createScreen({ smartCSR: false, title: formatTuiTitle("Board", "Acme\u0007\u001b]0;pwned") });
		try {
			expect(screen.title).toBe("Acme]0;pwned - Board");
			expect(hasControlCharacters(String(screen.title))).toBe(false);
		} finally {
			screen.destroy();
		}
	});
});
