/**
 * Lightweight clipboard utility for copying text to the system clipboard.
 * Supports macOS (pbcopy), Windows (clip.exe), and Linux (xclip/wl-copy/xsel),
 * with an OSC 52 escape-sequence fallback so yank still works over SSH in
 * terminals that support it (kitty, WezTerm, iTerm2, ...).
 */

/**
 * Build an OSC 52 sequence that asks the terminal to set the system clipboard.
 * When running inside tmux the sequence must be wrapped in a DCS passthrough
 * (with embedded ESC bytes doubled) so tmux forwards it to the outer terminal.
 */
export function buildOsc52Sequence(text: string, options?: { tmuxPassthrough?: boolean }): string {
	const payload = Buffer.from(text, "utf8").toString("base64");
	const sequence = `\x1b]52;c;${payload}\x07`;
	if (options?.tmuxPassthrough) {
		return `\x1bPtmux;${sequence.replaceAll("\x1b", "\x1b\x1b")}\x1b\\`;
	}
	return sequence;
}

async function pipeToCommand(cmd: string[], text: string): Promise<boolean> {
	try {
		const proc = Bun.spawn(cmd, { stdin: "pipe", stdout: "ignore", stderr: "ignore" });
		proc.stdin.write(text);
		await proc.stdin.end();
		return (await proc.exited) === 0;
	} catch {
		return false;
	}
}

async function copyViaLocalTool(text: string): Promise<boolean> {
	const platform = process.platform;

	if (platform === "darwin") {
		return pipeToCommand(["pbcopy"], text);
	}

	if (platform === "win32") {
		return pipeToCommand(["clip.exe"], text);
	}

	if (platform === "linux") {
		// Try wl-copy first, then xclip, then xsel
		const commands = ["wl-copy", "xclip -selection clipboard", "xsel --clipboard --input"];
		for (const cmdStr of commands) {
			if (await pipeToCommand(cmdStr.split(" "), text)) return true;
		}
	}

	return false;
}

async function copyViaOsc52(text: string): Promise<boolean> {
	const insideTmux = Boolean(process.env.TMUX);
	if (insideTmux) {
		// tmux forwards the buffer to the outer terminal via OSC 52 when
		// set-clipboard is enabled; -w requires tmux >= 3.2.
		if (await pipeToCommand(["tmux", "load-buffer", "-w", "-"], text)) return true;
	}
	try {
		const tty = Bun.file("/dev/tty");
		await Bun.write(tty, buildOsc52Sequence(text, { tmuxPassthrough: insideTmux }));
		return true;
	} catch {
		return false;
	}
}

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (await copyViaLocalTool(text)) return true;
		// No local clipboard tool worked (e.g. over SSH without a display):
		// ask the terminal itself to set the clipboard.
		return await copyViaOsc52(text);
	} catch (error) {
		if (process.env.DEBUG) {
			console.error("Clipboard copy failed:", error);
		}
		return false;
	}
}
