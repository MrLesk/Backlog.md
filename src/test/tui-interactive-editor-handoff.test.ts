import { describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = process.env.TUI_TEST_CLI_PATH?.trim() || join(process.cwd(), "src", "cli.ts");
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
	console.warn(`[tui-interactive] Skipping interactive editor handoff tests: ${skipReason}`);
}
const itInteractive = skipReason ? it.skip : it;

interface InteractiveEditRunOptions {
	scenario: string;
	cliArgs: string[];
	taskTitle: string;
	readyPattern: string;
}

interface InteractiveEditRunResult {
	taskContent: string;
	transcriptPath: string;
	editorMarker: string;
	editorInputLog: string;
}

function buildSpawnCommand(cliArgs: string[]): string {
	const argsSegment = cliArgs.map((arg) => `"${arg}"`).join(" ");
	if (CLI_RUNTIME.length === 0) {
		return `spawn {${CLI_PATH}} ${argsSegment}`;
	}
	return `spawn {${CLI_RUNTIME}} {${CLI_PATH}} ${argsSegment}`;
}

async function runInteractiveEditScenario(options: InteractiveEditRunOptions): Promise<InteractiveEditRunResult> {
	const testDir = createUniqueTestDir(`test-tui-interactive-${options.scenario}`);
	await mkdir(testDir, { recursive: true });
	await mkdir(TRANSCRIPT_DIR, { recursive: true });

	const transcriptPath = join(TRANSCRIPT_DIR, `${options.scenario}-${Date.now()}.log`);
	const editorMarkerPath = join(testDir, `${options.scenario}-editor-marker.txt`);
	const editorInputPath = join(testDir, `${options.scenario}-editor-input.log`);
	const editorScriptPath = join(testDir, `${options.scenario}-editor.cjs`);
	const expectScriptPath = join(testDir, `${options.scenario}.expect`);

	await writeFile(
		editorScriptPath,
		`const { appendFileSync, createReadStream } = require("node:fs");

const taskFile = process.argv[2];
const markerFile = process.env.TUI_EDITOR_MARKER_FILE;
const keyLogFile = process.env.TUI_EDITOR_KEY_LOG_FILE;

if (markerFile) {
	appendFileSync(markerFile, "started\\n");
}
if (taskFile) {
	appendFileSync(taskFile, "\\nEdited in interactive TUI test\\n");
}

let input = process.stdin;
if (!input.isTTY) {
	try {
		input = createReadStream("/dev/tty");
	} catch {}
}
if (input.isTTY && typeof input.setRawMode === "function") {
	input.setRawMode(true);
}
input.resume();
input.on("data", (chunk) => {
	if (!keyLogFile) {
		return;
	}
	const bytes = Array.from(chunk.values());
	appendFileSync(keyLogFile, \`DATA:\${bytes.join(",")}\\n\`);
});
process.stdout.write("__EDITOR_READY__\\n");

setTimeout(() => {
	process.exit(0);
}, 1200);
`,
	);

	await $`git init -b main`.cwd(testDir).quiet();
	await $`git config user.email test@example.com`.cwd(testDir).quiet();
	await $`git config user.name "Test User"`.cwd(testDir).quiet();

	const core = new Core(testDir);
	await core.initializeProject(`Interactive ${options.scenario}`);

	const config = await core.filesystem.loadConfig();
	if (!config) {
		throw new Error(`Failed to load config for scenario ${options.scenario}`);
	}

	const updatedConfig: BacklogConfig = {
		...config,
		remoteOperations: false,
		checkActiveBranches: false,
		defaultEditor: `node ${editorScriptPath}`,
	};
	await core.filesystem.saveConfig(updatedConfig);

	const task: Task = {
		id: "task-1",
		title: options.taskTitle,
		status: "To Do",
		assignee: [],
		createdDate: "2026-02-11 00:00",
		labels: [],
		dependencies: [],
		description: "TUI interactive editor test",
	};
	await core.createTask(task, false);

	await writeFile(
		expectScriptPath,
		`#!/usr/bin/expect -f
set timeout 20
log_user 0
log_file -a {${transcriptPath}}
set env(TERM) {xterm-256color}
set env(COLUMNS) {120}
set env(LINES) {40}
set env(NO_COLOR) {1}
set env(EDITOR) {node ${editorScriptPath}}
set env(TUI_EDITOR_MARKER_FILE) {${editorMarkerPath}}
set env(TUI_EDITOR_KEY_LOG_FILE) {${editorInputPath}}
${buildSpawnCommand(options.cliArgs)}
expect {
	-re {${options.readyPattern}} {}
	timeout { exit 91 }
}
sleep 0.5
send -- "E"
expect {
	-re {__EDITOR_READY__} {}
	timeout { exit 92 }
}
send -- "\\033\\[A"
sleep 0.2
send -- "q"
sleep 1.0
send -- "q"
sleep 2.0
send -- "\\003"
expect eof
set wait_status [wait]
set exit_code [lindex $wait_status 3]
exit $exit_code
`,
	);

	const child = Bun.spawn(["expect", "-f", expectScriptPath], {
		cwd: testDir,
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdoutPromise = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
	const stderrPromise = child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
	const exitCode = await child.exited;
	const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
	const transcript = await Bun.file(transcriptPath)
		.text()
		.catch(() => "(no transcript captured)");

	try {
		expect([0, 130]).toContain(exitCode);
	} catch (_error) {
		throw new Error(
			`Interactive CLI run failed for ${options.scenario}.\n` +
				`Exit code: ${exitCode}\n` +
				`STDOUT:\n${stdout}\n` +
				`STDERR:\n${stderr}\n` +
				`Transcript: ${transcriptPath}\n` +
				`Transcript contents:\n${transcript}\n`,
		);
	}

	const markerContent = await readFile(editorMarkerPath, "utf8").catch(() => "");
	const editorInputLog = await readFile(editorInputPath, "utf8").catch(() => "");
	const taskContent = await core.getTaskContent("task-1");

	await safeCleanup(testDir);
	return {
		taskContent: taskContent || "",
		transcriptPath,
		editorMarker: markerContent,
		editorInputLog,
	};
}

describe("interactive TUI editor handoff", () => {
	itInteractive("launches terminal editor from board view and marks task updated", async () => {
		const result = await runInteractiveEditScenario({
			scenario: "board",
			cliArgs: ["board"],
			taskTitle: "Board interactive editor task",
			readyPattern: "Backlog Board",
		});

		expect(result.editorMarker).toContain("started");
		expect(result.editorInputLog).toContain("DATA:27,91,65");
		expect(result.taskContent).toContain("Edited in interactive TUI test");
		expect(result.transcriptPath).toContain("tui-interactive-transcripts");
	});

	itInteractive("launches terminal editor from task list view and marks task updated", async () => {
		const result = await runInteractiveEditScenario({
			scenario: "task-list",
			cliArgs: ["task", "list"],
			taskTitle: "Task list interactive editor task",
			readyPattern: "Tasks",
		});

		expect(result.editorMarker).toContain("started");
		expect(result.editorInputLog).toContain("DATA:27,91,65");
		expect(result.taskContent).toContain("Edited in interactive TUI test");
		expect(result.transcriptPath).toContain("tui-interactive-transcripts");
	});
});
