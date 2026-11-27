import { describe, expect, it } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const TMUX_PATH = Bun.which("tmux");
const tmuxVersion = TMUX_PATH
	? Bun.spawnSync([TMUX_PATH, "-V"])
			.stdout.toString()
			.match(/tmux (\d+)\.(\d+)/)
	: null;
const supportsPassthroughOption =
	Number(tmuxVersion?.[1]) > 3 || (Number(tmuxVersion?.[1]) === 3 && Number(tmuxVersion?.[2]) >= 3);
const itTmux = process.platform === "win32" || !supportsPassthroughOption ? it.skip : it;
const CLIPBOARD_PATH = resolve(import.meta.dir, "../utils/clipboard.ts");

async function waitFor(check: () => boolean | Promise<boolean>): Promise<void> {
	const deadline = Date.now() + 5_000;
	while (!(await check())) {
		if (Date.now() >= deadline) throw new Error("Timed out waiting for the isolated tmux test");
		await Bun.sleep(10);
	}
}

async function runTmuxCopy(passthrough: boolean, allowPassthrough = true): Promise<void> {
	const testDir = await mkdtemp(join(tmpdir(), "backlog-tmux-"));
	const socket = join(testDir, "socket");
	const binDir = join(testDir, "bin");
	const config = join(testDir, "tmux.conf");
	const start = join(testDir, "start");
	const result = join(testDir, "result");
	const runner = join(testDir, "copy.ts");
	const commandLog = join(testDir, "commands");
	const nativeLog = join(testDir, "native-commands");
	let terminal = "";
	let passed = false;
	let child: ReturnType<typeof Bun.spawn> | undefined;
	const env = {
		...process.env,
		TMUX: "",
		TERM: "xterm-256color",
		PATH: binDir,
		DEBUG: "",
		CLIPBOARD_TMUX: TMUX_PATH ?? "",
		CLIPBOARD_SOCKET: socket,
		CLIPBOARD_COMMANDS: commandLog,
		CLIPBOARD_NATIVE_LOG: nativeLog,
	};
	try {
		await mkdir(binDir);
		// Every native tool fails; no test process can reach the user's clipboard.
		for (const name of ["pbcopy", "wl-copy", "xclip", "xsel"]) {
			await writeFile(
				join(binDir, name),
				`#!/bin/sh\nprintf '%s\\n' '${name}' >> "$CLIPBOARD_NATIVE_LOG"\n/bin/cat > /dev/null\nexit 1\n`,
			);
			await chmod(join(binDir, name), 0o755);
		}
		await writeFile(
			join(binDir, "tmux"),
			`#!/bin/sh
printf '%s\\n' "$*" >> "$CLIPBOARD_COMMANDS"
${passthrough ? "exit 1" : 'exec "$CLIPBOARD_TMUX" -S "$CLIPBOARD_SOCKET" "$@"'}
`,
		);
		await chmod(join(binDir, "tmux"), 0o755);
		await writeFile(
			config,
			`set -g status off
set -g default-shell /bin/sh
set -g remain-on-exit on
set -s set-clipboard external
set -as terminal-features ',xterm*:clipboard'
set -g allow-passthrough ${allowPassthrough ? "on" : "off"}
`,
		);
		await writeFile(
			runner,
			`import { copyToClipboard } from ${JSON.stringify(CLIPBOARD_PATH)};
import { join } from "node:path";
// Check resolution, then pass an absolute stub path so real clipboard tools are unreachable.
const spawn = Bun.spawn;
Bun.spawn = (command, options) => {
  const name = command[0];
  if (!["pbcopy", "wl-copy", "xclip", "xsel", "tmux"].includes(name)) throw new Error("Unexpected command");
  const stub = join(${JSON.stringify(binDir)}, name);
  if (Bun.which(name) !== stub) throw new Error("Unsafe command resolution: " + name);
  return spawn([stub, ...command.slice(1)], options);
};
const deadline = Date.now() + 5000;
while (!(await Bun.file(${JSON.stringify(start)}).exists())) {
  if (Date.now() > deadline) process.exit(2);
  await Bun.sleep(10);
}
const copied = await copyToClipboard("BACK-703");
await Bun.write(${JSON.stringify(result)}, JSON.stringify({ copied, tmux: process.env.TMUX, path: process.env.PATH }));
console.log("__TMUX_COPY_DONE__");
`,
		);
		child = Bun.spawn(
			[TMUX_PATH as string, "-S", socket, "-f", config, "new-session", "-s", "clipboard", process.execPath, runner],
			{
				env,
				terminal: {
					data(_terminal, data) {
						terminal += new TextDecoder().decode(data);
					},
				},
			},
		);
		// The attached client must be initialized before load-buffer sends its request.
		await waitFor(() => terminal.includes("\x1b["));
		await writeFile(start, "start");
		await waitFor(() => terminal.includes("__TMUX_COPY_DONE__"));
		const response = JSON.parse(await readFile(result, "utf8"));
		expect(response.path).toBe(binDir);
		expect(response.tmux).toContain(socket);
		expect(response.copied).toBe(true);
		expect(await readFile(commandLog, "utf8")).toBe("load-buffer -w -\n");
		expect(await readFile(nativeLog, "utf8")).toBe(
			process.platform === "darwin" ? "pbcopy\n" : "wl-copy\nxclip\nxsel\n",
		);
		if (!allowPassthrough) {
			expect(terminal).not.toContain("\x1b]52;");
		} else {
			// tmux chooses the selection parameter; decode the independently captured payload.
			const requests = terminal.split("\x1b]52;").slice(1);
			expect(requests).toHaveLength(1);
			const payload = requests[0]?.split(";")[1]?.split("\x07")[0]?.split("\x1b\\")[0] ?? "";
			expect(Buffer.from(payload, "base64").toString("utf8")).toBe("BACK-703");
			if (passthrough) {
				expect(terminal).toContain("\x1b]52;c;QkFDSy03MDM=\x07");
				expect(terminal).not.toContain("\x1bPtmux;");
			}
		}
		passed = true;
	} finally {
		// The explicit socket ensures cleanup cannot touch an existing tmux server.
		const cleanup = Bun.spawn([TMUX_PATH as string, "-S", socket, "kill-server"], {
			env,
			stdout: "ignore",
			stderr: "ignore",
		});
		await cleanup.exited;
		child?.kill();
		child?.terminal?.close();
		if (passed) {
			await rm(testDir, { recursive: true, force: true });
		} else {
			await writeFile(join(testDir, "outer-terminal.bin"), terminal);
			console.warn(`Isolated tmux failure traces preserved at ${testDir}`);
		}
	}
}

describe("copyToClipboard through tmux", () => {
	itTmux("forwards load-buffer -w to the captured outer terminal", async () => {
		await runTmuxCopy(false);
	});

	itTmux("forwards DCS passthrough after the tmux command fails", async () => {
		await runTmuxCopy(true);
	});

	itTmux("cannot confirm clipboard delivery when tmux rejects passthrough", async () => {
		await runTmuxCopy(true, false);
	});
});
