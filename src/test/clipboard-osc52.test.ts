import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { constants } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLIPBOARD_PATH = resolve(import.meta.dir, "../utils/clipboard.ts");
const itUnix = process.platform === "win32" ? it.skip : it;
let testDir: string;

beforeEach(async () => {
	testDir = await mkdtemp(join(tmpdir(), "backlog-clipboard-"));
	await mkdir(join(testDir, "bin"));
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

async function stubCommand(name: string, exitCode: number): Promise<void> {
	const path = join(testDir, "bin", name);
	await writeFile(
		path,
		`#!/bin/sh
printf '%s %s\\n' '${name}' "$*" >> "$CLIPBOARD_COMMANDS"
/bin/cat > "$CLIPBOARD_INPUT/${name}"
printf 'native-stderr\\n' >&2
exit ${exitCode}
`,
	);
	await chmod(path, 0o755);
}

async function runCopy({
	platform = "darwin",
	text = "BACK-123",
	pty = true,
	tmux = "",
	debug = "",
	setup = "",
} = {}): Promise<{
	result: { copied: boolean; observations: Record<string, unknown> };
	output: string;
	terminal: string;
}> {
	const outputPath = join(testDir, "stdout");
	const source = `
import { spyOn } from "bun:test";
import * as fs from "node:fs/promises";
import { closeSync, constants, openSync, writeSync } from "node:fs";
Object.defineProperty(process, "platform", { value: ${JSON.stringify(platform)} });
const observations = {};
${setup}
const { copyToClipboard } = await import(${JSON.stringify(CLIPBOARD_PATH)});
const copied = await copyToClipboard(${JSON.stringify(text)});
console.log("ordinary-output");
console.log(JSON.stringify({ copied, observations }));
try {
  const fd = openSync("/dev/tty", constants.O_WRONLY);
  writeSync(fd, "__COPY_DONE__");
  closeSync(fd);
} catch {}
`;
	let terminal = "";
	const child = Bun.spawn(["/bin/sh", "-c", 'exec "$@" > "$CLIPBOARD_STDOUT"', "sh", process.execPath, "-e", source], {
		env: {
			...process.env,
			PATH: join(testDir, "bin"),
			TMUX: tmux,
			DEBUG: debug,
			CLIPBOARD_STDOUT: outputPath,
			CLIPBOARD_COMMANDS: join(testDir, "commands"),
			CLIPBOARD_INPUT: testDir,
		},
		detached: !pty,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		...(pty
			? {
					terminal: {
						data: (_terminal: Bun.Terminal, data: Uint8Array) => {
							terminal += new TextDecoder().decode(data);
						},
					},
				}
			: {}),
	});
	const timeout = setTimeout(() => child.kill(), 5_000);
	try {
		const exitCode = await child.exited;
		if (pty) {
			const deadline = Date.now() + 1_000;
			while (!terminal.includes("__COPY_DONE__") && Date.now() < deadline) await Bun.sleep(5);
			expect(terminal).toContain("__COPY_DONE__");
		} else if (child.stderr) {
			terminal = await new Response(child.stderr).text();
		}
		expect(exitCode).toBe(0);
		const output = await readFile(outputPath, "utf8");
		expect(output).toStartWith("ordinary-output\n");
		expect(output).not.toContain("\x1b");
		return { result: JSON.parse(output.split("\n")[1] ?? ""), output, terminal };
	} finally {
		clearTimeout(timeout);
		child.kill();
		child.terminal?.close();
	}
}

describe("copyToClipboard", () => {
	itUnix("keeps native success first and does not open a terminal or invoke tmux", async () => {
		await stubCommand("pbcopy", 0);
		await stubCommand("tmux", 0);
		const { result, terminal } = await runCopy({
			tmux: "unused-test-server",
			setup:
				'spyOn(fs, "open").mockImplementation(async () => { observations.opened = true; throw new Error("unexpected open"); });',
		});
		expect(result).toEqual({ copied: true, observations: {} });
		expect(terminal).not.toContain("\x1b");
		expect(terminal).toContain("native-stderr");
		expect(await readFile(join(testDir, "pbcopy"), "utf8")).toBe("BACK-123");
		expect(await readFile(join(testDir, "commands"), "utf8")).toBe("pbcopy \n");
	});

	itUnix("tries Linux native tools in order and stops when one succeeds", async () => {
		await stubCommand("wl-copy", 1);
		await stubCommand("xclip", 0);
		await stubCommand("xsel", 0);
		const { result, terminal } = await runCopy({ platform: "linux" });
		expect(result.copied).toBe(true);
		expect(await readFile(join(testDir, "commands"), "utf8")).toBe("wl-copy \nxclip -selection clipboard\n");
		expect(terminal).not.toContain("\x1b");
	});

	itUnix("keeps the Windows native command and its input", async () => {
		await stubCommand("clip.exe", 0);
		const { result, terminal } = await runCopy({ platform: "win32" });
		expect(result.copied).toBe(true);
		expect(await readFile(join(testDir, "clip.exe"), "utf8")).toBe("BACK-123");
		expect(terminal).not.toContain("\x1b");
	});

	itUnix("writes the clipboard request to the controlling terminal after native failure", async () => {
		await stubCommand("pbcopy", 1);
		const { result, terminal } = await runCopy();
		expect(result.copied).toBe(true);
		expect(terminal).toContain("\x1b]52;c;QkFDSy0xMjM=\x07");
		expect(terminal.split("\x1b]52;")).toHaveLength(2);
	});

	itUnix("falls back after a missing native tool and preserves DEBUG diagnostics", async () => {
		const { result, terminal } = await runCopy({ text: "täsk ✓", debug: "1" });
		expect(result.copied).toBe(true);
		expect(terminal).toContain("Clipboard copy failed:");
		expect(terminal).toContain("\x1b]52;c;dMOkc2sg4pyT\x07");
	});

	itUnix("returns false without a controlling terminal, even when TMUX is set", async () => {
		await stubCommand("pbcopy", 1);
		await stubCommand("tmux", 0);
		const { result, terminal } = await runCopy({ pty: false, tmux: "unused-test-server" });
		expect(result.copied).toBe(false);
		expect(terminal).not.toContain("\x1b");
		expect(await readFile(join(testDir, "commands"), "utf8")).toBe("pbcopy \n");
	});

	itUnix("does not create or truncate files when opening the terminal fails", async () => {
		const { result } = await runCopy({
			setup:
				'spyOn(fs, "open").mockImplementation(async (path, flags) => { observations.path = path; observations.flags = flags; throw new Error("open failed"); });',
		});
		expect(result).toEqual({ copied: false, observations: { path: "/dev/tty", flags: constants.O_WRONLY } });
		expect((await readdir(testDir)).sort()).toEqual(["bin", "stdout"]);
	});

	itUnix("rejects a non-terminal file and closes it without changing its content", async () => {
		await writeFile(join(testDir, "sentinel"), "keep this");
		const { result, terminal } = await runCopy({
			setup: `const realOpen = fs.open;
spyOn(fs, "open").mockImplementation(async (_path, flags) => {
  const file = await realOpen(${JSON.stringify(join(testDir, "sentinel"))}, flags);
  const close = file.close.bind(file);
  file.close = async () => { observations.closed = true; await close(); };
  return file;
});`,
		});
		expect(result).toEqual({ copied: false, observations: { closed: true } });
		expect(await readFile(join(testDir, "sentinel"), "utf8")).toBe("keep this");
		expect(terminal).not.toContain("\x1b");
	});

	itUnix("returns false and closes the terminal when writing fails", async () => {
		const { result, terminal } = await runCopy({
			setup: `const realOpen = fs.open;
spyOn(fs, "open").mockImplementation(async (...args) => {
  const terminal = await realOpen(...args);
  const close = terminal.close.bind(terminal);
  terminal.writeFile = async () => { throw new Error("write failed"); };
  terminal.close = async () => { observations.closed = true; await close(); };
  return terminal;
});`,
		});
		expect(result).toEqual({ copied: false, observations: { closed: true } });
		expect(terminal).not.toContain("\x1b");
	});
});
