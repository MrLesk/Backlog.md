import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isatty } from "node:tty";

/**
 * Lightweight clipboard utility for copying text to the system clipboard.
 * Tries native tools first, then asks the controlling terminal through OSC 52.
 * A successful request does not confirm that the terminal changed the clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	if (await copyViaLocalTool(text)) return true;

	try {
		// Do not create or truncate a file when no controlling terminal is available.
		const terminal = await open("/dev/tty", constants.O_WRONLY);
		try {
			if (!isatty(terminal.fd)) return false;

			const insideTmux = Boolean(process.env.TMUX);
			if (insideTmux) {
				try {
					// tmux 3.2+ can send to an attached client's terminal if it supports OSC 52.
					const proc = Bun.spawn(["tmux", "load-buffer", "-w", "-"], {
						stdin: "pipe",
						stdout: "ignore",
						stderr: "ignore",
					});
					proc.stdin.write(text);
					await proc.stdin.end();
					if ((await proc.exited) === 0) return true;
				} catch {}
			}

			const sequence = `\x1b]52;c;${Buffer.from(text, "utf8").toString("base64")}\x07`;
			// tmux passthrough requires allow-passthrough and doubles embedded ESC bytes.
			await terminal.writeFile(insideTmux ? `\x1bPtmux;${sequence.replaceAll("\x1b", "\x1b\x1b")}\x1b\\` : sequence);
			return true;
		} finally {
			await terminal.close();
		}
	} catch {
		return false;
	}
}

async function copyViaLocalTool(text: string): Promise<boolean> {
	try {
		const platform = process.platform;

		if (platform === "darwin") {
			const proc = Bun.spawn(["pbcopy"], {
				stdin: "pipe",
			});
			proc.stdin.write(text);
			await proc.stdin.end();
			return (await proc.exited) === 0;
		}

		if (platform === "win32") {
			const proc = Bun.spawn(["clip.exe"], {
				stdin: "pipe",
			});
			proc.stdin.write(text);
			await proc.stdin.end();
			return (await proc.exited) === 0;
		}

		if (platform === "linux") {
			// Try wl-copy first, then xclip, then xsel
			const commands = ["wl-copy", "xclip -selection clipboard", "xsel --clipboard --input"];
			for (const cmdStr of commands) {
				const cmd = cmdStr.split(" ");
				try {
					const proc = Bun.spawn(cmd, {
						stdin: "pipe",
					});
					proc.stdin.write(text);
					await proc.stdin.end();
					if ((await proc.exited) === 0) return true;
				} catch {}
			}
		}

		return false;
	} catch (error) {
		if (process.env.DEBUG) {
			console.error("Clipboard copy failed:", error);
		}
		return false;
	}
}
