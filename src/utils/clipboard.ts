/**
 * Lightweight clipboard utility for copying text to the system clipboard.
 * Supports macOS (pbcopy), Windows (clip.exe), and Linux (xclip/wl-copy/xsel).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
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
