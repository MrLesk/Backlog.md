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
	console.warn(`[tui-ready-filter] Skipping interactive --ready render test: ${skipReason}`);
}
const itInteractive = skipReason ? it.skip : it;

function buildSpawnCommand(cliArgs: string[]): string {
	const argsSegment = cliArgs.map((arg) => `"${arg}"`).join(" ");
	if (CLI_RUNTIME.length === 0) {
		return `spawn {${CLI_PATH}} ${argsSegment}`;
	}
	return `spawn {${CLI_RUNTIME}} {${CLI_PATH}} ${argsSegment}`;
}

describe("interactive task list --ready", () => {
	itInteractive(
		"filters blocked tasks out of the very first render",
		async () => {
			const testDir = createUniqueTestDir("tui-ready-filter");
			await mkdir(testDir, { recursive: true });
			await mkdir(TRANSCRIPT_DIR, { recursive: true });
			const transcriptPath = join(TRANSCRIPT_DIR, `ready-filter-${Date.now()}.log`);
			const expectScriptPath = join(testDir, "ready-filter.expect");

			try {
				await $`git init -b main`.cwd(testDir).quiet();
				const core = new Core(testDir);
				await initializeTestProject(core, "Ready Filter");

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
				// The blocker carries High priority so the unfiltered list would sort it first: if the
				// initial render skips the readiness filter, this title reaches the terminal before any
				// ready task does.
				await core.createTask({ ...baseTask, id: "task-1", title: "Zulu Blocker", status: "In Progress" }, false);
				await core.createTask(
					{
						...baseTask,
						id: "task-2",
						title: "Zulu Blocked",
						status: "To Do",
						priority: "high",
						dependencies: ["task-1"],
					},
					false,
				);
				await core.createTask(
					{ ...baseTask, id: "task-3", title: "Alpha Ready", status: "To Do", priority: "low", dependencies: [] },
					false,
				);

				await writeFile(
					expectScriptPath,
					`#!/usr/bin/expect -f
set timeout 30
log_user 0
log_file -a {${transcriptPath}}
set env(NO_COLOR) {1}
set env(TERM) {xterm-256color}
${buildSpawnCommand(["task", "list", "--ready"])}
expect {
	-re {Zulu Blocked} { exit 92 }
	-re {Alpha Ready} {}
	timeout { exit 91 }
}
send "q"
expect eof
exit 0
`,
				);

				const child = Bun.spawn([EXPECT_PATH as string, "-f", expectScriptPath], {
					cwd: testDir,
					stdout: "pipe",
					stderr: "pipe",
					env: { ...process.env, NO_COLOR: "1" },
				});
				const stdout = child.stdout ? await new Response(child.stdout).text() : "";
				const stderr = child.stderr ? await new Response(child.stderr).text() : "";
				const exitCode = await child.exited;

				if (exitCode === 92) {
					throw new Error(
						`The first interactive render listed the blocked task, so --ready was not applied.\nTranscript: ${transcriptPath}`,
					);
				}
				if (exitCode !== 0) {
					throw new Error(
						`Interactive --ready render failed with ${exitCode}.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
					);
				}
				expect(exitCode).toBe(0);
			} finally {
				await safeCleanup(testDir);
			}
		},
		60_000,
	);
});
