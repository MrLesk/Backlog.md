import { describe, expect, it } from "bun:test";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const EXPECT_PATH = Bun.which("expect");
const RUN_INTERACTIVE_TUI_TESTS = process.env.RUN_INTERACTIVE_TUI_TESTS === "1";

const skipReason =
	process.platform === "win32"
		? "interactive PTY tests require a Unix-like environment"
		: !RUN_INTERACTIVE_TUI_TESTS
			? "set RUN_INTERACTIVE_TUI_TESTS=1 to enable interactive PTY tests"
			: !EXPECT_PATH
				? "expect is not installed"
				: null;

if (skipReason) {
	console.warn(`[cli-init-cursor-pty] Skipping Cursor init PTY test: ${skipReason}`);
}
const itInteractive = skipReason ? it.skip : it;

describe("Cursor init PTY behavior", () => {
	itInteractive("uses AGENTS.md and completes without opening an editor", async () => {
		const testDir = createUniqueTestDir("cli-init-cursor-pty");
		await mkdir(testDir, { recursive: true });
		const editorMarkerPath = join(testDir, "editor-opened.txt");
		const editorScriptPath = join(testDir, "fail-editor.sh");
		const expectScriptPath = join(testDir, "cursor-init.expect");

		try {
			await $`git init -b main`.cwd(testDir).quiet();
			await $`git config user.name "Test User"`.cwd(testDir).quiet();
			await $`git config user.email test@example.com`.cwd(testDir).quiet();
			await writeFile(editorScriptPath, `#!/bin/sh\nprintf 'opened\\n' > '${editorMarkerPath}'\nexit 97\n`);
			await chmod(editorScriptPath, 0o755);
			await writeFile(
				expectScriptPath,
				`#!/usr/bin/expect -f
set timeout 20
log_user 0
set env(NO_COLOR) {1}
set env(EDITOR) {${editorScriptPath}}
set env(VISUAL) {${editorScriptPath}}
spawn {bun} {${CLI_PATH}} init {CursorPty} --defaults --agent-instructions cursor
expect {
	-re {Initialization Summary} {}
	timeout { exit 91 }
}
expect eof
set wait_status [wait]
set exit_code [lindex $wait_status 3]
exit $exit_code
`,
			);

			const child = Bun.spawn([EXPECT_PATH as string, "-f", expectScriptPath], {
				cwd: testDir,
				stdout: "pipe",
				stderr: "pipe",
			});
			const stdoutPromise = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
			const stderrPromise = child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
			const exitCode = await child.exited;
			const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
			if (exitCode !== 0) {
				throw new Error(`Cursor init PTY failed with ${exitCode}.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
			}

			expect(await Bun.file(join(testDir, "AGENTS.md")).exists()).toBe(true);
			expect(await Bun.file(editorMarkerPath).exists()).toBe(false);
			expect(await Bun.file(join(testDir, ".cursorrules")).exists()).toBe(false);
			expect(await Bun.file(join(testDir, ".cursor", "rules", "backlog.mdc")).exists()).toBe(false);
		} finally {
			await safeCleanup(testDir);
		}
	});
});
