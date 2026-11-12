import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const expectPath = Bun.which("expect");
const enabled = process.env.RUN_INTERACTIVE_TUI_TESTS === "1" && process.platform !== "win32" && expectPath;
const interactive = enabled ? it : it.skip;
const cliPath = process.env.TUI_TEST_CLI_PATH?.trim() || getTestCliPath();
const runtime = process.env.TUI_TEST_CLI_RUNTIME?.trim() ?? "bun";
const command = runtime ? [runtime, cliPath] : [cliPath];
const views = [
	{ name: "overview", args: ["overview"], marker: "Project Overview" },
	{ name: "document list", args: ["doc", "list"], marker: "Select a document" },
	{ name: "document viewer", args: ["doc", "view", "doc-1"], marker: "Document body marker" },
];
let projectDir: string;
let core: Core;

async function session(args: string[], marker: string, steps: string): Promise<void> {
	// Terminal output may encode spaces as cursor movement between the visible words.
	const script = join(projectDir, "quit.expect");
	await writeFile(
		script,
		`set timeout 5
set env(TERM) xterm-256color
set stty_init "rows 40 columns 120"
spawn ${[...command, ...args].map((word) => `{${word}}`).join(" ")}
expect {
	-re {${marker.replaceAll(" ", ".*")}} {}
	timeout { exit 91 }
	eof { exit 92 }
}
${steps}
set result [wait]
exit [lindex $result 3]
`,
	);
	const child = Bun.spawn([expectPath as string, "-f", script], {
		cwd: projectDir,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(code, `${args.join(" ")}\n${stdout}\n${stderr}`).toBe(0);
}

const waitForPrompt = `expect {
	-re {Quit.*Backlog[.]md[?]} {}
	timeout { exit 93 }
	eof { exit 94 }
}`;
const waitForExit = `expect {
	eof {}
	timeout { exit 95 }
}`;

describe("quit confirmation in overview and document browsing", () => {
	beforeEach(async () => {
		if (!enabled) return;
		projectDir = createUniqueTestDir("quit-confirmation-pty");
		await mkdir(projectDir, { recursive: true });
		core = new Core(projectDir);
		await initializeFilesystemTestProject(core, "Quit confirmation");
		await core.createDocument({
			id: "doc-1",
			title: "Example document",
			type: "guide",
			createdDate: "2026-11-11",
			rawContent: "Document body marker",
		});
	});

	afterEach(async () => {
		if (enabled) await safeCleanup(projectDir);
	});

	for (const view of views) {
		interactive(`${view.name}: quit keys prompt, cancellation restores input, and confirmation exits`, async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Missing fixture config");
			await core.filesystem.saveConfig({ ...config, confirmExit: true });
			for (const key of ["q", "\\033", "\\003"]) {
				await session(
					view.args,
					view.marker,
					`send "${key}"
${waitForPrompt}
send "\\033"
after 100
send "q"
${waitForPrompt}
send "\\t\\r"
after 100
send "q"
${waitForPrompt}
send "${key === "\\033" ? "\\r" : key}"
${waitForExit}`,
				);
			}
		});

		for (const setting of [false, undefined]) {
			interactive(`${view.name}: exits immediately when confirmExit is ${setting}`, async () => {
				const config = await core.filesystem.loadConfig();
				if (!config) throw new Error("Missing fixture config");
				await core.filesystem.saveConfig({ ...config, confirmExit: setting });
				for (const key of ["q", "\\033", "\\003"]) {
					await session(
						view.args,
						view.marker,
						`send "${key}"
expect {
	-re {Quit.*Backlog[.]md[?]} { exit 96 }
	eof {}
	timeout { exit 95 }
}`,
					);
				}
			});
		}
	}

	interactive("selecting a document opens its viewer without a quit prompt", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing fixture config");
		await core.filesystem.saveConfig({ ...config, confirmExit: true });
		await session(
			["doc", "list"],
			"Select a document",
			`send "\\r"
expect {
	-re {Quit.*Backlog[.]md[?]} { exit 96 }
	-re {Document.*body.*marker} {}
	eof { exit 94 }
	timeout { exit 95 }
}
send "q"
${waitForPrompt}
send "\\r"
${waitForExit}`,
		);
	});
});
