import { describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = process.env.TUI_TEST_CLI_PATH?.trim() || getTestCliPath();
const CLI_RUNTIME = process.env.TUI_TEST_CLI_RUNTIME?.trim() ?? "bun";
const TRANSCRIPT_DIR = join(process.cwd(), "tmp", "tui-interactive-transcripts");
const EXPECT_PATH = Bun.which("expect");
const RUN_INTERACTIVE_TUI_TESTS = process.env.RUN_INTERACTIVE_TUI_TESTS === "1";

function getSkipReason(): string | null {
	if (process.platform === "win32") {
		return "interactive PTY tests require a Unix-like environment";
	}
	if (!RUN_INTERACTIVE_TUI_TESTS) {
		return "set RUN_INTERACTIVE_TUI_TESTS=1 to enable interactive PTY tests";
	}
	if (!EXPECT_PATH) {
		return "expect is not installed";
	}
	return null;
}

const skipReason = getSkipReason();
if (skipReason) {
	console.warn(`[board-multi-move] Skipping interactive board move test: ${skipReason}`);
}
const itInteractive = skipReason ? it.skip : it;

function buildSpawnCommand(cliArgs: string[]): string {
	const argsSegment = cliArgs.map((arg) => `"${arg}"`).join(" ");
	if (CLI_RUNTIME.length === 0) {
		return `spawn {${CLI_PATH}} ${argsSegment}`;
	}
	return `spawn {${CLI_RUNTIME}} {${CLI_PATH}} ${argsSegment}`;
}

describe("interactive board multi-select move", () => {
	itInteractive(
		"walks the highlight with real xterm shift-arrows and recruits the task the fallback cannot reach",
		async () => {
			const testDir = createUniqueTestDir("board-multi-move");
			await mkdir(testDir, { recursive: true });
			await mkdir(TRANSCRIPT_DIR, { recursive: true });
			const transcriptPath = join(TRANSCRIPT_DIR, `board-multi-move-${Date.now()}.log`);
			const expectScriptPath = join(testDir, "board-multi-move.expect");

			try {
				await $`git init -b main`.cwd(testDir).quiet();
				const core = new Core(testDir);
				await initializeTestProject(core, "Board Multi Move");

				const config = await core.filesystem.loadConfig();
				if (!config) throw new Error("Failed to load config");
				const updatedConfig: BacklogConfig = { ...config, remoteOperations: false, checkActiveBranches: false };
				await core.filesystem.saveConfig(updatedConfig);

				const baseTask = {
					assignee: [],
					labels: [],
					createdDate: "2026-08-08",
					rawContent: "",
					dependencies: [] as string[],
				};
				await core.createTask(
					{ ...baseTask, id: "task-1", title: "Grabbed Task", status: "To Do", ordinal: 1000 },
					false,
				);
				await core.createTask(
					{ ...baseTask, id: "task-2", title: "Recruited Task", status: "To Do", ordinal: 2000 },
					false,
				);
				await core.createTask(
					{ ...baseTask, id: "task-3", title: "Bystander Task", status: "To Do", ordinal: 3000 },
					false,
				);

				// The shift-arrow is sent as the raw xterm modified-arrow sequence (ESC [ 1 ; 2 B),
				// exactly what a real terminal emits for Shift+Down.
				await writeFile(
					expectScriptPath,
					`#!/usr/bin/expect -f
set timeout 30
log_user 0
log_file -a {${transcriptPath}}
set env(TERM) {xterm-256color}
# Without a UTF-8 locale blessed downgrades ► and the arrow glyphs to "?".
set env(LANG) {en_US.UTF-8}
${buildSpawnCommand(["board"])}
# Under bun test there is no controlling terminal, so the spawned pty starts sizeless
# and the board would render into a zero-width screen.
exec stty rows 40 columns 160 < $spawn_out(slave,name)
expect {
	-re {Grabbed Task} {}
	timeout { exit 91 }
}
send "m"
expect {
	-re {MOVE MODE} {}
	timeout { exit 92 }
}
send "\\033\\[1;2B"
send "\\033\\[1;2B"
# The buffer pointer sits past the initial render, so "Bystander Task" can only
# reappear when the highlight bar redraws the third row - proof the shift-arrow
# walk itself ran. The M fallback (which targets the row below the grabbed task)
# could never produce this: it would recruit "Recruited Task" instead.
expect {
	-re {Bystander Task} {}
	timeout { exit 93 }
}
send "M"
expect {
	-re {►[^\\n]*Bystander Task} {}
	timeout { exit 94 }
}
send "\\033"
# A pause keeps ESC + q from being read back as one Meta-q chord.
sleep 0.3
send "q"
set timeout 5
expect eof
exit 0
`,
				);

				const child = Bun.spawn([EXPECT_PATH as string, "-f", expectScriptPath], {
					cwd: testDir,
					stdout: "pipe",
					stderr: "pipe",
					env: { ...process.env },
				});
				const stdout = child.stdout ? await new Response(child.stdout).text() : "";
				const stderr = child.stderr ? await new Response(child.stderr).text() : "";
				const exitCode = await child.exited;

				if (exitCode === 91) {
					throw new Error(`The board never rendered the seeded tasks.\nTranscript: ${transcriptPath}`);
				}
				if (exitCode === 92) {
					throw new Error(`Pressing m never entered move mode.\nTranscript: ${transcriptPath}`);
				}
				if (exitCode === 93) {
					throw new Error(
						`Shift+Down never walked the highlight to the third task, so shift-arrow parsing is broken.\nTranscript: ${transcriptPath}`,
					);
				}
				if (exitCode === 94) {
					throw new Error(`M never marked the highlighted third task with ►.\nTranscript: ${transcriptPath}`);
				}
				if (exitCode !== 0) {
					throw new Error(`Interactive board move failed with ${exitCode}.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
				}
				expect(exitCode).toBe(0);
			} finally {
				await safeCleanup(testDir);
			}
		},
		60_000,
	);
});
